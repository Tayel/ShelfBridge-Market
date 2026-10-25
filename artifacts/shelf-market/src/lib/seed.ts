import type { Holder, Shop, State } from "./types";
import {
  activateListing, approveContract, authorize, capture, createListing, decideListing, payInvoice, requestContract,
  shopDefaults, signContract, YOU_HOLDER,
} from "./ops";
import { PRODUCTS } from "./data";
import { addDays, nowIso, today } from "./util";

const sd = (p: Partial<Shop> & { id: string; country: string }): Shop => shopDefaults({ seeded: true, status: "approved", ...p });

export const SEED_SHOPS: Shop[] = [
  sd({ id: "s-cairo", name: "Dokkan Zamalek", country: "EG", city: "Cairo", location: "26th of July St 112", address: "26th of July St 112, Zamalek, Cairo", business: "4711", width: 5, depth: 4, bricks: [0, 1, 2, 5, 10], tiers: 3, price: 29, categories: ["food", "drinks", "textile", "beauty"], restrictions: [], hue: 28, registration: "DEMO-EG-CR-48113", ownerName: "Hany Mansour (sample)", shelf: { widthCm: 80, heightCm: 32, depthCm: 38, capacity: 36 }, floorNote: "Left wall by the entrance, under the window.", terms: { ...shopDefaults({ id: "x", country: "EG" }).terms, months: 6, deposit: 40 } }),
  sd({ id: "s-alex", name: "Saydaliyat El Raml", country: "EG", city: "Alexandria", location: "Saad Zaghloul St 9", address: "Saad Zaghloul St 9, Raml Station, Alexandria", business: "4772", width: 4, depth: 3, bricks: [0, 3, 8], tiers: 2, price: 22, categories: ["beauty", "food"], restrictions: ["no-animal-test"], hue: 190, registration: "DEMO-EG-AX-20871", ownerName: "Mona Fawzy (sample)", shelf: { widthCm: 60, heightCm: 30, depthCm: 30, capacity: 24 }, floorNote: "Glass wall unit beside the counter." }),
  sd({ id: "s-lisbon", name: "Mercearia da Graça", country: "PT", city: "Lisbon", location: "Rua da Graça 14", address: "Rua da Graça 14, 1170-169 Lisbon", business: "4711", width: 5, depth: 4, bricks: [0, 1, 2, 5, 10, 15], tiers: 3, price: 38, categories: ["food", "beauty", "craft", "drinks", "textile"], restrictions: ["no-plastic"], hue: 12, registration: "DEMO-PT-NIPC-5071", ownerName: "Inês Cardoso (sample)", shelf: { widthCm: 90, heightCm: 35, depthCm: 40, capacity: 40 }, floorNote: "Back wall, oak shelving facing the till." }),
  sd({ id: "s-budapest", name: "Csemege Kálvin", country: "HU", city: "Budapest", location: "Kálvin tér 7", address: "Kálvin tér 7, 1091 Budapest", business: "4711", width: 4, depth: 4, bricks: [0, 3, 12, 15], tiers: 3, price: 34, categories: ["food", "textile", "craft", "drinks"], restrictions: ["no-plastic"], hue: 350, registration: "DEMO-HU-CG-01-09", ownerName: "Gábor Tóth (sample)", shelf: { widthCm: 80, heightCm: 34, depthCm: 35, capacity: 32 }, floorNote: "Corner gondola opposite the deli." }),
  sd({ id: "s-istanbul", name: "Moda Bakkal", country: "TR", city: "Istanbul", location: "Moda Cd. 41, Kadıköy", address: "Moda Cd. 41, Kadıköy, Istanbul", business: "4711", width: 4, depth: 3, bricks: [0, 1, 2, 3], tiers: 2, price: 27, categories: ["food", "craft", "textile", "beauty"], restrictions: [], hue: 205, registration: "DEMO-TR-MERSIS-0419", ownerName: "Emre Aydın (sample)", shelf: { widthCm: 70, heightCm: 30, depthCm: 35, capacity: 30 }, floorNote: "Front window ledge, street-facing." }),
  sd({ id: "s-dubai", name: "Al Fahidi Pharmacy", country: "AE", city: "Dubai", location: "Al Fahidi St", address: "Al Fahidi St, Bur Dubai", business: "4772", width: 4, depth: 4, bricks: [0, 1, 4, 5], tiers: 2, price: 72, categories: ["beauty", "food", "alcohol"], restrictions: ["no-animal-test"], hue: 330, registration: "DEMO-AE-DED-77310", ownerName: "Rashid Al Suwaidi (sample)", shelf: { widthCm: 60, heightCm: 30, depthCm: 30, capacity: 24 }, floorNote: "Wellness aisle, eye-level." }),
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
];

export function emptyState(): State {
  return { schema: 2, role: "holder", shops: [], tokens: [], holders: [], contracts: [], invoices: [], listings: [], orders: [], ledger: [], notifications: [], audit: [], seq: 0 };
}

const fromProduct = (pid: string, origin: string, qty: number, over: { expiry?: string; batch?: string } = {}) => {
  const p = PRODUCTS.find((x) => x.id === pid)!;
  return { name: p.name, sku: `${pid.slice(0, 4).toUpperCase()}-${origin}-01`, category: p.category, description: p.description ?? "", color: p.color, imageUrl: undefined, origin, retail: p.retail, cost: p.unitCost, taxRate: 0, batch: over.batch ?? `B-${origin}-2026-01`, expiry: over.expiry ?? p.expiry, initialQty: qty };
};

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
  signContract(s, c1, "owner", "Hany Mansour", "seed");
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
  signContract(s, c2, "owner", "Emre Aydın", "seed");
  signContract(s, c2, "holder", "Defne Yıldız", "seed");
  s.invoices.filter((i) => i.contractId === c2 && i.dueDate < addDays(today(), -40)).forEach((i) => payInvoice(s, i.id));
  const l4 = createListing(s, k2.tokenId, { ...fromProduct("coaster", "TR", 12), taxRate: tax("TR") });
  const l5 = createListing(s, k2.tokenId, { ...fromProduct("lokum", "TR", 9, { expiry: addDays(today(), 19), batch: "LK-0526" }), taxRate: tax("TR") });
  decideListing(s, l4, true, "", "Store owner (seed)"); decideListing(s, l5, true, "", "Store owner (seed)");
  activateListing(s, l4); activateListing(s, l5);

  // Budapest: awaiting signatures
  requestContract(s, { shopId: "s-budapest", slot: 0, holderId: "h-zsofi", start: addDays(today(), 3) });

  s.notifications.forEach((n) => { n.read = true; });
  s.audit.forEach((a) => { a.actor = `${a.actor} [seed]`; });
  return s;
}
