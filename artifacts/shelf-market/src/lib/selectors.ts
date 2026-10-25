import type { Contract, ContractVersion, Listing, RentInvoice, Shop, State, Token } from "./types";
import { daysUntil, round2, today } from "./util";

export type ContractStatus = "awaiting" | "active" | "expired" | "terminated";

export const slotsOf = (s: Shop) => s.bricks.length * s.tiers;
export const takenSlots = (st: State, shopId: string) =>
  new Set(st.tokens.filter((t) => t.shopId === shopId && !t.released).map((t) => t.slot));
export const shelfLabel = (shop: Shop, slot: number) => `${shop.id.replace(/^s-|^shop-/, "").slice(0, 4).toUpperCase()}-S${String(slot + 1).padStart(2, "0")}`;

export const executedVersion = (c: Contract): ContractVersion | undefined => [...c.versions].reverse().find((v) => v.status === "executed");
export const awaitingVersion = (c: Contract): ContractVersion | undefined => c.versions.find((v) => v.status === "awaiting");
export const latestVersion = (c: Contract): ContractVersion => c.versions[c.versions.length - 1];

export function contractStatus(c: Contract): ContractStatus {
  if (c.terminatedAt) return "terminated";
  const ex = executedVersion(c);
  if (!ex) return "awaiting";
  return ex.snapshot.terms.end < today() ? "expired" : "active";
}

export const contractOfToken = (s: State, tokenId: string) => s.contracts.find((c) => c.tokenId === tokenId);

export function invoiceStatus(i: RentInvoice): "paid" | "due" | "overdue" | "void" {
  if (i.voidedAt) return "void";
  if (i.paidAt) return "paid";
  return i.dueDate < today() ? "overdue" : "due";
}

export function lateFeeFor(s: State, i: RentInvoice): number {
  if (invoiceStatus(i) !== "overdue") return 0;
  const c = s.contracts.find((x) => x.id === i.contractId);
  const v = c?.versions.find((x) => x.v === i.version);
  if (!v) return 0;
  const late = -daysUntil(i.dueDate);
  return late > v.snapshot.terms.graceDays ? round2((i.total * v.snapshot.terms.lateFeePct) / 100) : 0;
}

export const reservedQty = (s: State, listingId: string) =>
  s.orders.filter((o) => o.listingId === listingId && o.payment === "authorized").reduce((a, o) => a + o.qty, 0);

export const isExpired = (l: Listing) => !!l.expiry && l.expiry < today();
export const expiresSoon = (l: Listing) => !!l.expiry && !isExpired(l) && daysUntil(l.expiry) <= 30;
export const isLowStock = (l: Listing) => l.status === "active" && l.available > 0 && l.available <= 3;

/** Returns a human reason why this shelf cannot sell, or null when it can. */
export function shelfBlockReason(s: State, token: Token): string | null {
  const shop = s.shops.find((x) => x.id === token.shopId);
  if (!shop) return "Store not found";
  if (shop.status === "suspended") return "This store is suspended by the platform (simulated admin).";
  if (shop.status !== "approved") return "This store is awaiting platform approval.";
  if (token.released) return "This shelf rental has ended and the shelf was released.";
  if (token.suspended) return "This shelf is suspended by the platform (simulated admin).";
  const c = contractOfToken(s, token.id);
  if (!c) return "No rental contract on file.";
  const cs = contractStatus(c);
  if (cs !== "active") return `Rental contract is ${cs === "awaiting" ? "awaiting approval and signatures" : cs}.`;
  return null;
}

export function listingBlockReason(s: State, l: Listing): string | null {
  const t = s.tokens.find((x) => x.id === l.tokenId);
  if (!t) return "Shelf not found";
  const r = shelfBlockReason(s, t);
  if (r) return r;
  if (l.status !== "active") return "This product is not on sale right now.";
  if (isExpired(l)) return "This batch has expired and cannot be sold.";
  if (l.available - reservedQty(s, l.id) <= 0) return "Sold out.";
  return null;
}

export const shelfUnits = (s: State, tokenId: string, exceptListingId?: string) =>
  s.listings.filter((l) => l.tokenId === tokenId && l.status !== "removed" && l.status !== "rejected" && l.id !== exceptListingId)
    .reduce((a, l) => a + l.available, 0);

export function holderMoney(s: State, holderId?: string) {
  const L = s.ledger.filter((e) => !holderId || e.holderId === holderId);
  const sum = (t: string[]) => round2(L.filter((e) => t.includes(e.type)).reduce((a, e) => a + e.amount, 0));
  const payable = sum(["holder_payable", "holder_payable_reversed"]);
  const settled = sum(["payout_settled"]);
  const orders = s.orders.filter((o) => !holderId || o.holderId === holderId);
  const processing = round2(orders.filter((o) => o.payout === "processing").reduce((a, o) => a + o.net, 0));
  const pending = round2(orders.filter((o) => o.payout === "pending" || o.payout === "failed").reduce((a, o) => a + o.net, 0));
  const recovery = round2(Math.max(0, settled - payable));
  const gross = sum(["capture_gross", "refund_gross"]);
  const fees = sum(["platform_fee", "platform_fee_reversed"]);
  const tax = sum(["tax_collected", "tax_reversed"]);
  const rentPaid = sum(["rent_paid", "deposit_paid"]);
  return { payable, settled, processing, pending, recovery, gross, fees, tax, rentPaid };
}

export interface RecCheck { orderRef: string; orderId: string; ok: boolean; note: string; }
export function reconcile(s: State): RecCheck[] {
  return s.orders.filter((o) => o.payment === "captured" || o.payment === "refunded").map((o) => {
    const L = s.ledger.filter((e) => e.orderId === o.id);
    const t = (k: string) => round2(L.filter((e) => e.type === k).reduce((a, e) => a + e.amount, 0));
    const issues: string[] = [];
    const parts = round2(t("tax_collected") + t("platform_fee") + t("holder_payable"));
    if (round2(t("capture_gross")) !== round2(o.gross)) issues.push("captured gross differs from order");
    if (parts !== round2(t("capture_gross"))) issues.push("gross does not split into tax + fee + net");
    if (round2(t("holder_payable")) !== round2(o.net)) issues.push("holder payable differs from order net");
    if (L.filter((e) => e.type === "payout_settled").length > 1) issues.push("more than one settlement recorded");
    if (o.payout === "settled" && t("payout_settled") !== round2(o.net)) issues.push("settled amount differs from net");
    if (o.payout !== "settled" && t("payout_settled") !== 0 && o.payment !== "refunded") issues.push("settlement recorded without settled state");
    if (!o.stockDeducted) issues.push("stock not deducted for captured order");
    if (o.payment === "refunded") {
      const after = round2(t("capture_gross") + t("refund_gross"));
      if (after !== 0) issues.push("refund does not offset capture");
    }
    return { orderRef: o.ref, orderId: o.id, ok: issues.length === 0, note: issues.length ? issues.join("; ") : "Ledger ties to order" };
  });
}
