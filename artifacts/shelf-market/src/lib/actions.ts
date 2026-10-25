import * as ops from "./ops";
import { run, resetDemo } from "./store";
import type { Role } from "./types";

/** UI-facing actions. Each returns a Result; none throw. */
export const actions = {
  setRole: (role: Role) => run((d) => { d.role = role; }),
  createShop: (a: ops.ShopInput) => run((d) => ops.createShop(d, a)),
  updateShop: (id: string, p: Parameters<typeof ops.updateShop>[2]) => run((d) => ops.updateShop(d, id, p)),
  setShopStatus: (id: string, status: "approved" | "suspended" | "pending", note: string) => run((d) => ops.setShopStatus(d, id, status, note)),
  deleteShop: (id: string) => run((d) => ops.deleteShop(d, id)),
  requestContract: (a: Parameters<typeof ops.requestContract>[1]) => run((d) => ops.requestContract(d, a)),
  approveContract: (id: string, name: string) => run((d) => ops.approveContract(d, id, name)),
  rejectVersion: (id: string, reason: string) => run((d) => ops.rejectVersion(d, id, reason)),
  sign: (id: string, party: "owner" | "holder", name: string, simulated: boolean) => run((d) => ops.signContract(d, id, party, name, simulated ? "simulated" : "ui")),
  newVersion: (id: string, kind: "renewal" | "amendment", a: { months: number; monthlyRent: number; note: string }, actor: Role) => run((d) => ops.newVersion(d, id, kind, a, actor)),
  terminate: (id: string, reason: string, actor: Role) => run((d) => ops.terminateContract(d, id, reason, actor)),
  payInvoice: (id: string) => run((d) => ops.payInvoice(d, id)),
  setShelfSuspended: (tokenId: string, on: boolean, note: string) => run((d) => ops.setShelfSuspended(d, tokenId, on, note)),
  createListing: (tokenId: string, a: ops.ListingInput) => run((d) => ops.createListing(d, tokenId, a)),
  updateListing: (id: string, a: ops.ListingInput) => run((d) => ops.updateListing(d, id, a)),
  decideListing: (id: string, ok: boolean, note: string) => run((d) => ops.decideListing(d, id, ok, note)),
  activateListing: (id: string) => run((d) => ops.activateListing(d, id)),
  deactivateListing: (id: string) => run((d) => ops.deactivateListing(d, id)),
  removeListing: (id: string) => run((d) => ops.removeListing(d, id)),
  restockListing: (id: string, qty: number) => run((d) => ops.restockListing(d, id, qty)),
  authorize: (listingId: string, qty: number, decline: boolean) => run((d) => ops.authorize(d, listingId, qty, decline)),
  capture: (orderId: string) => run((d) => ops.capture(d, orderId)),
  cancelAuthorization: (orderId: string) => run((d) => ops.cancelAuthorization(d, orderId)),
  requestRefund: (orderId: string, reason: string) => run((d) => ops.requestRefund(d, orderId, reason)),
  decideRefund: (orderId: string, approve: boolean, restock: boolean, note: string) => run((d) => ops.decideRefund(d, orderId, approve, restock, note)),
  requestPayout: (orderId: string, actor: Role) => run((d) => ops.requestPayout(d, orderId, actor)),
  confirmPayout: (orderId: string, ok: boolean) => run((d) => ops.confirmPayout(d, orderId, ok)),
  markRead: (role: Role, id?: string) => run((d) => ops.markRead(d, role, id)),
  reset: resetDemo,
};
