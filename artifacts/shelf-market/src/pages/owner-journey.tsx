import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Check, Clock, Gem, Gift, Home, Minus, Package, PencilRuler, Plane, Plus, Recycle, Sparkles,
  Store, Trash2, Cookie, X,
} from "lucide-react";
import { Shell, PrimaryButton, GhostButton } from "@/components/shell";
import { SceneArt, SceneInteractive, sceneHotspots, sceneTitle } from "@/components/owner-scenes";
import { PhotoUploader, photosComplete } from "@/components/photos";
import { ErrorNote, Field, inputCls } from "@/components/kit";
import { PRIORITY_COUNTRIES, countryName, localApprox, RATES_AS_OF, PLATFORM_COMMISSION_PCT } from "@/lib/data";
import { LIVE, usd, useSession, useStore } from "@/lib/store";
import { actions } from "@/lib/actions";
import { useAct } from "@/hooks/use-act";
import { useToast } from "@/hooks/use-toast";
import { DATED_CATEGORIES, MIN_SHELF_LIFE_DAYS, daysLeft, type OwnerRequestInput, type ShopInput } from "@/lib/ops";
import { today } from "@/lib/util";
import type { AirportDetails, OfferKind, ProductItem, ServiceOffer, ShelfType, ShopPhoto, SpaceArea, SurplusItem, VenueType } from "@/lib/types";

// ---------- what the owner can pick ----------
const VENUES: { id: VenueType; title: string; text: string; code: string }[] = [
  { id: "street", title: "Street retail", text: "Independent shops, boutiques, convenience stores and neighbourhood retailers.", code: "4773" },
  { id: "mall", title: "Shopping mall", text: "Mall stores, department stores, kiosks, pop-up spaces and mall displays.", code: "4771" },
  { id: "airport", title: "Airport", text: "Airport shops, duty-free, departure lounges and transit areas.", code: "4719" },
  { id: "hotel", title: "Hotel", text: "Hotel boutiques, lobby displays, reception areas and gift shops.", code: "5510" },
  { id: "factory", title: "Factory & manufacturer", text: "Factory outlets, production sites, warehouses and surplus inventory.", code: "1079" },
  { id: "supermarket", title: "Supermarket & grocery", text: "Aisle shelves, checkout counters, promotional displays and brand sections.", code: "4711" },
  { id: "cafe", title: "Restaurant & café", text: "Counter displays, retail corners and packaged-product shelves.", code: "5610" },
  { id: "other", title: "Other commercial space", text: "Any business with display space, products or stock to offer.", code: "4719" },
];

const OFFERS: { id: OfferKind; title: string; text: string; icon: typeof Store; examples: string[] }[] = [
  { id: "rent", title: "Rent your space", text: "For empty or under-used shelves, displays and corners.", icon: Store,
    examples: ["Wall shelves and glass cabinets", "Counters and window displays", "Kiosks and pop-up corners", "Airport and hotel lobby displays", "Dedicated brand corners"] },
  { id: "sell", title: "Sell or distribute your products", text: "Offer your own products to customers or to other shops.", icon: Package,
    examples: ["Handmade products", "Gifts and souvenirs", "Fashion accessories", "Beauty and personal care", "Specialty food, décor, stationery"] },
  { id: "surplus", title: "Offer surplus or near-expiry stock", text: "Sell stock before it loses its value, responsibly.", icon: Recycle,
    examples: ["Products close to their expiry date", "Retail overstock and excess production", "Seasonal and discontinued lines", "Hotel surplus", "Packaging changes"] },
];

const CATS: { id: string; title: string; icon: typeof Gift; examples: string; shop: string; tint: string }[] = [
  { id: "gifts", title: "Gifts, handmade & souvenirs", icon: Gift, examples: "Candles, gift boxes, local souvenirs, artisan pieces", shop: "craft", tint: "#F7E3D9" },
  { id: "fashion", title: "Fashion & accessories", icon: Gem, examples: "Jewellery, sunglasses, watches, bags, scarves, wallets", shop: "textile", tint: "#EFE6F3" },
  { id: "beauty", title: "Beauty & personal care", icon: Sparkles, examples: "Soaps, skincare, perfumes, haircare", shop: "beauty", tint: "#F6E9EC" },
  { id: "food", title: "Specialty food & packaged", icon: Cookie, examples: "Chocolates, dates, honey, snacks, coffee and tea", shop: "food", tint: "#F8EBD2" },
  { id: "home", title: "Home décor & lifestyle", icon: Home, examples: "Ceramics, small artwork, decorative pieces, small plants", shop: "craft", tint: "#E5ECE2" },
  { id: "stationery", title: "Stationery, hobbies & children", icon: PencilRuler, examples: "Notebooks, planners, educational toys, puzzles, craft supplies", shop: "craft", tint: "#E2ECF0" },
  { id: "surplus", title: "Surplus, clearance & near-expiry", icon: Recycle, examples: "Factory surplus, overstock, seasonal clearance, near-date goods", shop: "food", tint: "#EEE9DF" },
];
const catTitle = (id: string) => CATS.find((c) => c.id === id)?.title ?? id;

const SERVICES: { id: string; label: string; price: number }[] = [
  { id: "setup", label: "Display and product setup", price: 25 },
  { id: "staff", label: "Staff assistance", price: 40 },
  { id: "pos", label: "Checkout at your till", price: 15 },
  { id: "promo", label: "In-store promotions", price: 30 },
  { id: "photo", label: "Product photography", price: 35 },
  { id: "inventory", label: "Inventory management", price: 20 },
  { id: "storage", label: "Storage and fulfilment", price: 30 },
  { id: "merch", label: "Packaging and merchandising", price: 20 },
];

const FORMATS = ["Gondola or shelf bay", "Counter display", "Free-standing stand", "Wall display", "Kiosk"];

// ---------- the owner's answers ----------
interface J {
  venue: VenueType | null; offers: OfferKind[]; cats: string[]; otherCat: string;
  spaces: Record<VenueType, SpaceArea[]>;
  airport: AirportDetails;
  products: ProductItem[]; surplus: SurplusItem[];
  services: ServiceOffer[];
  name: string; country: string; city: string; address: string; contact: string; phone: string; email: string; typeLabel: string;
  months: number; terms: string; photos: ShopPhoto[];
}
const spacesFor = (v: VenueType): SpaceArea[] => sceneHotspots(v).map((h) => ({ id: h.id, label: h.label, kind: h.kind, dims: h.dims, units: h.units, price: h.price, active: false, mode: "rent" }));
const BLANK = (): J => ({
  venue: null, offers: [], cats: [], otherCat: "",
  spaces: Object.fromEntries(VENUES.map((v) => [v.id, spacesFor(v.id)])) as Record<VenueType, SpaceArea[]>,
  airport: { terminal: "", zone: "", side: "airside", departures: true, format: FORMATS[0] },
  products: [], surplus: [], services: [],
  name: "", country: "", city: "", address: "", contact: "", phone: "", email: "", typeLabel: "",
  months: 3, terms: "", photos: [],
});
const blankProduct = (): ProductItem => ({ name: "", category: "gifts", qty: 10, price: 10 });
const blankSurplus = (): SurplusItem => ({ name: "", category: "food", qty: 20, originalPrice: 10, price: 6, condition: "overstock", storage: "ambient", handover: "both" });

const DRAFT = "inraf-owner-journey";
function readDraft(): { j: J; step: string } | null {
  try {
    const raw = localStorage.getItem(DRAFT); if (!raw) return null;
    const d = JSON.parse(raw); const b = BLANK();
    return { j: { ...b, ...d.j, spaces: { ...b.spaces, ...(d.j?.spaces ?? {}) }, airport: { ...b.airport, ...(d.j?.airport ?? {}) } }, step: String(d.step ?? "where") };
  } catch { return null; }
}

type StepId = "where" | "what" | "cats" | "space" | "stock" | "services" | "details" | "review";
const STEP_TITLE: Record<StepId, string> = {
  where: "Where is your business?", what: "What would you like to offer?", cats: "Which products?", space: "Explore your space",
  stock: "Your products and stock", services: "Services and earnings", details: "Your business listing", review: "Review and submit",
};

// ---------- helpers ----------
const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
const num = (v: string) => (v === "" ? 0 : Math.max(0, Number(v)));
function Stepper({ value, set, min, max, label }: { value: number; set: (n: number) => void; min: number; max: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label={`Fewer ${label}`} onClick={() => set(Math.max(min, value - 1))} className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-muted active:scale-90" data-testid={`dec-${label}`}><Minus className="h-4 w-4" /></button>
      <span className="w-10 text-center text-xl font-bold tabular-nums" data-testid={`value-${label}`}>{value}</span>
      <button type="button" aria-label={`More ${label}`} onClick={() => set(Math.min(max, value + 1))} className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-muted active:scale-90" data-testid={`inc-${label}`}><Plus className="h-4 w-4" /></button>
    </div>
  );
}

function money(j: J) {
  const areas = j.venue ? j.spaces[j.venue].filter((a) => a.active) : [];
  const rent = j.offers.includes("rent") ? areas.reduce((t, a) => t + a.units * a.price, 0) : 0;
  const units = areas.reduce((t, a) => t + a.units, 0);
  const products = j.offers.includes("sell") ? j.products.reduce((t, p) => t + p.qty * p.price, 0) : 0;
  const surplus = j.offers.includes("surplus") ? j.surplus.reduce((t, p) => t + p.qty * p.price, 0) : 0;
  const services = j.services.reduce((t, s) => t + s.price, 0);
  const sales = (products + surplus) * (1 - PLATFORM_COMMISSION_PCT / 100);
  return { areas, units, rent, products, surplus, services, sales, monthly: rent + services };
}

/** The live earnings estimate. Rent is separate from possible sales, and nothing is promised. */
function Earnings({ j }: { j: J }) {
  const m = money(j);
  const loc = (v: number) => (j.country ? localApprox(v, j.country) : null);
  const Row = ({ label, value, sub, testId }: { label: string; value: number; sub?: string; testId: string }) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm text-muted-foreground">{label}{sub && <span className="block text-xs">{sub}</span>}</span>
      <span className="text-right font-semibold tabular-nums" data-testid={testId}>{usd(value)}{loc(value) && <span className="block text-xs font-normal text-muted-foreground">{loc(value)}</span>}</span>
    </div>
  );
  return (
    <aside className="rounded-[2rem] border border-border bg-card p-6 shadow-[0_30px_60px_-45px_rgba(120,60,30,.5)]" data-testid="earnings">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Your estimate</p>
      {j.offers.includes("rent") && (
        <>
          <p className="mt-2 text-sm text-muted-foreground">{m.areas.length} of {j.venue ? j.spaces[j.venue].length : 0} display areas · {m.units} units</p>
          <Row label="Rent if every unit is rented" value={m.rent} sub="per month" testId="est-rent" />
        </>
      )}
      {m.services > 0 && <Row label="Services, if one renter takes each" value={m.services} sub="per month" testId="est-services" />}
      {(j.offers.includes("rent") || m.services > 0) && (
        <div className="mt-2 flex items-baseline justify-between border-t border-border pt-3">
          <span className="font-semibold">Possible monthly income</span>
          <span className="font-display text-2xl font-bold tabular-nums" data-testid="est-monthly">{usd(m.monthly)}</span>
        </div>
      )}
      {(j.offers.includes("sell") || j.offers.includes("surplus")) && (
        <div className="mt-4 rounded-2xl bg-muted/60 p-4">
          {j.offers.includes("sell") && <Row label="Your products, if all sell" value={m.products} testId="est-products" />}
          {j.offers.includes("surplus") && <Row label="Surplus stock, if all sells" value={m.surplus} testId="est-surplus" />}
          <Row label={`You receive after InRaf's ${PLATFORM_COMMISSION_PCT}% commission`} value={m.sales} sub="one-off, not monthly" testId="est-sales" />
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">An estimate from your own prices, not a promise of earnings. Rent depends on makers choosing your space; sales depend on shoppers.{j.country ? ` Local amounts are approximate, at ${RATES_AS_OF} rates.` : ""}</p>
    </aside>
  );
}

// ---------- the page ----------
export default function OwnerJourney() {
  const q = new URLSearchParams(useSearch());
  const [, go] = useLocation();
  const { toast } = useToast();
  const session = useSession();
  const st = useStore();
  const { act, error, pending } = useAct();
  const [initial] = useState(readDraft);
  const [j, setJ] = useState<J>(() => {
    if (initial) return initial.j;
    const b = BLANK();
    if (q.get("product") === "flying") b.venue = "airport";
    if (q.get("product") === "expiring") b.offers = ["surplus"];
    return b;
  });
  const [step, setStep] = useState<StepId>((initial?.step as StepId) ?? "where");
  const [selected, setSelectedRaw] = useState<string | null>(null);
  // On phones the settings panel sits below the picture and list, so bring it into view when an area is chosen.
  const setSelected = (id: string | null) => {
    setSelectedRaw(id);
    if (id && window.innerWidth < 1024) window.setTimeout(() => document.querySelector("[data-testid=area-panel]")?.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
  };
  const [doneId, setDoneId] = useState<string | null>(null);
  const set = (p: Partial<J>) => setJ((x) => ({ ...x, ...p }));

  const steps = useMemo<StepId[]>(() => ["where", "what", "cats", ...(j.offers.includes("rent") ? ["space" as const] : []), ...(j.offers.some((o) => o !== "rent") ? ["stock" as const] : []), "services", "details", "review"], [j.offers]);
  const at = Math.max(0, steps.indexOf(step));
  useEffect(() => { if (!steps.includes(step)) setStep(steps[Math.min(at, steps.length - 1)]); }, [steps, step, at]);

  useEffect(() => {
    if (doneId) return;
    try { localStorage.setItem(DRAFT, JSON.stringify({ j, step })); } catch { /* storage unavailable */ }
  }, [j, step, doneId]);
  useEffect(() => { if (initial && initial.step !== "where") toast({ title: "Picked up where you left off", description: "Start over at the bottom of the page if you like." }); }, [initial, toast]);
  useEffect(() => { if (session.me && !j.email) set({ email: session.me.email, contact: j.contact || session.me.name || "" }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [session.me]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); setSelectedRaw(null); }, [step]);

  const venue = VENUES.find((v) => v.id === j.venue);
  const areas = j.venue ? j.spaces[j.venue] : [];
  const setArea = (id: string, p: Partial<SpaceArea>) => j.venue && set({ spaces: { ...j.spaces, [j.venue]: areas.map((a) => (a.id === id ? { ...a, ...p } : a)) } });
  const m = money(j);
  const t0 = today();

  const surplusIssue = (it: SurplusItem): string | null => {
    if (!it.name.trim()) return "Add the product name.";
    if (it.price > it.originalPrice) return "Selling price can't be above the original price.";
    if (DATED_CATEGORIES.includes(it.category) && !it.expiry) return "Add the expiry or best-before date.";
    if (it.expiry) { const d = daysLeft(it.expiry, t0); if (d < 0) return "Expired: expired products can't be offered."; if (d < MIN_SHELF_LIFE_DAYS) return `Only ${d} day${d === 1 ? "" : "s"} left: InRaf needs at least ${MIN_SHELF_LIFE_DAYS}.`; }
    if (it.made && it.expiry && it.made > it.expiry) return "Manufacturing date is after the expiry date.";
    if (!(it.qty > 0) || !(it.price > 0) || !(it.originalPrice > 0)) return "Add quantity and prices.";
    return null;
  };
  const rentNeedsPhotos = j.offers.includes("rent");
  const valid: Record<StepId, boolean> = {
    where: !!j.venue,
    what: j.offers.length > 0,
    cats: j.cats.length > 0 || !!j.otherCat.trim(),
    space: m.areas.length > 0 && m.units <= 49 && m.areas.every((a) => a.price > 0),
    stock: (!j.offers.includes("sell") || (j.products.length > 0 && j.products.every((p) => p.name.trim() && p.qty > 0 && p.price > 0)))
      && (!j.offers.includes("surplus") || (j.surplus.length > 0 && j.surplus.every((x) => !surplusIssue(x)))),
    services: true,
    details: !!(j.name.trim() && j.country && j.city.trim() && j.address.trim() && j.contact.trim() && /^\+?[0-9 ()-]{7,20}$/.test(j.phone) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(j.email)) && (!rentNeedsPhotos || photosComplete(j.photos)),
    review: true,
  };
  const next = () => setStep(steps[Math.min(at + 1, steps.length - 1)]);
  const prev = () => (at === 0 ? go("/") : setStep(steps[at - 1]));
  const startOver = () => { try { localStorage.removeItem(DRAFT); } catch { /* ignore */ } setJ(BLANK()); setStep("where"); };

  const submit = async () => {
    if (!j.venue) return;
    const v = venue!;
    let shop: ShopInput | undefined;
    if (j.offers.includes("rent")) {
      const N = m.units, width = Math.min(7, Math.max(2, Math.ceil(Math.sqrt(N)))), depth = Math.min(7, Math.max(2, Math.ceil(N / width)));
      const biggest = m.areas.slice().sort((a, b) => b.units * b.price - a.units * a.price)[0];
      const shopCats = [...new Set(j.cats.map((c) => CATS.find((x) => x.id === c)?.shop ?? "craft"))];
      shop = {
        name: j.name.trim(), country: j.country, city: j.city.trim(), location: j.address.trim(), business: v.code,
        width, depth, bricks: Array.from({ length: N }, (_, i) => i), tiers: 1, price: Math.max(1, Math.round(m.rent / N)),
        categories: shopCats.length ? shopCats : ["craft"], restrictions: [], hue: 12, venue: j.venue === "airport" ? "airport" : undefined,
        months: j.months, photos: j.photos,
        listing: {
          shelfType: biggest.kind as ShelfType,
          features: [...(j.services.some((s) => s.id === "pos") ? ["pos"] : []), ...(j.services.some((s) => s.id === "inventory" || s.id === "staff") ? ["restock"] : [])],
          sellsWell: j.cats.map(catTitle).join(", "), pricing: "fixed", salesSharePct: 0,
        },
      };
    }
    const input: OwnerRequestInput = {
      venue: j.venue, offers: j.offers, categories: j.cats, otherCategory: j.otherCat.trim() || undefined,
      business: { name: j.name.trim(), type: j.typeLabel.trim() || v.title, country: j.country, city: j.city.trim(), address: j.address.trim(), contact: j.contact.trim(), phone: j.phone.trim(), email: j.email.trim() },
      spaces: j.offers.includes("rent") ? areas : [], airport: j.venue === "airport" && j.offers.includes("rent") ? j.airport : undefined,
      products: j.products, surplus: j.surplus, services: j.services, terms: [`Minimum term ${j.months} month${j.months === 1 ? "" : "s"}.`, j.terms.trim()].filter(Boolean).join(" "),
      shop,
    };
    const r = await act(() => actions.submitOwnerRequest(input), LIVE ? "Application sent to InRaf" : "Application submitted (demo)");
    if (r.ok && r.id) { try { localStorage.removeItem(DRAFT); } catch { /* ignore */ } setDoneId(r.id); window.scrollTo({ top: 0 }); }
  };

  // ---------- confirmation ----------
  if (doneId) {
    const req = st.requests.find((r) => r.id === doneId);
    return (
      <Shell title="Application received" back="/owner-dashboard">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-xl rounded-[2rem] border border-border p-8 text-center" data-testid="journey-done">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-7 w-7" /></span>
          <h1 className="font-display mt-4 text-4xl font-bold">Your application is in</h1>
          {req && <p className="mt-2 text-sm text-muted-foreground">Reference <b className="text-foreground" data-testid="journey-ref">{req.ref}</b> · {req.business.name}</p>}
          <ul className="mx-auto mt-6 max-w-md space-y-3 text-left text-sm">
            <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />The InRaf team reviews every business before anything goes live. You'll see the decision in your notifications.</li>
            {req?.shopId && <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Your space is saved as a store listing, waiting for approval. Add your business registration number in its settings so we can approve it.</li>}
            {(req?.offers.includes("surplus") || req?.offers.includes("sell")) && <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />We'll contact you about your products and stock. Nothing is sold until we've checked eligibility, dates and storage.</li>}
          </ul>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {req?.shopId ? <PrimaryButton onClick={() => go(`/owner-dashboard/shops/${req.shopId}?new=1`)} data-testid="button-open-shop">Add registration <ArrowRight className="h-4 w-4" /></PrimaryButton>
              : <PrimaryButton onClick={() => go("/owner-dashboard")} data-testid="button-open-portal">Go to owner portal <ArrowRight className="h-4 w-4" /></PrimaryButton>}
            <GhostButton onClick={() => go("/")}>Back to home</GhostButton>
          </div>
        </motion.div>
      </Shell>
    );
  }

  const bodies: Record<StepId, React.ReactElement> = {
    // 1. Where
    where: (
      <div>
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-display text-2xl font-bold text-primary md:text-3xl">Your space. Your products. New revenue.</p>
          <p className="mt-3 text-muted-foreground">Whether you run a boutique, a mall store, an airport shop, a hotel or a factory, InRaf helps you earn from the space and products you already have.</p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VENUES.map((v, i) => (
            <motion.button key={v.id} type="button" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => { set({ venue: v.id }); setStep("what"); }} aria-pressed={j.venue === v.id} data-testid={`venue-${v.id}`}
              className={`group overflow-hidden rounded-3xl border-2 text-left transition hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 ${j.venue === v.id ? "border-primary" : "border-border hover:border-primary/40"}`}>
              <div className="aspect-[8/5] overflow-hidden bg-muted"><SceneArt venue={v.id} className="h-full w-full transition duration-500 group-hover:scale-105" /></div>
              <div className="p-4"><p className="font-display text-lg font-bold">{v.title}</p><p className="mt-1 text-sm text-muted-foreground">{v.text}</p></div>
            </motion.button>
          ))}
        </div>
      </div>
    ),
    // 2. What
    what: (
      <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
        {OFFERS.map((o) => {
          const on = j.offers.includes(o.id);
          return (
            <button key={o.id} type="button" onClick={() => set({ offers: toggle(j.offers, o.id) })} aria-pressed={on} data-testid={`offer-${o.id}`}
              className={`relative flex flex-col rounded-[2rem] border-2 p-6 text-left transition hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 ${on ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
              <span className={`absolute right-5 top-5 grid h-7 w-7 place-items-center rounded-full border-2 ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{on && <Check className="h-4 w-4" />}</span>
              <o.icon className="h-9 w-9 text-primary" strokeWidth={1.5} />
              <p className="font-display mt-4 text-xl font-bold">{o.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{o.text}</p>
              <ul className="mt-4 space-y-1.5 text-sm">{o.examples.map((x) => <li key={x} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />{x}</li>)}</ul>
              {o.id === "surplus" && <p className="mt-4 rounded-2xl bg-muted px-3 py-2 text-xs text-muted-foreground">Expiry dates, storage and safety rules apply. Expired products are never accepted.</p>}
            </button>
          );
        })}
        <p className="text-center text-sm text-muted-foreground md:col-span-3">Choose one or more.</p>
      </div>
    ),
    // 3. Categories
    cats: (
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CATS.map((c) => {
            const on = j.cats.includes(c.id);
            return (
              <button key={c.id} type="button" onClick={() => set({ cats: toggle(j.cats, c.id) })} aria-pressed={on} data-testid={`cat-${c.id}`}
                className={`overflow-hidden rounded-3xl border-2 text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 ${on ? "border-primary" : "border-border hover:border-primary/40"}`}>
                <div className="relative grid h-24 place-items-center" style={{ background: c.tint }}>
                  <c.icon className="h-10 w-10 text-foreground/70" strokeWidth={1.3} />
                  {on && <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" /></span>}
                </div>
                <div className="p-4"><p className="font-semibold leading-tight">{c.title}</p><p className="mt-1 text-xs text-muted-foreground">{c.examples}</p></div>
              </button>
            );
          })}
          <div className={`rounded-3xl border-2 border-dashed p-4 ${j.otherCat.trim() ? "border-primary" : "border-border"}`}>
            <p className="font-semibold">Other products</p>
            <input value={j.otherCat} onChange={(e) => set({ otherCat: e.target.value.slice(0, 80) })} placeholder="e.g. phone accessories" aria-label="Other product category" className={`${inputCls} mt-3`} data-testid="input-other-cat" />
          </div>
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">Choose as many as you like.</p>
      </div>
    ),
    // 4. Interactive space
    space: j.venue ? (
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="relative overflow-hidden rounded-[2rem] border border-border bg-muted">
            <SceneInteractive venue={j.venue} selected={selected} active={Object.fromEntries(areas.map((a) => [a.id, a.active]))} onSelect={setSelected} />
            {selected && <button type="button" onClick={() => setSelected(null)} className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-3 py-1.5 text-xs font-semibold shadow backdrop-blur" data-testid="button-zoom-out"><ArrowLeft className="h-3.5 w-3.5" /> Whole space</button>}
          </div>
          <p className="mt-3 text-center text-sm text-muted-foreground">{sceneTitle(j.venue)}. Tap a numbered spot to zoom in and set it up. A drawing, not your shop: your own photos come later.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {areas.map((a, i) => (
              <button key={a.id} type="button" onClick={() => setSelected(a.id)} data-testid={`area-row-${a.id}`}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left text-sm transition ${selected === a.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${a.active ? "bg-primary" : "bg-foreground/70"}`}>{i + 1}</span>
                <span className="min-w-0 flex-1"><b className="block truncate">{a.label}</b><span className="text-xs text-muted-foreground">{a.active ? `${a.units} × ${usd(a.price)}/mo` : "Not offered"}</span></span>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {(() => {
              const a = areas.find((x) => x.id === selected); const h = sceneHotspots(j.venue!).find((x) => x.id === selected);
              if (!a || !h) return (
                <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-[2rem] border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Tap a display area in the picture to set its units, price and availability.
                </motion.div>
              );
              return (
                <motion.div key={a.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="scroll-mt-24 rounded-[2rem] border border-border bg-card p-6" data-testid="area-panel">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Display area</p><p className="font-display text-xl font-bold">{a.label}</p></div>
                    <button type="button" aria-label="Close" onClick={() => setSelected(null)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted"><X className="h-4 w-4" /></button>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{h.hint}</p>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-xs text-muted-foreground">Size</dt><dd className="font-medium">{a.dims}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Status</dt><dd className={`font-medium ${a.active ? "text-primary" : ""}`} data-testid="area-status">{a.active ? "Available to rent" : "Not offered"}</dd></div>
                  </dl>
                  <button type="button" onClick={() => setArea(a.id, { active: !a.active })} aria-pressed={a.active} data-testid="toggle-area"
                    className={`mt-4 flex w-full items-center justify-between rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition ${a.active ? "border-primary bg-primary/5" : "border-border"}`}>
                    {a.active ? "Offered on InRaf" : "Offer this area"}
                    <span className={`relative h-6 w-11 rounded-full transition ${a.active ? "bg-primary" : "bg-muted"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${a.active ? "left-[22px]" : "left-0.5"}`} /></span>
                  </button>
                  <div className={`mt-4 space-y-4 ${a.active ? "" : "pointer-events-none opacity-40"}`}>
                    <div className="flex items-center justify-between"><span className="text-sm">Units available</span><Stepper label="units" value={a.units} set={(n) => setArea(a.id, { units: n })} min={1} max={40} /></div>
                    <Field label="Monthly price per unit (USD)" hint={j.country && localApprox(a.price, j.country) ? `${localApprox(a.price, j.country)} a month` : "Set your own price. This is a suggestion."}>
                      <input type="number" min={1} max={5000} value={a.price || ""} onChange={(e) => setArea(a.id, { price: Math.min(5000, num(e.target.value)) })} className={inputCls} data-testid="input-area-price" />
                    </Field>
                    <p className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">This area: <b data-testid="area-total">{usd(a.units * a.price)}</b> a month if every unit is rented.</p>
                  </div>
                </motion.div>
              );
            })()}
          </AnimatePresence>
          {j.venue === "airport" && (
            <div className="rounded-[2rem] border border-border p-6" data-testid="airport-details">
              <p className="inline-flex items-center gap-2 font-display text-lg font-bold"><Plane className="h-5 w-5 text-primary" />Departure passengers</p>
              <p className="mt-1 text-sm text-muted-foreground">Travellers about to board buy gifts, perfume, snacks, chargers and local specialties.</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Field label="Terminal"><input value={j.airport.terminal} onChange={(e) => set({ airport: { ...j.airport, terminal: e.target.value.slice(0, 40) } })} placeholder="e.g. T3" className={inputCls} data-testid="input-terminal" /></Field>
                <Field label="Zone or gates"><input value={j.airport.zone} onChange={(e) => set({ airport: { ...j.airport, zone: e.target.value.slice(0, 60) } })} placeholder="e.g. Gates B1–B12" className={inputCls} data-testid="input-zone" /></Field>
              </div>
              <div className="mt-3 flex gap-2">
                {(["airside", "landside"] as const).map((sd) => <button key={sd} type="button" onClick={() => set({ airport: { ...j.airport, side: sd } })} aria-pressed={j.airport.side === sd} className={`flex-1 rounded-full border px-3 py-2 text-sm ${j.airport.side === sd ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{sd === "airside" ? "After security" : "Before security"}</button>)}
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={j.airport.departures} onChange={(e) => set({ airport: { ...j.airport, departures: e.target.checked } })} data-testid="check-departures" />Faces departing passengers</label>
              <Field label="Display format"><select value={j.airport.format} onChange={(e) => set({ airport: { ...j.airport, format: e.target.value } })} className={inputCls} data-testid="select-format">{FORMATS.map((f) => <option key={f}>{f}</option>)}</select></Field>
            </div>
          )}
          {m.units > 49 && <p className="text-sm text-destructive">Up to 49 units in one listing. Lower some units or split your space into two listings.</p>}
        </div>
      </div>
    ) : <></>,
    // 5. Products and surplus
    stock: (
      <div className="mx-auto max-w-4xl space-y-10">
        {j.offers.includes("sell") && (
          <section data-testid="products-section">
            <h2 className="font-display text-2xl font-bold">Products you want to sell</h2>
            <p className="text-sm text-muted-foreground">A short list is enough: we'll go through the details with you.</p>
            <div className="mt-4 space-y-3">
              {j.products.map((p, i) => {
                const upd = (x: Partial<ProductItem>) => set({ products: j.products.map((y, k) => (k === i ? { ...y, ...x } : y)) });
                return (
                  <div key={i} className="grid gap-3 rounded-3xl border border-border p-4 sm:grid-cols-[2fr_1.4fr_1fr_1fr_auto] sm:items-end" data-testid={`product-row-${i}`}>
                    <Field label="Product"><input value={p.name} onChange={(e) => upd({ name: e.target.value.slice(0, 80) })} className={inputCls} placeholder="e.g. Olive-oil soap" data-testid={`product-name-${i}`} /></Field>
                    <Field label="Category"><select value={p.category} onChange={(e) => upd({ category: e.target.value })} className={inputCls}>{CATS.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></Field>
                    <Field label="Quantity"><input type="number" min={1} value={p.qty || ""} onChange={(e) => upd({ qty: num(e.target.value) })} className={inputCls} data-testid={`product-qty-${i}`} /></Field>
                    <Field label="Price (USD)"><input type="number" min={0} step="0.5" value={p.price || ""} onChange={(e) => upd({ price: num(e.target.value) })} className={inputCls} data-testid={`product-price-${i}`} /></Field>
                    <button type="button" aria-label="Remove product" onClick={() => set({ products: j.products.filter((_, k) => k !== i) })} className="grid h-11 w-11 place-items-center rounded-full hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
                  </div>
                );
              })}
            </div>
            <GhostButton className="mt-3" onClick={() => set({ products: [...j.products, blankProduct()] })} data-testid="button-add-product"><Plus className="h-4 w-4" />Add a product</GhostButton>
          </section>
        )}
        {j.offers.includes("surplus") && (
          <section data-testid="surplus-section">
            <h2 className="font-display text-2xl font-bold">Turn excess inventory into opportunity</h2>
            <p className="text-sm text-muted-foreground">Give surplus, seasonal stock and eligible products close to their date another chance to sell. Food and beauty products need an expiry or best-before date and at least {MIN_SHELF_LIFE_DAYS} days left. Expired products are never accepted.</p>
            <div className="mt-4 space-y-4">
              {j.surplus.map((it, i) => {
                const upd = (x: Partial<SurplusItem>) => set({ surplus: j.surplus.map((y, k) => (k === i ? { ...y, ...x } : y)) });
                const issue = it.name.trim() || it.expiry ? surplusIssue(it) : null;
                const left = it.expiry ? daysLeft(it.expiry, t0) : null;
                const off = it.originalPrice > 0 ? Math.round((1 - it.price / it.originalPrice) * 100) : 0;
                return (
                  <div key={i} className={`rounded-3xl border p-5 ${issue ? "border-destructive/50" : "border-border"}`} data-testid={`surplus-row-${i}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{it.name.trim() || `Product ${i + 1}`}</p>
                      {left !== null && left >= 0 && <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${left < MIN_SHELF_LIFE_DAYS ? "bg-destructive/10 text-destructive" : left <= 45 ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"}`} data-testid={`surplus-days-${i}`}><Clock className="h-3 w-3" />{left} days of shelf life left</span>}
                      {off > 0 && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{off}% off</span>}
                      <button type="button" aria-label="Remove product" onClick={() => set({ surplus: j.surplus.filter((_, k) => k !== i) })} className="ml-auto grid h-9 w-9 place-items-center rounded-full hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-4">
                      <div className="sm:col-span-2"><Field label="Product name"><input value={it.name} onChange={(e) => upd({ name: e.target.value.slice(0, 80) })} className={inputCls} placeholder="e.g. Date-filled biscuits 250 g" data-testid={`surplus-name-${i}`} /></Field></div>
                      <Field label="Category"><select value={it.category} onChange={(e) => upd({ category: e.target.value })} className={inputCls} data-testid={`surplus-cat-${i}`}>{CATS.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></Field>
                      <Field label="Quantity"><input type="number" min={1} value={it.qty || ""} onChange={(e) => upd({ qty: num(e.target.value) })} className={inputCls} data-testid={`surplus-qty-${i}`} /></Field>
                      <Field label="Original price (USD)"><input type="number" min={0} step="0.5" value={it.originalPrice || ""} onChange={(e) => upd({ originalPrice: num(e.target.value) })} className={inputCls} data-testid={`surplus-orig-${i}`} /></Field>
                      <Field label="Selling price (USD)"><input type="number" min={0} step="0.5" value={it.price || ""} onChange={(e) => upd({ price: num(e.target.value) })} className={inputCls} data-testid={`surplus-price-${i}`} /></Field>
                      <Field label="Made on (optional)"><input type="date" value={it.made ?? ""} max={t0} onChange={(e) => upd({ made: e.target.value || undefined })} className={inputCls} /></Field>
                      <Field label={DATED_CATEGORIES.includes(it.category) ? "Expiry / best before" : "Expiry (if any)"}><input type="date" value={it.expiry ?? ""} onChange={(e) => upd({ expiry: e.target.value || undefined })} className={inputCls} data-testid={`surplus-expiry-${i}`} /></Field>
                      <Field label="Condition"><select value={it.condition} onChange={(e) => upd({ condition: e.target.value as SurplusItem["condition"] })} className={inputCls}>
                        <option value="overstock">Overstock</option><option value="new">New, near its date</option><option value="seasonal">Seasonal</option><option value="discontinued">Discontinued line</option><option value="packaging">Packaging change</option>
                      </select></Field>
                      <Field label="Storage"><select value={it.storage} onChange={(e) => upd({ storage: e.target.value as SurplusItem["storage"] })} className={inputCls}><option value="ambient">Room temperature</option><option value="chilled">Chilled</option><option value="frozen">Frozen</option></select></Field>
                      <Field label="Handover"><select value={it.handover} onChange={(e) => upd({ handover: e.target.value as SurplusItem["handover"] })} className={inputCls}><option value="both">Collection or delivery</option><option value="collect">Collection only</option><option value="deliver">We deliver</option></select></Field>
                    </div>
                    {issue && <p className="mt-3 text-sm font-medium text-destructive" data-testid={`surplus-issue-${i}`}>{issue}</p>}
                  </div>
                );
              })}
            </div>
            <GhostButton className="mt-3" onClick={() => set({ surplus: [...j.surplus, blankSurplus()] })} data-testid="button-add-surplus"><Plus className="h-4 w-4" />Add surplus stock</GhostButton>
          </section>
        )}
      </div>
    ),
    // 6. Services
    services: (
      <div className="mx-auto max-w-3xl">
        <p className="text-center text-muted-foreground">Optional services you can offer the makers and brands on your shelves. Set your own monthly price for each.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {SERVICES.map((sv) => {
            const cur = j.services.find((x) => x.id === sv.id);
            return (
              <div key={sv.id} className={`rounded-3xl border-2 p-4 transition ${cur ? "border-primary bg-primary/5" : "border-border"}`} data-testid={`service-${sv.id}`}>
                <label className="flex cursor-pointer items-center gap-3 font-medium">
                  <input type="checkbox" checked={!!cur} onChange={() => set({ services: cur ? j.services.filter((x) => x.id !== sv.id) : [...j.services, { id: sv.id, price: sv.price }] })} className="h-4 w-4 accent-[hsl(var(--primary))]" data-testid={`check-service-${sv.id}`} />
                  {sv.label}
                </label>
                {cur && (
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">USD / month</span>
                    <input type="number" min={0} value={cur.price} onChange={(e) => set({ services: j.services.map((x) => (x.id === sv.id ? { ...x, price: num(e.target.value) } : x)) })} className={`${inputCls} w-28`} data-testid={`price-service-${sv.id}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    ),
    // 7. Details
    details: (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name"><input value={j.name} onChange={(e) => set({ name: e.target.value.slice(0, 80) })} className={inputCls} data-testid="input-business-name" /></Field>
          <Field label="Business type" hint={venue ? `e.g. ${venue.title.toLowerCase()}` : undefined}><input value={j.typeLabel} onChange={(e) => set({ typeLabel: e.target.value.slice(0, 60) })} placeholder={venue?.title} className={inputCls} data-testid="input-business-type" /></Field>
          <Field label="Country"><select value={j.country} onChange={(e) => set({ country: e.target.value })} className={inputCls} data-testid="select-country"><option value="">Choose…</option>{PRIORITY_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></Field>
          <Field label="City"><input value={j.city} onChange={(e) => set({ city: e.target.value.slice(0, 60) })} className={inputCls} data-testid="input-city" /></Field>
          <div className="sm:col-span-2"><Field label={j.venue === "airport" ? "Airport and unit" : "Address"}><input value={j.address} onChange={(e) => set({ address: e.target.value.slice(0, 140) })} className={inputCls} data-testid="input-address" /></Field></div>
          <Field label="Contact person"><input value={j.contact} onChange={(e) => set({ contact: e.target.value.slice(0, 80) })} className={inputCls} data-testid="input-contact" /></Field>
          <Field label="Phone or WhatsApp" hint="With the country code, e.g. +20 100 000 0000"><input type="tel" value={j.phone} onChange={(e) => set({ phone: e.target.value.slice(0, 20) })} className={inputCls} data-testid="input-phone" /></Field>
          <Field label="Email"><input type="email" value={j.email} onChange={(e) => set({ email: e.target.value.slice(0, 120) })} className={inputCls} data-testid="input-email" /></Field>
          {j.offers.includes("rent") && <Field label="Minimum rental term (months)"><input type="number" min={1} max={24} value={j.months} onChange={(e) => set({ months: Math.min(24, Math.max(1, num(e.target.value) || 1)) })} className={inputCls} data-testid="input-months" /></Field>}
          <div className="sm:col-span-2"><Field label="Commercial terms (optional)" hint="Anything makers or InRaf should know: opening hours, restocking days, payment preferences."><textarea value={j.terms} onChange={(e) => set({ terms: e.target.value.slice(0, 600) })} rows={3} className={inputCls} data-testid="input-terms" /></Field></div>
        </div>
        <div>
          <p className="font-semibold">Photos of your premises{j.offers.includes("rent") ? "" : " or products (optional)"}</p>
          <p className="mb-3 text-sm text-muted-foreground">{j.offers.includes("rent") ? "Makers only rent what they can see: add the shop front and the shelf or display you're offering." : "Photos help us review faster."}</p>
          <PhotoUploader photos={j.photos} onChange={(photos) => set({ photos })} />
        </div>
      </div>
    ),
    // 8. Review
    review: (
      <div className="mx-auto max-w-3xl space-y-4" data-testid="journey-review">
        <div className="rounded-[2rem] border border-border p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{venue?.title}</p>
          <p className="font-display text-3xl font-bold" data-testid="review-name">{j.name}</p>
          <p className="text-sm text-muted-foreground">{j.typeLabel || venue?.title} · {j.address}, {j.city}, {countryName(j.country)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{j.contact} · {j.phone} · {j.email}</p>
          <div className="mt-4 flex flex-wrap gap-2">{j.offers.map((o) => <span key={o} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{OFFERS.find((x) => x.id === o)?.title}</span>)}</div>
          <p className="mt-3 text-sm"><b>Products:</b> {[...j.cats.map(catTitle), ...(j.otherCat.trim() ? [j.otherCat.trim()] : [])].join(" · ")}</p>
        </div>
        {j.offers.includes("rent") && (
          <div className="rounded-[2rem] border border-border p-6">
            <p className="font-semibold">Space offered</p>
            <ul className="mt-2 divide-y divide-border text-sm">{m.areas.map((a) => <li key={a.id} className="flex justify-between py-2"><span>{a.label} <span className="text-muted-foreground">· {a.dims}</span></span><span className="tabular-nums">{a.units} × {usd(a.price)}/mo</span></li>)}</ul>
            {j.venue === "airport" && <p className="mt-2 text-sm text-muted-foreground">{[j.airport.terminal && `Terminal ${j.airport.terminal}`, j.airport.zone, j.airport.side === "airside" ? "after security" : "before security", j.airport.departures && "facing departures", j.airport.format].filter(Boolean).join(" · ")}</p>}
            <p className="mt-2 text-xs text-muted-foreground">Makers see one monthly price per unit on your listing: the average of your areas, {usd(Math.round(m.rent / Math.max(1, m.units)))}. You can change it in shop settings.</p>
          </div>
        )}
        {j.offers.includes("sell") && j.products.length > 0 && <div className="rounded-[2rem] border border-border p-6"><p className="font-semibold">Products</p><ul className="mt-2 text-sm">{j.products.map((p, i) => <li key={i} className="flex justify-between py-1"><span>{p.name}</span><span className="tabular-nums">{p.qty} × {usd(p.price)}</span></li>)}</ul></div>}
        {j.offers.includes("surplus") && j.surplus.length > 0 && <div className="rounded-[2rem] border border-border p-6"><p className="font-semibold">Surplus stock</p><ul className="mt-2 text-sm">{j.surplus.map((p, i) => <li key={i} className="flex justify-between gap-3 py-1"><span>{p.name}{p.expiry && <span className="text-muted-foreground"> · {daysLeft(p.expiry, t0)} days left</span>}</span><span className="tabular-nums">{p.qty} × {usd(p.price)} <s className="text-muted-foreground">{usd(p.originalPrice)}</s></span></li>)}</ul></div>}
        {j.services.length > 0 && <div className="rounded-[2rem] border border-border p-6"><p className="font-semibold">Services</p><p className="mt-1 text-sm">{j.services.map((s) => `${SERVICES.find((x) => x.id === s.id)?.label} (${usd(s.price)}/mo)`).join(" · ")}</p></div>}
        <ErrorNote error={error} />
        <p className="text-center text-xs text-muted-foreground">By submitting you confirm the details are accurate and you're allowed to offer this space and stock, under the <Link href="/terms" className="underline">Terms</Link>. The InRaf team reviews every application before anything goes live. {LIVE ? "" : "This is the demo: nothing is sent."}</p>
      </div>
    ),
  };

  const showEarnings = ["space", "stock", "services", "details", "review"].includes(step);
  const needSignIn = step === "review" && session.live && !session.me;
  return (
    <Shell title="Apply as store owner" back="/" wide>
      <div className="flex flex-col items-center gap-4 text-center">
        <div role="tablist" aria-label="I am" className="inline-flex rounded-full bg-muted p-1 text-sm">
          <button role="tab" aria-selected className="rounded-full bg-background px-4 py-1.5 font-semibold shadow-sm">I have a shop</button>
          <button role="tab" aria-selected={false} onClick={() => go("/start?as=holder", { replace: true })} className="rounded-full px-4 py-1.5 font-semibold text-muted-foreground hover:text-foreground" data-testid="switch-role-holder">I make or supply products</button>
        </div>
        <ol className="flex flex-wrap justify-center gap-1.5" aria-label={`Step ${at + 1} of ${steps.length}`} data-testid="journey-steps">
          {steps.map((s, i) => (
            <li key={s}>
              <button type="button" disabled={i > at} onClick={() => setStep(s)} className={`h-2 rounded-full transition-all ${i === at ? "w-8 bg-primary" : i < at ? "w-4 bg-primary/50 hover:bg-primary" : "w-4 bg-muted"}`} aria-label={STEP_TITLE[s]} />
            </li>
          ))}
        </ol>
        <h1 className="font-display text-4xl font-bold md:text-5xl" data-testid="journey-title">{STEP_TITLE[step]}</h1>
      </div>

      <div className={`mx-auto mt-8 ${showEarnings && step !== "space" ? "grid max-w-6xl gap-6 lg:grid-cols-[1fr_320px] lg:items-start" : "max-w-6xl"}`}>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28 }}>
            {bodies[step]}
          </motion.div>
        </AnimatePresence>
        {showEarnings && step !== "space" && <div className="lg:sticky lg:top-24"><Earnings j={j} /></div>}
      </div>
      {step === "space" && <div className="mx-auto mt-6 max-w-md"><Earnings j={j} /></div>}

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <GhostButton onClick={prev} data-testid="journey-back"><ArrowLeft className="h-4 w-4" /> {at === 0 ? "Home" : "Back"}</GhostButton>
        {step === "where" ? null : step !== "review" ? (
          <PrimaryButton disabled={!valid[step]} onClick={next} data-testid="journey-next">Continue <ArrowRight className="h-4 w-4" /></PrimaryButton>
        ) : needSignIn ? (
          <PrimaryButton onClick={() => go(`/signin?next=${encodeURIComponent("/start?as=owner")}`)} data-testid="journey-signin">Sign in to submit <ArrowRight className="h-4 w-4" /></PrimaryButton>
        ) : (
          <PrimaryButton disabled={pending || !steps.slice(0, -1).every((s) => valid[s])} onClick={submit} data-testid="journey-submit"><Check className="h-4 w-4" /> Submit my application</PrimaryButton>
        )}
      </div>
      {needSignIn && <p className="mt-3 text-center text-sm text-muted-foreground">Sign in with your email (no password). Your answers are kept on this device and you'll come straight back here.</p>}
      {step !== "where" && !valid[step] && step !== "review" && <p className="mt-3 text-center text-sm text-muted-foreground" data-testid="journey-hint">{{
        what: "Choose at least one option.", cats: "Choose at least one category, or type your own.", space: "Turn on at least one display area, with a price.",
        stock: "Complete each product, and fix anything marked in red.", details: rentNeedsPhotos && !photosComplete(j.photos) ? "Fill in every field and add photos of the shop front and the shelf." : "Fill in every field: phone with country code and a valid email.",
      }[step as "what"] ?? ""}</p>}
      <div className="mt-6 flex justify-center">{(initial || step !== "where") && <GhostButton onClick={startOver} data-testid="journey-start-over">Start over</GhostButton>}</div>
    </Shell>
  );
}
