// Payments made outside InRaf: rent reported by the renter and confirmed by the store, till sales, refunds, the store
// paying makers, the deposit's return, and sample stores hidden from customers. LOCAL dev server only: node scripts/live-tests/payments.mjs
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
const owner = client(), maker = client(), admin = client(), other = client(), visitor = client();
await owner.signIn(`po-${RUN}@inraf.test`, "Paula Owner"); await maker.signIn(`pm-${RUN}@inraf.test`, "Marco Maker");
await admin.signIn("admin@inraf.test", "InRaf team"); await other.signIn(`px-${RUN}@inraf.test`, "Other");
const photo = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";
const shopId = (await owner.act("createShop", { country: "PT", city: "Porto", business: "4711", width: 2, depth: 2, tiers: 1, categories: ["food"], restrictions: [], hue: 12, photos: [{ url: photo, kind: "front" }, { url: photo, kind: "shelf" }], name: "Payments Test Store", location: "Rua Santa Catarina 1", bricks: [0, 1], price: 50, listing: { pricing: "hybrid", salesSharePct: 10 } })).id;
await owner.act("updateShop", shopId, { registration: "PT-1" }); await admin.act("setShopStatus", shopId, "approved", "ok");
const day = (n) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
const c1 = (await maker.act("requestContract", { shopId, slot: 0, holderId: "x", start: day(1), months: 6 })).id;
await admin.act("approveContract", c1, "x"); await owner.act("sign", c1, "owner", "Paula Owner", false);
let v = (await maker.state()).contracts.find((x) => x.id === c1).versions[0];
check(v.offer.template === 2, "new offers use the direct-payments edition of the agreement");
await maker.act("sign", c1, "holder", "Marco Maker", false, { fingerprint: v.offer.fingerprint });
const inv = async (who) => (await who.state()).invoices.filter((i) => i.contractId === c1);
const rent1 = (await inv(maker)).find((i) => i.kind === "rent");
const dep = (await inv(maker)).find((i) => i.kind === "deposit");

// ---------- rent paid directly to the store ----------
check((await maker.act("payInvoice", rent1.id)).ok === false, "InRaf doesn't take rent itself");
check((await maker.act("reportInvoicePaid", rent1.id, { paidOn: day(2), method: "Cash" })).ok === false, "a payment date in the future is refused");
check((await maker.act("reportInvoicePaid", rent1.id, { paidOn: day(0), method: "" })).ok === false, "the method of payment is required");
check((await other.act("reportInvoicePaid", rent1.id, { paidOn: day(0), method: "Cash" })).ok === false, "a stranger can't report paying");
check((await maker.act("reportInvoicePaid", rent1.id, { paidOn: day(0), method: "Bank transfer", reference: "IBAN-REF-77" })).ok, "the renter reports paying the first month by bank transfer");
let r = (await inv(owner)).find((i) => i.id === rent1.id);
check(r.reported?.reference === "IBAN-REF-77" && !r.paidAt, "the store sees the report; it isn't marked paid until the store confirms");
check((await other.act("confirmInvoicePaid", rent1.id, {})).ok === false, "a stranger can't confirm");
check((await owner.act("confirmInvoicePaid", rent1.id, {})).ok, "the store owner confirms receipt");
r = (await inv(maker)).find((i) => i.id === rent1.id);
check(r.paidAt && /^RCPT-/.test(r.receiptRef) && r.method === "Bank transfer" && r.paymentRef === "IBAN-REF-77" && !r.lateFee, "the renter sees it paid, with a receipt, method and reference, no late fee");
check((await maker.state()).notifications.some((n) => n.title === "Payment confirmed" && n.body.includes(r.receiptRef)), "the renter is told the payment was confirmed");
check((await owner.act("confirmInvoicePaid", rent1.id, {})).ok === false, "a payment can't be confirmed twice");
check((await owner.act("confirmInvoicePaid", dep.id, { method: "Cash", reference: "hand" })).ok, "the store can also confirm a payment the renter didn't report (cash at the counter)");
check((await admin.state()).ledger.some((e) => e.invoiceId === dep.id && e.type === "deposit_paid" && /paid directly to the store owner by Cash/.test(e.memo)), "the ledger says the money went directly to the store");

// ---------- till sales, refunds and paying the maker ----------
const t = (await maker.state()).contracts.find((x) => x.id === c1).tokenId;
const jam = await maker.act("createListing", t, { name: "Port wine jam", sku: "PJ-1", category: "food", description: "x", color: "#7b2d26", origin: "PT", retail: 10, cost: 4, taxRate: 6, batch: "B1", initialQty: 12 });
await owner.act("decideListing", jam.id, true, ""); await maker.act("activateListing", jam.id);
const pub = (await visitor.state()).listings.find((l) => l.id === jam.id);
check(!!pub, "shoppers can see the product and its price");
check((await visitor.act("authorize", jam.id, 1, false)).ok === false, "shoppers can't check out online; they pay at the till");
check((await owner.act("recordTillSale", jam.id, 0)).ok === false && (await owner.act("recordTillSale", jam.id, 99)).ok === false, "a zero sale or more than the stock is refused");
const s1 = await owner.act("recordTillSale", jam.id, 3);
const o1 = s1.state.orders.find((o) => o.id === s1.id);
check(s1.ok && o1.channel === "till" && o1.gross === 31.8 && o1.shopShare === 3 && o1.net === 27 && o1.commission === 0, "a till sale of 3 × 10: 31.80 incl. tax, store keeps 3.00, 27.00 due to the maker, no InRaf commission");
check((await maker.state()).listings.find((l) => l.id === jam.id).available === 9, "the maker's stock drops to 9");
check((await maker.state()).notifications.some((n) => n.title === "Sale at the store" && n.body.includes("27.00")), "the maker is told what is due");
const s2 = await owner.act("recordTillSale", jam.id, 1);
check((await owner.act("recordTillRefund", s2.id, true, "")).ok === false, "a refund needs a reason");
check((await maker.act("recordTillRefund", s2.id, true, "x")).ok === false, "only the store can refund a till sale");
check((await owner.act("recordTillRefund", s2.id, true, "Damaged jar lid")).ok, "the store refunds the second sale and puts it back on the shelf");
let mo = await maker.state();
check(mo.orders.find((o) => o.id === s2.id).payment === "refunded" && mo.orders.find((o) => o.id === s2.id).payout === "reversed" && mo.listings.find((l) => l.id === jam.id).available === 9, "the refund cancels what was due and restores the stock");
check((await other.act("settleWithMaker", t, { method: "Bank transfer" })).ok === false, "a stranger can't record a payment to the maker");
check((await maker.act("settleWithMaker", t, { method: "Bank transfer" })).ok === false, "the maker can't record being paid");
check((await owner.act("settleWithMaker", t, { method: "Bank transfer", reference: "NOV-SETTLE" })).ok, "the store records paying the maker");
mo = await maker.state();
check(mo.orders.find((o) => o.id === s1.id).payout === "settled" && mo.orders.find((o) => o.id === s1.id).settlement?.reference === "NOV-SETTLE", "the maker sees the sale paid, with the reference");
check(mo.notifications.some((n) => n.title === "Payment from the store" && n.body.includes("27.00")), "the maker is told 27.00 was paid");
check((await owner.act("settleWithMaker", t, { method: "Bank transfer" })).ok === false, "nothing is paid twice");
check((await owner.act("recordTillRefund", s1.id, false, "Returned after payment")).ok, "a refund after the maker was paid is still possible");
check((await maker.state()).notifications.some((n) => n.title === "Refund processed" && /owed back to the store/.test(n.body)), "the maker is told the amount is owed back");
const rec = (await admin.state()).orders.filter((o) => o.tokenId === t);
check(rec.length === 2, "InRaf sees both till sales");

// ---------- deposit ----------
check((await owner.act("returnDeposit", dep.id, { amount: 50, method: "Bank transfer" })).ok === false, "the deposit isn't returned while the agreement runs");
await owner.act("terminate", c1, "Store closing for renovation", "owner");
check((await owner.act("returnDeposit", dep.id, { amount: 40, method: "Bank transfer" })).ok === false, "a deduction must be itemised");
check((await maker.act("returnDeposit", dep.id, { amount: 50, method: "Bank transfer" })).ok === false, "only the store returns the deposit");
check((await owner.act("returnDeposit", dep.id, { amount: 40, deductions: "Broken shelf bracket, 10.00 (photo on incident)", method: "Bank transfer", reference: "DEP-BACK" })).ok, "the store returns 40 with an itemised 10 deduction");
const d2 = (await inv(maker)).find((i) => i.id === dep.id);
check(d2.returned?.amount === 40 && /bracket/.test(d2.returned.deductions), "the renter sees the return and the deduction");
check((await maker.state()).notifications.some((n) => n.title === "Deposit returned" && /dispute|disagree/.test(n.body)), "the renter is told and how to dispute it");
check((await owner.act("returnDeposit", dep.id, { amount: 10, deductions: "xxxxxxxxxxxx", method: "Cash" })).ok === false, "a deposit is returned once");

// ---------- sample stores ----------
const seeded = (await admin.state()).shops.filter((x) => x.seeded).length;
check(seeded > 0 && !(await visitor.state()).shops.some((x) => x.seeded) && !(await maker.state()).shops.some((x) => x.seeded), "sample stores are hidden from shoppers and makers, kept for the InRaf team");
check(!(await visitor.state()).listings.some((l) => (/^s-/.test(l.shopId))), "and so are their products");

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
