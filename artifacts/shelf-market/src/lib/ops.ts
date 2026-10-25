/**
 * Pure demo business logic. Every function mutates a draft copy of the latest
 * state and throws DemoError when a guard fails. Nothing here touches a server,
 * a payment provider, an e-signature service or a bank.
 */
import type {
  Contract, ContractSnapshot, ContractVersion, Holder, LedgerEntry, LedgerType, Listing, Order, RentInvoice,
  RentalTerms, Role, Shop, State, Token, VersionKind,
} from "./types";
import {
  awaitingVersion, contractOfToken, contractStatus, executedVersion, invoiceStatus, isExpired, lateFeeFor,
  listingBlockReason, reservedQty, shelfBlockReason, shelfLabel, shelfUnits, takenSlots, slotsOf,
} from "./selectors";
import { CUSTOMER_SERVICE_FEE, PLATFORM_COMMISSION_PCT, demoTaxFor } from "./data";
import { addDays, addMonths, nowIso, round2, today, uid } from "./util";

export class DemoError extends Error {}
function fail(m: string): never { throw new DemoError(m); }

export const YOU_HOLDER = "h-you";
export const ROLE_LABEL: Record<Role, string> = { owner: "Store owner", holder: "Token holder", customer: "Customer", admin: "Platform admin" };

// ---------- infra ----------
const nextRef = (s: State, p: string) => { s.seq += 1; return `${p}-${String(s.seq).padStart(5, "0")}`; };

export function audit(s: State, actor: string, action: string, ref: string, detail: string) {
  s.audit.push({ id: uid("aud"), at: nowIso(), actor, action, ref, detail });
}
export function notify(s: State, role: Role, title: string, body: string, link?: string) {
  s.notifications.push({ id: uid("ntf"), at: nowIso(), role, title, body, link, read: false });
}
function ledger(s: State, e: Omit<LedgerEntry, "id" | "seq" | "at" | "financial"> & { financial?: boolean }) {
  s.seq += 1;
  s.ledger.push({ financial: true, ...e, id: `LED-${String(s.seq).padStart(6, "0")}`, seq: s.seq, at: nowIso(), amount: round2(e.amount) });
}

const shopOf = (s: State, id: string) => s.shops.find((x) => x.id === id) ?? fail("Store not found.");
const tokenOf = (s: State, id: string) => s.tokens.find((x) => x.id === id) ?? fail("Shelf token not found.");
const contractOf = (s: State, id: string) => s.contracts.find((x) => x.id === id) ?? fail("Contract not found.");
const listingOf = (s: State, id: string) => s.listings.find((x) => x.id === id) ?? fail("Product not found.");
const orderOf = (s: State, id: string) => s.orders.find((x) => x.id === id) ?? fail("Order not found.");
export const holderOf = (s: State, id: string): Holder =>
  s.holders.find((h) => h.id === id) ?? { id, name: "Unknown holder", kind: "individual", country: "", registration: "—", verification: "not-started", seeded: false };

// ---------- defaults ----------
export function defaultTerms(country: string): RentalTerms {
  return {
    months: 6, deposit: 0, taxRate: demoTaxFor(country), renewal: "manual", lateFeePct: 5, graceDays: 7,
    maintenance: "Store owner keeps the shelf installed, safe and clean. Token holder replenishes, arranges and removes own goods.",
    liability: "Token holder bears risk for its products (damage, loss, expiry, prohibited goods, unsold stock) unless caused by the store owner's negligence.",
    display: "Products stay within the shelf footprint. Pricing is set by the token holder. Expired or recalled goods are removed within 48 hours.",
    dispute: "Parties first try good-faith resolution via the platform within 14 days, then a mediator agreed by both.",
  };
}

export function shopDefaults(p: Partial<Shop> & { id: string }): Shop {
  const country = p.country ?? "PT";
  return {
    name: "Untitled shop", city: "", location: "", business: "4711", width: 4, depth: 4, bricks: [0], tiers: 2, price: 30,
    categories: ["food"], restrictions: [], seeded: false, hue: 12,
    address: p.location ?? "", registration: "DEMO-REG-0000", ownerName: "You (demo owner)", status: "approved",
    shelf: { widthCm: 90, heightCm: 35, depthCm: 40, capacity: 40 }, floorNote: "Spot and tier shown on the shop floor plan.",
    createdAt: nowIso(),
    ...p,
    country,
    terms: { ...defaultTerms(country), ...(p.terms ?? {}) },
  } as Shop;
}

// ---------- stores ----------
export type ShopInput = Pick<Shop, "name" | "country" | "city" | "location" | "business" | "width" | "depth" | "bricks" | "tiers" | "price" | "categories" | "restrictions" | "hue">;

export function createShop(s: State, input: ShopInput): string {
  if (!input.name.trim()) fail("Shop name is required.");
  if (input.bricks.length === 0) fail("Raise at least one shelf spot.");
  const id = uid("shop");
  s.shops.push(shopDefaults({ ...input, id, seeded: false, status: "pending", address: `${input.location}, ${input.city}`, registration: `DEMO-${input.country}-${Math.floor(1000 + Math.random() * 8999)}` }));
  audit(s, ROLE_LABEL.owner, "store.submitted", id, `${input.name} submitted for platform approval`);
  notify(s, "admin", "New store awaiting approval", `${input.name} (${input.city}) was submitted.`, "/admin?tab=stores");
  notify(s, "owner", "Store submitted", `${input.name} is pending platform approval (simulated admin).`, `/owner-dashboard/shops/${id}`);
  return id;
}

export function updateShop(s: State, id: string, patch: Partial<Pick<Shop, "name" | "address" | "registration" | "ownerName" | "price" | "floorNote" | "shelf" | "terms" | "city">>) {
  const shop = shopOf(s, id);
  if (shop.seeded) fail("Seeded sample stores are read-only.");
  if (patch.shelf && (patch.shelf.capacity < 1 || patch.shelf.widthCm < 10 || patch.shelf.heightCm < 10 || patch.shelf.depthCm < 10)) fail("Shelf dimensions must be at least 10 cm and capacity at least 1 unit.");
  if (patch.price !== undefined && patch.price <= 0) fail("Rent must be above zero.");
  if (patch.terms && (patch.terms.months < 1 || patch.terms.months > 36)) fail("Duration must be 1–36 months.");
  Object.assign(shop, patch);
  audit(s, ROLE_LABEL.owner, "store.updated", id, "Store and shelf details updated (existing contract versions unchanged)");
}

export function setShopStatus(s: State, id: string, status: Shop["status"], note: string) {
  const shop = shopOf(s, id);
  if (shop.status === status) fail(`Store is already ${status}.`);
  shop.status = status; shop.statusNote = note || undefined;
  audit(s, ROLE_LABEL.admin, `store.${status}`, id, `${shop.name}: ${note || "no note"}`);
  notify(s, "owner", `Store ${status}`, `${shop.name} is now ${status}.${note ? ` Note: ${note}` : ""}`, `/owner-dashboard/shops/${id}`);
  if (status === "suspended") {
    notify(s, "holder", "Store suspended", `Sales on shelves at ${shop.name} are blocked while it is suspended.`, "/dashboard");
  }
}

export function deleteShop(s: State, id: string) {
  const shop = shopOf(s, id);
  if (shop.seeded) fail("Seeded sample stores can't be removed.");
  if (s.tokens.some((t) => t.shopId === id)) fail("This store has shelf rentals on record and can't be removed.");
  s.shops = s.shops.filter((x) => x.id !== id);
  audit(s, ROLE_LABEL.owner, "store.removed", id, shop.name);
}

// ---------- contracts ----------
function snapshot(s: State, shop: Shop, token: Token, holder: Holder, start: string, months: number, rent: number, terms?: RentalTerms): ContractSnapshot {
  const t = terms ?? shop.terms;
  return JSON.parse(JSON.stringify({
    store: { id: shop.id, name: shop.name, address: shop.address || `${shop.location}, ${shop.city}`, city: shop.city, country: shop.country, registration: shop.registration, ownerName: shop.ownerName },
    shelf: {
      tokenId: token.id, slot: token.slot, label: shelfLabel(shop, token.slot), count: 1, spec: shop.shelf,
      areaCm2: shop.shelf.widthCm * shop.shelf.depthCm,
      floorNote: `${shop.floorNote} Spot ${Math.floor(token.slot / shop.tiers) + 1}, tier ${(token.slot % shop.tiers) + 1}.`,
      categories: shop.categories, restrictions: shop.restrictions,
    },
    holder: { id: holder.id, name: holder.name, kind: holder.kind, registration: holder.registration },
    terms: { ...t, months, monthlyRent: rent, start, end: addMonths(start, months), paymentFrequency: "monthly" },
  })) as ContractSnapshot;
}

export function requestContract(s: State, a: { shopId: string; slot: number; holderId: string; start: string; months?: number }): string {
  const shop = shopOf(s, a.shopId);
  if (shop.status !== "approved") fail("This store isn't approved for rentals right now.");
  if (a.slot < 0 || a.slot >= slotsOf(shop)) fail("That shelf doesn't exist.");
  if (takenSlots(s, shop.id).has(a.slot)) fail("That shelf was just requested by someone else. Pick another.");
  if (!a.start || a.start < today()) fail("Start date can't be in the past.");
  const holder = holderOf(s, a.holderId);
  const months = a.months ?? shop.terms.months;
  const tokenId = uid("tok"); const contractId = uid("ctr");
  const token: Token = { id: tokenId, shopId: shop.id, slot: a.slot, stage: "A", rent: shop.price, createdAt: nowIso(), holderId: holder.id, contractId, sold: 0, revenue: 0, sales: [] };
  s.tokens.push(token);
  const v: ContractVersion = { v: 1, kind: "original", createdAt: nowIso(), snapshot: snapshot(s, shop, token, holder, a.start, months, shop.price), status: "awaiting" };
  const c: Contract = { id: contractId, ref: nextRef(s, "CTR"), tokenId, shopId: shop.id, holderId: holder.id, versions: [v], createdAt: nowIso() };
  s.contracts.push(c);
  audit(s, ROLE_LABEL.holder, "contract.requested", c.ref, `${holder.name} requested ${shelfLabel(shop, a.slot)} at ${shop.name}, v1 snapshot frozen`);
  notify(s, "owner", "New shelf rental request", `${holder.name} requested ${shelfLabel(shop, a.slot)} at ${shop.name}. Review and sign.`, `/contracts/${c.id}`);
  notify(s, "admin", "Contract awaiting approval", `${c.ref} for ${shop.name} needs platform review.`, `/contracts/${c.id}`);
  notify(s, "holder", "Contract created", `${c.ref} is waiting for admin approval and both signatures.`, `/contracts/${c.id}`);
  return c.id;
}

function versionToAct(c: Contract) {
  if (c.terminatedAt) fail("This contract was terminated.");
  return awaitingVersion(c) ?? fail("There is no version awaiting signatures.");
}

export function approveContract(s: State, contractId: string, name: string) {
  const c = contractOf(s, contractId); const v = versionToAct(c);
  if (v.adminApproval) fail("Admin approval is already recorded for this version.");
  if (!name.trim()) fail("Type the reviewer name.");
  v.adminApproval = { name: name.trim(), at: nowIso(), via: "ui" };
  audit(s, ROLE_LABEL.admin, "contract.approved", `${c.ref} v${v.v}`, `Approved by ${name.trim()} (simulated admin)`);
  notify(s, "holder", "Contract approved by platform", `${c.ref} v${v.v} passed admin review.`, `/contracts/${c.id}`);
  notify(s, "owner", "Contract approved by platform", `${c.ref} v${v.v} passed admin review.`, `/contracts/${c.id}`);
  maybeExecute(s, c, v);
}

export function rejectVersion(s: State, contractId: string, reason: string) {
  const c = contractOf(s, contractId); const v = versionToAct(c);
  v.status = "void"; v.note = `Rejected by admin: ${reason || "no reason given"}`;
  audit(s, ROLE_LABEL.admin, "contract.rejected", `${c.ref} v${v.v}`, v.note);
  notify(s, "holder", "Contract version rejected", `${c.ref} v${v.v}: ${reason || "no reason"}`, `/contracts/${c.id}`);
  notify(s, "owner", "Contract version rejected", `${c.ref} v${v.v}: ${reason || "no reason"}`, `/contracts/${c.id}`);
  if (!executedVersion(c)) releaseToken(s, c, "Initial version rejected");
}

export function signContract(s: State, contractId: string, party: "owner" | "holder", name: string, via: "ui" | "simulated" | "seed") {
  const c = contractOf(s, contractId); const v = versionToAct(c);
  const shop = shopOf(s, c.shopId); const holder = holderOf(s, c.holderId);
  if (!name.trim()) fail("Type the signer's full name to sign.");
  if (via === "ui" && party === "owner" && shop.seeded) fail("This is a sample store. Use “Simulate owner signature”.");
  if (via === "ui" && party === "holder" && holder.seeded) fail("This holder is a sample profile. Use “Simulate holder signature”.");
  if (via === "simulated" && party === "owner" && !shop.seeded) fail("You own this store. Sign it yourself.");
  if (via === "simulated" && party === "holder" && !holder.seeded) fail("You are this holder. Sign it yourself.");
  const key = party === "owner" ? "ownerSig" : "holderSig";
  if (v[key]) fail(`The ${party === "owner" ? "store owner" : "token holder"} already signed v${v.v}.`);
  v[key] = { name: name.trim(), at: nowIso(), via };
  audit(s, via === "ui" ? ROLE_LABEL[party] : `${ROLE_LABEL[party]} (simulated)`, "contract.signed", `${c.ref} v${v.v}`, `Demo signature recorded: “${name.trim()}”`);
  notify(s, party === "owner" ? "holder" : "owner", "Contract signed", `${name.trim()} signed ${c.ref} v${v.v}.`, `/contracts/${c.id}`);
  maybeExecute(s, c, v);
}

function maybeExecute(s: State, c: Contract, v: ContractVersion) {
  if (!v.adminApproval || !v.ownerSig || !v.holderSig) return;
  const prev = executedVersion(c);
  if (prev) prev.status = "superseded";
  v.status = "executed";
  const token = tokenOf(s, c.tokenId);
  token.rent = v.snapshot.terms.monthlyRent;
  // rent schedule
  if (prev && v.kind === "amendment") {
    s.invoices.filter((i) => i.contractId === c.id && !i.paidAt && !i.voidedAt && i.dueDate >= today()).forEach((i) => { i.voidedAt = nowIso(); });
  }
  const t = v.snapshot.terms;
  if (t.deposit > 0 && !s.invoices.some((i) => i.contractId === c.id && i.kind === "deposit" && !i.voidedAt)) {
    s.invoices.push({ id: uid("inv"), ref: nextRef(s, "RNT"), contractId: c.id, version: v.v, kind: "deposit", label: "Security deposit", amount: t.deposit, tax: 0, total: t.deposit, dueDate: t.start });
  }
  for (let i = 0; i < t.months; i++) {
    const due = addDays(addMonths(t.start, i), 5);
    if (v.kind === "amendment" && due < today()) continue;
    const tax = round2((t.monthlyRent * t.taxRate) / 100);
    s.invoices.push({ id: uid("inv"), ref: nextRef(s, "RNT"), contractId: c.id, version: v.v, kind: "rent", label: `Rent month ${i + 1} (v${v.v})`, amount: t.monthlyRent, tax, total: round2(t.monthlyRent + tax), dueDate: due });
  }
  audit(s, "System", "contract.executed", `${c.ref} v${v.v}`, "Admin approval + both demo signatures recorded; version activated");
  (["holder", "owner", "admin"] as Role[]).forEach((r) => notify(s, r, "Contract active", `${c.ref} v${v.v} is now active (demo, not a legal contract).`, `/contracts/${c.id}`));
  syncStage(s, token.id);
}

export function newVersion(s: State, contractId: string, kind: Extract<VersionKind, "renewal" | "amendment">, a: { months: number; monthlyRent: number; note: string }, actor: Role) {
  const c = contractOf(s, contractId);
  if (c.terminatedAt) fail("Terminated contracts can't be renewed or amended.");
  if (awaitingVersion(c)) fail("A version is already awaiting signatures. Finish or reject it first.");
  const ex = executedVersion(c) ?? fail("Only an executed contract can be renewed or amended.");
  if (a.months < 1 || a.months > 36) fail("Duration must be 1–36 months.");
  if (a.monthlyRent <= 0) fail("Rent must be above zero.");
  const shop = shopOf(s, c.shopId); const token = tokenOf(s, c.tokenId);
  const start = kind === "renewal" ? ex.snapshot.terms.end : (ex.snapshot.terms.start > today() ? ex.snapshot.terms.start : today());
  const terms: RentalTerms = { ...ex.snapshot.terms };
  const snap = snapshot(s, shop, token, holderOf(s, c.holderId), start, a.months, a.monthlyRent, terms);
  const v: ContractVersion = { v: c.versions.length + 1, kind, createdAt: nowIso(), snapshot: snap, status: "awaiting", note: a.note || undefined };
  c.versions.push(v);
  audit(s, ROLE_LABEL[actor], `contract.${kind}`, `${c.ref} v${v.v}`, `New unsigned version (${a.months} mo at ${a.monthlyRent}/mo). ${a.note}`);
  (["owner", "holder", "admin"] as Role[]).forEach((r) => notify(s, r, `Contract ${kind} drafted`, `${c.ref} v${v.v} needs approval and both signatures.`, `/contracts/${c.id}`));
  return c.id;
}

function releaseToken(s: State, c: Contract, why: string) {
  const token = tokenOf(s, c.tokenId);
  token.released = true;
  s.listings.filter((l) => l.tokenId === token.id && l.status === "active").forEach((l) => { l.status = "inactive"; l.statusNote = why; l.updatedAt = nowIso(); });
  s.orders.filter((o) => o.tokenId === token.id && o.payment === "authorized").forEach((o) => {
    o.payment = "cancelled"; o.cancelledAt = nowIso();
    ledger(s, { type: "authorization_cancelled", amount: 0, financial: false, orderId: o.id, shopId: o.shopId, tokenId: o.tokenId, holderId: o.holderId, listingId: o.listingId, memo: `Authorization released: ${why}` });
  });
}

export function terminateContract(s: State, contractId: string, reason: string, actor: Role) {
  const c = contractOf(s, contractId);
  if (c.terminatedAt) fail("Already terminated.");
  if (!reason.trim()) fail("Give a short termination reason.");
  c.terminatedAt = nowIso(); c.terminationReason = reason.trim();
  c.versions.filter((v) => v.status === "awaiting").forEach((v) => { v.status = "void"; v.note = "Voided by termination"; });
  s.invoices.filter((i) => i.contractId === c.id && !i.paidAt && !i.voidedAt && i.dueDate > today()).forEach((i) => { i.voidedAt = nowIso(); });
  releaseToken(s, c, "Contract terminated");
  audit(s, ROLE_LABEL[actor], "contract.terminated", c.ref, `${reason.trim()} — shelf released, sales blocked, future rent voided`);
  (["owner", "holder", "admin"] as Role[]).forEach((r) => notify(s, r, "Contract terminated", `${c.ref}: ${reason.trim()}. The shelf was released.`, `/contracts/${c.id}`));
}

export function payInvoice(s: State, invoiceId: string) {
  const inv = s.invoices.find((i) => i.id === invoiceId) ?? fail("Invoice not found.");
  const st = invoiceStatus(inv);
  if (st === "paid") fail("This rent invoice is already paid.");
  if (st === "void") fail("This invoice was voided.");
  const c = contractOf(s, inv.contractId);
  const fee = lateFeeFor(s, inv);
  inv.lateFee = fee; inv.paidAt = nowIso(); inv.receiptRef = nextRef(s, "RCPT");
  ledger(s, { type: inv.kind === "deposit" ? "deposit_paid" : "rent_paid", amount: inv.total + fee, invoiceId: inv.id, contractId: c.id, shopId: c.shopId, tokenId: c.tokenId, holderId: c.holderId, memo: `${inv.label}${fee ? ` incl. late fee ${fee}` : ""} — simulated payment, no money moved` });
  audit(s, ROLE_LABEL.holder, "rent.paid", inv.ref, `Simulated rent payment ${inv.receiptRef}`);
  notify(s, "owner", "Rent payment recorded", `${inv.ref} (${inv.label}) marked paid — simulated.`, "/owner-dashboard?tab=rent");
  notify(s, "holder", "Rent receipt ready", `Demo receipt ${inv.receiptRef} for ${inv.label}.`, `/contracts/${c.id}`);
}

export function setShelfSuspended(s: State, tokenId: string, on: boolean, note: string) {
  const t = tokenOf(s, tokenId);
  if (!!t.suspended === on) fail(on ? "Shelf already suspended." : "Shelf is not suspended.");
  t.suspended = on;
  const shop = shopOf(s, t.shopId);
  audit(s, ROLE_LABEL.admin, on ? "shelf.suspended" : "shelf.reinstated", shelfLabel(shop, t.slot), note || "—");
  notify(s, "holder", on ? "Shelf suspended" : "Shelf reinstated", `${shelfLabel(shop, t.slot)} at ${shop.name}${note ? `: ${note}` : ""}`, `/shelf/${t.id}`);
  notify(s, "owner", on ? "Shelf suspended" : "Shelf reinstated", `${shelfLabel(shop, t.slot)} at ${shop.name}`, "/owner-dashboard?tab=shelves");
}

// ---------- products ----------
export function syncStage(s: State, tokenId: string) {
  const t = tokenOf(s, tokenId);
  const L = s.listings.filter((l) => l.tokenId === tokenId && l.status !== "removed");
  t.stage = L.some((l) => l.status === "active") ? "B" : L.some((l) => l.status === "approved" || l.status === "inactive") ? "approved" : L.some((l) => l.status === "pending") ? "requested" : L.some((l) => l.status === "rejected") ? "rejected" : "A";
}

export type ListingInput = Pick<Listing, "name" | "sku" | "category" | "description" | "color" | "imageUrl" | "origin" | "retail" | "cost" | "taxRate" | "batch" | "expiry" | "initialQty">;

function validateListing(a: ListingInput) {
  if (!a.name.trim()) fail("Product name is required.");
  if (!a.sku.trim()) fail("SKU is required.");
  if (!(a.retail > 0)) fail("Retail price must be above zero.");
  if (a.cost < 0) fail("Cost can't be negative.");
  if (a.taxRate < 0 || a.taxRate > 40) fail("Tax rate must be 0–40% (illustrative).");
  if (!Number.isInteger(a.initialQty) || a.initialQty < 1) fail("Quantity must be a whole number of at least 1.");
  if (a.imageUrl && !/^https:\/\/\S+$/.test(a.imageUrl)) fail("Image URL must start with https://");
  if (a.imageUrl && a.imageUrl.length > 300) fail("Image URL is too long (300 characters max).");
  if (a.expiry && a.expiry < today()) fail("This batch is already expired.");
}

export function createListing(s: State, tokenId: string, a: ListingInput, actor: Role = "holder"): string {
  const t = tokenOf(s, tokenId);
  if (t.released) fail("This shelf was released.");
  validateListing(a);
  const shop = shopOf(s, t.shopId);
  if (s.listings.some((l) => l.tokenId === tokenId && l.sku.trim().toLowerCase() === a.sku.trim().toLowerCase() && l.status !== "removed")) fail("That SKU already exists on this shelf.");
  const used = shelfUnits(s, tokenId);
  if (used + a.initialQty > shop.shelf.capacity) fail(`Shelf capacity is ${shop.shelf.capacity} units; ${used} already allocated. Max you can add: ${Math.max(0, shop.shelf.capacity - used)}.`);
  const id = uid("lst");
  s.listings.push({ ...a, name: a.name.trim(), sku: a.sku.trim().toUpperCase(), id, tokenId, shopId: shop.id, holderId: t.holderId, available: a.initialQty, sold: 0, returned: 0, status: "pending", createdAt: nowIso(), updatedAt: nowIso() });
  syncStage(s, tokenId);
  audit(s, ROLE_LABEL[actor], "product.submitted", a.sku.toUpperCase(), `${a.initialQty} × ${a.name} for ${shelfLabel(shop, t.slot)}`);
  notify(s, "owner", "Product awaiting approval", `${a.name} (${a.initialQty} units) for ${shop.name}.`, "/owner-dashboard");
  return id;
}

export function updateListing(s: State, id: string, a: ListingInput) {
  const l = listingOf(s, id);
  if (l.status === "removed") fail("Removed products can't be edited.");
  if (reservedQty(s, id) > 0) fail("A checkout is in progress for this product. Try again after it completes.");
  validateListing(a);
  const shop = shopOf(s, l.shopId);
  const newAvail = l.status === "pending" || l.status === "rejected" || l.status === "draft" ? a.initialQty : l.available;
  if (shelfUnits(s, l.tokenId, l.id) + newAvail > shop.shelf.capacity) fail(`That exceeds shelf capacity (${shop.shelf.capacity} units).`);
  const commercial = a.name !== l.name || a.retail !== l.retail || a.category !== l.category || a.taxRate !== l.taxRate || a.expiry !== l.expiry || a.batch !== l.batch;
  const initial = l.sold === 0 ? a.initialQty : l.initialQty;
  Object.assign(l, { ...a, sku: a.sku.trim().toUpperCase(), initialQty: initial, available: newAvail, updatedAt: nowIso() });
  if (commercial && (l.status === "approved" || l.status === "active" || l.status === "inactive" || l.status === "rejected")) {
    l.status = "pending"; l.statusNote = "Edited — needs owner re-approval";
    notify(s, "owner", "Edited product needs approval", `${l.name} was changed.`, "/owner-dashboard");
  }
  syncStage(s, l.tokenId);
  audit(s, ROLE_LABEL.holder, "product.updated", l.sku, commercial ? "Commercial fields changed; re-approval required" : "Description/image updated");
}

export function decideListing(s: State, id: string, ok: boolean, note: string, actor = ROLE_LABEL.owner) {
  const l = listingOf(s, id);
  if (l.status !== "pending") fail("This product isn't waiting for a decision.");
  l.status = ok ? "approved" : "rejected"; l.statusNote = note || undefined; l.updatedAt = nowIso();
  syncStage(s, l.tokenId);
  audit(s, actor, ok ? "product.approved" : "product.rejected", l.sku, note || "—");
  notify(s, "holder", ok ? "Product approved" : "Product rejected", `${l.name}${note ? `: ${note}` : ""}${ok ? ". Activate it when your contract is active." : ""}`, `/shelf/${l.tokenId}`);
}

export function activateListing(s: State, id: string) {
  const l = listingOf(s, id);
  if (l.status !== "approved" && l.status !== "inactive") fail("Only owner-approved products can be put on sale.");
  const t = tokenOf(s, l.tokenId);
  const r = shelfBlockReason(s, t); if (r) fail(r);
  if (isExpired(l)) fail("This batch has expired.");
  if (l.available <= 0) fail("No stock left. Restock first.");
  l.status = "active"; l.statusNote = undefined; l.updatedAt = nowIso();
  t.stockCost = round2((t.stockCost ?? 0) + (l.sold === 0 ? l.cost * l.initialQty : 0));
  syncStage(s, t.id);
  audit(s, ROLE_LABEL.holder, "product.activated", l.sku, `${l.available} units on sale`);
  notify(s, "holder", "Product live", `${l.name} is on sale via the shelf QR.`, `/shelf/${t.id}`);
}

export function deactivateListing(s: State, id: string) {
  const l = listingOf(s, id);
  if (l.status !== "active") fail("Product isn't on sale.");
  if (reservedQty(s, id) > 0) fail("A checkout is in progress. Try again shortly.");
  l.status = "inactive"; l.updatedAt = nowIso();
  syncStage(s, l.tokenId);
  audit(s, ROLE_LABEL.holder, "product.deactivated", l.sku, "Taken off sale");
}

export function removeListing(s: State, id: string) {
  const l = listingOf(s, id);
  if (l.status === "removed") fail("Already removed.");
  if (reservedQty(s, id) > 0) fail("A checkout is in progress. Try again shortly.");
  l.status = "removed"; l.updatedAt = nowIso();
  syncStage(s, l.tokenId);
  audit(s, ROLE_LABEL.holder, "product.removed", l.sku, `${l.available} units withdrawn from shelf`);
}

export function restockListing(s: State, id: string, qty: number) {
  const l = listingOf(s, id);
  if (!Number.isInteger(qty) || qty < 1) fail("Restock quantity must be a whole number of at least 1.");
  if (l.status === "removed" || l.status === "rejected" || l.status === "pending") fail("Only approved products can be restocked.");
  if (isExpired(l)) fail("This batch is expired. Create a new batch instead.");
  const shop = shopOf(s, l.shopId);
  const used = shelfUnits(s, l.tokenId);
  if (used + qty > shop.shelf.capacity) fail(`Capacity ${shop.shelf.capacity} units; only ${Math.max(0, shop.shelf.capacity - used)} free.`);
  l.available += qty; l.initialQty += qty; l.updatedAt = nowIso();
  audit(s, ROLE_LABEL.holder, "product.restocked", l.sku, `+${qty} units (simulated)`);
}

// ---------- orders & payments ----------
export function authorize(s: State, listingId: string, qty: number, decline: boolean): string {
  const l = listingOf(s, listingId);
  if (!Number.isInteger(qty) || qty < 1) fail("Choose a whole quantity of at least 1.");
  if (qty > 20) fail("Max 20 units per order in this demo.");
  const reason = listingBlockReason(s, l); if (reason) fail(reason);
  const free = l.available - reservedQty(s, l.id);
  if (qty > free) fail(`Only ${free} left right now.`);
  const c = contractOfToken(s, l.tokenId) ?? fail("No contract.");
  const subtotal = round2(l.retail * qty);
  const tax = round2((subtotal * l.taxRate) / 100);
  const commission = round2((subtotal * PLATFORM_COMMISSION_PCT) / 100);
  const fee = CUSTOMER_SERVICE_FEE;
  const gross = round2(subtotal + tax + fee);
  const id = uid("ord");
  const o: Order = {
    id, ref: nextRef(s, "ORD"), listingId: l.id, tokenId: l.tokenId, shopId: l.shopId, holderId: l.holderId, contractId: c.id,
    productName: l.name, sku: l.sku, qty, unit: l.retail, subtotal, tax, taxRate: l.taxRate, serviceFee: fee, commission, gross, net: round2(subtotal - commission),
    payment: decline ? "failed" : "authorized", payout: "none", simRef: `SIMULATED-${String(s.seq).padStart(5, "0")}`, customerLabel: `Customer #${String(s.seq).padStart(4, "0")}`,
    createdAt: nowIso(), stockDeducted: false,
  };
  if (decline) {
    o.failedAt = nowIso();
    s.orders.push(o);
    ledger(s, { type: "authorization_failed", amount: 0, financial: false, orderId: id, shopId: o.shopId, tokenId: o.tokenId, holderId: o.holderId, listingId: l.id, memo: `Simulated decline for ${gross}` });
    notify(s, "customer", "Payment declined (simulated)", `${o.ref}: nothing was charged. You can try again.`, `/orders/${id}`);
    notify(s, "holder", "Customer payment failed", `${o.ref} for ${l.name} was declined (simulated).`, "/dashboard?tab=orders");
    audit(s, ROLE_LABEL.customer, "payment.failed", o.ref, "Simulated authorization decline");
    return id;
  }
  o.authorizedAt = nowIso();
  s.orders.push(o);
  ledger(s, { type: "authorization", amount: gross, financial: false, orderId: id, shopId: o.shopId, tokenId: o.tokenId, holderId: o.holderId, listingId: l.id, memo: `Hold of ${qty} unit(s) reserved; no stock deducted yet` });
  audit(s, ROLE_LABEL.customer, "payment.authorized", o.ref, `${qty} × ${l.name} reserved`);
  return id;
}

export function capture(s: State, orderId: string) {
  const o = orderOf(s, orderId);
  if (o.payment === "captured") fail("This payment was already captured.");
  if (o.payment !== "authorized") fail(`Can't capture a ${o.payment} payment.`);
  const l = listingOf(s, o.listingId);
  const t = tokenOf(s, o.tokenId);
  const block = shelfBlockReason(s, t);
  if (block || l.status !== "active" || isExpired(l)) {
    o.payment = "cancelled"; o.cancelledAt = nowIso();
    ledger(s, { type: "authorization_cancelled", amount: 0, financial: false, orderId: o.id, shopId: o.shopId, tokenId: o.tokenId, holderId: o.holderId, listingId: l.id, memo: "Auto-released: shelf or product no longer sellable" });
    throw new DemoError(`${block ?? "Product is no longer on sale."} The hold was released; nothing was charged.`);
  }
  if (o.stockDeducted) fail("Stock already deducted for this order.");
  if (l.available < o.qty) fail("Not enough stock to complete this order (oversell blocked).");
  l.available -= o.qty; l.sold += o.qty; l.updatedAt = nowIso();
  o.stockDeducted = true; o.payment = "captured"; o.capturedAt = nowIso(); o.payout = "pending";
  const base = { orderId: o.id, shopId: o.shopId, tokenId: o.tokenId, holderId: o.holderId, listingId: l.id };
  ledger(s, { ...base, type: "capture_gross", amount: o.gross, memo: "Simulated capture (customer paid)" });
  ledger(s, { ...base, type: "tax_collected", amount: o.tax, memo: `Illustrative tax ${o.taxRate}%` });
  ledger(s, { ...base, type: "platform_fee", amount: round2(o.commission + o.serviceFee), memo: `Commission ${PLATFORM_COMMISSION_PCT}% + service fee` });
  ledger(s, { ...base, type: "holder_payable", amount: o.net, memo: "Net due to token holder — payout pending, not settled" });
  audit(s, ROLE_LABEL.customer, "payment.captured", o.ref, `Stock −${o.qty} (${l.sku}); payout pending`);
  notify(s, "customer", "Receipt ready", `${o.ref}: ${o.qty} × ${o.productName}. Simulated payment captured.`, `/orders/${o.id}`);
  notify(s, "holder", "New sale", `${o.qty} × ${o.productName} sold (${o.ref}). Payout pending — not settled.`, "/dashboard?tab=orders");
  notify(s, "admin", "Payment captured", `${o.ref} captured; payout pending.`, "/admin?tab=finance");
  if (l.available === 0) {
    notify(s, "holder", "Sold out", `${l.name} is sold out on ${shelfLabel(shopOf(s, l.shopId), t.slot)}.`, `/shelf/${t.id}`);
    notify(s, "owner", "Shelf product sold out", `${l.name} sold out.`, "/owner-dashboard?tab=shelves");
  } else if (l.available <= 3) {
    notify(s, "holder", "Low stock", `${l.name}: only ${l.available} left.`, `/shelf/${t.id}`);
  }
}

export function cancelAuthorization(s: State, orderId: string) {
  const o = orderOf(s, orderId);
  if (o.payment !== "authorized") fail(`Can't cancel a ${o.payment} payment.`);
  o.payment = "cancelled"; o.cancelledAt = nowIso();
  ledger(s, { type: "authorization_cancelled", amount: 0, financial: false, orderId: o.id, shopId: o.shopId, tokenId: o.tokenId, holderId: o.holderId, listingId: o.listingId, memo: "Customer cancelled; hold released, nothing charged" });
  audit(s, ROLE_LABEL.customer, "payment.cancelled", o.ref, "Authorization voided");
}

export function requestRefund(s: State, orderId: string, reason: string) {
  const o = orderOf(s, orderId);
  if (o.payment !== "captured") fail("Only captured payments can be refunded.");
  if (o.refund && o.refund.status !== "rejected") fail("A refund was already requested for this order.");
  if (o.refund?.status === "rejected") fail("The refund request for this order was declined. Contact support.");
  if (!reason.trim()) fail("Tell us briefly why.");
  o.refund = { status: "requested", reason: reason.trim(), requestedAt: nowIso() };
  audit(s, ROLE_LABEL.customer, "refund.requested", o.ref, reason.trim());
  notify(s, "admin", "Refund requested", `${o.ref}: ${reason.trim()}`, "/admin?tab=finance");
  notify(s, "holder", "Refund requested", `${o.ref} (${o.productName}).`, "/dashboard?tab=orders");
}

export function decideRefund(s: State, orderId: string, approve: boolean, restock: boolean, note: string) {
  const o = orderOf(s, orderId);
  if (!o.refund || o.refund.status !== "requested") fail("No open refund request on this order.");
  if (o.payment === "refunded") fail("Already refunded.");
  if (!approve) {
    o.refund.status = "rejected"; o.refund.decidedAt = nowIso(); o.refund.note = note || undefined;
    audit(s, ROLE_LABEL.admin, "refund.rejected", o.ref, note || "—");
    notify(s, "customer", "Refund declined", `${o.ref}${note ? `: ${note}` : ""}`, `/orders/${o.id}`);
    return;
  }
  if (o.payout === "processing") fail("Payout is processing with the (simulated) provider. Confirm or fail it first, then refund.");
  const base = { orderId: o.id, shopId: o.shopId, tokenId: o.tokenId, holderId: o.holderId, listingId: o.listingId };
  ledger(s, { ...base, type: "refund_gross", amount: -o.gross, memo: "Full refund to customer (simulated)" });
  ledger(s, { ...base, type: "tax_reversed", amount: -o.tax, memo: "Tax reversed" });
  ledger(s, { ...base, type: "platform_fee_reversed", amount: -round2(o.commission + o.serviceFee), memo: "Fees reversed" });
  ledger(s, { ...base, type: "holder_payable_reversed", amount: -o.net, memo: "Holder net reversed" });
  if (o.payout === "pending" || o.payout === "failed") {
    o.payout = "reversed";
    ledger(s, { ...base, type: "payout_reversed", amount: 0, financial: false, memo: "Unpaid payout cancelled" });
  } else if (o.payout === "settled") {
    ledger(s, { ...base, type: "holder_recovery", amount: o.net, financial: false, memo: "Already settled — amount owed back by holder" });
    notify(s, "holder", "Refund after settlement", `${o.ref}: ${o.net.toFixed(2)} USD will be offset against future payouts (simulated).`, "/dashboard?tab=money");
  }
  o.payment = "refunded"; o.refundedAt = nowIso();
  o.refund.status = "approved"; o.refund.decidedAt = nowIso(); o.refund.restocked = restock; o.refund.note = note || undefined;
  const l = listingOf(s, o.listingId);
  if (restock) {
    if (isExpired(l)) fail("Returned goods are from an expired batch — can't restock. Approve without restock.");
    l.available += o.qty; l.sold -= o.qty; l.returned += o.qty; l.updatedAt = nowIso();
  } else {
    l.returned += o.qty;
  }
  audit(s, ROLE_LABEL.admin, "refund.approved", o.ref, `Full refund; ${restock ? `${o.qty} usable unit(s) restocked` : "goods not restocked"}`);
  notify(s, "customer", "Refund approved", `${o.ref} fully refunded (simulated).`, `/orders/${o.id}`);
  notify(s, "holder", "Refund processed", `${o.ref} refunded${restock ? "; stock returned to shelf" : ""}.`, "/dashboard?tab=orders");
}

export function requestPayout(s: State, orderId: string, actor: Role) {
  const o = orderOf(s, orderId);
  if (o.payment !== "captured") fail("Only captured, unrefunded sales can be paid out.");
  if (o.payout === "processing") fail("Payout already processing.");
  if (o.payout === "settled") fail("Payout already settled — duplicates are blocked.");
  if (o.payout !== "pending" && o.payout !== "failed") fail(`Payout is ${o.payout}.`);
  if (o.refund?.status === "requested") fail("Refund request open. Resolve it first.");
  o.payout = "processing"; o.payoutRequestedAt = nowIso();
  ledger(s, { type: "payout_initiated", amount: 0, financial: false, orderId: o.id, shopId: o.shopId, tokenId: o.tokenId, holderId: o.holderId, listingId: o.listingId, memo: `Payout of ${o.net} sent to simulated provider — awaiting confirmation` });
  audit(s, ROLE_LABEL[actor], "payout.initiated", o.ref, `${o.net} USD`);
  notify(s, "holder", "Settlement initiated", `${o.ref}: awaiting provider confirmation (simulated).`, "/dashboard?tab=money");
}

export function confirmPayout(s: State, orderId: string, success: boolean) {
  const o = orderOf(s, orderId);
  if (o.payout !== "processing") fail("Only processing payouts can be confirmed.");
  const base = { orderId: o.id, shopId: o.shopId, tokenId: o.tokenId, holderId: o.holderId, listingId: o.listingId };
  if (success) {
    if (s.ledger.some((e) => e.orderId === o.id && e.type === "payout_settled")) fail("Settlement already recorded.");
    o.payout = "settled"; o.settledAt = nowIso();
    ledger(s, { ...base, type: "payout_settled", amount: o.net, memo: "Simulated provider confirmed settlement" });
    notify(s, "holder", "Settlement completed", `${o.ref}: ${o.net.toFixed(2)} USD settled (simulated).`, "/dashboard?tab=money");
  } else {
    o.payout = "failed"; o.payoutFailedAt = nowIso();
    ledger(s, { ...base, type: "payout_failed", amount: 0, financial: false, memo: "Simulated provider reported failure" });
    notify(s, "holder", "Settlement failed", `${o.ref}: simulated provider failure. It can be retried.`, "/dashboard?tab=money");
  }
  audit(s, `${ROLE_LABEL.admin} (simulated provider)`, success ? "payout.settled" : "payout.failed", o.ref, `${o.net} USD`);
}

export function markRead(s: State, role: Role, id?: string) {
  s.notifications.forEach((n) => { if (n.role === role && (!id || n.id === id)) n.read = true; });
}

export const _internal = { ledger, nextRef, snapshot };
export type { LedgerType };
