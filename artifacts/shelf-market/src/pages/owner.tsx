import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Minus, Plus, Save, Zap } from "lucide-react";
import { Shell, PrimaryButton, GhostButton, Tile, StepDots } from "@/components/shell";
import { IsoFloor } from "@/components/iso-floor";
import { ShelfArt } from "@/components/shelf-art";
import { PhotoUploader, coverOf, photosComplete } from "@/components/photos";
import {
  BUSINESSES, COUNTRIES, CATEGORIES, CANCELLATION, FEATURES, PRICING_LABEL, RESTRICTIONS, SHELF_TYPES,
  businessOf, countryName, categoryLabel, shelfTypeLabel,
} from "@/lib/data";
import { usd } from "@/lib/store";
import { actions } from "@/lib/actions";
import { useAct } from "@/hooks/use-act";
import { useToast } from "@/hooks/use-toast";
import { ErrorNote, inputCls } from "@/components/kit";
import { useProduct } from "@/components/product-bits";
import { PRODUCT_JOURNEY } from "@/lib/data";
import type { CancellationPolicy, PricingModel, ShelfType, ShopPhoto } from "@/lib/types";

const PHASES = ["Tell us about your shop", "Make it stand out", "Finish up and publish"];
const STEPS: { title: string; phase: number }[] = [
  { title: "What do you run?", phase: 0 },
  { title: "Which country?", phase: 0 },
  { title: "Where is it?", phase: 0 },
  { title: "How big is it?", phase: 0 },
  { title: "Tap spots for shelves", phase: 0 },
  { title: "What kind of shelf?", phase: 1 },
  { title: "Who walks past?", phase: 1 },
  { title: "Show makers your shop", phase: 1 },
  { title: "What can go on them?", phase: 1 },
  { title: "Shelves and price", phase: 2 },
  { title: "How do you charge?", phase: 2 },
  { title: "Ready to publish", phase: 2 },
];

const DRAFT_KEY = "inraf-owner-draft";

interface Form {
  business: string; country: string; city: string; location: string; name: string;
  width: number; depth: number; bricks: number[]; tiers: number; price: number;
  cats: string[]; rules: string[];
  shelfType: ShelfType; features: string[]; footTraffic: number; sellsWell: string;
  pricing: PricingModel; salesSharePct: number; months: number; instantBook: boolean; cancellation: CancellationPolicy;
  photos: ShopPhoto[];
}
const BLANK: Form = {
  business: "", country: "", city: "", location: "", name: "", width: 4, depth: 4, bricks: [], tiers: 3, price: 30,
  cats: ["food", "craft"], rules: [], shelfType: "eye-level", features: [], footTraffic: 150, sellsWell: "",
  pricing: "fixed", salesSharePct: 10, months: 3, instantBook: false, cancellation: "moderate",
  photos: [],
};

function readDraft(): { form: Form; step: number } | null {
  try { const raw = localStorage.getItem(DRAFT_KEY); if (!raw) return null; const d = JSON.parse(raw); return { form: { ...BLANK, ...d.form }, step: Number(d.step) || 0 }; }
  catch { return null; }
}

function Stepper({ value, set, min, max, label, prefix = "", step = 1 }: { value: number; set: (n: number) => void; min: number; max: number; label: string; prefix?: string; step?: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-4">
        <button type="button" aria-label={`Decrease ${label}`} data-testid={`button-dec-${label}`} onClick={() => set(Math.max(min, value - step))} className="grid h-11 w-11 place-items-center rounded-full border border-border transition hover:bg-muted active:scale-90"><Minus className="h-4 w-4" /></button>
        <span className="font-display w-24 text-center text-4xl font-bold tabular-nums">{prefix}{value}</span>
        <button type="button" aria-label={`Increase ${label}`} data-testid={`button-inc-${label}`} onClick={() => set(Math.min(max, value + step))} className="grid h-11 w-11 place-items-center rounded-full border border-border transition hover:bg-muted active:scale-90"><Plus className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

const chipCls = (on: boolean) => `rounded-full border px-4 py-2 text-sm transition active:scale-95 ${on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40"}`;

export default function Owner() {
  const [, go] = useLocation();
  const { toast } = useToast();
  const product = useProduct();
  const back = product ? `/host?product=${product}` : "/host";
  const [initial] = useState(readDraft);
  const [step, setStep] = useState(initial?.step ?? 0);
  const [f, setForm] = useState<Form>(initial?.form ?? BLANK);
  const set = (p: Partial<Form>) => setForm((x) => ({ ...x, ...p }));
  const hue = 12;
  const { act, error } = useAct();

  // Keep a draft as the owner goes, so "Save & exit" (or closing the tab) loses nothing.
  useEffect(() => {
    if (f === BLANK && step === 0) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ form: f, step })); } catch { /* storage unavailable */ }
  }, [f, step]);

  useEffect(() => {
    if (initial) toast({ title: "Picked up your draft", description: "Continue where you left off, or start over at the bottom." });
  }, [initial, toast]);

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const shareOk = f.pricing === "fixed" || (f.salesSharePct > 0 && f.salesSharePct <= 50);
  const valid = [!!f.business, !!f.country, f.city.trim() && f.name.trim() && f.location.trim(), true, f.bricks.length > 0, true, f.footTraffic > 0, photosComplete(f.photos), f.cats.length > 0, f.price > 0, shareOk, true][step];
  const resize = (w: number, d: number) => set({ width: w, depth: d, bricks: [] });
  const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } };

  const publish = () => {
    const r = act(() => actions.createShop({
      name: f.name.trim(), country: f.country, city: f.city.trim(), location: f.location.trim(), business: f.business,
      width: f.width, depth: f.depth, bricks: f.bricks, tiers: f.tiers, price: f.price, categories: f.cats, restrictions: f.rules, hue, venue: product === "flying" ? "airport" : undefined,
      months: f.months, photos: f.photos,
      listing: {
        shelfType: f.shelfType, features: f.features, footTraffic: f.footTraffic, sellsWell: f.sellsWell.trim(),
        pricing: f.pricing, salesSharePct: f.pricing === "fixed" ? 0 : f.salesSharePct, instantBook: f.instantBook, cancellation: f.cancellation,
      },
    }), "Submitted for platform approval (simulated)");
    if (r.ok && r.id) { clearDraft(); go(`/owner-dashboard/shops/${r.id}?new=1`); }
  };
  const saveExit = () => { toast({ title: "Draft saved", description: "Open “List a new shop” to carry on." }); go(back); };
  const startOver = () => { clearDraft(); setForm(BLANK); setStep(0); };

  const B = businessOf(f.business);
  const body = [
    <div key="0" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {BUSINESSES.map((b) => (
        <Tile key={b.code} selected={f.business === b.code} onClick={() => { set({ business: b.code }); setStep(1); }} testId={`tile-business-${b.code}`}>
          <b.icon className="h-9 w-9 text-primary" strokeWidth={1.5} />
          <span className="font-medium">{b.label}</span>
          <span className="text-[10px] text-muted-foreground">ISIC {b.code}</span>
        </Tile>
      ))}
    </div>,
    <div key="1" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {COUNTRIES.map((c) => (
        <Tile key={c.code} selected={f.country === c.code} onClick={() => { set({ country: c.code }); setStep(2); }} testId={`tile-country-${c.code}`}>
          <span className="font-display text-3xl font-bold text-primary/80">{c.code}</span>
          <span className="font-medium">{c.name}</span>
        </Tile>
      ))}
    </div>,
    <div key="2" className="mx-auto flex max-w-sm flex-col gap-3">
      {([["Shop name", "name", "shop-name"], ["City", "city", "city"], ["Street", "location", "street"]] as const).map(([l, k, id]) => (
        <input key={id} aria-label={l} placeholder={l} value={f[k]} data-testid={`input-${id}`}
          onChange={(e) => set({ [k]: e.target.value } as Partial<Form>)}
          className="rounded-2xl border border-input bg-background px-5 py-4 text-lg outline-none transition focus:border-primary focus:ring-4 focus:ring-ring/20" />
      ))}
    </div>,
    <div key="3" className="flex flex-col items-center gap-6">
      <div className="flex gap-10">
        <Stepper label="Width (m)" value={f.width} set={(w) => resize(w, f.depth)} min={2} max={7} />
        <Stepper label="Depth (m)" value={f.depth} set={(d) => resize(f.width, d)} min={2} max={7} />
      </div>
      <IsoFloor width={f.width} depth={f.depth} bricks={[]} hue={hue} />
    </div>,
    <div key="4" className="flex flex-col items-center">
      <IsoFloor width={f.width} depth={f.depth} bricks={f.bricks} onToggle={(i) => set({ bricks: toggle(f.bricks, i) })} hue={hue} />
      <p className="text-sm text-muted-foreground" data-testid="text-brick-count">{f.bricks.length} spot{f.bricks.length === 1 ? "" : "s"} raised</p>
    </div>,
    <div key="5" className="mx-auto max-w-2xl space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SHELF_TYPES.map((t) => (
          <Tile key={t.id} selected={f.shelfType === t.id} onClick={() => set({ shelfType: t.id })} testId={`tile-type-${t.id}`}>
            <span className="font-medium">{t.label}</span>
            <span className="text-xs text-muted-foreground">{t.hint}</span>
          </Tile>
        ))}
      </div>
      <div>
        <p className="text-center text-sm text-muted-foreground">What does your shop offer renters?</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {FEATURES.map((x) => <button key={x.id} onClick={() => set({ features: toggle(f.features, x.id) })} aria-pressed={f.features.includes(x.id)} data-testid={`chip-feature-${x.id}`} className={chipCls(f.features.includes(x.id))}>{x.label}</button>)}
        </div>
      </div>
    </div>,
    <div key="6" className="mx-auto flex max-w-md flex-col items-center gap-6">
      <Stepper label="Shoppers a day (your best guess)" value={f.footTraffic} set={(n) => set({ footTraffic: n })} min={10} max={3000} step={10} />
      <input aria-label="What sells well here" placeholder="What sells well here? e.g. snacks, gifts, skincare" value={f.sellsWell} onChange={(e) => set({ sellsWell: e.target.value })} className={inputCls} data-testid="input-sells-well" />
      <p className="text-center text-xs text-muted-foreground">Makers use this to decide. In the real product, figures can be backed by till or door-counter data.</p>
    </div>,
    <div key="photos" className="mx-auto max-w-2xl">
      <p className="mb-5 text-center text-muted-foreground">Makers only rent what they can see. Add a clear photo of the shelf itself and one of the shop front.</p>
      <PhotoUploader photos={f.photos} onChange={(photos) => set({ photos })} />
    </div>,
    <div key="7" className="mx-auto max-w-xl space-y-6">
      <div className="flex flex-wrap justify-center gap-2">
        {CATEGORIES.map((c) => <button key={c.id} onClick={() => set({ cats: toggle(f.cats, c.id) })} aria-pressed={f.cats.includes(c.id)} data-testid={`chip-cat-${c.id}`} className={chipCls(f.cats.includes(c.id))}>{c.label}</button>)}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {RESTRICTIONS.map((r) => (
          <button key={r.id} onClick={() => set({ rules: toggle(f.rules, r.id) })} aria-pressed={f.rules.includes(r.id)} data-testid={`chip-rule-${r.id}`}
            className={`rounded-full border px-4 py-2 text-sm transition active:scale-95 ${f.rules.includes(r.id) ? "border-secondary-foreground bg-secondary text-secondary-foreground" : "border-dashed border-border text-muted-foreground"}`}>{r.label}</button>
        ))}
      </div>
    </div>,
    <div key="8" className="flex flex-col items-center gap-8 md:flex-row md:justify-center">
      <ShelfArt tiers={f.tiers} hue={hue} fill={Array(f.tiers).fill(null)} className="w-48" />
      <div className="flex flex-col gap-6">
        <Stepper label="Shelves per spot" value={f.tiers} set={(n) => set({ tiers: n })} min={1} max={5} />
        <Stepper label="USD / month" value={f.price} set={(n) => set({ price: n })} min={5} max={250} prefix="$" />
        <p className="text-center text-sm text-muted-foreground">{f.bricks.length * f.tiers} shelves to rent</p>
      </div>
    </div>,
    <div key="9" className="mx-auto max-w-2xl space-y-8">
      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(PRICING_LABEL) as PricingModel[]).map((k) => (
          <Tile key={k} selected={f.pricing === k} onClick={() => set({ pricing: k })} testId={`tile-pricing-${k}`}>
            <span className="font-medium">{PRICING_LABEL[k]}</span>
            <span className="text-xs text-muted-foreground">{k === "fixed" ? `${usd(f.price)}/mo` : k === "share" ? "A cut of each sale" : `${usd(f.price)}/mo + a cut`}</span>
          </Tile>
        ))}
      </div>
      {f.pricing === "share" && <p className="text-center text-sm text-muted-foreground">No monthly rent. You earn only your share, taken from each sale before the maker is paid.</p>}
      {f.pricing !== "fixed" && <div className="flex justify-center"><Stepper label="Share of each sale (%)" value={f.salesSharePct} set={(n) => set({ salesSharePct: n })} min={1} max={50} /></div>}
      <div className="flex justify-center"><Stepper label="Minimum term (months)" value={f.months} set={(n) => set({ months: n })} min={1} max={24} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button onClick={() => set({ instantBook: !f.instantBook })} aria-pressed={f.instantBook} data-testid="toggle-instant"
          className={`flex items-start gap-3 rounded-3xl border-2 p-4 text-left transition ${f.instantBook ? "border-primary bg-primary/5" : "border-border"}`}>
          <Zap className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <span><b>Instant book {f.instantBook ? "on" : "off"}</b><br /><span className="text-sm text-muted-foreground">Agree to the standard terms now, so makers don't wait for your signature.</span></span>
        </button>
        <label className="flex flex-col gap-1 rounded-3xl border-2 border-border p-4">
          <b>Cancellation</b>
          <select value={f.cancellation} onChange={(e) => set({ cancellation: e.target.value as CancellationPolicy })} className="bg-transparent outline-none" data-testid="select-cancellation">
            {(Object.keys(CANCELLATION) as CancellationPolicy[]).map((k) => <option key={k} value={k}>{CANCELLATION[k].label}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">{CANCELLATION[f.cancellation].text}</span>
        </label>
      </div>
    </div>,
    <div key="10" className="mx-auto flex max-w-md flex-col items-center rounded-[2rem] border border-border p-8 text-center">
      <B.icon className="h-10 w-10 text-primary" strokeWidth={1.5} />
      <h3 className="font-display mt-3 text-3xl font-bold" data-testid="text-review-name">{f.name}</h3>
      <p className="text-muted-foreground">{f.city}, {countryName(f.country)} · {B.label}</p>
      {coverOf(f.photos)
        ? <img src={coverOf(f.photos)!.url} alt="Your shelf" className="my-4 aspect-[4/3] w-full rounded-2xl object-cover" data-testid="img-review-cover" />
        : <ShelfArt tiers={f.tiers} hue={hue} className="my-4 w-40" />}
      <p className="text-xs text-muted-foreground">{f.photos.length} photo{f.photos.length === 1 ? "" : "s"}</p>
      <p className="font-display text-2xl font-bold">{f.bricks.length * f.tiers} shelves · {f.pricing === "share" ? `${f.salesSharePct}% of sales` : <>{usd(f.price)}<span className="text-base font-normal text-muted-foreground">/mo</span></>}</p>
      <p className="mt-1 text-sm text-muted-foreground">{PRICING_LABEL[f.pricing]}{f.pricing !== "fixed" ? ` (${f.salesSharePct}%)` : ""} · min {f.months} mo · {f.instantBook ? "Instant book" : "Request to book"}</p>
      <p className="mt-1 text-sm text-muted-foreground">{shelfTypeLabel(f.shelfType)} · ~{f.footTraffic} shoppers/day</p>
      <p className="mt-2 text-sm text-muted-foreground">{f.cats.map(categoryLabel).join(" · ")}</p>
    </div>,
  ][step];

  const phase = STEPS[step].phase;
  return (
    <Shell title={product ? `List your shop · ${PRODUCT_JOURNEY[product].title}` : "List your shop"} back={back}>
      {product && <p className="mx-auto mb-4 w-fit rounded-full bg-primary/10 px-4 py-1.5 text-center text-sm font-semibold text-primary" data-testid="owner-product">{product === "flying" ? "Listing an airport shop for About to Fly Inside" : "Listing a neighbourhood shop for About to Expire"}</p>}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex gap-2 text-xs font-semibold" aria-label="Phases">
          {PHASES.map((p, i) => <span key={p} className={`rounded-full px-3 py-1 ${i === phase ? "bg-foreground text-background" : i < phase ? "bg-muted text-foreground" : "text-muted-foreground"}`}>{i + 1}. {p}</span>)}
        </div>
        <StepDots step={step} total={STEPS.length} />
        <h1 className="font-display text-4xl font-bold md:text-5xl">{STEPS[step].title}</h1>
      </div>
      <div className="mt-10">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
            {body}
          </motion.div>
        </AnimatePresence>
      </div>
      {step === STEPS.length - 1 && <div className="mx-auto mt-6 max-w-md space-y-2"><ErrorNote error={error} /><p className="text-center text-xs text-muted-foreground">Next you'll add registration (demo value), shelf dimensions, capacity and rental terms. Stores go live after simulated admin approval.</p></div>}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        {step > 0 && <GhostButton onClick={() => setStep(step - 1)} data-testid="button-prev"><ArrowLeft className="h-4 w-4" /> Back</GhostButton>}
        {step < STEPS.length - 1 ? (
          step > 1 && <PrimaryButton disabled={!valid} onClick={() => setStep(step + 1)} data-testid="button-next">Continue <ArrowRight className="h-4 w-4" /></PrimaryButton>
        ) : (
          <PrimaryButton onClick={publish} data-testid="button-publish"><Check className="h-4 w-4" /> Submit demo store</PrimaryButton>
        )}
      </div>
      <div className="mt-6 flex justify-center gap-2">
        {step > 0 && <GhostButton onClick={saveExit} data-testid="button-save-exit"><Save className="h-4 w-4" />Save & exit</GhostButton>}
        {initial && <GhostButton onClick={startOver} data-testid="button-start-over">Start over</GhostButton>}
      </div>
    </Shell>
  );
}
