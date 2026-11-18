import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Check } from "lucide-react";
import { HowItWorks, JourneySteps, ProductSwitch, asset, useRequireProduct } from "@/components/product-bits";
import { motion } from "framer-motion";
import { Map as MapIcon, List, MapPin, SlidersHorizontal, Store, Users } from "lucide-react";
import { Shell, PrimaryButton, GhostButton } from "@/components/shell";
import { ShelfArt } from "@/components/shelf-art";
import { coverOf } from "@/components/photos";
import { Field, Modal, inputCls } from "@/components/kit";
import { ListingBadges, Rating, SaveHeart, ShopMap, priceText } from "@/components/listing-bits";
import { rentOf } from "@/lib/ops";
import { BUSINESSES, CATEGORIES, FEATURES, PRICING_LABEL, PRODUCT_JOURNEY, SHELF_TYPES, countryName, shelfTypeLabel, shopServes, type ProductId } from "@/lib/data";
import { isFavourite } from "@/lib/reviews";
import { slotsOf, takenSlots, useStore, usd } from "@/lib/store";
import { today } from "@/lib/util";
import type { PricingModel, Shop, ShelfType } from "@/lib/types";

function Chip({ on, onClick, children, id }: { on: boolean; onClick: () => void; children: React.ReactNode; id: string }) {
  return (
    <button onClick={onClick} aria-pressed={on} data-testid={id}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition active:scale-95 ${on ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/30"}`}>
      {children}
    </button>
  );
}

interface Filters {
  min: number; max: number; types: ShelfType[]; traffic: number; pricing: PricingModel[];
  features: string[]; biz: string[]; instant: boolean; favourite: boolean; openOnly: boolean;
}
const NO_FILTERS: Filters = { min: 0, max: 0, types: [], traffic: 0, pricing: [], features: [], biz: [], instant: false, favourite: false, openOnly: false };
const LENGTHS = [{ v: 0, l: "Any length" }, { v: 1, l: "1 month" }, { v: 3, l: "3 months" }, { v: 6, l: "6 months" }, { v: 12, l: "12 months" }];
const TRAFFIC = [{ v: 0, l: "Any" }, { v: 200, l: "200+ a day" }, { v: 350, l: "350+ a day" }, { v: 500, l: "500+ a day" }];
const toggle = <T,>(a: T[], v: T) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);

function matches(s: Shop, f: Filters, where: string, what: string, months: number) {
  const L = s.listing;
  return (where === "all" || s.city === where)
    && (what === "all" || s.categories.includes(what))
    && (!months || s.terms.months <= months)
    && (!f.min || rentOf(s) >= f.min) && (!f.max || rentOf(s) <= f.max)
    && (!f.types.length || f.types.includes(L.shelfType))
    && L.footTraffic >= f.traffic
    && (!f.pricing.length || f.pricing.includes(L.pricing))
    && f.features.every((x) => L.features.includes(x))
    && (!f.biz.length || f.biz.includes(s.business))
    && (!f.instant || L.instantBook)
    && (!f.favourite || isFavourite(s))
    && (!f.openOnly || L.access === "open");
}

const activeCount = (f: Filters) =>
  [f.min || f.max, f.types.length, f.traffic, f.pricing.length, f.features.length, f.biz.length, f.instant, f.favourite, f.openOnly].filter(Boolean).length;

/** What each product sells: near-date food and drinks; national products of any kind at the airport. */
const PRODUCT_CATS: Record<ProductId, string[]> = { expiring: ["food", "drinks"], flying: ["food", "craft", "textile", "beauty"] };

export default function Explore() {
  const product = useRequireProduct("holder");
  return product ? <ExploreFor product={product} key={product} /> : null;
}

function ExploreFor({ product }: { product: ProductId }) {
  const st = useStore();
  const [, go] = useLocation();
  const j = PRODUCT_JOURNEY[product];
  const [where, setWhere] = useState("all");
  const [start, setStart] = useState(today());
  const [months, setMonths] = useState(0);
  const [what, setWhat] = useState("all");
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const [open, setOpen] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  const approved = useMemo(() => st.shops.filter((s) => s.status === "approved" && shopServes(s, product)), [st.shops, product]);
  const cities = [...new Set(approved.map((s) => s.city))].sort();
  const shops = useMemo(() => approved.filter((s) => matches(s, f, where, what, months)), [approved, f, where, what, months]);
  const draftCount = approved.filter((s) => matches(s, draft, where, what, months)).length;
  const n = activeCount(f);
  const quick = (patch: Partial<Filters>) => setF((x) => ({ ...x, ...patch }));
  const qs = `?start=${start}${months ? `&months=${months}` : ""}&product=${product}`;

  return (
    <Shell title={`Find a shelf · ${j.title}`} back={`/start?as=holder&product=${product}`}>
      <div className="mb-8 flex flex-col items-center gap-4">
        <JourneySteps at={3} />
        <ProductSwitch value={product} onChange={(p) => go(`/explore?product=${p}`)} />
      </div>
      <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]" data-testid={`explore-hero-${product}`}>
        <div className="text-center lg:text-left">
          <p className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{j.title} · {j.holder.who}</p>
          <h1 className="font-display text-4xl font-extrabold leading-[1] md:text-5xl">{j.holder.title}</h1>
          <p className="mt-4 text-muted-foreground">{j.holder.pitch}</p>
          <ul className="mt-5 space-y-2 text-left text-sm">
            {j.holder.promises.map((x) => (
              <li key={x.title} className="flex gap-2.5"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Check className="h-3 w-3" /></span><span><b>{x.title}.</b> <span className="text-muted-foreground">{x.text}</span></span></li>
            ))}
          </ul>
        </div>
        <figure className="overflow-hidden rounded-[2rem] border border-border">
          <img src={asset(j.illustration)} alt={product === "flying" ? "A Made in Our Country shop at an airport gate" : "A neighbourhood grocery with an About to Expire shelf"} className="w-full" />
        </figure>
      </section>
      <h2 className="font-display mt-12 text-center text-3xl font-bold">{j.holder.cta}</h2>

      <div className="mx-auto mt-6 grid max-w-4xl gap-2 rounded-[2rem] border border-border p-2 shadow-[0_12px_40px_-24px_rgba(60,40,20,.35)] grid-cols-2 sm:grid-cols-4" data-testid="search-bar">
        <label className="flex flex-col rounded-3xl px-4 py-2 hover:bg-muted">
          <span className="text-xs font-semibold">Where</span>
          <select value={where} onChange={(e) => setWhere(e.target.value)} className="bg-transparent text-sm text-muted-foreground outline-none" data-testid="select-where">
            <option value="all">Anywhere</option>
            {cities.map((c) => <option key={c} value={c}>{c}, {countryName(approved.find((s) => s.city === c)!.country)}</option>)}
          </select>
        </label>
        <label className="flex flex-col rounded-3xl px-4 py-2 hover:bg-muted">
          <span className="text-xs font-semibold">Start</span>
          <input type="date" min={today()} value={start} onChange={(e) => setStart(e.target.value || today())} className="bg-transparent text-sm text-muted-foreground outline-none" data-testid="input-search-start" />
        </label>
        <label className="flex flex-col rounded-3xl px-4 py-2 hover:bg-muted">
          <span className="text-xs font-semibold">For how long</span>
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="bg-transparent text-sm text-muted-foreground outline-none" data-testid="select-length">
            {LENGTHS.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}
          </select>
        </label>
        <label className="flex flex-col rounded-3xl px-4 py-2 hover:bg-muted">
          <span className="text-xs font-semibold">What you sell</span>
          <select value={what} onChange={(e) => setWhat(e.target.value)} className="bg-transparent text-sm text-muted-foreground outline-none" data-testid="select-what">
            <option value="all">{product === "flying" ? "Any national product" : "Food or drinks"}</option>
            {CATEGORIES.filter((c) => PRODUCT_CATS[product].includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-1">
        <Chip on={n > 0} onClick={() => { setDraft(f); setOpen(true); }} id="button-filters"><SlidersHorizontal className="h-4 w-4" />Filters{n ? ` · ${n}` : ""}</Chip>
        <Chip on={f.instant} onClick={() => quick({ instant: !f.instant })} id="chip-instant">Instant book</Chip>
        <Chip on={f.favourite} onClick={() => quick({ favourite: !f.favourite })} id="chip-favourite">Maker favourite</Chip>
        {SHELF_TYPES.map((t) => <Chip key={t.id} on={f.types.includes(t.id)} onClick={() => quick({ types: toggle(f.types, t.id) })} id={`chip-type-${t.id}`}>{t.label}</Chip>)}
        <Chip on={f.features.includes("restock")} onClick={() => quick({ features: toggle(f.features, "restock") })} id="chip-restock">Shop restocks</Chip>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground" data-testid="text-result-count">{shops.length} {product === "flying" ? "airport shop" : "neighbourhood shop"}{shops.length === 1 ? "" : "s"} with shelves</p>
        <button onClick={() => setShowMap((m) => !m)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm lg:hidden" data-testid="button-toggle-map">
          {showMap ? <><List className="h-4 w-4" />List</> : <><MapIcon className="h-4 w-4" />Map</>}
        </button>
      </div>

      {shops.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center text-muted-foreground" data-testid="empty-shops">
          <ShelfArt tiers={2} hue={30} fill={[null, null]} className="w-40" />
          <p className="mt-4">No shelves match. Try fewer filters.</p>
          <GhostButton onClick={() => { setF(NO_FILTERS); setWhere("all"); setWhat("all"); setMonths(0); }} data-testid="button-clear-all">Clear search and filters</GhostButton>
        </div>
      ) : (
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className={`grid content-start gap-5 sm:grid-cols-2 ${showMap ? "hidden lg:grid" : ""}`}>
            {shops.map((s, i) => <ShopCard key={s.id} shop={s} i={i} months={months} qs={qs} active={active === s.id} saved={st.saved.includes(s.id)} free={slotsOf(s) - takenSlots(st, s.id).size} />)}
          </div>
          <div className={showMap ? "" : "hidden lg:block"}>
            <div className="lg:sticky lg:top-20 lg:h-[calc(100dvh-7rem)]">
              <ShopMap shops={shops} active={active} onPick={(id) => { setActive(id); setShowMap(false); setTimeout(() => document.querySelector(`[data-testid="card-shop-${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50); }} />
            </div>
          </div>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Filters" wide>
        <div className="max-h-[60vh] space-y-6 overflow-y-auto pr-1">
          <section>
            <p className="font-semibold">Monthly rent</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Field label="Minimum (USD)"><input type="number" min={0} value={draft.min || ""} placeholder="No minimum" onChange={(e) => setDraft({ ...draft, min: Number(e.target.value) })} className={inputCls} data-testid="input-price-min" /></Field>
              <Field label="Maximum (USD)"><input type="number" min={0} value={draft.max || ""} placeholder="No maximum" onChange={(e) => setDraft({ ...draft, max: Number(e.target.value) })} className={inputCls} data-testid="input-price-max" /></Field>
            </div>
          </section>
          <FilterGroup title="Shelf type" options={SHELF_TYPES.map((t) => ({ id: t.id, label: t.label }))} value={draft.types} onChange={(v) => setDraft({ ...draft, types: v as ShelfType[] })} />
          <section>
            <p className="font-semibold">Shoppers a day</p>
            <div className="mt-2 flex flex-wrap gap-2">{TRAFFIC.map((t) => <Chip key={t.v} on={draft.traffic === t.v} onClick={() => setDraft({ ...draft, traffic: t.v })} id={`chip-traffic-${t.v}`}>{t.l}</Chip>)}</div>
          </section>
          <FilterGroup title="How rent is charged" options={(Object.keys(PRICING_LABEL) as PricingModel[]).map((k) => ({ id: k, label: PRICING_LABEL[k] }))} value={draft.pricing} onChange={(v) => setDraft({ ...draft, pricing: v as PricingModel[] })} />
          <FilterGroup title="What the shop offers" options={FEATURES} value={draft.features} onChange={(v) => setDraft({ ...draft, features: v })} />
          <FilterGroup title="Type of shop" options={BUSINESSES.map((b) => ({ id: b.code, label: b.label }))} value={draft.biz} onChange={(v) => setDraft({ ...draft, biz: v })} />
          <section>
            <p className="font-semibold">Booking and access</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip on={draft.instant} onClick={() => setDraft({ ...draft, instant: !draft.instant })} id="filter-instant">Instant book</Chip>
              <Chip on={draft.favourite} onClick={() => setDraft({ ...draft, favourite: !draft.favourite })} id="filter-favourite">Maker favourite</Chip>
              <Chip on={draft.openOnly} onClick={() => setDraft({ ...draft, openOnly: !draft.openOnly })} id="filter-open">Open to any token</Chip>
            </div>
          </section>
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <GhostButton onClick={() => setDraft(NO_FILTERS)} data-testid="button-clear-filters">Clear all</GhostButton>
          <PrimaryButton onClick={() => { setF(draft); setOpen(false); }} data-testid="button-apply-filters">Show {draftCount} shop{draftCount === 1 ? "" : "s"}</PrimaryButton>
        </div>
      </Modal>
      <HowItWorks product={product} />
    </Shell>
  );
}

function FilterGroup({ title, options, value, onChange }: { title: string; options: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <section>
      <p className="font-semibold">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => <Chip key={o.id} on={value.includes(o.id)} onClick={() => onChange(toggle(value, o.id))} id={`filter-${o.id}`}>{o.label}</Chip>)}
      </div>
    </section>
  );
}

export function ShopCard({ shop: s, i, months, qs = "", active, saved, free }: { shop: Shop; i: number; months: number; qs?: string; active?: boolean; saved: boolean; free: number }) {
  const L = s.listing;
  const term = months || s.terms.months;
  const cover = coverOf(s.photos);
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}>
      <Link href={`/explore/${s.id}${qs}`} data-testid={`card-shop-${s.id}`}
        className={`group block rounded-[1.75rem] border p-4 transition hover:-translate-y-1 hover:shadow-[0_24px_50px_-28px_rgba(120,60,30,.4)] ${active ? "border-foreground" : "border-border"}`}>
        <div className={`relative overflow-hidden rounded-2xl ${cover ? "aspect-[4/3]" : "p-4"}`} style={cover ? undefined : { background: `hsl(${s.hue} 50% 97%)` }}>
          {cover
            ? <img src={cover.url} alt={`${s.name}: ${cover.caption || "the shelf"}`} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" data-testid={`img-cover-${s.id}`} />
            : <ShelfArt tiers={Math.min(s.tiers, 3)} hue={s.hue} className="mx-auto h-32 transition duration-500 group-hover:scale-105" />}
          {s.photos.length > 1 && <span className="absolute bottom-3 left-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-semibold shadow-sm">{s.photos.length} photos</span>}
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5"><ListingBadges shop={s} /></div>
          <SaveHeart shopId={s.id} saved={saved} className="absolute right-3 top-3" />
        </div>
        <div className="mt-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-display truncate text-lg font-bold">{s.name}</h2>
            <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" />{s.city}, {countryName(s.country)}</p>
          </div>
          <Rating shop={s} compact />
        </div>
        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          {shelfTypeLabel(L.shelfType)} · <Users className="h-3.5 w-3.5" />{L.footTraffic}/day
        </p>
        <p className="mt-2 text-sm">
          <b className="font-display text-base">{priceText(s)}</b>
        </p>
        <p className="text-xs text-muted-foreground" data-testid={`text-total-${s.id}`}>{L.pricing === "share" ? "No fixed rent" : `${usd(rentOf(s) * term)} rent for ${term} mo, before tax`}{s.terms.deposit ? ` · ${usd(s.terms.deposit)} deposit` : ""}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className={`rounded-full px-2.5 py-1 ${free ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>{free ? `${free} free` : "Full"}</span>
          {L.cancellation === "flexible" && <span className="rounded-full bg-muted px-2.5 py-1">Flexible cancellation</span>}
          {!s.seeded && <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-accent-foreground"><Store className="h-3 w-3" />Yours</span>}
        </div>
      </Link>
    </motion.div>
  );
}
