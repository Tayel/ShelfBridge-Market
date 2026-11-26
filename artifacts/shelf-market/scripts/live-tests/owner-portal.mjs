// Store-owner portal: the records an owner sees and the actions they can take, against the live-mode API.
// Run against the LOCAL dev server only (it relies on the dev sign-in link): node scripts/live-tests/owner-portal.mjs
// Prints the owner's email at the end so the portal can be opened in a browser with that account.
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
const owner = client(), maker = client(), other = client(), admin = client(), shopper = client(), otherOwner = client();
const ownerEmail = `portal-${RUN}@inraf.test`;
await owner.signIn(ownerEmail, "Mona Fawzy"); await maker.signIn(`pm-${RUN}@inraf.test`, "Nile Soap Co"); await other.signIn(`px-${RUN}@inraf.test`, "X");
await admin.signIn("admin@inraf.test", "InRaf team"); await otherOwner.signIn(`po-${RUN}@inraf.test`, "Other Owner");
const photo = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";
const base = { country: "EG", city: "Cairo", business: "4711", width: 2, depth: 2, tiers: 1, categories: ["food", "beauty"], restrictions: [], hue: 12, photos: [{ url: photo, kind: "front" }, { url: photo, kind: "shelf" }], listing: { pricing: "hybrid", salesSharePct: 10 } };
const shopId = (await owner.act("createShop", { ...base, name: "Saydaliyat Mona", location: "Tahrir St 4", bricks: [0, 1, 2, 3], price: 30, place: "street" })).id;
const otherShop = (await otherOwner.act("createShop", { ...base, name: "Elsewhere Market", location: "Far St 1", bricks: [0, 1], price: 20 })).id;
for (const [o, id] of [[owner, shopId], [otherOwner, otherShop]]) { await o.act("updateShop", id, { registration: "EG-CR-1" }); await admin.act("setShopStatus", id, "approved", "ok"); }

check((await owner.act("updateShop", shopId, { hours: "x".repeat(130) })).ok === false, "opening hours over 120 characters are refused");
check((await owner.act("updateShop", shopId, { hours: "Sat–Thu 9:00–22:00" })).ok, "the owner sets opening hours");
check((await maker.state()).shops.find((s) => s.id === shopId)?.hours === "Sat–Thu 9:00–22:00", "makers see the opening hours");
check((await other.act("updateShop", shopId, { hours: "never" })).ok === false, "another account can't change the hours");

// A maker rents a shelf, both sign, lists two products (one near its date); the owner approves; a shopper buys.
const start = new Date(Date.now() + 86400e3).toISOString().slice(0, 10);
const c = await maker.act("requestContract", { shopId, slot: 0, holderId: "x", start, months: 6 });
await admin.act("approveContract", c.id, "x"); await owner.act("sign", c.id, "owner", "Mona Fawzy", false);
const signed = await maker.act("sign", c.id, "holder", "Nile Soap", false);
const tokenId = signed.state.contracts.find((x) => x.id === c.id).tokenId;
const soon = new Date(Date.now() + 10 * 86400e3).toISOString().slice(0, 10);
const soap = await maker.act("createListing", tokenId, { name: "Olive oil soap", sku: "NS-1", category: "beauty", description: "Handmade", color: "#5E8C61", origin: "EG", retail: 5, cost: 2, taxRate: 14, batch: "B1", initialQty: 12 });
const dates = await maker.act("createListing", tokenId, { name: "Siwa dates 500 g", sku: "NS-2", category: "food", description: "Near date", color: "#B5651D", origin: "EG", retail: 4, cost: 1.5, taxRate: 0, batch: "B2", initialQty: 4, expiry: soon });
let os = await owner.state();
check(os.listings.filter((l) => l.shopId === shopId && l.status === "pending").length === 2, "the owner sees both products waiting for approval");
await owner.act("decideListing", soap.id, true, ""); await owner.act("decideListing", dates.id, true, "");
await maker.act("activateListing", soap.id); await maker.act("activateListing", dates.id);
const o1 = await shopper.act("authorize", soap.id, 3, false); await shopper.act("capture", o1.id);
const o2 = await shopper.act("authorize", dates.id, 2, false); await shopper.act("capture", o2.id);
const elsewhereOrderCount = (await admin.state()).orders.filter((o) => o.shopId === otherShop).length;

os = await owner.state();
const myOrders = os.orders.filter((o) => o.shopId === shopId);
check(myOrders.length === 2 && myOrders.every((o) => o.payment === "captured"), "the owner sees the two paid orders at their store");
check(myOrders.every((o) => o.shopShare > 0 && o.sharePct === 10), "each order shows the owner's 10% share");
check(!os.orders.some((o) => o.shopId === otherShop) && elsewhereOrderCount === 0, "the owner sees no orders from other stores");
check(myOrders.every((o) => /^Customer #/.test(o.customerLabel) && !o.buyerId), "shoppers appear only by customer number, with no visitor or account id");
const dl = os.listings.find((l) => l.id === dates.id);
check(dl.available === 2 && dl.expiry === soon, "stock and expiry are up to date for the owner (2 dates left, expiring in 10 days)");
check(os.invoices.some((i) => i.contractId === c.id), "the owner sees the rent schedule for the contract");

// Shelf suspension by the owner.
check((await other.act("setShelfSuspended", tokenId, true, "x")).ok === false, "another account can't suspend the shelf");
check((await owner.act("setShelfSuspended", tokenId, true, "Labels missing on the dates")).ok, "the owner suspends the shelf");
check((await shopper.act("authorize", soap.id, 1, false)).ok === false, "a suspended shelf can't sell");
check((await maker.state()).notifications.some((n) => n.title === "Shelf suspended"), "the maker is told");
check((await admin.state()).audit.some((a) => a.action === "shelf.suspended" && a.actor.startsWith("Store owner")), "the audit log records the store owner, not the platform");
check((await owner.act("setShelfSuspended", tokenId, false, "Reinstated by owner")).ok, "the owner reinstates the shelf");

console.log(`\nOwner account for the browser: ${ownerEmail}`);
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED"); process.exit(failures ? 1 : 0);
