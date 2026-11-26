import { Link, useLocation, useParams, useSearch } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BadgeCheck, CalendarClock, ChevronRight, MapPin, Store } from "lucide-react";
import { Shell } from "@/components/shell";
import { SceneArt } from "@/components/owner-scenes";
import { ProductVideo } from "@/components/product-video";
import { coverOf } from "@/components/photos";
import { priceText } from "@/components/listing-bits";
import { OPPORTUNITIES, freeShelves, freeingUp, geography, opportunityOf, placeOf, storesFor, type OpportunityId } from "@/lib/opportunities";
import { PRIORITY_COUNTRIES, countryName, localApprox } from "@/lib/data";
import { useStore } from "@/lib/store";
import { fmtDate } from "@/lib/util";

const PLACE_LABEL: Record<string, string> = { street: "Street shop", mall: "Shopping mall", airport: "Airport", hotel: "Hotel", factory: "Factory outlet", supermarket: "Supermarket", cafe: "Café", other: "Commercial space" };

/** Opportunity → country → city → store. The store page then shows the exact shelf on its floor plan. */
export default function Opportunities() {
  const { id } = useParams<{ id: string }>();
  const q = new URLSearchParams(useSearch());
  const [, go] = useLocation();
  const st = useStore();
  const o = opportunityOf(id);
  if (!o) return <Shell title="Not found" back="/start?as=holder"><p className="mt-20 text-center text-muted-foreground">That opportunity doesn't exist. <Link href="/start?as=holder" className="text-primary underline">See all</Link></p></Shell>;

  const country = q.get("country"), city = q.get("city");
  // "Near-expiry" from the start page: only stores that accept food and drinks, where near-date stock can go.
  const nearExpiry = q.get("type") === "near-expiry";
  const stores = storesFor(st, o.id).filter((x) => !nearExpiry || x.categories.some((c) => c === "food" || c === "drinks"));
  const geo = geography(st, stores);
  const url = (c?: string | null, ci?: string | null) => {
    const p = new URLSearchParams();
    if (c) p.set("country", c); if (c && ci) p.set("city", ci); if (nearExpiry) p.set("type", "near-expiry");
    const s = p.toString();
    return `/opportunities/${o.id}${s ? `?${s}` : ""}`;
  };
  const countries = [...new Set([...geo.keys(), ...PRIORITY_COUNTRIES.map((c) => c.code)])];
  const cities = country ? [...(geo.get(country)?.cities.entries() ?? [])] : [];
  const list = stores.filter((x) => (!country || x.country === country) && (!city || x.city === city));
  const level = !country ? 0 : !city ? 1 : 2;

  const Crumb = ({ label, href, on }: { label: string; href?: string; on: boolean }) => (
    href && !on ? <Link href={href} className="text-muted-foreground underline-offset-4 hover:underline">{label}</Link> : <span className={on ? "font-semibold" : "text-muted-foreground"}>{label}</span>
  );

  return (
    <Shell title={o.title} back="/start?as=holder" wide>
      <div className="relative overflow-hidden rounded-[2rem] border border-border bg-muted">
        <div className="aspect-[16/6] w-full">
          {o.video ? <ProductVideo product={o.video} className="h-full w-full" /> : <SceneArt venue={o.scene} className="h-full w-full" />}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-90">{o.tagline}</p>
          <h1 className="font-display text-3xl font-extrabold md:text-5xl" data-testid="opportunity-title">{o.title}</h1>
          <p className="mt-1 max-w-2xl text-sm opacity-90">{o.text}</p>
        </div>
      </div>

      <nav aria-label="Where you are" className="mt-6 flex flex-wrap items-center gap-1.5 text-sm" data-testid="opportunity-crumbs">
        <Crumb label="All opportunities" href="/start?as=holder" on={false} /><ChevronRight className="h-4 w-4 text-muted-foreground" />
        <Crumb label={o.title} href={url()} on={level === 0} /><ChevronRight className="h-4 w-4 text-muted-foreground" />
        <Crumb label={country ? countryName(country) : "Country"} href={country ? url(country) : undefined} on={level === 1} /><ChevronRight className="h-4 w-4 text-muted-foreground" />
        <Crumb label={city ?? "City"} on={level === 2} /><ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Store</span><ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Shelf</span>
      </nav>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={nearExpiry ? url(country, city).replace(/[?&]type=near-expiry/, "").replace(/\?$/, "") : `${url(country, city)}${url(country, city).includes("?") ? "&" : "?"}type=near-expiry`}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${nearExpiry ? "border-foreground bg-foreground text-background" : "border-dashed border-border"}`} data-testid="toggle-near-expiry">
          {nearExpiry ? "Near-expiry: food & drink stores ✕" : "Near-expiry only"}
        </Link>
        {OPPORTUNITIES.map((x) => (
          <Link key={x.id} href={`/opportunities/${x.id}${nearExpiry ? "?type=near-expiry" : ""}`} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${x.id === o.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40"}`}>{x.title}</Link>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={`${country}-${city}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="mt-8">
          {level === 0 && (
            <>
              <h2 className="font-display text-2xl font-bold">Choose a country</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {countries.map((c) => {
                  const g = geo.get(c);
                  return (
                    <button key={c} type="button" disabled={!g} onClick={() => go(url(c))} data-testid={`country-${c}`}
                      className="flex items-center justify-between gap-3 rounded-3xl border-2 border-border p-5 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:border-primary/40 disabled:opacity-60">
                      <span><span className="font-display block text-3xl font-bold text-primary/80">{c}</span><span className="font-medium">{countryName(c)}</span>
                        <span className="block text-xs text-muted-foreground">{g ? `${g.stores} store${g.stores === 1 ? "" : "s"} · ${g.free} shelves free · ${g.cities.size} cit${g.cities.size === 1 ? "y" : "ies"}` : "Coming soon"}</span></span>
                      {g && <ArrowRight className="h-5 w-5 text-primary" />}
                    </button>
                  );
                })}
              </div>
              {stores.length === 0 && <p className="mt-6 rounded-3xl bg-muted/60 p-5 text-sm text-muted-foreground" data-testid="opportunity-soon">No store offers this kind of shelf yet. Store owners are joining now: save InRaf and check back, or <Link href="/opportunities/independent" className="underline">see independent stores</Link>.</p>}
            </>
          )}
          {level === 1 && (
            <>
              <h2 className="font-display text-2xl font-bold">Choose a city in {countryName(country!)}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {cities.map(([name, g]) => (
                  <button key={name} type="button" onClick={() => go(url(country, name))} data-testid={`city-${name}`}
                    className="flex items-center justify-between gap-3 rounded-3xl border-2 border-border p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/40">
                    <span><MapPin className="h-5 w-5 text-primary" /><span className="font-display mt-1 block text-xl font-bold">{name}</span><span className="text-xs text-muted-foreground">{g.stores} store{g.stores === 1 ? "" : "s"} · {g.free} shelves free</span></span>
                    <ArrowRight className="h-5 w-5 text-primary" />
                  </button>
                ))}
                {cities.length === 0 && <p className="text-sm text-muted-foreground">No stores here yet.</p>}
              </div>
            </>
          )}
          {level === 2 && (
            <>
              <h2 className="font-display text-2xl font-bold">Stores in {city}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((x) => {
                  const cover = coverOf(x.photos);
                  const ending = o.id === "expiring-rentals" ? freeingUp(st, x) : [];
                  const free = freeShelves(st, x);
                  return (
                    <Link key={x.id} href={`/explore/${x.id}`} className="group overflow-hidden rounded-3xl border border-border transition hover:-translate-y-1 hover:shadow-[0_30px_60px_-35px_rgba(120,60,30,.45)]" data-testid={`store-${x.id}`}>
                      <div className="relative aspect-[4/3] bg-muted">
                        {cover ? <img src={cover.url} alt={x.name} referrerPolicy="no-referrer" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <SceneArt venue={placeOf(x)} className="h-full w-full" />}
                        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-xs font-semibold backdrop-blur">
                          {x.seeded ? <>Sample store</> : <><BadgeCheck className="h-3.5 w-3.5 text-primary" />Approved by InRaf</>}
                        </span>
                      </div>
                      <div className="p-4">
                        <p className="text-xs text-muted-foreground"><Store className="mr-1 inline h-3.5 w-3.5" />{PLACE_LABEL[placeOf(x)]} · {x.city}, {countryName(x.country)}</p>
                        <p className="font-display text-lg font-bold">{x.name}</p>
                        <p className="text-xs text-muted-foreground">{x.address || `${x.location}, ${x.city}`}</p>
                        <p className="mt-2 text-sm"><b>{priceText(x)}</b>{localApprox(x.price, x.country) ? <span className="text-muted-foreground"> · {localApprox(x.price, x.country)}</span> : null}</p>
                        <p className="text-xs text-muted-foreground">{free} of {x.bricks.length * x.tiers} shelves free · {x.shelf.widthCm}×{x.shelf.heightCm}×{x.shelf.depthCm} cm · min {x.terms.months} months</p>
                        {ending.map((e) => <p key={e.contract.id} className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"><CalendarClock className="h-3 w-3" />{e.label} frees up {fmtDate(e.end)}</p>)}
                        <p className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">Inspect the shelves <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </Shell>
  );
}

export type { OpportunityId };
