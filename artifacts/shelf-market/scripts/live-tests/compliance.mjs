// Data rights requests and the MLRO's silent account freeze, against the live-mode API.
// Run against the LOCAL dev server only (it relies on the dev sign-in link): node scripts/live-tests/compliance.mjs
const BASE = process.argv[2] ?? "http://localhost:24559";
const RUN = Date.now().toString(36);
let failures = 0;
const check = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) failures++; };
function client() {
  const jar = {};
  const req = async (method, path, body) => {
    const r = await fetch(BASE + path, { method, redirect: "manual", headers: { "Content-Type": "application/json", Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ") }, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const c of r.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar[kv.slice(0, i)] = kv.slice(i + 1); }
    const t = await r.text(); try { return JSON.parse(t); } catch { return { status: r.status }; }
  };
  return { req, act: (n, ...a) => req("POST", `/api/actions/${n}`, { args: a }), state: () => req("GET", "/api/state").then((r) => r.state),
    async signIn(email, name) { const r = await req("POST", "/api/auth/request", { email, name, next: "/", acceptTerms: true }); await req("GET", `/api/auth/verify?token=${new URL(r.devLink).searchParams.get("token")}`); } };
}
const owner = client(), maker = client(), admin = client(), shopper = client(), stranger = client();
await owner.signIn(`co-${RUN}@inraf.test`, "Compliance Owner"); await maker.signIn(`cm-${RUN}@inraf.test`, "Frozen Maker");
await admin.signIn("admin@inraf.test", "InRaf team");
const photo = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";
const shopId = (await owner.act("createShop", { country: "AE", city: "Dubai", business: "4711", width: 2, depth: 2, tiers: 1, categories: ["food", "beauty"], restrictions: [], hue: 12, photos: [{ url: photo, kind: "front" }, { url: photo, kind: "shelf" }], name: "Freeze Test Store", location: "Al Wasl 1", bricks: [0, 1], price: 30 })).id;
await owner.act("updateShop", shopId, { registration: "AE-CR-1" }); await admin.act("setShopStatus", shopId, "approved", "ok");
const start = new Date(Date.now() + 86400e3).toISOString().slice(0, 10);
const c = await maker.act("requestContract", { shopId, slot: 0, holderId: "x", start, months: 6 });
await admin.act("approveContract", c.id, "x"); await owner.act("sign", c.id, "owner", "Owner", false);
const tokenId = (await maker.act("sign", c.id, "holder", "Maker", false)).state.contracts.find((x) => x.id === c.id).tokenId;
const soap = await maker.act("createListing", tokenId, { name: "Freeze soap", sku: "FZ-1", category: "beauty", description: "x", color: "#5E8C61", origin: "AE", retail: 5, cost: 2, taxRate: 5, batch: "B1", initialQty: 20 });
await owner.act("decideListing", soap.id, true, ""); await maker.act("activateListing", soap.id);
const o1 = await owner.act("recordTillSale", soap.id, 2);
check(o1.ok, "before any freeze the store can sell the maker's product");

// ---------- data rights ----------
const anon = await stranger.req("POST", "/api/privacy/requests", { kind: "access", name: "Visitor", email: `dsr-${RUN}@inraf.test`, details: "", confirm: true });
check(anon.ok && /^DSR-\d{5}$/.test(anon.request?.ref), "a visitor files an access request and gets a DSR reference");
const due = (new Date(anon.request.dueAt) - Date.now()) / 86400e3;
check(due > 29 && due < 31, "the answer is due in one month");
check((await stranger.req("POST", "/api/privacy/requests", { kind: "access", name: "V", email: "x@y.zz", confirm: false })).ok === false, "a request without the own-data confirmation is refused");
check((await stranger.req("POST", "/api/privacy/requests", { kind: "rectification", name: "V", email: `dsr-${RUN}@inraf.test`, confirm: true })).ok === false, "a correction request needs details");
check((await stranger.req("POST", "/api/privacy/requests", { kind: "sell-it", name: "V", email: "x@y.zz", confirm: true })).ok === false, "an unknown request kind is refused");
const mine = await maker.req("POST", "/api/privacy/requests", { kind: "erasure", name: "Frozen Maker", email: "someone-else@inraf.test", confirm: true });
check(mine.ok && mine.request.email === `cm-${RUN}@inraf.test`, "a signed-in request always uses the account's own email");
const myList = (await maker.req("GET", "/api/privacy/requests")).requests;
check(myList.some((r) => r.ref === mine.request.ref), "the person sees their own request");
check(!myList.some((r) => r.ref === anon.request.ref), "and not other people's");
check((await maker.req("GET", "/api/admin/data-requests")).ok === false, "only the InRaf team lists all requests");
const all = await admin.req("GET", "/api/admin/data-requests");
const row = all.requests?.find((r) => r.ref === anon.request.ref);
check(!!row && row.status === "received", "the InRaf team sees the request with its deadline");
check((await admin.req("POST", `/api/admin/data-requests/${row.id}`, { status: "refused", note: "" })).ok === false, "refusing needs a recorded reason");
const ext = await admin.req("POST", `/api/admin/data-requests/${row.id}`, { extend: true, note: "Large export from several stores" });
check(ext.ok && (new Date(ext.request.dueAt) - new Date(row.dueAt)) / 86400e3 > 59, "the team extends the deadline once by two months");
check((await admin.req("POST", `/api/admin/data-requests/${row.id}`, { extend: true, note: "again" })).ok === false, "a second extension is refused");
const closed = await admin.req("POST", `/api/admin/data-requests/${row.id}`, { status: "completed", note: "Export sent" });
check(closed.ok && !!closed.request.closedAt, "completing a request closes it");
check((await maker.req("POST", `/api/admin/data-requests/${row.id}`, { status: "received" })).ok === false, "a non-admin can't change a request");

// ---------- silent freeze ----------
const accounts = (await admin.req("GET", "/api/admin/accounts")).accounts;
const target = accounts.find((a) => a.email === `cm-${RUN}@inraf.test`);
check(!!target && !target.frozen, "the team finds the maker's account");
check((await maker.req("POST", "/api/admin/freeze", { userId: target.id, on: true, reason: "x" })).ok === false, "only the InRaf team can freeze");
check((await admin.req("POST", "/api/admin/freeze", { userId: target.id, on: true, reason: "" })).ok === false, "a freeze needs an internal reason");
const notesBefore = (await maker.state()).notifications.length;
check((await admin.req("POST", "/api/admin/freeze", { userId: target.id, on: true, reason: "Sanctions name match under review" })).ok, "the MLRO freezes the maker");
const ms = await maker.state();
check(ms.notifications.length === notesBefore, "the maker gets no notice of the freeze");
const msJson = JSON.stringify(ms);
check(!msJson.includes("Sanctions name match") && !msJson.includes("account.frozen"), "nothing in the maker's view mentions the freeze");
check(ms.listings.find((l) => l.id === soap.id)?.status === "active", "the maker's own view still shows the product as live");
const tried = await maker.act("restockListing", soap.id, 5);
check(tried.ok === false && /try again later/.test(tried.error) && !/frozen|compliance|suspend/i.test(tried.error), "the maker's actions fail with a neutral message");
check((await maker.act("reportInvoicePaid", "x", { paidOn: "2026-01-01", method: "Cash" })).ok === false, "the maker can't record payments");
check(!(await shopper.state()).listings.some((l) => l.id === soap.id), "shoppers no longer see the product");
check((await owner.act("recordTillSale", soap.id, 1)).ok === false, "and the store can't ring it up");
check((await owner.state()).listings.some((l) => l.id === soap.id), "the store owner still sees the product on their shelf");
const audit = (await admin.state()).audit;
check(audit.some((a) => a.action === "account.frozen" && a.detail === "Sanctions name match under review"), "the freeze and reason are in the audit log");
check((await maker.state()).audit.length === 0, "the audit log isn't sent to the maker");
check((await maker.act("markRead", "holder")).ok, "reading notices still works, so nothing looks different");
check((await admin.req("POST", "/api/admin/freeze", { userId: target.id, on: false, reason: "Cleared: false positive" })).ok, "the MLRO lifts the freeze");
check((await maker.act("restockListing", soap.id, 5)).ok, "after the freeze the maker can act again");
check((await shopper.state()).listings.some((l) => l.id === soap.id), "and shoppers see the product again");
check((await admin.state()).audit.some((a) => a.action === "account.unfrozen"), "lifting the freeze is audited too");

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
