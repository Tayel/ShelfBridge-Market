import type { Holder, Shop, ShopPhoto, State } from "./types";
import {
  activateListing, approveContract, authorize, capture, createListing, decideListing, payInvoice, requestContract,
  shopDefaults, signContract, YOU_HOLDER,
} from "./ops";
import { PRODUCTS } from "./data";
import { addDays, nowIso, today } from "./util";

/** Real stock photos of similar shops (Unsplash licence). The sample stores themselves are fictional. */
const stock = (...items: [ShopPhoto["kind"], string, string][]): ShopPhoto[] =>
  items.map(([kind, id, caption]) => ({ kind, caption, source: "stock", addedAt: "2026-01-01", url: `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1400&q=70` }));

const sd = (p: Partial<Shop> & { id: string; country: string }): Shop => shopDefaults({ seeded: true, status: "approved", ...p });

/** About to Fly Inside: sample shops inside airports. The photo is the product's own illustration. */
const ASSET = (p: string) => `${(import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/"}${p}`;
function AIRPORT_SHOPS(): Shop[] {
  const photo = (caption: string): ShopPhoto[] => [{ kind: "front", url: ASSET("images/airport-kiosk.jpg"), caption, source: "stock", addedAt: "2026-11-18" }];
  const listing = (traffic: number, nearby: string[], geo: [number, number]) => ({ shelfType: "eye-level" as const, footTraffic: traffic, features: ["cctv", "pos"], instantBook: false, pricing: "hybrid" as const, salesSharePct: 10, cancellation: "moderate" as const, access: "open" as const, responseRate: 99, responseHours: 3, ownerSince: 2023, sellsWell: "National gifts and food for travellers", nearby, geo });
  const base = { venue: "airport" as const, business: "4719", width: 5, depth: 4, bricks: [0, 1, 2, 3, 4, 5], tiers: 3, categories: ["food", "craft", "textile", "beauty"], restrictions: [], shelf: { widthCm: 90, heightCm: 35, depthCm: 40, capacity: 40 } };
  return [
    sd({ ...base, id: "s-cai-airport", photos: photo("Made in Egypt display, Terminal 2"), listing: listing(2400, ["Gates F1–F12", "Departures lounge"], [30.12, 31.41]), name: "Made in Egypt · Terminal 2", country: "EG", city: "Cairo", location: "Cairo International Airport, Terminal 2", address: "Cairo International Airport, Terminal 2, Departures, Gate F", price: 95, hue: 32, registration: "DEMO-EG-CR-77310", ownerName: "Karim Adel (sample)", floorNote: "Centre island facing gates F1–F12." }),
    sd({ ...base, id: "s-ist-airport", photos: photo("Anatolia gate shop, departures"), listing: listing(3100, ["Gates B1–B16", "Food court"], [41.26, 28.74]), name: "Anatolia Gate Shop", country: "TR", city: "Istanbul", location: "Istanbul Airport, Departures", address: "Istanbul Airport, Departures, Gates B1–B16", price: 120, hue: 205, registration: "DEMO-TR-MERSIS-6620", ownerName: "Selin Kaya (sample)", floorNote: "Front gondola on the walkway to gates B1–B16." }),
    sd({ ...base, id: "s-lis-airport", photos: photo("Feito em Portugal kiosk, Terminal 1"), listing: listing(1900, ["Gate 14", "Schengen departures"], [38.77, -9.13]), name: "Feito em Portugal · Gate 14", country: "PT", city: "Lisbon", location: "Lisbon Airport, Terminal 1", address: "Humberto Delgado Airport, Terminal 1, Gate 14", price: 110, hue: 12, registration: "DEMO-PT-NIPC-8812", ownerName: "Rui Matos (sample)", floorNote: "Kiosk wall opposite gate 14." }),
  ];
}

export const SEED_SHOPS: Shop[] = [
  sd({ id: "s-cairo", photos: stock(["front", "1605542202587-5849be5054a4", "Shop front"], ["inside", "1723140796154-7597be5363d8", "Inside the shop"], ["shelf", "1757801752791-8bcd63cec878", "The window shelf"]), listing: { shelfType: "window", footTraffic: 420, features: ["cctv", "pos"], instantBook: true, pricing: "fixed", salesSharePct: 0, cancellation: "flexible", access: "open", responseRate: 98, responseHours: 2, ownerSince: 2021, sellsWell: "Spices, dates and small gifts for visitors", nearby: ["Zamalek Art Gallery", "Two cafés", "Metro (10 min)"], geo: [30.06, 31.22] }, name: "Dokkan Zamalek", country: "EG", city: "Cairo", location: "26th of July St 112", address: "26th of July St 112, Zamalek, Cairo", business: "4711", width: 5, depth: 4, bricks: [0, 1, 2, 5, 10], tiers: 3, price: 29, categories: ["food", "drinks", "textile", "beauty"], restrictions: [], hue: 28, registration: "DEMO-EG-CR-48113", ownerName: "Hany Mansour (sample)", shelf: { widthCm: 80, heightCm: 32, depthCm: 38, capacity: 36 }, floorNote: "Left wall by the entrance, under the window.", terms: { ...shopDefaults({ id: "x", country: "EG" }).terms, months: 6, deposit: 40 } }),
  sd({ id: "s-alex", photos: stock(["front", "1610839123817-236de748e5c9", "Shop front"], ["inside", "1765031092161-a9ebe556117e", "Inside the pharmacy"], ["shelf", "1611072965169-e1534f6f300c", "The glass wall unit"]), listing: { shelfType: "eye-level", footTraffic: 260, features: ["cctv", "pos"], instantBook: false, pricing: "hybrid", salesSharePct: 8, cancellation: "moderate", access: "open", responseRate: 100, responseHours: 1, ownerSince: 2022, sellsWell: "Natural soap and skincare", nearby: ["Raml tram station", "Corniche"], geo: [31.2, 29.9] }, name: "Saydaliyat El Raml", country: "EG", city: "Alexandria", location: "Saad Zaghloul St 9", address: "Saad Zaghloul St 9, Raml Station, Alexandria", business: "4772", width: 4, depth: 3, bricks: [0, 3, 8], tiers: 2, price: 22, categories: ["beauty", "food"], restrictions: ["no-animal-test"], hue: 190, registration: "DEMO-EG-AX-20871", ownerName: "Mona Fawzy (sample)", shelf: { widthCm: 60, heightCm: 30, depthCm: 30, capacity: 24 }, floorNote: "Glass wall unit beside the counter." }),
  sd({ id: "s-lisbon", photos: stock(["front", "1768180316485-2c7306ab38ff", "Shop front"], ["inside", "1782177676949-f4af85ae4ff2", "Inside the shop"], ["shelf", "1717082778340-6bcc3a24f33d", "Oak shelving by the till"]), listing: { shelfType: "checkout", footTraffic: 380, features: ["restock", "pos", "cctv"], instantBook: true, pricing: "fixed", salesSharePct: 0, cancellation: "flexible", access: "open", responseRate: 97, responseHours: 3, ownerSince: 2019, sellsWell: "Cork goods, honey and tinned fish", nearby: ["Tram 28 stop", "Miradouro da Graça"], geo: [38.716, -9.13] }, name: "Mercearia da Graça", country: "PT", city: "Lisbon", location: "Rua da Graça 14", address: "Rua da Graça 14, 1170-169 Lisbon", business: "4711", width: 5, depth: 4, bricks: [0, 1, 2, 5, 10, 15], tiers: 3, price: 38, categories: ["food", "beauty", "craft", "drinks", "textile"], restrictions: ["no-plastic"], hue: 12, registration: "DEMO-PT-NIPC-5071", ownerName: "Inês Cardoso (sample)", shelf: { widthCm: 90, heightCm: 35, depthCm: 40, capacity: 40 }, floorNote: "Back wall, oak shelving facing the till." }),
  sd({ id: "s-budapest", photos: stock(["front", "1552602990-ba760f06432e", "Shop window"], ["inside", "1681418290255-a5355089dc6d", "Inside the shop"], ["shelf", "1760273464017-4bb7dfa42d91", "Chilled endcap"]), listing: { shelfType: "endcap", footTraffic: 300, features: ["chilled", "pos"], instantBook: false, pricing: "share", salesSharePct: 15, cancellation: "moderate", access: "open", responseRate: 90, responseHours: 6, ownerSince: 2023, sellsWell: "Paprika, preserves and linen", nearby: ["Great Market Hall", "Kálvin tér metro"], geo: [47.49, 19.06] }, name: "Csemege Kálvin", country: "HU", city: "Budapest", location: "Kálvin tér 7", address: "Kálvin tér 7, 1091 Budapest", business: "4711", width: 4, depth: 4, bricks: [0, 3, 12, 15], tiers: 3, price: 34, categories: ["food", "textile", "craft", "drinks"], restrictions: ["no-plastic"], hue: 350, registration: "DEMO-HU-CG-01-09", ownerName: "Gábor Tóth (sample)", shelf: { widthCm: 80, heightCm: 34, depthCm: 35, capacity: 32 }, floorNote: "Corner gondola opposite the deli." }),
  sd({ id: "s-istanbul", photos: stock(["front", "1656443046114-08c6dac52aa2", "Street-facing window"], ["inside", "1765809255360-6ed6240bd10f", "Inside the shop"], ["shelf", "1765810005650-0f393e45b50c", "The window ledge"]), listing: { shelfType: "window", footTraffic: 510, features: ["pos"], instantBook: true, pricing: "fixed", salesSharePct: 0, cancellation: "strict", access: "open", responseRate: 95, responseHours: 4, ownerSince: 2020, sellsWell: "Ceramics, lokum and coffee", nearby: ["Moda seafront", "Kadıköy ferry"], geo: [40.98, 29.03] }, name: "Moda Bakkal", country: "TR", city: "Istanbul", location: "Moda Cd. 41, Kadıköy", address: "Moda Cd. 41, Kadıköy, Istanbul", business: "4711", width: 4, depth: 3, bricks: [0, 1, 2, 3], tiers: 2, price: 27, categories: ["food", "craft", "textile", "beauty"], restrictions: [], hue: 205, registration: "DEMO-TR-MERSIS-0419", ownerName: "Emre Aydın (sample)", shelf: { widthCm: 70, heightCm: 30, depthCm: 35, capacity: 30 }, floorNote: "Front window ledge, street-facing." }),
  sd({ id: "s-dubai", photos: stock(["front", "1785596497581-19b671f83d70", "Shop front"], ["inside", "1789108978116-2763682414a4", "Wellness aisle"], ["shelf", "1687293375398-65aadbb792d1", "Eye-level shelf"], ["shelf", "1757800945999-ed0fa905d0f5", "Shelves along the aisle"]), listing: { shelfType: "eye-level", footTraffic: 640, features: ["chilled", "cctv", "restock", "pos"], instantBook: false, pricing: "hybrid", salesSharePct: 10, cancellation: "strict", access: "premium", responseRate: 92, responseHours: 5, ownerSince: 2018, sellsWell: "Wellness, oud and premium gifts", nearby: ["Al Fahidi Historical District", "Dubai Creek abra"], geo: [25.26, 55.3] }, name: "Al Fahidi Pharmacy", country: "AE", city: "Dubai", location: "Al Fahidi St", address: "Al Fahidi St, Bur Dubai", business: "4772", width: 4, depth: 4, bricks: [0, 1, 4, 5], tiers: 2, price: 72, categories: ["beauty", "food", "alcohol"], restrictions: ["no-animal-test"], hue: 330, registration: "DEMO-AE-DED-77310", ownerName: "Rashid Al Suwaidi (sample)", shelf: { widthCm: 60, heightCm: 30, depthCm: 30, capacity: 24 }, floorNote: "Wellness aisle, eye-level." }),
  ...AIRPORT_SHOPS(),
];

/** Legacy v1 seed shops, kept only when an earlier rental points at them. */
export const LEGACY_SEEDS: Shop[] = [
  sd({ id: "s-nairobi", name: "Kilimani Corner", country: "KE", city: "Nairobi", location: "Argwings Kodhek Rd", business: "5610", width: 4, depth: 4, bricks: [0, 3, 12, 15], tiers: 2, price: 24, categories: ["food", "drinks", "textile"], restrictions: ["fair-trade"], hue: 150, legacy: true }),
  sd({ id: "s-kyoto", name: "Hanaya Tsuki", country: "JP", city: "Kyoto", location: "Sanjo-dori 82", business: "4776", width: 4, depth: 3, bricks: [0, 1, 2, 3], tiers: 2, price: 61, categories: ["craft", "drinks", "textile"], restrictions: [], hue: 210, legacy: true }),
  sd({ id: "s-oaxaca", name: "Libros del Sol", country: "MX", city: "Oaxaca", location: "Calle Macedonio Alcalá", business: "4761", width: 5, depth: 3, bricks: [0, 4, 10, 14], tiers: 3, price: 19, categories: ["food", "craft", "textile", "alcohol"], restrictions: [], hue: 40, legacy: true }),
  sd({ id: "s-berlin", name: "Backstube Krause", country: "DE", city: "Berlin", location: "Weserstraße 31", business: "1071", width: 4, depth: 3, bricks: [3, 7, 11], tiers: 2, price: 44, categories: ["food", "drinks", "craft"], restrictions: ["no-plastic"], hue: 270, legacy: true }),
];

export const SEED_HOLDERS: Holder[] = [
  { id: YOU_HOLDER, name: "You (demo holder)", kind: "individual", country: "PT", registration: "DEMO-HOLDER-0001", verification: "not-started", seeded: false },
  { id: "h-nour", name: "Nour Atelier (sample)", kind: "company", country: "EG", registration: "DEMO-EG-CR-90021", verification: "demo-reviewed", seeded: true },
  { id: "h-defne", name: "Defne Seramik (sample)", kind: "company", country: "TR", registration: "DEMO-TR-MERSIS-7781", verification: "demo-reviewed", seeded: true },
  { id: "h-zsofi", name: "Zsófia Kertész (sample)", kind: "individual", country: "HU", registration: "DEMO-HU-EV-55120", verification: "not-started", seeded: true },
  // About to expire / About to fly sample makers
  { id: "h-delta", name: "Delta Foods Factory (sample)", kind: "company", country: "EG", registration: "DEMO-EG-CR-33870", verification: "demo-reviewed", seeded: true },
  { id: "h-gorece", name: "Görece Cam Atölyesi (sample)", kind: "company", country: "TR", registration: "DEMO-TR-MERSIS-4410", verification: "demo-reviewed", seeded: true },
  { id: "h-minho", name: "Oficina do Minho (sample)", kind: "individual", country: "PT", registration: "DEMO-PT-NIF-2290", verification: "demo-reviewed", seeded: true },
];

export function emptyState(): State {
  return { schema: 2, role: "holder", shops: [], tokens: [], holders: [], contracts: [], invoices: [], listings: [], orders: [], ledger: [], notifications: [], audit: [], saved: [], seq: 0 };
}

const fromProduct = (pid: string, origin: string, qty: number, over: { expiry?: string; batch?: string } = {}) => {
  const p = PRODUCTS.find((x) => x.id === pid)!;
  return { offer: p.offer, wasPrice: p.wasPrice, story: p.story, name: p.name, sku: `${pid.slice(0, 4).toUpperCase()}-${origin}-01`, category: p.category, description: p.description ?? "", color: p.color, imageUrl: undefined, origin, retail: p.retail, cost: p.unitCost, taxRate: 0, batch: over.batch ?? `B-${origin}-2026-01`, expiry: over.expiry ?? p.expiry, initialQty: qty };
};

/** Instant-book shops already carry the owner's agreement from the request, so only sign when it's missing. */
function signOwner(s: State, contractId: string, name: string) {
  const v = s.contracts.find((c) => c.id === contractId)!.versions[0];
  if (!v.ownerSig) signContract(s, contractId, "owner", name, "seed");
}

/** An active, signed sample shelf: contract from 30 days ago, first invoices paid. */
function activeShelf(s: State, shopId: string, slot: number, holderId: string, owner: string, holder: string): string {
  const cid = requestContract(s, { shopId, slot, holderId, start: today() });
  const k = s.contracts.find((c) => c.id === cid)!;
  k.versions[0].snapshot.terms.start = addDays(today(), -30);
  k.versions[0].snapshot.terms.end = addDays(today(), 150);
  approveContract(s, cid, "Platform reviewer (seed)");
  signOwner(s, cid, owner);
  signContract(s, cid, "holder", holder, "seed");
  s.invoices.filter((i) => i.contractId === cid).slice(0, 1).forEach((i) => payInvoice(s, i.id));
  return k.tokenId;
}

/**
 * Sample stock for the two special offers: a Cairo factory clearing near-date food ("About to expire") and
 * manufacturers in Istanbul and Lisbon airport shops ("About to Fly Inside"). Also added to browsers that saved
 * their demo before the offers existed (see store.ts), so it skips shelves that are already taken.
 */
export function seedOffers(s: State) {
  // Airport shops arrived after the first offers; older saves get them here.
  for (const a of SEED_SHOPS.filter((x) => x.venue === "airport")) if (!s.shops.some((x) => x.id === a.id)) s.shops.push({ ...a, createdAt: nowIso() });
  const plan: { shopId: string; slot: number; holderId: string; owner: string; holder: string; items: [string, number, number?][] }[] = [
    { shopId: "s-cairo", slot: 1, holderId: "h-delta", owner: "Hany Mansour", holder: "Delta Foods Factory", items: [["biscuit", 10, 12], ["mango", 12, 9], ["feta", 6, 21]] },
    { shopId: "s-ist-airport", slot: 0, holderId: "h-gorece", owner: "Selin Kaya", holder: "Görece Cam Atölyesi", items: [["nazar", 14], ["cezve", 5]] },
    { shopId: "s-lis-airport", slot: 0, holderId: "h-minho", owner: "Rui Matos", holder: "Oficina do Minho", items: [["azulejo", 16], ["galo", 8]] },
  ];
  for (const p of plan) {
    const shop = s.shops.find((x) => x.id === p.shopId);
    if (!shop || s.tokens.some((t) => t.shopId === p.shopId && t.slot === p.slot)) continue;
    try {
      const tokenId = activeShelf(s, p.shopId, p.slot, p.holderId, p.owner, p.holder);
      const ids = p.items.map(([pid, qty, days]) =>
        createListing(s, tokenId, { ...fromProduct(pid, shop.country, qty, days ? { expiry: addDays(today(), days), batch: `NEAR-${pid.slice(0, 3).toUpperCase()}-${days}` } : {}), taxRate: shop.terms.taxRate }));
      ids.forEach((id) => { decideListing(s, id, true, "", "Store owner (seed)"); activateListing(s, id); });
      const o = authorize(s, ids[0], 2, false); capture(s, o);
    } catch { /* a shelf changed under us in an old save: leave it out */ }
  }
}

/** Seed records are labelled as sample data; their signatures are marked "seed". */
export function seedState(): State {
  const s = emptyState();
  s.shops = SEED_SHOPS.map((x) => ({ ...x, createdAt: nowIso() }));
  s.holders = SEED_HOLDERS.map((h) => ({ ...h }));
  const tax = (country: string) => s.shops.find((x) => x.country === country)!.terms.taxRate;

  // Cairo: active, stocked, with one sale
  const c1 = requestContract(s, { shopId: "s-cairo", slot: 0, holderId: "h-nour", start: today() });
  const k1 = s.contracts.find((c) => c.id === c1)!;
  k1.versions[0].snapshot.terms.start = addDays(today(), -40);
  k1.versions[0].snapshot.terms.end = addDays(today(), 142);
  approveContract(s, c1, "Platform reviewer (seed)");
  signOwner(s, c1, "Hany Mansour");
  signContract(s, c1, "holder", "Nour El-Sayed", "seed");
  s.invoices.filter((i) => i.contractId === c1).slice(0, 2).forEach((i) => payInvoice(s, i.id));
  const t1 = k1.tokenId;
  const l1 = createListing(s, t1, { ...fromProduct("dukkah", "EG", 18), taxRate: tax("EG") });
  const l2 = createListing(s, t1, { ...fromProduct("towel", "EG", 5), taxRate: tax("EG") });
  const l3 = createListing(s, t1, { ...fromProduct("tea", "EG", 8), taxRate: tax("EG") });
  decideListing(s, l1, true, "", "Store owner (seed)"); decideListing(s, l2, true, "", "Store owner (seed)");
  activateListing(s, l1); activateListing(s, l2);
  const o = authorize(s, l1, 2, false); capture(s, o);

  // Istanbul: active, ending soon, expiring product
  const c2 = requestContract(s, { shopId: "s-istanbul", slot: 1, holderId: "h-defne", start: today() });
  const k2 = s.contracts.find((c) => c.id === c2)!;
  k2.versions[0].snapshot.terms.start = addDays(today(), -160);
  k2.versions[0].snapshot.terms.end = addDays(today(), 22);
  approveContract(s, c2, "Platform reviewer (seed)");
  signOwner(s, c2, "Emre Aydın");
  signContract(s, c2, "holder", "Defne Yıldız", "seed");
  s.invoices.filter((i) => i.contractId === c2 && i.dueDate < addDays(today(), -40)).forEach((i) => payInvoice(s, i.id));
  const l4 = createListing(s, k2.tokenId, { ...fromProduct("coaster", "TR", 12), taxRate: tax("TR") });
  const l5 = createListing(s, k2.tokenId, { ...fromProduct("lokum", "TR", 9, { expiry: addDays(today(), 19), batch: "LK-0526" }), taxRate: tax("TR") });
  decideListing(s, l4, true, "", "Store owner (seed)"); decideListing(s, l5, true, "", "Store owner (seed)");
  activateListing(s, l4); activateListing(s, l5);

  seedOffers(s);

  // Budapest: awaiting signatures
  requestContract(s, { shopId: "s-budapest", slot: 0, holderId: "h-zsofi", start: addDays(today(), 3) });

  s.notifications.forEach((n) => { n.read = true; });
  s.audit.forEach((a) => { a.actor = `${a.actor} [seed]`; });
  return s;
}
