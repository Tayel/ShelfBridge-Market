import { categoryLabel, countryName, type Product } from "./data";
import type { Shop } from "./store";

export interface Check { id: string; label: string; ok: boolean; note: string; }

const TODAY = () => new Date();

/** Illustrative sample checks only. Not legal or regulatory clearance. */
export function runChecks(p: Product, shop: Shop, origin: string): Check[] {
  const minExpiry = new Date(TODAY().getTime() + 60 * 864e5);
  const exp = p.expiry ? new Date(p.expiry) : null;
  const policyHit =
    (shop.restrictions.includes("no-plastic") && p.tags?.includes("plastic")) ||
    (shop.restrictions.includes("no-animal-test") && p.tags?.includes("animal-test")) ||
    (shop.restrictions.includes("fair-trade") && !p.tags?.includes("fair-trade"));
  return [
    { id: "origin", label: "Origin", ok: p.origins.includes(origin), note: p.origins.includes(origin) ? `Made in ${countryName(origin)}` : `Not sourced from ${countryName(origin)}` },
    { id: "dest", label: "Destination", ok: !p.blockedIn?.includes(shop.country), note: p.blockedIn?.includes(shop.country) ? `Restricted in ${countryName(shop.country)} (sample rule)` : `Sample rule passes for ${countryName(shop.country)}` },
    { id: "cat", label: "Category", ok: shop.categories.includes(p.category), note: shop.categories.includes(p.category) ? categoryLabel(p.category) : `Shop doesn't take ${categoryLabel(p.category).toLowerCase()}` },
    { id: "exp", label: "Expiry", ok: !exp || exp > minExpiry, note: !exp ? "Not perishable" : exp > minExpiry ? `Good until ${exp.toLocaleDateString()}` : exp < TODAY() ? `Expired ${exp.toLocaleDateString()}` : "Expires within 60 days" },
    { id: "policy", label: "Store policy", ok: !policyHit, note: policyHit ? "Conflicts with shop's ethical rules" : "Fits shop's rules" },
  ];
}

export const firstBlocker = (c: Check[]) => c.find((x) => !x.ok && x.id !== "origin");
