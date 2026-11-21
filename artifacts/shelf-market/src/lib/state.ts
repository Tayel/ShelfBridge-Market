/** Pure state helpers shared by the browser store and the server: fill missing fields, migrate old saves. */
import type { Contract, ContractVersion, Listing, Role, Shop, State, Token } from "./types";
import { YOU_HOLDER, _internal, audit, shopDefaults } from "./ops";
import { LEGACY_SEEDS, SEED_HOLDERS, SEED_SHOPS, emptyState, seedState } from "./seed";
import { PRODUCTS } from "./data";
import { nowIso, uid } from "./util";

const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);

/** Fill any missing fields so older or partially-written data never crashes the UI. */
export function normalize(raw: Partial<State>): State {
  const base = emptyState();
  const s: State = {
    ...base,
    role: (["owner", "holder", "customer", "admin"] as Role[]).includes(raw.role as Role) ? (raw.role as Role) : "holder",
    // Seeded shops saved before listing attributes or photos existed pick them up from the seed.
    shops: arr<Shop>(raw.shops).filter((x) => x && x.id).map((x) => {
      const seed = x.seeded ? SEED_SHOPS.find((y) => y.id === x.id) : undefined;
      return shopDefaults({ ...x, listing: x.listing ?? seed?.listing, photos: x.photos ?? seed?.photos });
    }),
    tokens: arr<Token>(raw.tokens).filter((t) => t && t.id),
    holders: arr(raw.holders),
    contracts: arr(raw.contracts),
    invoices: arr(raw.invoices),
    listings: arr(raw.listings),
    orders: arr(raw.orders),
    ledger: arr(raw.ledger),
    notifications: arr(raw.notifications),
    audit: arr(raw.audit),
    saved: arr<string>(raw.saved).filter((x) => typeof x === "string"),
    seq: typeof raw.seq === "number" ? raw.seq : 0,
    migratedFromV1: raw.migratedFromV1,
    offersSeeded: raw.offersSeeded,
    airportsSeeded: raw.airportsSeeded,
  };
  SEED_HOLDERS.forEach((h) => { if (!s.holders.some((x) => x.id === h.id)) s.holders.push({ ...h }); });
  s.tokens = s.tokens.map((t) => ({ ...t, sold: t.sold ?? 0, revenue: t.revenue ?? 0, sales: t.sales ?? [], holderId: t.holderId ?? YOU_HOLDER, contractId: t.contractId ?? "", stage: t.stage ?? "A" }));
  // Any token without a contract gets a transparent migrated contract (no signatures fabricated).
  s.tokens.forEach((t) => {
    if (t.contractId && s.contracts.some((c) => c.id === t.contractId)) return;
    const shop = s.shops.find((x) => x.id === t.shopId);
    if (!shop) return;
    const holder = s.holders.find((h) => h.id === t.holderId) ?? s.holders[0];
    const start = (t.createdAt ?? nowIso()).slice(0, 10);
    const v: ContractVersion = {
      v: 1, kind: "migrated", createdAt: nowIso(), status: "awaiting",
      snapshot: _internal.snapshot(s, shop, t, holder, start, shop.terms.months, t.rent ?? shop.price),
      note: "Migrated from an earlier demo rental. No approval or signatures were recorded then, so none are shown here.",
    };
    const c: Contract = { id: uid("ctr"), ref: _internal.nextRef(s, "CTR"), tokenId: t.id, shopId: shop.id, holderId: holder.id, versions: [v], createdAt: nowIso() };
    s.contracts.push(c); t.contractId = c.id;
    audit(s, "System", "contract.migrated", c.ref, "Earlier rental converted to contract awaiting admin approval and both signatures; sales blocked until active");
    s.notifications.push({ id: uid("ntf"), at: nowIso(), role: "holder", title: "Rental needs a contract", body: `${shop.name}: your earlier rental now needs admin approval and both signatures before sales.`, link: `/contracts/${c.id}`, read: false });
  });
  // Legacy single-product tokens become listings.
  s.tokens.forEach((t) => {
    if (!t.productId || s.listings.some((l) => l.tokenId === t.id)) return;
    const p = PRODUCTS.find((x) => x.id === t.productId);
    if (!p) return;
    const shop = s.shops.find((x) => x.id === t.shopId);
    const status: Listing["status"] = t.stage === "requested" ? "pending" : t.stage === "rejected" ? "rejected" : "approved";
    s.listings.push({
      id: uid("lst"), tokenId: t.id, shopId: t.shopId, holderId: t.holderId, name: p.name, sku: `${p.id.slice(0, 4).toUpperCase()}-${t.origin ?? "XX"}-L1`,
      category: p.category, description: p.description ?? "", color: p.color, origin: t.origin ?? "", retail: p.retail, cost: p.unitCost,
      taxRate: shop?.terms.taxRate ?? 10, batch: "LEGACY", expiry: p.expiry, initialQty: t.qty ?? 0, available: Math.max(0, (t.qty ?? 0) - t.sold),
      sold: t.sold, returned: 0, status, statusNote: t.stage === "B" ? "Migrated stock — activate after contract is active" : undefined,
      createdAt: t.createdAt ?? nowIso(), updatedAt: nowIso(), legacyRevenue: t.revenue,
    });
  });
  if (!s.migratedFromV1 && s.shops.length === 0) return seedState();
  return s;
}

export function migrateV1(v1: { shops?: Shop[]; tokens?: Token[] }): State {
  const seeded = seedState();
  const oldShops = arr<Shop>(v1.shops);
  const oldTokens = arr<Token>(v1.tokens);
  const userShops = oldShops.filter((x) => !x.seeded).map((x) => shopDefaults({ ...x, status: "approved", statusNote: "Carried over from the earlier demo where listings were public." }));
  const referenced = new Set(oldTokens.map((t) => t.shopId));
  const seededIds = new Set(SEED_SHOPS.map((x) => x.id));
  const legacy = LEGACY_SEEDS.filter((x) => referenced.has(x.id) && !seededIds.has(x.id));
  const merged: Partial<State> = {
    ...seeded,
    shops: [...seeded.shops, ...legacy, ...userShops],
    tokens: [...seeded.tokens, ...oldTokens.map((t) => ({ ...t, holderId: YOU_HOLDER, contractId: "" }))],
    migratedFromV1: nowIso(),
  };
  return normalize(merged);
}

