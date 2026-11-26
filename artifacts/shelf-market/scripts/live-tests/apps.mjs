// Applications from the "I have a shop" journey, against the live-mode API.
// Run against the LOCAL dev server only (it relies on the dev sign-in link): node scripts/live-tests/apps.mjs
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
const owner = client(), other = client(), admin = client(), anon = client();
await owner.signIn(`hotel-${RUN}@inraf.test`, "Layla"); await other.signIn(`x-${RUN}@inraf.test`, "X"); await admin.signIn("admin@inraf.test", "InRaf team");
const day = (n) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
const photo = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";
const base = {
  venue: "hotel", offers: ["rent", "surplus"], categories: ["gifts", "food"],
  business: { name: "Nile View Hotel", type: "Hotel", country: "EG", city: "Cairo", address: "Corniche 1", contact: "Layla", phone: "+20 100 000 0000", email: `hotel-${RUN}@inraf.test` },
  spaces: [{ id: "giftshop", label: "Gift shop vitrine", kind: "eye-level", dims: "x", units: 4, price: 110, active: true, mode: "rent" }, { id: "console", label: "Console", kind: "endcap", dims: "x", units: 2, price: 85, active: false, mode: "rent" }],
  products: [], services: [{ id: "pos", price: 15 }], terms: "Minimum term 3 months.",
  surplus: [{ name: "Dates 500 g", category: "food", qty: 40, originalPrice: 8, price: 5, expiry: day(30), condition: "overstock", storage: "ambient", handover: "both" }],
  shop: { name: "Nile View Hotel", country: "EG", city: "Cairo", location: "Corniche 1", business: "5510", place: "hotel", width: 2, depth: 2, bricks: [0, 1, 2, 3], tiers: 1, price: 110, categories: ["craft", "food"], restrictions: [], hue: 12, months: 3, photos: [{ url: photo, kind: "front" }, { url: photo, kind: "shelf" }], listing: { shelfType: "eye-level", pricing: "fixed", salesSharePct: 0 } },
};
check((await anon.act("submitOwnerRequest", base)).code === "auth", "a visitor must sign in to apply");
const expired = await owner.act("submitOwnerRequest", { ...base, surplus: [{ ...base.surplus[0], expiry: day(-1) }] });
check(expired.ok === false && /expired/i.test(expired.error), `expired stock is refused (${expired.error})`);
const short = await owner.act("submitOwnerRequest", { ...base, surplus: [{ ...base.surplus[0], expiry: day(3) }] });
check(short.ok === false && /7 days/.test(short.error), "stock with under 7 days left is refused");
const nodate = await owner.act("submitOwnerRequest", { ...base, surplus: [{ ...base.surplus[0], expiry: undefined }] });
check(nodate.ok === false && /expiry/i.test(nodate.error), "food without an expiry date is refused");
check((await owner.act("submitOwnerRequest", { ...base, surplus: [{ ...base.surplus[0], price: 9 }] })).ok === false, "selling above the original price is refused");
check((await owner.act("submitOwnerRequest", { ...base, business: { ...base.business, phone: "abc" } })).ok === false, "a phone number is required");
check((await owner.act("submitOwnerRequest", { ...base, spaces: base.spaces.map((a) => ({ ...a, active: false })) })).ok === false, "renting needs at least one area turned on");
check((await owner.act("submitOwnerRequest", { ...base, shop: { ...base.shop, place: "moon" } })).ok === false, "an unknown kind of place is refused");
const ok = await owner.act("submitOwnerRequest", base);
check(ok.ok && ok.id, `a complete application is accepted (${ok.error ?? ok.id})`);
const mine = (await owner.state()).state;
const r = mine.requests.find((x) => x.id === ok.id);
check(r && r.status === "received" && /^APP-/.test(r.ref), "the owner sees it with a reference");
check(r?.shopId && mine.shops.some((s) => s.id === r.shopId && s.status === "pending" && s.place === "hotel"), "renting space also creates a pending store listing, marked as a hotel");
check(mine.notifications.some((n) => n.title === "Application received"), "the owner is notified");
check(!(await other.state()).state.requests.some((x) => x.id === ok.id), "another account can't see the application");
check((await anon.state()).state.requests?.length === 0, "a visitor sees no applications");
const ad = (await admin.state()).state;
check(ad.requests.some((x) => x.id === ok.id) && ad.notifications.some((n) => n.title === "New business application"), "the InRaf team sees it and is notified");
check((await owner.act("decideOwnerRequest", ok.id, "accepted", "")).ok === false, "the owner can't accept their own application");
check((await admin.act("decideOwnerRequest", ok.id, "accepted", "Welcome")).ok, "the team accepts it");
const after = (await owner.state()).state;
check(after.requests.find((x) => x.id === ok.id)?.status === "accepted" && after.notifications.some((n) => n.title === "Application accepted"), "the owner sees the decision in notifications");
const sell = await owner.act("submitOwnerRequest", { ...base, venue: "factory", offers: ["sell"], shop: undefined, products: [{ name: "Soap", category: "beauty", qty: 10, price: 4 }] });
const sr = (await owner.state()).state.requests.find((x) => x.id === sell.id);
check(sell.ok && !sr?.shopId && sr?.spaces.length === 0, "a products-only application creates no store and keeps no display areas");
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED"); process.exit(failures ? 1 : 0);
