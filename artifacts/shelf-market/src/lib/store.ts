/**
 * Browser-only demo store (localStorage). Not production-safe:
 * - No server, no multi-device sync: other phones/browsers see their own copy.
 * - Cross-tab: tabs refresh on the `storage` event and every mutation re-reads
 *   the latest saved state before applying guards, but there are no true locks.
 */
import { useSyncExternalStore } from "react";
import type { Contract, ContractVersion, Listing, Result, Role, Shop, State, Token } from "./types";
import { DemoError, YOU_HOLDER, _internal, audit, shopDefaults } from "./ops";
import { LEGACY_SEEDS, SEED_HOLDERS, SEED_SHOPS, emptyState, seedState } from "./seed";
import { PRODUCTS } from "./data";
import { nowIso, today, uid } from "./util";

export type { Shop, Token, State } from "./types";
export { usd } from "./util";
export { slotsOf, takenSlots } from "./selectors";

const KEY = "inraf-demo-v2";
const V1_KEY = "shelf-demo-v1"; // read for migration; never deleted

const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);

/** Fill any missing fields so older or partially-written data never crashes the UI. */
function normalize(raw: Partial<State>): State {
  const base = emptyState();
  const s: State = {
    ...base,
    role: (["owner", "holder", "customer", "admin"] as Role[]).includes(raw.role as Role) ? (raw.role as Role) : "holder",
    shops: arr<Shop>(raw.shops).filter((x) => x && x.id).map((x) => shopDefaults(x)),
    tokens: arr<Token>(raw.tokens).filter((t) => t && t.id),
    holders: arr(raw.holders),
    contracts: arr(raw.contracts),
    invoices: arr(raw.invoices),
    listings: arr(raw.listings),
    orders: arr(raw.orders),
    ledger: arr(raw.ledger),
    notifications: arr(raw.notifications),
    audit: arr(raw.audit),
    seq: typeof raw.seq === "number" ? raw.seq : 0,
    migratedFromV1: raw.migratedFromV1,
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

function migrateV1(v1: { shops?: Shop[]; tokens?: Token[] }): State {
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

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
    const old = localStorage.getItem(V1_KEY);
    if (old) {
      const s = migrateV1(JSON.parse(old));
      localStorage.setItem(KEY, JSON.stringify(s));
      return s;
    }
  } catch { /* fall through to seed */ }
  const s = seedState();
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
  return s;
}

let state: State = load();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try { state = normalize(JSON.parse(e.newValue)); emit(); } catch { /* ignore malformed */ }
  });
}

function readLatest(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch { /* use memory */ }
  return state;
}

let busy = false;
/** Apply a guarded mutation against the latest saved state. Errors are returned, never thrown. */
export function run(fn: (draft: State) => string | void): Result {
  if (busy) return { ok: false, error: "Another action is still being applied. Try again." };
  busy = true;
  try {
    const draft: State = JSON.parse(JSON.stringify(readLatest()));
    const id = fn(draft);
    try { localStorage.setItem(KEY, JSON.stringify(draft)); }
    catch { return { ok: false, error: "Browser storage is full or blocked — the change was not saved." }; }
    state = draft; emit();
    return { ok: true, id: id || undefined };
  } catch (e) {
    return { ok: false, error: e instanceof DemoError ? e.message : `Unexpected error: ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    busy = false;
  }
}

export function useStore(): State {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}
export const getState = () => state;

/** Explicit, user-confirmed reset of the v2 demo data. The original v1 key is left untouched. */
export function resetDemo(): Result {
  return run((d) => { const fresh = seedState(); Object.assign(d, fresh); });
}

export const todayIso = today;
