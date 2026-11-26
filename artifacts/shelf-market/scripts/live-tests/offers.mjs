// Token-holder journey: offers, counter-offers and consignment, against the live-mode API.
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
  return { req, act: (n, ...a) => req("POST", `/api/actions/${n}`, { args: a }), state: () => req("GET", "/api/state"),
    async signIn(email, name) { const r = await req("POST", "/api/auth/request", { email, name, next: "/", acceptTerms: true }); await req("GET", `/api/auth/verify?token=${new URL(r.devLink).searchParams.get("token")}`); } };
}
const owner = client(), maker = client(), other = client(), admin = client();
await owner.signIn(`o-${RUN}@inraf.test`, "Samira"); await maker.signIn(`m-${RUN}@inraf.test`, "Karim"); await other.signIn(`x-${RUN}@inraf.test`, "X"); await admin.signIn("admin@inraf.test", "InRaf team");
const photo = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";
const created = await owner.act("createShop", { name: "Mall Kiosk", country: "AE", city: "Dubai", location: "Mall Level 1", business: "4771", place: "mall", width: 2, depth: 2, bricks: [0, 1, 2], tiers: 1, price: 100, categories: ["textile", "craft"], restrictions: [], hue: 12, photos: [{ url: photo, kind: "front" }, { url: photo, kind: "shelf" }], listing: { instantBook: true, pricing: "fixed" } });
const shopId = created.id;
await owner.act("updateShop", shopId, { registration: "AE-DED-1" });
check((await admin.act("setShopStatus", shopId, "approved", "ok")).ok, "a mall store is listed and approved");
const pub = (await maker.state()).state.shops.find((s) => s.id === shopId);
check(pub?.place === "mall", "the store keeps its place (mall) for the opportunity pages");
const start = new Date(Date.now() + 86400e3).toISOString().slice(0, 10);

// Model A with a lower offer at an Instant-book store: not instantly booked.
const r1 = await maker.act("requestContract", { shopId, slot: 0, holderId: "x", start, months: 6, offer: { monthlyRent: 80, note: "Can we start at 80?" } });
check(r1.ok, `maker sends an offer of 80 instead of 100 (${r1.error ?? "ok"})`);
let c = r1.state.contracts.find((x) => x.id === r1.id);
check(c.model === "rental" && c.offers.length === 1 && c.versions[0].snapshot.terms.monthlyRent === 80, "the draft carries the offered rent");
check(!c.versions[0].ownerSig, "an offer below the listing is not instantly booked");
check((await owner.state()).state.notifications.some((n) => n.title === "New shelf offer"), "the owner is told about the offer");
check((await other.act("counterOffer", r1.id, "owner", { monthlyRent: 95, months: 6 })).ok === false, "another account can't counter for the owner");
check((await maker.act("counterOffer", r1.id, "owner", { monthlyRent: 95, months: 6 })).ok === false, "the maker can't counter as the owner");
const co = await owner.act("counterOffer", r1.id, "owner", { monthlyRent: 90, months: 12, note: "90 if you take 12 months" });
check(co.ok, `the owner counters at 90 for 12 months (${co.error ?? "ok"})`);
check((await owner.act("counterOffer", r1.id, "owner", { monthlyRent: 90, months: 12 })).ok === false, "the same offer twice is refused (sign to accept)");
check((await owner.act("counterOffer", r1.id, "owner", { monthlyRent: 90, months: 2 })).ok === false, "an offer below the store's minimum term is refused");
check((await maker.state()).state.notifications.some((n) => n.title === "Counter-offer received"), "the maker is told about the counter-offer");
check((await admin.act("approveContract", r1.id, "x")).ok, "InRaf approves the draft");
check((await maker.act("counterOffer", r1.id, "holder", { monthlyRent: 85, months: 12 })).ok, "the maker counters back at 85");
c = (await maker.state()).state.contracts.find((x) => x.id === r1.id);
check(!c.versions[0].adminApproval && c.offers.length === 3, "a new offer clears the earlier approval and keeps the thread");
await admin.act("approveContract", r1.id, "x");
check((await owner.act("sign", r1.id, "owner", "Samira", false)).ok, "the owner accepts by signing");
check((await owner.act("counterOffer", r1.id, "owner", { monthlyRent: 99, months: 12 })).ok, "until both sign, either side can still counter");
await admin.act("approveContract", r1.id, "x");
await owner.act("sign", r1.id, "owner", "Samira", false);
const s1 = await maker.act("sign", r1.id, "holder", "Karim", false);
c = s1.state.contracts.find((x) => x.id === r1.id);
check(s1.ok && c.versions[0].status === "executed" && c.versions[0].snapshot.terms.monthlyRent === 99, "the signed contract has the last agreed rent");
check((await maker.act("counterOffer", r1.id, "holder", { monthlyRent: 50, months: 12 })).ok === false, "a signed contract can't be renegotiated by offer");

// Model B: consignment.
check((await maker.act("requestContract", { shopId, slot: 1, holderId: "x", start, months: 6, model: "consignment", offer: { sharePct: 60 } })).ok === false, "a commission above 50% is refused");
const r2 = await maker.act("requestContract", { shopId, slot: 1, holderId: "x", start, months: 6, model: "consignment", offer: { sharePct: 20 } });
const c2 = r2.state.contracts.find((x) => x.id === r2.id);
const t2 = c2.versions[0].snapshot.terms;
check(r2.ok && c2.model === "consignment" && t2.pricing === "share" && t2.salesSharePct === 20 && t2.monthlyRent === 0, "consignment has no rent and a 20% commission");
await admin.act("approveContract", r2.id, "x"); await owner.act("sign", r2.id, "owner", "Samira", false);
const s2 = await maker.act("sign", r2.id, "holder", "Karim", false);
check(s2.ok && !s2.state.invoices.some((i) => i.contractId === r2.id && i.kind === "rent"), "a signed consignment issues no rent invoices");
check(!(await other.state()).state.contracts.some((x) => x.id === r2.id), "others can't see the contracts");
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED"); process.exit(failures ? 1 : 0);
