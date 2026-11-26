/**
 * Retail opportunities for token holders: the six kinds of shelf the discovery page offers, and which real stores
 * belong to each. Everything is derived from the marketplace data (stores, contracts, products), so a category
 * with no store yet is shown as "Coming soon" rather than with made-up listings.
 */
import type { ProductId } from "./data";
import { executedVersion, contractStatus, slotsOf, takenSlots } from "./selectors";
import { daysUntil } from "./util";
import type { Shop, State, VenueType } from "./types";

export type OpportunityId = "airport" | "mall" | "independent" | "expiring-rentals" | "fashion" | "outlet";

export const OPPORTUNITIES: { id: OpportunityId; title: string; tagline: string; text: string; scene: VenueType; video?: ProductId }[] = [
  { id: "airport", title: "Airport retail shelves", tagline: "Travellers about to board", text: "Shelf space inside airport shops, duty-free and departure areas.", scene: "airport", video: "flying" },
  { id: "mall", title: "Shopping mall shelves", tagline: "High footfall, every day", text: "Display space inside mall stores, kiosks and pop-up corners.", scene: "mall" },
  { id: "independent", title: "Independent stores & boutiques", tagline: "Neighbourhood regulars", text: "Shelves inside existing shops, boutiques, cafés and hotels.", scene: "street" },
  { id: "expiring-rentals", title: "Shelves freeing up soon", tagline: "Book the next term", text: "Shelves whose current rental ends within 60 days, so you can line up the next term.", scene: "supermarket" },
  { id: "fashion", title: "Fashion brand space", tagline: "Rails, windows and corners", text: "Stores that accept clothing, textiles and accessories.", scene: "street" },
  { id: "outlet", title: "Outlet & near-date stock", tagline: "A second chance to sell", text: "Factory outlets and near-date shelves for excess and outlet stock.", scene: "factory", video: "expiring" },
];
export const opportunityOf = (id: string) => OPPORTUNITIES.find((o) => o.id === id);

/** The kind of place a store is. Older stores have no `place`, so it's inferred from what is known. */
export function placeOf(shop: Shop): VenueType {
  if (shop.place) return shop.place;
  if (shop.venue === "airport") return "airport";
  if (shop.business === "1079") return "factory";
  if (shop.business === "5610") return "cafe";
  if (shop.business === "5510") return "hotel";
  return "street";
}

/** Shelves in this store whose executed contract ends within `days`. */
export function freeingUp(s: State, shop: Shop, days = 60) {
  return s.contracts
    .filter((c) => c.shopId === shop.id && contractStatus(c) === "active")
    .map((c) => ({ contract: c, end: executedVersion(c)!.snapshot.terms.end, label: executedVersion(c)!.snapshot.shelf.label }))
    .filter((x) => daysUntil(x.end) >= 0 && daysUntil(x.end) <= days);
}

export const freeShelves = (s: State, shop: Shop) => slotsOf(shop) - takenSlots(s, shop.id).size;

/** Stores a token holder can rent in, for one opportunity. */
export function storesFor(s: State, id: OpportunityId): Shop[] {
  const open = s.shops.filter((x) => x.status === "approved" && !x.legacy);
  switch (id) {
    case "airport": return open.filter((x) => placeOf(x) === "airport");
    case "mall": return open.filter((x) => placeOf(x) === "mall");
    case "independent": return open.filter((x) => ["street", "cafe", "hotel", "supermarket", "other"].includes(placeOf(x)));
    case "fashion": return open.filter((x) => x.categories.includes("textile"));
    case "outlet": return open.filter((x) => placeOf(x) === "factory" || s.listings.some((l) => l.shopId === x.id && l.offer === "expiring" && l.status === "active"));
    case "expiring-rentals": return open.filter((x) => freeingUp(s, x).length > 0);
  }
}

/** Countries, then cities, with how many stores and free shelves each has. */
export function geography(s: State, shops: Shop[]) {
  const countries = new Map<string, { stores: number; free: number; cities: Map<string, { stores: number; free: number }> }>();
  for (const x of shops) {
    const c = countries.get(x.country) ?? { stores: 0, free: 0, cities: new Map() };
    const f = freeShelves(s, x);
    c.stores++; c.free += f;
    const city = c.cities.get(x.city) ?? { stores: 0, free: 0 };
    city.stores++; city.free += f;
    c.cities.set(x.city, city);
    countries.set(x.country, c);
  }
  return countries;
}
