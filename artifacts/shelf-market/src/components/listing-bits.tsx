import { Heart, Star, Zap } from "lucide-react";
import { COUNTRY_GEO, CITY_GEO } from "@/lib/data";
import { isFavourite, ratingOf } from "@/lib/reviews";
import { actions } from "@/lib/actions";
import { rentOf } from "@/lib/ops";
import { usd } from "@/lib/util";
import type { Shop } from "@/lib/types";

export function SaveHeart({ shopId, saved, className = "" }: { shopId: string; saved: boolean; className?: string }) {
  return (
    <button type="button" aria-label={saved ? "Remove from saved" : "Save shelf"} aria-pressed={saved} data-testid={`button-save-${shopId}`}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); actions.toggleSaved(shopId); }}
      className={`grid h-9 w-9 place-items-center rounded-full bg-background/90 shadow-sm transition hover:scale-110 active:scale-90 ${className}`}>
      <Heart className={`h-4.5 w-4.5 ${saved ? "fill-primary text-primary" : "text-foreground/70"}`} strokeWidth={2} />
    </button>
  );
}

export function Rating({ shop, compact }: { shop: Shop; compact?: boolean }) {
  const r = ratingOf(shop);
  if (!r) return <span className="text-xs font-semibold text-primary">New</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm" data-testid={`rating-${shop.id}`}>
      <Star className="h-3.5 w-3.5 fill-foreground" />
      <b className="tabular-nums">{r.overall.toFixed(2)}</b>
      {!compact && <span className="text-muted-foreground">({r.count})</span>}
    </span>
  );
}

export function ListingBadges({ shop }: { shop: Shop }) {
  return (
    <>
      {isFavourite(shop) && <span className="rounded-full bg-background/95 px-2.5 py-1 text-xs font-semibold shadow-sm">Maker favourite</span>}
      {shop.listing.access === "premium" && <span className="rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold text-background">Premium</span>}
      {shop.listing.instantBook && <span className="inline-flex items-center gap-1 rounded-full bg-background/95 px-2.5 py-1 text-xs font-semibold shadow-sm"><Zap className="h-3 w-3 text-primary" />Instant</span>}
    </>
  );
}

/** Push pins apart vertically so nearby shops (e.g. Cairo and Alexandria) don't cover each other. */
function placed<T extends { p: number[] }>(items: T[], height = 520): T[] {
  const out: T[] = [];
  const clash = (p: number[]) => out.some((o) => Math.abs(o.p[0] - p[0]) < 110 && Math.abs(o.p[1] - p[1]) < 72);
  items.forEach((it) => {
    // Try the spot itself, then alternate below/above, staying inside the map.
    const tries = [0, 72, -72, 144, -144, 216, -216].map((d) => [it.p[0], it.p[1] + d]).filter((p) => p[1] > 30 && p[1] < height - 60);
    const p = tries.find((q) => !clash(q)) ?? tries[0] ?? it.p;
    out.push({ ...it, p });
  });
  return out;
}

/** "$29/mo", "15% of sales" or "$34/mo + 10% of sales". */
export function priceText(s: Shop) {
  const L = s.listing;
  if (L.pricing === "share") return `${L.salesSharePct}% of sales`;
  return `${usd(rentOf(s))}/mo${L.pricing === "hybrid" ? ` + ${L.salesSharePct}% of sales` : ""}`;
}

export const geoOf =(s: Shop): [number, number] => s.listing.geo ?? CITY_GEO[s.city] ?? COUNTRY_GEO[s.country] ?? [35, 20];

/**
 * Schematic map: shops plotted by latitude/longitude on a plain projection that fits the
 * shops in view. Pins show the monthly rent; clicking one selects that shop.
 */
export function ShopMap({ shops, active, onPick }: { shops: Shop[]; active: string | null; onPick: (id: string) => void }) {
  const W = 600, H = 520, pad = 60;
  const pts = shops.map((s) => ({ s, g: geoOf(s) }));
  const lats = pts.map((p) => p.g[0]), lngs = pts.map((p) => p.g[1]);
  const [minLat, maxLat] = pts.length ? [Math.min(...lats) - 2, Math.max(...lats) + 2] : [20, 50];
  const [minLng, maxLng] = pts.length ? [Math.min(...lngs) - 3, Math.max(...lngs) + 3] : [-10, 60];
  const sx = (W - pad * 2) / Math.max(1, maxLng - minLng), sy = (H - pad * 2) / Math.max(1, maxLat - minLat);
  const k = Math.min(sx, sy);
  const ox = (W - (maxLng - minLng) * k) / 2, oy = (H - (maxLat - minLat) * k) / 2;
  const xy = (g: [number, number]) => [ox + (g[1] - minLng) * k, oy + (maxLat - g[0]) * k];
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-border" style={{ background: "hsl(var(--muted))" }} data-testid="shop-map">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full" role="img" aria-label="Map of shops in these results">
        {Array.from({ length: 9 }).map((_, i) => <line key={`v${i}`} x1={(i * W) / 8} x2={(i * W) / 8} y1={0} y2={H} stroke="hsl(var(--border))" />)}
        {Array.from({ length: 9 }).map((_, i) => <line key={`h${i}`} y1={(i * H) / 8} y2={(i * H) / 8} x1={0} x2={W} stroke="hsl(var(--border))" />)}
        {placed(pts.map(({ s, g }) => ({ s, p: xy(g) }))).map(({ s, p: [x, y] }) => {
          const on = active === s.id;
          const label = s.listing.pricing === "share" ? `${s.listing.salesSharePct}%` : usd(rentOf(s)).replace(".00", "");
          const w = label.length * 13 + 26;
          return (
            <g key={s.id} transform={`translate(${x},${y})`} className="cursor-pointer" onClick={() => onPick(s.id)} data-testid={`pin-${s.id}`}>
              <rect x={-w / 2} y={-22} width={w} height={44} rx={22} fill={on ? "hsl(var(--foreground))" : "hsl(var(--background))"} stroke="hsl(var(--border))" strokeWidth={2} />
              <text textAnchor="middle" y={8} fontSize={22} fontWeight={700} fill={on ? "hsl(var(--background))" : "hsl(var(--foreground))"}>{label}</text>
              <text textAnchor="middle" y={44} fontSize={17} fill="hsl(var(--muted-foreground))">{s.city}</text>
            </g>
          );
        })}
      </svg>
      <p className="absolute bottom-2 left-3 text-[10px] text-muted-foreground">Schematic map, not to scale. Rent per shelf per month; % = share of sales only.</p>
    </div>
  );
}
