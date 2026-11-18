import { Clock, Plane } from "lucide-react";
import type { Listing } from "@/lib/types";
import { offerTitle } from "@/lib/data";
import { daysUntil } from "@/lib/util";

/** Days left on an About to expire batch, in words. */
export function daysLeftText(expiry?: string) {
  if (!expiry) return "";
  const d = daysUntil(expiry);
  return d <= 0 ? "last day" : d === 1 ? "1 day left" : `${d} days left`;
}

export const offerPct = (l: Pick<Listing, "retail" | "wasPrice">) =>
  l.wasPrice && l.wasPrice > l.retail ? Math.round((1 - l.retail / l.wasPrice) * 100) : 0;

/** Small chip naming the offer, in the app's rounded-pill style. */
export function OfferPill({ l }: { l: Listing }) {
  if (!l.offer) return null;
  const Icon = l.offer === "expiring" ? Clock : Plane;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary" data-testid={`pill-offer-${l.id}`}>
      <Icon className="h-3 w-3" />{offerTitle(l.offer)}
      {l.offer === "expiring" && offerPct(l) > 0 && <span className="tabular-nums">· −{offerPct(l)}%</span>}
    </span>
  );
}

/** One line under a product: days left for near-date stock, the culture story for souvenirs. */
export function OfferNote({ l }: { l: Listing }) {
  return (
    <div className="mt-1 space-y-1">
      <OfferPill l={l} />
      {l.offer === "expiring" && l.expiry && <p className="text-xs text-muted-foreground">{daysLeftText(l.expiry)} · sold below its usual price so it doesn't go to waste</p>}
      {l.offer === "flying" && l.story && <p className="text-xs italic text-muted-foreground">{l.story}</p>}
    </div>
  );
}
