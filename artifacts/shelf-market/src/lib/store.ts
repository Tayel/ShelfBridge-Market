import { useSyncExternalStore } from "react";
import { PRODUCTS, SHELF_CAPACITY, type Product } from "./data";

export interface Shop {
  id: string; name: string; country: string; city: string; location: string;
  business: string; width: number; depth: number; bricks: number[];
  tiers: number; price: number; categories: string[]; restrictions: string[];
  seeded: boolean; hue: number;
}

export type TokenStage = "A" | "requested" | "approved" | "rejected" | "B";

export interface Token {
  id: string; shopId: string; slot: number; stage: TokenStage; rent: number; createdAt: string;
  productId?: string; origin?: string; qty?: number; stockCost?: number;
  sold: number; revenue: number; sales: { at: string; amount: number }[];
}

export interface State { shops: Shop[]; tokens: Token[]; }

const KEY = "shelf-demo-v1";

const seedShops: Shop[] = [
  { id: "s-lisbon", name: "Mercearia da Graça", country: "PT", city: "Lisbon", location: "Rua da Graça 14", business: "4711", width: 5, depth: 4, bricks: [0, 1, 2, 5, 10, 15], tiers: 3, price: 38, categories: ["food", "beauty", "craft", "drinks"], restrictions: ["no-plastic"], seeded: true, hue: 12 },
  { id: "s-nairobi", name: "Kilimani Corner", country: "KE", city: "Nairobi", location: "Argwings Kodhek Rd", business: "5610", width: 4, depth: 4, bricks: [0, 3, 12, 15], tiers: 2, price: 24, categories: ["food", "drinks", "textile"], restrictions: ["fair-trade"], seeded: true, hue: 150 },
  { id: "s-kyoto", name: "Hanaya Tsuki", country: "JP", city: "Kyoto", location: "Sanjo-dori 82", business: "4776", width: 4, depth: 3, bricks: [0, 1, 2, 3], tiers: 2, price: 61, categories: ["craft", "drinks", "textile"], restrictions: [], seeded: true, hue: 210 },
  { id: "s-oaxaca", name: "Libros del Sol", country: "MX", city: "Oaxaca", location: "Calle Macedonio Alcalá", business: "4761", width: 5, depth: 3, bricks: [0, 4, 10, 14], tiers: 3, price: 19, categories: ["food", "craft", "textile", "alcohol"], restrictions: [], seeded: true, hue: 40 },
  { id: "s-dubai", name: "Al Fahidi Pharmacy", country: "AE", city: "Dubai", location: "Al Fahidi St", business: "4772", width: 4, depth: 4, bricks: [0, 1, 4, 5], tiers: 2, price: 72, categories: ["beauty", "food", "alcohol"], restrictions: ["no-animal-test"], seeded: true, hue: 330 },
  { id: "s-berlin", name: "Backstube Krause", country: "DE", city: "Berlin", location: "Weserstraße 31", business: "1071", width: 4, depth: 3, bricks: [3, 7, 11], tiers: 2, price: 44, categories: ["food", "drinks", "craft"], restrictions: ["no-plastic"], seeded: true, hue: 270 },
];

const initial = (): State => ({ shops: seedShops, tokens: [] });

let state: State = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch { /* ignore */ }
  return initial();
})();

const listeners = new Set<() => void>();
function set(next: State) {
  state = next;
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}
export function useStore(): State {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

export const slotsOf = (s: Shop) => s.bricks.length * s.tiers;
export const takenSlots = (st: State, shopId: string) =>
  new Set(st.tokens.filter((t) => t.shopId === shopId).map((t) => t.slot));
export const productOf = (id?: string): Product | undefined => PRODUCTS.find((p) => p.id === id);
export const remaining = (t: Token) => Math.max(0, (t.qty ?? 0) - t.sold);

export const actions = {
  publishShop(shop: Omit<Shop, "id" | "seeded">): string {
    const id = uid("shop");
    set({ ...state, shops: [...state.shops, { ...shop, id, seeded: false }] });
    return id;
  },
  deleteShop(id: string) {
    if (state.tokens.some((t) => t.shopId === id)) return false;
    set({ ...state, shops: state.shops.filter((s) => s.id !== id) });
    return true;
  },
  rent(shopId: string, slot: number): string | null {
    const shop = state.shops.find((s) => s.id === shopId);
    if (!shop || slot >= slotsOf(shop) || takenSlots(state, shopId).has(slot)) return null;
    const id = uid("tok");
    set({ ...state, tokens: [...state.tokens, { id, shopId, slot, stage: "A", rent: shop.price, createdAt: new Date().toISOString(), sold: 0, revenue: 0, sales: [] }] });
    return id;
  },
  patch(id: string, p: Partial<Token>) {
    set({ ...state, tokens: state.tokens.map((t) => (t.id === id ? { ...t, ...p } : t)) });
  },
  request(id: string, productId: string, origin: string, qty: number) {
    const q = Math.max(1, Math.min(SHELF_CAPACITY, Math.floor(qty)));
    this.patch(id, { stage: "requested", productId, origin, qty: q });
  },
  decide(id: string, ok: boolean) { this.patch(id, { stage: ok ? "approved" : "rejected" }); },
  stock(id: string) {
    const t = state.tokens.find((x) => x.id === id); const p = productOf(t?.productId);
    if (!t || !p || t.stage !== "approved") return;
    this.patch(id, { stage: "B", stockCost: +(p.unitCost * (t.qty ?? 0)).toFixed(2) });
  },
  sell(id: string) {
    const t = state.tokens.find((x) => x.id === id); const p = productOf(t?.productId);
    if (!t || !p || t.stage !== "B" || remaining(t) <= 0) return;
    this.patch(id, { sold: t.sold + 1, revenue: +(t.revenue + p.retail).toFixed(2), sales: [...t.sales, { at: new Date().toISOString(), amount: p.retail }] });
  },
  reset() { set(initial()); },
};

export const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
