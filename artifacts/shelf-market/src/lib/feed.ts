/**
 * Compliance feed for the In-Raf FinCrime OS. The FinCrime OS screens the makers (holders) and shop owners and
 * monitors the QR sales and settlements. The browser holds the data, so the feed is a JSON file the admin
 * exports and the FinCrime OS loads (its Shelf Market page). Same shape on both sides: keep in step with
 * the FinCrime OS `src/lib/shelfMarket/feed.ts`.
 */
import type { State } from "./types";
import { nowIso, today } from "./util";

/**
 * v2 adds `applications` (the "I have a shop" journey) and each shop's venue and categories.
 * v3 (27 Nov 2026) adds `payments` (rent and deposits paid directly to the store, with method and confirmation) and,
 * on each sale, whether it was paid at the store's till and how the store paid the maker. Older readers ignore them.
 */
export const FEED_SCHEMA = "inraf.shelf-market.compliance-feed/v3";

/** `live`: the hosted server builds it, so it is labelled live and includes stores still waiting for approval (they need screening most). */
export function buildComplianceFeed(s: State, opts: { live?: boolean } = {}) {
  const contractOf = (id: string) => s.contracts.find((c) => c.id === id);
  return {
    schema: FEED_SCHEMA,
    source: opts.live ? "InRaf Shelf Market (live — payments made directly between parties, recorded on InRaf)" : "InRaf Shelf Market (demo — simulated money)",
    generatedAt: nowIso(),
    currency: "USD",
    shops: s.shops.filter((x) => opts.live || x.status !== "pending" || x.seeded).map((x) => ({
      id: x.id, name: x.name, country: x.country, city: x.city, address: x.address, registration: x.registration,
      ownerName: x.ownerName.replace(/\s*\(sample\)$/, ""), business: x.business, status: x.status, createdAt: x.createdAt,
      venue: x.venue ?? "neighbourhood", categories: x.categories, seeded: x.seeded,
      applicationRef: s.requests.find((r) => r.shopId === x.id)?.ref ?? null,
    })),
    /** Business applications, grouped the way the journey asks: where (venue), what (offers), which products (categories). */
    applications: (s.requests ?? []).map((r) => ({
      id: r.id, ref: r.ref, createdAt: r.createdAt, status: r.status, statusNote: r.statusNote ?? null,
      venue: r.venue, offers: r.offers, categories: r.categories, otherCategory: r.otherCategory ?? null,
      business: r.business, shopId: r.shopId ?? null,
      spaces: r.spaces.filter((a) => a.active).map((a) => ({ id: a.id, label: a.label, kind: a.kind, dims: a.dims, units: a.units, monthlyPrice: a.price, monthlyTotal: a.units * a.price })),
      airport: r.airport ?? null,
      products: r.products.map((p) => ({ name: p.name, category: p.category, qty: p.qty, price: p.price, value: p.qty * p.price })),
      surplus: r.surplus.map((p) => ({
        name: p.name, category: p.category, qty: p.qty, originalPrice: p.originalPrice, price: p.price, value: p.qty * p.price,
        discountPct: p.originalPrice > 0 ? Math.round((1 - p.price / p.originalPrice) * 100) : 0,
        made: p.made ?? null, expiry: p.expiry ?? null,
        daysLeft: p.expiry ? Math.round((Date.parse(p.expiry) - Date.parse(today())) / 86400e3) : null,
        condition: p.condition, storage: p.storage, handover: p.handover,
      })),
      services: r.services,
      terms: r.terms,
    })),
    makers: s.holders.map((h) => ({ id: h.id, name: h.name.replace(/\s*\(sample\)$/, ""), kind: h.kind, country: h.country, registration: h.registration, verification: h.verification })),
    contracts: s.contracts.map((c) => {
      const v = c.versions[c.versions.length - 1];
      return { id: c.id, ref: c.ref, shopId: c.shopId, makerId: c.holderId, status: c.terminatedAt ? "terminated" : v.status, monthlyRent: v.snapshot.terms.monthlyRent, start: v.snapshot.terms.start, end: v.snapshot.terms.end, model: c.model ?? "rental", commissionPct: v.snapshot.terms.salesSharePct ?? 0, offers: c.offers?.length ?? 0 };
    }),
    listings: s.listings.filter((l) => l.status !== "removed").map((l) => ({
      id: l.id, shopId: l.shopId, makerId: l.holderId, name: l.name, sku: l.sku, category: l.category, origin: l.origin,
      offer: l.offer ?? null, retail: l.retail, wasPrice: l.wasPrice ?? null, expiry: l.expiry ?? null, status: l.status, sold: l.sold, available: l.available,
    })),
    sales: s.orders.map((o) => ({
      id: o.id, ref: o.ref, at: o.capturedAt ?? o.createdAt, shopId: o.shopId, makerId: o.holderId, listingId: o.listingId,
      contractRef: contractOf(o.contractId)?.ref ?? null, product: o.productName, qty: o.qty, unit: o.unit, gross: o.gross, net: o.net,
      payment: o.payment, payout: o.payout, settledAt: o.settledAt ?? null, refund: o.refund?.status ?? null, customer: o.customerLabel,
      channel: o.channel ?? "online", settlementMethod: o.settlement?.method ?? null, settlementRef: o.settlement?.reference ?? null,
    })),
    /** Rent and deposit invoices, paid directly to the store owner: what the renter reported and what the store confirmed. */
    payments: s.invoices.map((i) => {
      const c = contractOf(i.contractId);
      return {
        id: i.id, ref: i.ref, contractRef: c?.ref ?? null, shopId: c?.shopId ?? null, makerId: c?.holderId ?? null, kind: i.kind, label: i.label,
        total: i.total, lateFee: i.lateFee ?? 0, dueDate: i.dueDate,
        status: i.voidedAt ? "void" : i.paidAt ? "paid" : i.dueDate < today() ? "overdue" : "due",
        reportedAt: i.reported?.at ?? null, reportedPaidOn: i.reported?.paidOn ?? null, reportedMethod: i.reported?.method ?? null,
        confirmedAt: i.paidAt ?? null, method: i.method ?? null, reference: i.paymentRef ?? null, lateFeeWaived: !!i.lateFeeWaived,
        returned: i.returned ? { at: i.returned.at, amount: i.returned.amount, deductions: i.returned.deductions, method: i.returned.method } : null,
      };
    }),
    settlements: s.ledger.filter((e) => e.financial).map((e) => ({ id: e.id, at: e.at, type: e.type, amount: e.amount, shopId: e.shopId, makerId: e.holderId, orderId: e.orderId ?? null, memo: e.memo })),
  };
}

export type ComplianceFeed = ReturnType<typeof buildComplianceFeed>;
