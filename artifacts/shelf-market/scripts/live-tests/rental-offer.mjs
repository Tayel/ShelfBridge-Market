// Formal rental offer and acceptance: the store owner issues an offer addressed to the renter, InRaf reviews it, the
// renter accepts it, and both sides get a confirmation and the same records. LOCAL dev server only: node scripts/live-tests/rental-offer.mjs
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
const owner = client(), maker = client(), admin = client(), other = client();
await owner.signIn(`ro-${RUN}@inraf.test`, "Rui Owner"); await maker.signIn(`rm-${RUN}@inraf.test`, "Mina Maker");
await admin.signIn("admin@inraf.test", "InRaf team"); await other.signIn(`rx-${RUN}@inraf.test`, "Someone Else");
const photo = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";
const shopId = (await owner.act("createShop", { country: "PT", city: "Lisbon", business: "4711", width: 2, depth: 2, tiers: 1, categories: ["food", "beauty"], restrictions: [], hue: 12, photos: [{ url: photo, kind: "front" }, { url: photo, kind: "shelf" }], name: "Offer Test Store", location: "Rua Augusta 1", bricks: [0, 1, 2], price: 40 })).id;
await owner.act("updateShop", shopId, { registration: "PT-NIPC-1" }); await admin.act("setShopStatus", shopId, "approved", "ok");
const start = new Date(Date.now() + 86400e3).toISOString().slice(0, 10);
const day = (n) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
const ctr = async (who, id) => (await who.state()).contracts.find((x) => x.id === id);
const notes = async (who) => (await who.state()).notifications;

const c1 = (await maker.act("requestContract", { shopId, slot: 0, holderId: "x", start, months: 6 })).id;
let r = await maker.act("sign", c1, "holder", "Mina Maker", false);
check(!r.ok && /hasn't issued a formal offer/.test(r.error), "the renter can't accept before the store owner issues an offer");
await admin.act("approveContract", c1, "x");
check(!(await maker.act("sign", c1, "holder", "Mina Maker", false)).ok, "InRaf's review alone isn't an offer");
check(!(await maker.act("sign", c1, "owner", "Mina", false)).ok, "the renter can't issue the offer for the store");
check(!(await other.act("sign", c1, "owner", "X", false)).ok, "a stranger can't issue the offer");
r = await owner.act("sign", c1, "owner", "Rui Owner", false, { validDays: 3 });
let v = (await ctr(owner, c1)).versions[0];
check(r.ok && v.offer && /^OFR-/.test(v.offer.no) && v.offer.validUntil === day(3), "the store owner issues a formal offer, open for 3 days");
check(/^[0-9A-F]{4}-/.test(v.offer.fingerprint), "the offer records a fingerprint of the exact text");
check((await notes(maker)).some((n) => n.title === "Formal rental offer received" && n.body.includes(v.offer.no)), "the renter receives the offer, addressed to them");
check((await notes(owner)).some((n) => n.title === "Offer issued"), "the store owner gets a copy that it was sent");
check(!(await notes(other)).some((n) => n.title === "Formal rental offer received"), "nobody else is told");
check(!(await owner.act("sign", c1, "owner", "Rui Owner", false)).ok, "an open offer can't be issued twice");
check(!(await maker.act("sign", c1, "holder", "Mina Maker", false, { fingerprint: "0000-0000-0000-00" })).ok, "accepting a different text than the one offered is refused");
check(!(await owner.act("sign", c1, "holder", "Rui", false)).ok, "the store owner can't accept for the renter");
check(!(await maker.act("sign", c1, "holder", "", false, { fingerprint: v.offer.fingerprint })).ok, "acceptance needs the renter's typed name");

r = await maker.act("sign", c1, "holder", "Mina Maker", false, { fingerprint: v.offer.fingerprint });
const mc = await ctr(maker, c1), oc = await ctr(owner, c1);
v = mc.versions[0];
check(r.ok && v.status === "executed", "the renter accepts and the agreement takes effect at once");
check(v.acceptance?.name === "Mina Maker" && v.acceptance.fingerprint === v.offer.fingerprint && !!v.acceptance.confirmedAt, "the acceptance is recorded with name, time, the same fingerprint and the confirmation time");
const mn = await notes(maker), on = await notes(owner);
check(mn.some((n) => n.title === "Rental agreement confirmed" && n.body.includes(v.offer.no)), "the renter receives a formal confirmation");
check(on.some((n) => n.title === "Rental agreement confirmed" && n.body.includes("Mina Maker")), "the store owner receives a formal confirmation");
check((await notes(admin)).some((n) => n.title === "Contract active" && n.body.includes(mc.ref)), "InRaf is told the agreement is in force");
check(!(await notes(other)).some((n) => n.title === "Rental agreement confirmed"), "confirmations go to the two parties only");
check(JSON.stringify(mc.versions) === JSON.stringify(oc.versions), "both sides hold the identical agreement record");
const audit = (await admin.state()).audit.filter((a) => a.ref.startsWith(mc.ref)).map((a) => a.action);
check(["contract.requested", "offer.issued", "offer.accepted", "contract.executed"].every((x) => audit.includes(x)), "issue, acceptance and execution are in the audit trail");

// Shared records after acceptance: same invoices, products and payments on both sides.
const inv = async (who) => (await who.state()).invoices.filter((i) => i.contractId === c1);
check((await inv(maker)).length > 0 && JSON.stringify(await inv(maker)) === JSON.stringify(await inv(owner)), "both sides see the same invoices");
check((await inv(maker)).some((i) => i.kind === "deposit"), "the security deposit invoice is issued");
const dep = (await inv(maker)).find((i) => i.kind === "deposit");
await maker.act("payInvoice", dep.id);
check((await inv(owner)).find((i) => i.id === dep.id)?.paidAt, "a payment by the renter shows on the store owner's side");
const tokenId = mc.tokenId;
const lst = await maker.act("createListing", tokenId, { name: "Pastel de nata box", sku: "PN-1", category: "food", description: "x", color: "#d9a441", origin: "PT", retail: 9, cost: 4, taxRate: 6, batch: "B1", initialQty: 10 });
check((await owner.state()).listings.some((l) => l.id === lst.id && l.status === "pending"), "a new product appears for the store owner's approval");
await owner.act("decideListing", lst.id, true, "");
check((await maker.state()).listings.find((l) => l.id === lst.id)?.status === "approved", "the store's approval shows on the renter's side");
check(!(await other.state()).invoices.some((i) => i.contractId === c1), "strangers see none of it");

// Order of steps: an offer InRaf hasn't reviewed can't be accepted yet; a counter-offer withdraws the offer.
const c2 = (await maker.act("requestContract", { shopId, slot: 1, holderId: "x", start, months: 6 })).id;
await owner.act("sign", c2, "owner", "Rui Owner", false);
let v2 = (await ctr(maker, c2)).versions[0];
r = await maker.act("sign", c2, "holder", "Mina Maker", false, { fingerprint: v2.offer.fingerprint });
check(!r.ok && /still reviewing/.test(r.error), "an offer InRaf hasn't reviewed can't be accepted yet");
check((await notes(maker)).some((n) => n.title === "Formal rental offer received" && /review is complete/.test(n.body)), "the renter is told acceptance opens after InRaf's review");
await maker.act("counterOffer", c2, "holder", { monthlyRent: 35, months: 6 });
v2 = (await ctr(owner, c2)).versions[0];
check(!v2.offer && !v2.ownerSig, "a counter-offer withdraws the issued offer");
await admin.act("approveContract", c2, "x"); await owner.act("sign", c2, "owner", "Rui Owner", false);
v2 = (await ctr(maker, c2)).versions[0];
check(v2.snapshot.terms.monthlyRent === 35, "the new offer carries the agreed rent");
check((await maker.act("sign", c2, "holder", "Mina Maker", false, { fingerprint: v2.offer.fingerprint })).ok, "and the renter accepts it");
check((await maker.act("terminate", c2, "Changed plans", "holder")).ok, "either side can still end the agreement under its terms");

// Renewal follows the same offer and acceptance.
check((await owner.act("newVersion", c1, "renewal", { months: 6, monthlyRent: 45, note: "Second term" }, "owner")).ok, "the store owner drafts a renewal");
check(!(await maker.act("sign", c1, "holder", "Mina Maker", false)).ok, "the renewal can't be accepted before it's offered");
await admin.act("approveContract", c1, "x"); await owner.act("sign", c1, "owner", "Rui Owner", false, { validDays: 14 });
const rv = (await ctr(maker, c1)).versions[1];
check(rv.offer.validUntil === day(14) && rv.offer.no.endsWith("-2"), "the renewal gets its own offer number, open for 14 days");
check((await maker.act("sign", c1, "holder", "Mina Maker", false, { fingerprint: rv.offer.fingerprint })).ok && (await ctr(owner, c1)).versions[1].status === "executed", "the renter accepts the renewal");

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
