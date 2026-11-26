/**
 * Who may do what, enforced on the server. The browser sends an action name and its arguments; here we check
 * the signed-in account against the data (who owns the store, who holds the shelf, who bought the order),
 * replace any identity the browser claims with the real one, run the same business rules the demo used
 * (src/lib/ops.ts), and address the resulting notices to the right accounts.
 */
import * as ops from "../src/lib/ops";
import type { Holder, Role, State } from "../src/lib/types";
import { HttpError } from "./db";
import { type Me, userIdOfHolder } from "./auth";

export interface Actor { me: Me | null; /** `u:<account>` when signed in, else `v:<visitor>` */ principal: string }

const need = (cond: unknown, msg = "You can't do that with this account.") => { if (!cond) throw new HttpError(403, msg); };
const signedIn = (a: Actor): Me => { if (!a.me) throw new HttpError(401, "Sign in to continue.", "auth"); return a.me; };
const admin = (a: Actor) => need(signedIn(a).isAdmin, "Only the InRaf team can do that.");
const str = (v: unknown, what = "value") => { if (typeof v !== "string" || !v || v.length > 200) throw new HttpError(400, `Invalid ${what}.`); return v; };

const find = <T extends { id: string }>(list: T[], id: string, what: string) => list.find((x) => x.id === id) ?? (() => { throw new HttpError(404, `${what} not found.`); })();
const ownsShop = (s: State, shopId: string, me: Me | null) => !!me && find(s.shops, shopId, "Store").ownerUserId === me.id;
const canManageShop = (s: State, shopId: string, a: Actor) => need(a.me?.isAdmin || ownsShop(s, shopId, a.me));
const isHolder = (holderId: string, me: Me | null) => !!me && holderId === me.holderId;

/** Every account gets one holder profile (the side that rents shelves), created the first time it's needed. */
export function ensureHolder(s: State, me: Me) {
  if (s.holders.some((h) => h.id === me.holderId)) return;
  const h: Holder = { id: me.holderId, name: me.name || me.email.split("@")[0], kind: "individual", country: "", registration: "—", verification: "not-started", seeded: false };
  s.holders.push(h);
}

/** Size limits on what the browser can send, so one request can't bloat the shared data. */
function checkSize(args: unknown[]) {
  const json = JSON.stringify(args);
  if (json.length > 3_000_000) throw new HttpError(413, "That's too much data in one go (photos are limited to about 3 MB in total).");
  const walk = (v: unknown): void => {
    if (typeof v === "string") { if (v.length > 600_000 || (!v.startsWith("data:image/") && v.length > 5000)) throw new HttpError(400, "A text field or photo is too long."); }
    else if (Array.isArray(v)) { if (v.length > 200) throw new HttpError(400, "Too many items."); v.forEach(walk); }
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(args);
}

/** The stores, holders and orders an action touched, used to address its notices. */
function context(s: State, values: unknown[]) {
  const shops = new Set<string>(), holders = new Set<string>(), orders = new Set<string>(), users = new Set<string>();
  const visit = (v: unknown) => {
    if (typeof v === "string") {
      const shop = s.shops.find((x) => x.id === v); if (shop) shops.add(shop.id);
      const ctr = s.contracts.find((x) => x.id === v); if (ctr) { shops.add(ctr.shopId); holders.add(ctr.holderId); }
      const inv = s.invoices.find((x) => x.id === v); const ic = inv && s.contracts.find((x) => x.id === inv.contractId);
      if (ic) { shops.add(ic.shopId); holders.add(ic.holderId); }
      const tok = s.tokens.find((x) => x.id === v); if (tok) { shops.add(tok.shopId); holders.add(tok.holderId); }
      const lst = s.listings.find((x) => x.id === v); if (lst) { shops.add(lst.shopId); holders.add(lst.holderId); }
      const ord = s.orders.find((x) => x.id === v); if (ord) { shops.add(ord.shopId); holders.add(ord.holderId); orders.add(ord.id); }
      const app = s.requests.find((x) => x.id === v); if (app?.userId) users.add(app.userId);
    } else if (v && typeof v === "object") Object.values(v).forEach(visit);
  };
  values.forEach(visit);
  return { shops, holders, orders, users };
}

function address(s: State, before: Set<string>, touched: unknown[], actor: Actor, actionName: string) {
  const ctx = context(s, touched);
  const suspended = actionName === "setShopStatus";
  if (suspended) s.tokens.forEach((t) => { if (ctx.shops.has(t.shopId) && !t.released) ctx.holders.add(t.holderId); });
  const recipients = (role: Role): string[] | undefined => {
    if (role === "admin") return undefined; // every admin
    if (role === "owner") return [...new Set([...[...ctx.shops].map((id) => s.shops.find((x) => x.id === id)?.ownerUserId), ...ctx.users])].filter(Boolean).map((u) => `u:${u}`);
    if (role === "holder") return [...ctx.holders].map(userIdOfHolder).filter(Boolean).map((u) => `u:${u}`);
    return [...ctx.orders].map((id) => s.orders.find((o) => o.id === id)?.buyerId).filter((b): b is string => !!b);
  };
  s.notifications.forEach((n) => { if (!before.has(n.id)) n.userIds = recipients(n.role); });
  // Record which account did it next to the role label the rules wrote.
  const who = actor.me ? actor.me.email : "visitor";
  s.audit.forEach((e) => { if (!before.has(e.id) && !e.actor.includes("·")) e.actor = `${e.actor} · ${who}`; });
}

/** Apply one action for this actor. Returns the new item's id when the action creates one. */
export function applyAction(s: State, name: string, rawArgs: unknown, actor: Actor): string | undefined {
  if (!Array.isArray(rawArgs)) throw new HttpError(400, "Invalid request.");
  const args = rawArgs as unknown[];
  checkSize(args);
  const before = new Set([...s.notifications.map((n) => n.id), ...s.audit.map((e) => e.id)]);
  const a0 = args[0];
  let id: string | undefined;
  const me = actor.me;
  const run = (fn: () => string | void) => { const r = fn(); if (typeof r === "string") id = r; };

  switch (name) {
    // ---------- stores ----------
    case "createShop": {
      const m = signedIn(actor);
      run(() => ops.createShop(s, a0 as ops.ShopInput));
      const shop = find(s.shops, id!, "Store");
      shop.ownerUserId = m.id;
      // A real store carries its owner's real name and no made-up registration: the owner adds it in shop settings.
      shop.ownerName = m.name || m.email.split("@")[0];
      shop.registration = "";
      break;
    }
    case "submitOwnerRequest": {
      const m = signedIn(actor);
      run(() => ops.submitOwnerRequest(s, a0 as ops.OwnerRequestInput));
      const r = find(s.requests, id!, "Application");
      r.userId = m.id;
      if (r.shopId) {
        const shop = find(s.shops, r.shopId, "Store");
        shop.ownerUserId = m.id; shop.ownerName = m.name || m.email.split("@")[0]; shop.registration = "";
      }
      break;
    }
    case "decideOwnerRequest": admin(actor); run(() => ops.decideOwnerRequest(s, str(a0, "application"), args[1] as "in-review" | "accepted" | "declined", String(args[2] ?? ""))); break;
    case "updateShop": canManageShop(s, str(a0, "store"), actor); run(() => ops.updateShop(s, a0 as string, args[1] as Parameters<typeof ops.updateShop>[2])); break;
    case "deleteShop": canManageShop(s, str(a0, "store"), actor); run(() => ops.deleteShop(s, a0 as string)); break;
    case "setShopStatus": {
      admin(actor);
      const shop = find(s.shops, str(a0, "store"), "Store");
      if (args[1] === "approved" && !shop.seeded && !shop.registration.trim()) throw new ops.DemoError("Ask the owner to add the business registration number in shop settings before approving.");
      run(() => ops.setShopStatus(s, shop.id, args[1] as "approved" | "suspended" | "pending", String(args[2] ?? "")));
      break;
    }
    case "reportShop": signedIn(actor); run(() => ops.reportShop(s, str(a0, "store"), String(args[1] ?? ""))); break;

    // ---------- contracts ----------
    case "requestContract": {
      const m = signedIn(actor);
      const a = (a0 ?? {}) as Parameters<typeof ops.requestContract>[1];
      const shop = find(s.shops, str(a.shopId, "store"), "Store");
      need(!shop.seeded, "This is a sample store to show how InRaf works. Pick a real store to rent a shelf.");
      need(shop.ownerUserId !== m.id, "You can't rent a shelf in your own store.");
      ensureHolder(s, m);
      run(() => ops.requestContract(s, { ...a, holderId: m.holderId }));
      break;
    }
    case "counterOffer": {
      const m = signedIn(actor);
      const c = find(s.contracts, str(a0, "contract"), "Contract");
      const by = args[1];
      if (by === "owner") need(ownsShop(s, c.shopId, m), "Only the store owner can make an offer for the store.");
      else if (by === "holder") need(isHolder(c.holderId, m), "Only the renter can make an offer as the renter.");
      else throw new HttpError(400, "Invalid party.");
      run(() => ops.counterOffer(s, c.id, by, (args[2] ?? {}) as Parameters<typeof ops.counterOffer>[3]));
      break;
    }
    case "approveContract": admin(actor); run(() => ops.approveContract(s, str(a0, "contract"), me!.name || me!.email)); break;
    case "rejectVersion": admin(actor); run(() => ops.rejectVersion(s, str(a0, "contract"), String(args[1] ?? ""))); break;
    case "sign": {
      const m = signedIn(actor);
      const c = find(s.contracts, str(a0, "contract"), "Contract");
      const party = args[1];
      if (party === "owner") need(ownsShop(s, c.shopId, m), "Only the store owner can sign as the store.");
      else if (party === "holder") need(isHolder(c.holderId, m), "Only the shelf holder can sign as the holder.");
      else throw new HttpError(400, "Invalid party.");
      run(() => ops.signContract(s, c.id, party, String(args[2] ?? ""), "ui")); // simulated signatures aren't allowed live
      break;
    }
    case "newVersion":
    case "terminate": {
      const m = signedIn(actor);
      const c = find(s.contracts, str(a0, "contract"), "Contract");
      const role: Role = ownsShop(s, c.shopId, m) ? "owner" : isHolder(c.holderId, m) ? "holder" : m.isAdmin ? "admin" : (() => { throw new HttpError(403, "You aren't a party to this contract."); })();
      if (name === "newVersion") run(() => ops.newVersion(s, c.id, args[1] as "renewal" | "amendment", args[2] as { months: number; monthlyRent: number; note: string }, role));
      else run(() => ops.terminateContract(s, c.id, String(args[1] ?? ""), role));
      break;
    }
    case "payInvoice": {
      const inv = find(s.invoices, str(a0, "invoice"), "Invoice");
      const c = find(s.contracts, inv.contractId, "Contract");
      need(isHolder(c.holderId, signedIn(actor)), "Only the shelf holder pays this invoice.");
      run(() => ops.payInvoice(s, inv.id));
      break;
    }
    case "setShelfSuspended": {
      const t = find(s.tokens, str(a0, "shelf"), "Shelf");
      canManageShop(s, t.shopId, actor);
      run(() => ops.setShelfSuspended(s, t.id, !!args[1], String(args[2] ?? ""), me?.isAdmin && !ownsShop(s, t.shopId, me) ? "admin" : "owner"));
      break;
    }

    // ---------- products ----------
    case "createListing": {
      const t = find(s.tokens, str(a0, "shelf"), "Shelf");
      need(isHolder(t.holderId, signedIn(actor)), "Only the shelf holder can add products here.");
      run(() => ops.createListing(s, t.id, args[1] as ops.ListingInput));
      break;
    }
    case "updateListing": case "activateListing": case "deactivateListing": case "removeListing": case "restockListing": {
      const l = find(s.listings, str(a0, "product"), "Product");
      need(isHolder(l.holderId, signedIn(actor)), "Only the shelf holder can change this product.");
      if (name === "updateListing") run(() => ops.updateListing(s, l.id, args[1] as ops.ListingInput));
      if (name === "activateListing") run(() => ops.activateListing(s, l.id));
      if (name === "deactivateListing") run(() => ops.deactivateListing(s, l.id));
      if (name === "removeListing") run(() => ops.removeListing(s, l.id));
      if (name === "restockListing") run(() => ops.restockListing(s, l.id, Number(args[1])));
      break;
    }
    case "decideListing": {
      const l = find(s.listings, str(a0, "product"), "Product");
      canManageShop(s, l.shopId, actor);
      run(() => ops.decideListing(s, l.id, !!args[1], String(args[2] ?? "")));
      break;
    }

    // ---------- shopping (payments are simulated) ----------
    case "authorize": {
      run(() => ops.authorize(s, str(a0, "product"), Number(args[1]), !!args[2]));
      find(s.orders, id!, "Order").buyerId = actor.principal;
      break;
    }
    case "capture": case "cancelAuthorization": case "requestRefund": {
      const o = find(s.orders, str(a0, "order"), "Order");
      need(o.buyerId === actor.principal || me?.isAdmin, "That order belongs to someone else.");
      if (name === "capture") run(() => ops.capture(s, o.id));
      if (name === "cancelAuthorization") run(() => ops.cancelAuthorization(s, o.id));
      if (name === "requestRefund") run(() => ops.requestRefund(s, o.id, String(args[1] ?? "")));
      break;
    }
    case "decideRefund": admin(actor); run(() => ops.decideRefund(s, str(a0, "order"), !!args[1], !!args[2], String(args[3] ?? ""))); break;
    case "requestPayout": {
      const m = signedIn(actor);
      const o = find(s.orders, str(a0, "order"), "Order");
      const role: Role = isHolder(o.holderId, m) ? "holder" : m.isAdmin ? "admin" : (() => { throw new HttpError(403, "Only the shelf holder can request this payout."); })();
      run(() => ops.requestPayout(s, o.id, role));
      break;
    }
    case "confirmPayout": admin(actor); run(() => ops.confirmPayout(s, str(a0, "order"), !!args[1])); break;

    // ---------- per-account ----------
    case "markRead": {
      const m = signedIn(actor);
      const role = a0 as Role; const only = args[1] as string | undefined;
      const mine = new Set([`u:${m.id}`, actor.principal]);
      s.notifications.forEach((n) => {
        if (n.role !== role || (only && n.id !== only)) return;
        const forMe = n.userIds ? n.userIds.some((u) => mine.has(u)) : n.role === "admin" && m.isAdmin;
        if (forMe) n.read = true;
      });
      break;
    }
    default:
      throw new HttpError(400, `Unknown action "${name}".`);
  }
  address(s, before, [...args, id], actor, name);
  return id;
}
