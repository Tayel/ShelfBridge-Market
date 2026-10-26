import type { Shop } from "./types";

/** Sample reviews for seeded stores only. Not real renters. */
export const SUB_SCORES = [
  { id: "visibility", label: "Visibility" },
  { id: "accuracy", label: "Accuracy" },
  { id: "traffic", label: "Foot traffic" },
  { id: "communication", label: "Communication" },
  { id: "stock", label: "Stock handling" },
  { id: "value", label: "Value" },
] as const;
export type SubScore = (typeof SUB_SCORES)[number]["id"];

export interface Review {
  shopId: string; author: string; months: number; at: string; text: string; tags: string[];
  scores: Record<SubScore, number>;
}

const r = (shopId: string, author: string, months: number, at: string, text: string, tags: string[], s: number[]): Review => ({
  shopId, author, months, at, text, tags,
  scores: { visibility: s[0], accuracy: s[1], traffic: s[2], communication: s[3], stock: s[4], value: s[5] },
});

export const REVIEWS: Review[] = [
  r("s-cairo", "Nour Atelier (sample)", 6, "2026-08-14", "Shelf was exactly as described. Hany counted the stock with me on day one and sent photos when the dukkah ran low.", ["Careful stock count", "Busy mornings"], [5, 5, 5, 5, 5, 4]),
  r("s-cairo", "Sabah Spices (sample)", 3, "2026-05-02", "Good spot by the window. Saturdays are slow, weekdays are great.", ["Busy mornings", "Good light"], [5, 5, 4, 5, 5, 5]),
  r("s-cairo", "Kemet Candles (sample)", 6, "2026-01-20", "Fair price for Zamalek. Payouts matched the till log every month.", ["Sales match the till"], [4, 5, 5, 5, 5, 5]),
  r("s-alex", "Bahari Soap (sample)", 6, "2026-07-09", "Pharmacy shoppers trust the shelf. Slightly small for boxed items.", ["Trusted setting"], [4, 4, 4, 5, 4, 4]),
  r("s-alex", "Raml Herbs (sample)", 3, "2026-03-11", "Mona replies quickly, but the glass unit hides the bottom tier.", ["Quick replies"], [3, 4, 4, 5, 4, 4]),
  r("s-lisbon", "Cortiça & Co (sample)", 6, "2026-09-01", "Tourists and locals both stop here. Inês restocks from my back-up box.", ["Restocks for you", "Tourist traffic"], [5, 5, 5, 5, 5, 4]),
  r("s-lisbon", "Atelier Azul (sample)", 6, "2026-04-18", "Best shelf I've rented. Visibility from the till is excellent.", ["Seen from the till"], [5, 5, 5, 5, 5, 5]),
  r("s-lisbon", "Mel do Alentejo (sample)", 3, "2026-02-05", "Honey sold out twice. Slightly pricey but worth it.", ["Restocks for you"], [5, 5, 5, 4, 5, 4]),
  r("s-budapest", "Paprika Haus (sample)", 6, "2026-06-23", "Deli queue walks right past the gondola.", ["Queue passes the shelf"], [5, 4, 5, 4, 4, 5]),
  r("s-istanbul", "Defne Seramik (sample)", 6, "2026-08-30", "Window ledge sells coasters to people walking by. Afternoon sun is strong, so no chocolate.", ["Street-facing", "Hot afternoons"], [5, 4, 5, 5, 4, 5]),
  r("s-istanbul", "Kadıköy Kahve (sample)", 3, "2026-03-28", "Emre logs every sale at the till, so payouts were easy to check.", ["Sales match the till"], [4, 5, 4, 5, 5, 5]),
  r("s-dubai", "Oud Lane (sample)", 6, "2026-07-15", "Premium crowd, premium price. Eye-level spot in the wellness aisle.", ["Premium shoppers"], [5, 5, 4, 4, 5, 3]),
];

export const reviewsOf = (shopId: string) => REVIEWS.filter((x) => x.shopId === shopId);

export function ratingOf(shop: Shop) {
  const list = reviewsOf(shop.id);
  if (!list.length) return null;
  const avg = (k: SubScore) => list.reduce((a, x) => a + x.scores[k], 0) / list.length;
  const subs = Object.fromEntries(SUB_SCORES.map((s) => [s.id, avg(s.id)])) as Record<SubScore, number>;
  const overall = Object.values(subs).reduce((a, b) => a + b, 0) / SUB_SCORES.length;
  const tags = new Map<string, number>();
  list.forEach((x) => x.tags.forEach((t) => tags.set(t, (tags.get(t) ?? 0) + 1)));
  return { overall, count: list.length, subs, tags: [...tags.entries()].sort((a, b) => b[1] - a[1]) };
}

/** "Maker favourite": strong rating across at least two reviews. */
export const isFavourite = (shop: Shop) => { const x = ratingOf(shop); return !!x && x.count >= 2 && x.overall >= 4.75; };
