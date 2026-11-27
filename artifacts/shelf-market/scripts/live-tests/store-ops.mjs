// Remote store operations for token holders: requests to the store, evidence and verification, incidents,
// deliveries and receiving, physical counts and reconciliation — and who may see or do what.
// Run against the LOCAL dev server only (it relies on the dev sign-in link): node scripts/live-tests/store-ops.mjs
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
const owner = client(), maker = client(), maker2 = client(), admin = client(), stranger = client();
const makerEmail = `ops-m-${RUN}@inraf.test`, ownerEmail = `ops-o-${RUN}@inraf.test`;
await owner.signIn(ownerEmail, "Hany Mansour"); await maker.signIn(makerEmail, "Karim's Kitchen"); await maker2.signIn(`ops-m2-${RUN}@inraf.test`, "Other Maker");
await admin.signIn("admin@inraf.test", "InRaf team"); await stranger.signIn(`ops-x-${RUN}@inraf.test`, "Stranger");
const photo = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";
const shopId = (await owner.act("createShop", { name: "Dokkan Hany", country: "EG", city: "Cairo", location: "Zamalek 1", business: "4711", width: 2, depth: 2, bricks: [0, 1], tiers: 1, price: 25, categories: ["food"], restrictions: [], hue: 12, photos: [{ url: photo, kind: "front" }, { url: photo, kind: "shelf" }] })).id;
await owner.act("updateShop", shopId, { registration: "EG-1" }); await admin.act("setShopStatus", shopId, "approved", "ok");
const start = new Date(Date.now() + 86400e3).toISOString().slice(0, 10);
async function rent(m, slot) {
  const c = await m.act("requestContract", { shopId, slot, holderId: "x", start, months: 6 });
  await admin.act("approveContract", c.id, "x"); await owner.act("sign", c.id, "owner", "Hany", false);
  const s = await m.act("sign", c.id, "holder", "M", false);
  return s.state.contracts.find((x) => x.id === c.id).tokenId;
}
const tok = await rent(maker, 0), tok2 = await rent(maker2, 1);
const jam = await maker.act("createListing", tok, { name: "Fig jam", sku: "KK-1", category: "food", description: "", color: "#b5651d", origin: "EG", retail: 6, cost: 2, taxRate: 0, batch: "B1", initialQty: 10 });
await owner.act("decideListing", jam.id, true, ""); await maker.act("activateListing", jam.id);

// ---- requests to the store ----
check((await maker2.act("openCase", { kind: "task", type: "restock", tokenId: tok, description: "Please restock" })).ok === false, "a maker can't send requests about someone else's shelf");
check((await maker.act("openCase", { kind: "task", type: "nonsense", tokenId: tok, description: "x".repeat(10) })).ok === false, "an unknown request type is refused");
const t1 = await maker.act("openCase", { kind: "task", type: "photo", tokenId: tok, description: "Please photograph my shelf from the front", priority: "urgent" });
check(t1.ok, `the maker asks for a shelf photo (${t1.error ?? "ok"})`);
let os = await owner.state();
check(os.cases.some((c) => c.id === t1.id && c.status === "submitted") && os.notifications.some((n) => n.title === "New request from a maker"), "the owner sees the request and is notified");
check(!(await maker2.state()).cases.some((c) => c.id === t1.id) && !(await stranger.state()).cases.some((c) => c.id === t1.id), "other makers and strangers can't see it");
check((await maker.act("caseAction", t1.id, "complete", { note: "done" })).ok === false, "the maker can't mark the store's work as done");
check((await owner.act("caseAction", t1.id, "accept", {})).ok === false, "the owner can't accept on the maker's behalf");
check((await owner.act("caseAction", t1.id, "receive", {})).ok, "the owner acknowledges it");
check((await owner.act("caseAction", t1.id, "start", { assignee: "Ahmed (floor staff)" })).ok, "the owner assigns it to a staff member");
check((await owner.act("caseAction", t1.id, "complete", { note: "Photo taken" })).ok === false, "a photo request can't be completed without a photo");
check((await owner.act("caseAction", t1.id, "complete", { note: "Front of shelf, 10 jars", photos: [photo] })).ok, "the owner completes it with photo evidence");
let mc = (await maker.state()).cases.find((c) => c.id === t1.id);
check(mc.status === "awaiting-verification" && mc.assignee === "Ahmed (floor staff)" && mc.evidence.some((e) => e.by === "owner"), "the maker sees who did it and the evidence, waiting for their check");
check((await maker.act("caseAction", t1.id, "concern", {})).ok === false, "a concern needs a reason");
check((await maker.act("caseAction", t1.id, "concern", { note: "The photo is blurry, please retake" })).ok, "the maker raises a concern");
check((await owner.act("caseAction", t1.id, "complete", { note: "Retaken in daylight", photos: [photo] })).ok, "the owner redoes it");
check((await maker.act("caseAction", t1.id, "accept", {})).ok, "the maker accepts the evidence");
mc = (await maker.state()).cases.find((c) => c.id === t1.id);
check(mc.status === "completed" && mc.events.length >= 7, "only then is it completed, with the full history kept");
check((await maker.act("caseAction", t1.id, "concern", { note: "again" })).ok === false, "a completed request can't be reopened by mistake");

// ---- physical count and reconciliation ----
const sale = await owner.act("recordTillSale", jam.id, 2);
const cnt = await maker.act("openCase", { kind: "task", type: "count", tokenId: tok, description: "Monthly count please" });
let cc = (await owner.state()).cases.find((c) => c.id === cnt.id);
check(cc.count?.[0]?.expected === 8, "a count request knows the expected stock (10 − 2 sold = 8)");
await owner.act("caseAction", cnt.id, "start", {});
check((await owner.act("caseAction", cnt.id, "complete", { note: "Counted" })).ok === false, "a count can't be completed without quantities");
check((await owner.act("caseAction", cnt.id, "complete", { note: "Counted twice", counts: { [jam.id]: 7 } })).ok, "the store records 7 counted");
check((await maker.act("applyCount", cnt.id, "fix")).ok === false, "a count can't be applied before the maker accepts it");
await maker.act("caseAction", cnt.id, "accept", {});
const before = (await maker.state()).listings.find((l) => l.id === jam.id).available;
check(before === 8, "accepting a count doesn't change stock by itself");
check((await maker.act("applyCount", cnt.id, "")).ok === false, "applying a count needs a reason");
check((await maker.act("applyCount", cnt.id, "Physical count by store")).ok, "the maker applies the count");
let ms = await maker.state();
check(ms.listings.find((l) => l.id === jam.id).available === 7 && ms.movements.some((m) => m.type === "count-adjustment" && m.qty === -1 && m.source === "physical-count"), "stock becomes 7, recorded as a count adjustment (not a sale or a loss)");
check((await maker.act("applyCount", cnt.id, "again")).ok === false, "a count is applied only once");

// ---- incident ----
const inc = await maker.act("openCase", { kind: "incident", type: "missing", tokenId: tok, listingId: jam.id, description: "One jar missing after the count" });
check(inc.ok && (await admin.state()).notifications.some((n) => n.title === "Incident reported"), "the maker reports an incident and InRaf is told");
check((await maker.act("caseAction", inc.id, "escalate", { note: "No reply from the store" })).ok, "the maker escalates it");
check((await admin.state()).cases.find((c) => c.id === inc.id)?.status === "escalated", "InRaf sees it escalated");
check((await admin.act("caseAction", inc.id, "resolve", { note: "Store refunds one jar against next rent" })).ok, "InRaf resolves it");
check((await maker.act("caseAction", inc.id, "comment", { note: "Thanks" })).ok, "the conversation can continue after resolution");

// ---- delivery and receiving ----
check((await maker.act("recordDelivery", { tokenId: tok, lines: [{ listingId: jam.id, expected: 0 }] })).ok === false, "a delivery needs quantities");
const dl = await maker.act("recordDelivery", { tokenId: tok, lines: [{ listingId: jam.id, expected: 6 }], carrier: "Bosta", tracking: "BST-123", expectedOn: start });
check(dl.ok && (await owner.state()).notifications.some((n) => n.title === "Delivery on its way"), "the maker registers a delivery and the owner is told");
check((await maker.act("receiveDelivery", dl.id, { lines: [{ listingId: jam.id, received: 6, damaged: 0 }] })).ok === false, "the maker can't confirm receipt for the store");
check((await owner.act("receiveDelivery", dl.id, { lines: [{ listingId: jam.id, received: 5, damaged: 2 }] })).ok === false, "received plus damaged can't exceed what was sent");
check((await owner.act("receiveDelivery", dl.id, { lines: [{ listingId: jam.id, received: 4, damaged: 1 }], note: "One jar cracked", photos: [photo] })).ok, "the owner records 4 good, 1 damaged, 1 missing");
ms = await maker.state();
const d = ms.deliveries.find((x) => x.id === dl.id);
check(d.status === "partial" && d.lines[0].received === 4 && d.lines[0].damaged === 1, "the maker sees a partial delivery with the differences");
check(ms.listings.find((l) => l.id === jam.id).available === 11, "only the 4 good units go on sale (7 + 4 = 11)");
check(ms.movements.some((m) => m.type === "delivery-received" && m.qty === 4 && m.source === "store-reported") && ms.movements.some((m) => m.type === "delivery-damaged" && m.qty === 0 && m.units === 1), "receipt and damage are both recorded, by source");
check((await maker.act("openCase", { kind: "incident", type: "delivery-discrepancy", tokenId: tok, deliveryId: dl.id, description: "1 jar missing, 1 damaged" })).ok, "the maker can open an incident linked to the delivery");
check(!(await maker2.state()).deliveries.some((x) => x.id === dl.id) && !(await maker2.state()).movements.some((m) => m.listingId === jam.id), "another maker sees none of it");

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
console.log(`Maker account for the browser: ${makerEmail} · owner: ${ownerEmail}`);
process.exit(failures ? 1 : 0);
