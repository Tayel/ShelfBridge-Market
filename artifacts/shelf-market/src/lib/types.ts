export type Role = "owner" | "holder" | "customer" | "admin";
export type ShopStatus = "pending" | "approved" | "suspended";

export interface ShelfSpec { widthCm: number; heightCm: number; depthCm: number; capacity: number; }

export interface RentalTerms {
  months: number;
  deposit: number;
  taxRate: number; // illustrative %
  renewal: "manual" | "auto-offer" | "none";
  lateFeePct: number;
  graceDays: number;
  maintenance: string;
  liability: string;
  display: string;
  dispute: string;
}

export interface Shop {
  id: string; name: string; country: string; city: string; location: string;
  business: string; width: number; depth: number; bricks: number[];
  tiers: number; price: number; categories: string[]; restrictions: string[];
  seeded: boolean; hue: number;
  // BRD additions
  address: string; registration: string; ownerName: string;
  status: ShopStatus; statusNote?: string;
  shelf: ShelfSpec; terms: RentalTerms; floorNote: string;
  createdAt: string; legacy?: boolean;
  // Marketplace listing attributes (search, filters, trust)
  listing: ShopListing;
  /** "airport": a shop inside an airport, where About to Fly Inside shelves live. Absent: a neighbourhood shop. */
  venue?: "airport";
  photos: ShopPhoto[];
}

export type PhotoKind = "front" | "inside" | "shelf";
export interface ShopPhoto {
  url: string; // https URL, or a compressed data URL for photos uploaded in this browser
  kind: PhotoKind;
  caption?: string;
  source: "owner" | "stock"; // stock = real photo of a similar shop, used for sample stores
  addedAt: string;
}

export type ShelfType = "eye-level" | "endcap" | "checkout" | "fridge" | "window";
export type PricingModel = "fixed" | "share" | "hybrid";
export type CancellationPolicy = "flexible" | "moderate" | "strict";
export type AccessTier = "open" | "premium";

export interface ShopListing {
  shelfType: ShelfType;
  footTraffic: number; // shoppers per day, owner-declared
  features: string[]; // ids from FEATURES
  instantBook: boolean; // owner pre-agrees to the standard terms
  pricing: PricingModel;
  salesSharePct: number; // used when pricing is "share" or "hybrid"
  cancellation: CancellationPolicy;
  access: AccessTier;
  responseRate: number; // %
  responseHours: number;
  ownerSince: number; // year
  sellsWell: string;
  nearby: string[];
  geo?: [number, number]; // lat, lng
}

export type TokenStage = "A" | "requested" | "approved" | "rejected" | "B";

export interface Token {
  id: string; shopId: string; slot: number; stage: TokenStage; rent: number; createdAt: string;
  holderId: string; contractId: string;
  suspended?: boolean; released?: boolean;
  // legacy fields from v1 (kept for transparency)
  productId?: string; origin?: string; qty?: number; stockCost?: number;
  sold: number; revenue: number; sales: { at: string; amount: number }[];
}

export interface Holder {
  id: string; name: string; kind: "individual" | "company"; country: string;
  registration: string; // demo value only
  verification: "not-started" | "demo-reviewed";
  seeded: boolean;
}

export interface Signature { name: string; at: string; via: "ui" | "simulated" | "seed" | "instant"; }

export interface ContractSnapshot {
  store: { id: string; name: string; address: string; city: string; country: string; registration: string; ownerName: string };
  shelf: { tokenId: string; slot: number; label: string; count: number; spec: ShelfSpec; areaCm2: number; floorNote: string; categories: string[]; restrictions: string[] };
  holder: { id: string; name: string; kind: string; registration: string };
  terms: RentalTerms & {
    monthlyRent: number; start: string; end: string; paymentFrequency: "monthly";
    // Frozen from the listing at request time. Missing on contracts made before pricing models existed (= fixed).
    pricing?: PricingModel; salesSharePct?: number;
  };
}

export type VersionKind = "original" | "renewal" | "amendment" | "migrated";
export type VersionStatus = "awaiting" | "executed" | "superseded" | "void";

export interface ContractVersion {
  v: number; kind: VersionKind; createdAt: string; note?: string;
  snapshot: ContractSnapshot;
  adminApproval?: Signature;
  ownerSig?: Signature;
  holderSig?: Signature;
  status: VersionStatus;
}

export interface Contract {
  id: string; ref: string; tokenId: string; shopId: string; holderId: string;
  versions: ContractVersion[];
  terminatedAt?: string; terminationReason?: string;
  createdAt: string;
}

export interface RentInvoice {
  id: string; ref: string; contractId: string; version: number; kind: "rent" | "deposit";
  label: string; amount: number; tax: number; total: number; dueDate: string;
  paidAt?: string; receiptRef?: string; voidedAt?: string; lateFee?: number;
}

export type ListingStatus = "draft" | "pending" | "approved" | "rejected" | "active" | "inactive" | "removed";

/** Special shelf offers. "expiring": factory stock close to its expiry date, sold below its usual price.
 *  "flying": souvenirs from local makers that carry the place's culture, for visitors to take home. */
export type ListingOffer = "expiring" | "flying";

export interface Listing {
  id: string; tokenId: string; shopId: string; holderId: string;
  offer?: ListingOffer; wasPrice?: number; story?: string;
  name: string; sku: string; category: string; description: string;
  color: string; imageUrl?: string; origin: string;
  retail: number; cost: number; taxRate: number; batch: string; expiry?: string;
  initialQty: number; available: number; sold: number; returned: number;
  status: ListingStatus; statusNote?: string;
  createdAt: string; updatedAt: string; legacyRevenue?: number;
}

export type PaymentState = "authorized" | "captured" | "failed" | "cancelled" | "refunded";
export type PayoutState = "none" | "pending" | "processing" | "settled" | "failed" | "reversed";

export interface Order {
  id: string; ref: string; listingId: string; tokenId: string; shopId: string; holderId: string; contractId: string;
  productName: string; sku: string;
  qty: number; unit: number; subtotal: number; tax: number; taxRate: number; serviceFee: number; commission: number; gross: number; net: number;
  shopShare?: number; sharePct?: number; // store owner's cut under a share-of-sales contract (absent on older orders)
  payment: PaymentState; payout: PayoutState;
  simRef: string; customerLabel: string;
  createdAt: string; authorizedAt?: string; capturedAt?: string; failedAt?: string; cancelledAt?: string;
  payoutRequestedAt?: string; settledAt?: string; payoutFailedAt?: string; refundedAt?: string;
  stockDeducted: boolean;
  refund?: { status: "requested" | "approved" | "rejected"; reason: string; requestedAt: string; decidedAt?: string; restocked?: boolean; note?: string };
}

export type LedgerType =
  | "authorization" | "authorization_failed" | "authorization_cancelled"
  | "capture_gross" | "tax_collected" | "platform_fee" | "holder_payable"
  | "payout_initiated" | "payout_settled" | "payout_failed"
  | "refund_gross" | "tax_reversed" | "platform_fee_reversed" | "holder_payable_reversed" | "payout_reversed" | "holder_recovery"
  | "rent_paid" | "deposit_paid"
  | "shop_share" | "shop_share_reversed" | "shop_payout_settled" | "shop_recovery";

export interface LedgerEntry {
  id: string; seq: number; at: string; type: LedgerType; amount: number; financial: boolean;
  orderId?: string; invoiceId?: string; contractId?: string;
  shopId: string; tokenId?: string; holderId: string; listingId?: string;
  memo: string;
}

export interface Notice { id: string; at: string; role: Role; title: string; body: string; link?: string; read: boolean; }
export interface AuditEntry { id: string; at: string; actor: string; action: string; ref: string; detail: string; }

export interface State {
  schema: 2;
  role: Role;
  shops: Shop[]; tokens: Token[]; holders: Holder[];
  contracts: Contract[]; invoices: RentInvoice[];
  listings: Listing[]; orders: Order[]; ledger: LedgerEntry[];
  notifications: Notice[]; audit: AuditEntry[];
  saved: string[]; // shop ids on the viewer's wishlist
  seq: number;
  offersSeeded?: string; // when the About to Expire / About to Fly samples were added
  airportsSeeded?: string; // when the airport shops for About to Fly Inside were added
  migratedFromV1?: string;
}

export type Result = { ok: true; id?: string } | { ok: false; error: string };
