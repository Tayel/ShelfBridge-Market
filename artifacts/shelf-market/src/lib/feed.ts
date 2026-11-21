/**
 * Compliance feed for the In-Raf FinCrime OS. The FinCrime OS screens the makers (holders) and shop owners and
 * monitors the QR sales and settlements. The browser holds the data, so the feed is a JSON file the admin
 * exports and the FinCrime OS loads (its Shelf Market page). Same shape on both sides: keep in step with
 * the FinCrime OS `src/lib/shelfMarket/feed.ts`.
 */
import type { State } from "./types";
import { nowIso } from "./util";

export const FEED_SCHEMA = "inraf.shelf-market.compliance-feed/v1";

/** `live`: the hosted server builds it, so it is labelled live and includes stores still waiting for approval (they need screening most). */
export function buildComplianceFeed(s: State, opts: { live?: boolean } = {}) {
  const contractOf = (id: string) => s.contracts.find((c) => c.id === id);
  return {
    schema: FEED_SCHEMA,
    source: opts.live ? "InRaf Shelf Market (live — payments simulated)" : "InRaf Shelf Market (demo — simulated money)",
    generatedAt: nowIso(),
    currency: "USD",
    shops: s.shops.filter((x) => opts.live || x.status !== "pending" || x.seeded).map((x) => ({
      id: x.id, name: x.name, country: x.country, city: x.city, address: x.address, registration: x.registration,
      ownerName: x.ownerName.replace(/\s*\(sample\)$/, ""), business: x.business, status: x.status, createdAt: x.createdAt,
    })),
    makers: s.holders.map((h) => ({ id: h.id, name: h.name.replace(/\s*\(sample\)$/, ""), kind: h.kind, country: h.country, registration: h.registration, verification: h.verification })),
    contracts: s.contracts.map((c) => {
      const v = c.versions[c.versions.length - 1];
      return { id: c.id, ref: c.ref, shopId: c.shopId, makerId: c.holderId, status: c.terminatedAt ? "terminated" : v.status, monthlyRent: v.snapshot.terms.monthlyRent, start: v.snapshot.terms.start, end: v.snapshot.terms.end };
    }),
    listings: s.listings.filter((l) => l.status !== "removed").map((l) => ({
      id: l.id, shopId: l.shopId, makerId: l.holderId, name: l.name, sku: l.sku, category: l.category, origin: l.origin,
      offer: l.offer ?? null, retail: l.retail, wasPrice: l.wasPrice ?? null, expiry: l.expiry ?? null, status: l.status, sold: l.sold, available: l.available,
    })),
    sales: s.orders.map((o) => ({
      id: o.id, ref: o.ref, at: o.capturedAt ?? o.createdAt, shopId: o.shopId, makerId: o.holderId, listingId: o.listingId,
      contractRef: contractOf(o.contractId)?.ref ?? null, product: o.productName, qty: o.qty, unit: o.unit, gross: o.gross, net: o.net,
      payment: o.payment, payout: o.payout, settledAt: o.settledAt ?? null, refund: o.refund?.status ?? null, customer: o.customerLabel,
    })),
    settlements: s.ledger.filter((e) => e.financial).map((e) => ({ id: e.id, at: e.at, type: e.type, amount: e.amount, shopId: e.shopId, makerId: e.holderId, orderId: e.orderId ?? null, memo: e.memo })),
  };
}

export type ComplianceFeed = ReturnType<typeof buildComplianceFeed>;
