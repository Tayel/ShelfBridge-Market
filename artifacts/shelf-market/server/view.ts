/**
 * What each person is allowed to see of the shared marketplace. Everyone sees approved stores, products on
 * sale and which shelves are taken; contracts, invoices, orders, money and notices are only sent to the
 * people involved; the audit log only to the InRaf team.
 */
import type { State } from "../src/lib/types";
import type { Me } from "./auth";

export function viewFor(s: State, me: Me | null, principal: string, saved: string[]): State {
  if (me?.isAdmin) return { ...s, saved };
  const mine = new Set([principal, ...(me ? [`u:${me.id}`] : [])]);
  const myShops = new Set(s.shops.filter((x) => me && x.ownerUserId === me.id).map((x) => x.id));
  const myHolder = me?.holderId ?? "\u0000";
  const shops = s.shops
    .filter((x) => x.status === "approved" || myShops.has(x.id))
    .map((x) => (myShops.has(x.id) ? x : { ...x, registration: "", statusNote: undefined }));
  const visibleShops = new Set(shops.map((x) => x.id));
  const party = (shopId: string, holderId: string) => myShops.has(shopId) || holderId === myHolder;
  const contracts = s.contracts.filter((c) => party(c.shopId, c.holderId));
  const contractIds = new Set(contracts.map((c) => c.id));
  return {
    ...s,
    shops,
    holders: s.holders.map((h) => (h.id === myHolder ? h : { ...h, registration: "" })),
    tokens: s.tokens
      .filter((t) => visibleShops.has(t.shopId))
      .map((t) => (party(t.shopId, t.holderId) ? t : { ...t, revenue: 0, sales: [], stockCost: undefined })),
    contracts,
    invoices: s.invoices.filter((i) => contractIds.has(i.contractId)),
    listings: s.listings.filter((l) => visibleShops.has(l.shopId) && (l.status === "active" || party(l.shopId, l.holderId))),
    // Stores and makers see their orders, but never which visitor or account placed them.
    orders: s.orders.filter((o) => party(o.shopId, o.holderId) || (o.buyerId && mine.has(o.buyerId)))
      .map((o) => (o.buyerId && mine.has(o.buyerId) ? o : { ...o, buyerId: undefined })),
    ledger: s.ledger.filter((e) => party(e.shopId, e.holderId)),
    notifications: s.notifications.filter((n) => n.userIds?.some((u) => mine.has(u))),
    requests: s.requests.filter((r) => me && r.userId === me.id),
    cases: s.cases.filter((c) => party(c.shopId, c.holderId)),
    deliveries: s.deliveries.filter((d) => party(d.shopId, d.holderId)),
    movements: s.movements.filter((m) => party(m.shopId, m.holderId)),
    audit: [],
    saved,
  };
}
