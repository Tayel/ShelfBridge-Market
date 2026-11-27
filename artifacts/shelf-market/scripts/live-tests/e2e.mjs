// End-to-end check of the InRaf live API with real accounts: owner lists a store, admin approves it, a maker
// rents a shelf, both sign, maker lists a product, owner approves, an anonymous shopper buys it. Also checks
// that people can't act for others or see others' private data, and the shop-owner protections.
// Run against the LOCAL dev server only (it relies on the dev sign-in link): node scripts/live-tests/e2e.mjs
const BASE = process.argv[2] ?? "http://localhost:24559";
const RUN = Date.now().toString(36);
let failures = 0;
const check = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) failures++; };

function client(label) {
  const jar = {};
  const req = async (method, path, body) => {
    const r = await fetch(BASE + path, {
      method, redirect: "manual",
      headers: { "Content-Type": "application/json", Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ") },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const c of r.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar[kv.slice(0, i)] = kv.slice(i + 1); }
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch { json = { status: r.status, location: r.headers.get("location") }; }
    return json;
  };
  return {
    label, req,
    async signIn(email, name) {
      const r = await req("POST", "/api/auth/request", { email, name, next: "/dashboard", acceptTerms: true });
      const token = new URL(r.devLink).searchParams.get("token");
      const v = await req("GET", `/api/auth/verify?token=${token}`);
      const again = await req("GET", `/api/auth/verify?token=${token}`);
      return { r, v, again };
    },
    act: (name, ...args) => req("POST", `/api/actions/${name}`, { args }),
    state: () => req("GET", "/api/state"),
  };
}

const owner = client("owner"), maker = client("maker"), other = client("other"), admin = client("admin"), shopper = client("shopper");
const ownerEmail = `owner-${RUN}@inraf.test`, makerEmail = `maker-${RUN}@inraf.test`;

check((await owner.req("POST", "/api/auth/request", { email: ownerEmail, name: "Samira" })).ok === false, "sign-in needs agreement to the Terms and Privacy Policy");
const s1 = await owner.signIn(ownerEmail, "Samira");
check(s1.v.location === "/dashboard", "magic link signs in and redirects to next");
check(s1.again.location?.startsWith("/signin?expired"), "a sign-in link works only once");
await maker.signIn(makerEmail, "Karim");
await other.signIn(`other-${RUN}@inraf.test`, "Nadia");
await admin.signIn("admin@inraf.test", "InRaf team");

const me = await owner.req("GET", "/api/me");
check(me.me?.email === ownerEmail && !me.me.isAdmin, "owner session is recognised, not admin");
check((await admin.req("GET", "/api/me")).me?.isAdmin === true, "ADMIN_EMAILS account is admin");

const photo = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";
const shopInput = { name: "Dokkan Samira", country: "EG", city: "Cairo", location: "Zamalek", business: "grocery", width: 2, depth: 1, bricks: [2, 2], tiers: 3, price: 25, categories: ["food"], restrictions: [], hue: 20, photos: [{ url: photo, kind: "front" }, { url: photo, kind: "shelf" }] };

check((await shopper.act("createShop", shopInput)).code === "auth", "anonymous visitor can't list a store (asked to sign in)");
const created = await owner.act("createShop", shopInput);
check(created.ok && created.id, `owner lists a store (${created.error ?? created.id})`);
const shopId = created.id;
const mine = created.state.shops.find((s) => s.id === shopId);
check(mine?.ownerUserId === me.me.id, "store is owned by the owner's account");
check(mine?.ownerName === "Samira" && mine?.registration === "", "the store carries the owner's real name and no made-up registration");
check(mine?.terms.deposit === 25 && mine?.terms.noticeDays === 30, "new stores default to a one-month deposit and 30 days' notice");

check(!(await maker.state()).state.shops.some((s) => s.id === shopId), "pending store is hidden from others");
check((await owner.act("setShopStatus", shopId, "approved", "")).ok === false, "owner can't approve their own store");
check((await admin.act("setShopStatus", shopId, "approved", "Checked")).ok === false, "a store can't be approved without a registration number");
check((await owner.act("updateShop", shopId, { registration: "EG-CR-12345" })).ok, "owner adds the registration number");
check((await admin.act("setShopStatus", shopId, "approved", "Checked")).ok, "admin approves the store");
check((await other.act("updateShop", shopId, { price: 1 })).ok === false, "another account can't edit the store");

const shopView = (await maker.state()).state.shops.find((s) => s.id === shopId);
check(shopView && shopView.registration === "", "approved store is public, registration number hidden");

check(!(await maker.state()).state.shops.some((s) => s.seeded), "sample stores aren't shown to customers");
const sample = (await admin.state()).state.shops.find((s) => s.seeded && s.status === "approved");
const start = new Date(Date.now() + 86400e3).toISOString().slice(0, 10);
check((await maker.act("requestContract", { shopId: sample.id, slot: 0, holderId: "h-you", start })).ok === false, "sample stores can't be rented live");
check((await owner.act("requestContract", { shopId, slot: 0, holderId: "x", start })).ok === false, "owner can't rent in their own store");
const req = await maker.act("requestContract", { shopId, slot: 0, holderId: "h-you", start, months: 6 });
check(req.ok, `maker requests a shelf (${req.error ?? req.id})`);
const contractId = req.id;
const ctr = req.state.contracts.find((c) => c.id === contractId);
check(ctr.holderId.startsWith("h-u-"), "the contract is in the maker's own name, not the id the browser sent");
const t0 = ctr.versions[ctr.versions.length - 1].snapshot.terms;
check(t0.noticeDays === 30 && /laws of Egypt/.test(t0.governingLaw ?? "") && t0.deposit > 0, "the contract has 30 days' notice, Egyptian law and a deposit");

check(!(await other.state()).state.contracts.some((c) => c.id === contractId), "a third account can't see the contract");
check((await owner.state()).state.notifications.some((n) => n.title === "New shelf rental request"), "owner is notified of the request");
check(!(await other.state()).state.notifications.some((n) => n.title === "New shelf rental request"), "the notice isn't shown to other accounts");

check((await maker.act("approveContract", contractId, "me")).ok === false, "maker can't approve as the platform");
check((await admin.act("approveContract", contractId, "x")).ok, "admin approves the contract");
check((await maker.act("sign", contractId, "owner", "Samira", true)).ok === false, "maker can't sign for the owner");
check((await owner.act("sign", contractId, "owner", "Samira", false)).ok, "owner signs");
const signed = await maker.act("sign", contractId, "holder", "Karim", false);
check(signed.ok, `maker signs (${signed.error ?? "ok"})`);
const tokenId = signed.state.contracts.find((c) => c.id === contractId).tokenId;

const listing = { name: "Karim's Kitchen jam", sku: "KK-1", category: "food", description: "Fig jam", color: "#b5651d", origin: "EG", retail: 6, cost: 2, taxRate: 14, batch: "B1", initialQty: 10 };
check((await other.act("createListing", tokenId, listing)).ok === false, "another account can't add products to the maker's shelf");
const lst = await maker.act("createListing", tokenId, listing);
check(lst.ok, `maker adds a product (${lst.error ?? lst.id})`);
check((await maker.act("decideListing", lst.id, true, "")).ok === false, "maker can't approve their own product");
check((await owner.act("decideListing", lst.id, true, "Looks good")).ok, "owner approves the product");
const act = await maker.act("activateListing", lst.id);
check(act.ok, `maker puts it on sale (${act.error ?? "ok"})`);

check((await shopper.state()).state.listings.some((l) => l.id === lst.id), "the product on sale is visible to an anonymous shopper");
const online = await shopper.act("authorize", lst.id, 2, false);
check(online.ok === false && /till/.test(online.error), "online checkout is closed: shoppers pay at the store's till");
check((await other.act("recordTillSale", lst.id, 2)).ok === false, "only the store can record a till sale");
check((await maker.act("recordTillSale", lst.id, 2)).ok === false, "the maker can't record sales for the store");
const order = await owner.act("recordTillSale", lst.id, 2);
check(order.ok, `the store records a till sale (${order.error ?? order.id})`);
check(!(await other.state()).state.orders.some((o) => o.id === order.id), "others can't see the order");
check((await maker.state()).state.notifications.some((n) => n.title === "Sale at the store"), "maker is told about the sale");
check((await owner.state()).state.audit.length === 0 && (await admin.state()).state.audit.length > 0, "audit log is admin-only");

const term = await maker.act("terminate", contractId, "Moving to another city");
check(term.ok && term.state.invoices.some((i) => i.contractId === contractId && /Notice period/.test(i.label)), `a maker who leaves early is billed the notice period (${term.error ?? "ok"})`);

const sv = await maker.act("toggleSaved", shopId);
check(sv.ok && sv.state.saved.includes(shopId) && !(await other.state()).state.saved.includes(shopId), "saved stores are per account");
check((await maker.req("POST", "/api/actions/reset", { args: [] })).ok === false, "no reset on the live site");

const evil = await fetch(BASE + "/api/actions/markRead", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://evil.example" }, body: JSON.stringify({ args: ["holder"] }) });
check(evil.status === 403, "requests from other websites are blocked");

await owner.req("POST", "/api/auth/logout", {});
check((await owner.req("GET", "/api/me")).me === null, "sign out ends the session");

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
