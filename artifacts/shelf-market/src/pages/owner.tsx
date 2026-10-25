import { useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Minus, Plus } from "lucide-react";
import { Shell, PrimaryButton, GhostButton, Tile, StepDots } from "@/components/shell";
import { IsoFloor } from "@/components/iso-floor";
import { ShelfArt } from "@/components/shelf-art";
import { BUSINESSES, COUNTRIES, CATEGORIES, RESTRICTIONS, businessOf, countryName, categoryLabel } from "@/lib/data";
import { actions, usd } from "@/lib/store";

const STEPS = ["What do you run?", "Which country?", "Where is it?", "How big is it?", "Tap spots for shelves", "Shelves and price", "What can go on them?", "Ready to publish"];

function Stepper({ value, set, min, max, label, prefix = "" }: { value: number; set: (n: number) => void; min: number; max: number; label: string; prefix?: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-4">
        <button type="button" aria-label={`Decrease ${label}`} data-testid={`button-dec-${label}`} onClick={() => set(Math.max(min, value - 1))} className="grid h-11 w-11 place-items-center rounded-full border border-border transition hover:bg-muted active:scale-90"><Minus className="h-4 w-4" /></button>
        <span className="font-display w-20 text-center text-4xl font-bold tabular-nums">{prefix}{value}</span>
        <button type="button" aria-label={`Increase ${label}`} data-testid={`button-inc-${label}`} onClick={() => set(Math.min(max, value + 1))} className="grid h-11 w-11 place-items-center rounded-full border border-border transition hover:bg-muted active:scale-90"><Plus className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export default function Owner() {
  const [, go] = useLocation();
  const [step, setStep] = useState(0);
  const [business, setBusiness] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [location, setLocation] = useState("");
  const [name, setName] = useState("");
  const [width, setWidth] = useState(4);
  const [depth, setDepth] = useState(4);
  const [bricks, setBricks] = useState<number[]>([]);
  const [tiers, setTiers] = useState(3);
  const [price, setPrice] = useState(30);
  const [cats, setCats] = useState<string[]>(["food", "craft"]);
  const [rules, setRules] = useState<string[]>([]);
  const hue = 12;

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const valid = [!!business, !!country, city.trim() && name.trim() && location.trim(), true, bricks.length > 0, price > 0, cats.length > 0, true][step];
  const resize = (w: number, d: number) => { setWidth(w); setDepth(d); setBricks([]); };

  const publish = () => {
    actions.publishShop({ name: name.trim(), country, city: city.trim(), location: location.trim(), business, width, depth, bricks, tiers, price, categories: cats, restrictions: rules, hue });
    go("/owner-dashboard");
  };

  const B = businessOf(business);
  const body = [
    <div key="0" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {BUSINESSES.map((b) => (
        <Tile key={b.code} selected={business === b.code} onClick={() => { setBusiness(b.code); setStep(1); }} testId={`tile-business-${b.code}`}>
          <b.icon className="h-9 w-9 text-primary" strokeWidth={1.5} />
          <span className="font-medium">{b.label}</span>
          <span className="text-[10px] text-muted-foreground">ISIC {b.code}</span>
        </Tile>
      ))}
    </div>,
    <div key="1" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {COUNTRIES.map((c) => (
        <Tile key={c.code} selected={country === c.code} onClick={() => { setCountry(c.code); setStep(2); }} testId={`tile-country-${c.code}`}>
          <span className="font-display text-3xl font-bold text-primary/80">{c.code}</span>
          <span className="font-medium">{c.name}</span>
        </Tile>
      ))}
    </div>,
    <div key="2" className="mx-auto flex max-w-sm flex-col gap-3">
      {[["Shop name", name, setName, "shop-name"], ["City", city, setCity, "city"], ["Street", location, setLocation, "street"]].map(([l, v, s, id]) => (
        <input key={id as string} aria-label={l as string} placeholder={l as string} value={v as string} data-testid={`input-${id}`}
          onChange={(e) => (s as (x: string) => void)(e.target.value)}
          className="rounded-2xl border border-input bg-background px-5 py-4 text-lg outline-none transition focus:border-primary focus:ring-4 focus:ring-ring/20" />
      ))}
    </div>,
    <div key="3" className="flex flex-col items-center gap-6">
      <div className="flex gap-10">
        <Stepper label="Width (m)" value={width} set={(w) => resize(w, depth)} min={2} max={7} />
        <Stepper label="Depth (m)" value={depth} set={(d) => resize(width, d)} min={2} max={7} />
      </div>
      <IsoFloor width={width} depth={depth} bricks={[]} hue={hue} />
    </div>,
    <div key="4" className="flex flex-col items-center">
      <IsoFloor width={width} depth={depth} bricks={bricks} onToggle={(i) => setBricks((b) => toggle(b, i))} hue={hue} />
      <p className="text-sm text-muted-foreground" data-testid="text-brick-count">{bricks.length} spot{bricks.length === 1 ? "" : "s"} raised</p>
    </div>,
    <div key="5" className="flex flex-col items-center gap-8 md:flex-row md:justify-center">
      <ShelfArt tiers={tiers} hue={hue} fill={Array(tiers).fill(null)} className="w-48" />
      <div className="flex flex-col gap-6">
        <Stepper label="Shelves per spot" value={tiers} set={setTiers} min={1} max={5} />
        <Stepper label="USD / month" value={price} set={setPrice} min={5} max={250} prefix="$" />
        <p className="text-center text-sm text-muted-foreground">{bricks.length * tiers} shelves to rent</p>
      </div>
    </div>,
    <div key="6" className="mx-auto max-w-xl space-y-6">
      <div className="flex flex-wrap justify-center gap-2">
        {CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setCats((x) => toggle(x, c.id))} aria-pressed={cats.includes(c.id)} data-testid={`chip-cat-${c.id}`}
            className={`rounded-full border px-4 py-2 text-sm transition active:scale-95 ${cats.includes(c.id) ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40"}`}>{c.label}</button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {RESTRICTIONS.map((r) => (
          <button key={r.id} onClick={() => setRules((x) => toggle(x, r.id))} aria-pressed={rules.includes(r.id)} data-testid={`chip-rule-${r.id}`}
            className={`rounded-full border px-4 py-2 text-sm transition active:scale-95 ${rules.includes(r.id) ? "border-secondary-foreground bg-secondary text-secondary-foreground" : "border-dashed border-border text-muted-foreground"}`}>{r.label}</button>
        ))}
      </div>
    </div>,
    <div key="7" className="mx-auto flex max-w-md flex-col items-center rounded-[2rem] border border-border p-8 text-center">
      <B.icon className="h-10 w-10 text-primary" strokeWidth={1.5} />
      <h3 className="font-display mt-3 text-3xl font-bold" data-testid="text-review-name">{name}</h3>
      <p className="text-muted-foreground">{city}, {countryName(country)} · {B.label}</p>
      <ShelfArt tiers={tiers} hue={hue} className="my-4 w-40" />
      <p className="font-display text-2xl font-bold">{bricks.length * tiers} shelves · {usd(price)}<span className="text-base font-normal text-muted-foreground">/mo</span></p>
      <p className="mt-2 text-sm text-muted-foreground">{cats.map(categoryLabel).join(" · ")}</p>
    </div>,
  ][step];

  return (
    <Shell title="List your shop" back="/">
      <div className="flex flex-col items-center gap-3 text-center">
        <StepDots step={step} total={STEPS.length} />
        <h1 className="font-display text-4xl font-bold md:text-5xl">{STEPS[step]}</h1>
      </div>
      <div className="mt-10">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
            {body}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-10 flex items-center justify-center gap-3">
        {step > 0 && <GhostButton onClick={() => setStep(step - 1)} data-testid="button-prev"><ArrowLeft className="h-4 w-4" /> Back</GhostButton>}
        {step < STEPS.length - 1 ? (
          step > 1 && <PrimaryButton disabled={!valid} onClick={() => setStep(step + 1)} data-testid="button-next">Continue <ArrowRight className="h-4 w-4" /></PrimaryButton>
        ) : (
          <PrimaryButton onClick={publish} data-testid="button-publish"><Check className="h-4 w-4" /> Publish demo listing</PrimaryButton>
        )}
      </div>
    </Shell>
  );
}
