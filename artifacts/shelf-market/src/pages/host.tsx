import { useMemo, useState } from "react";
import { ProductVideo } from "@/components/product-video";
import { Link, useLocation } from "wouter";
import { HowItWorks, JourneySteps, ProductSwitch, useRequireProduct } from "@/components/product-bits";
import { ArrowRight, BadgeCheck, Boxes, ChevronDown, Coins, IdCard, ShieldCheck, Sparkles } from "lucide-react";
import { Shell, PrimaryButton } from "@/components/shell";
import { Card } from "@/components/kit";
import { ShopMap } from "@/components/listing-bits";
import { PRODUCT_JOURNEY, countryName, shopServes } from "@/lib/data";
import { LIVE, useStore, usd } from "@/lib/store";

/** Share of shelves assumed rented in the estimate. Illustrative only. */
const OCCUPANCY = 0.7;

const PROMISE_ICONS = [Sparkles, Coins, ShieldCheck];

const PROTECTION = [
  { icon: IdCard, title: "Checks on both sides", text: "Shops and makers both go through a business check (KYB) before a contract can start." },
  { icon: Boxes, title: "Stock counted in and out", text: "Delivery works like check-in: a counted, photographed stock list. Collection at the end works the same way." },
  { icon: BadgeCheck, title: "Inventory protection", text: LIVE ? "Planned cover for theft or damage of a maker's stock while it's on your shelf. Not offered yet." : "Planned cover for theft or damage of a maker's stock while it's on your shelf. Not offered in this demo." },
];


export default function Host() {
  const product = useRequireProduct("owner");
  return product ? <HostFor product={product} key={product} /> : null;
}

function HostFor({ product }: { product: "expiring" | "flying" }) {
  const st = useStore();
  const [, go] = useLocation();
  const j = PRODUCT_JOURNEY[product];
  const approved = st.shops.filter((s) => s.status === "approved" && shopServes(s, product));
  const cities = [...new Set(approved.map((s) => s.city))].sort();
  const [city, setCity] = useState(cities.includes("Lisbon") ? "Lisbon" : cities[0] ?? "");
  const [shelves, setShelves] = useState(6);
  const [faq, setFaq] = useState<number | null>(0);

  const nearby = useMemo(() => {
    const ref = approved.find((s) => s.city === city);
    return approved.filter((s) => s.city === city || (ref && s.country === ref.country));
  }, [approved, city]);
  const avg = nearby.length ? nearby.reduce((a, s) => a + s.price, 0) / nearby.length : 30;
  const monthly = Math.round(avg * shelves * OCCUPANCY);

  return (
    <Shell title={`List your shop · ${j.title}`} back={`/start?as=owner&product=${product}`}>
      <div className="mb-8 flex flex-col items-center gap-4">
        <JourneySteps at={3} />
        <ProductSwitch value={product} onChange={(p) => go(`/host?product=${p}`)} />
      </div>
      <section className="grid items-center gap-10 lg:grid-cols-2" data-testid="section-estimator">
        <div className="text-center lg:text-left">
          <p className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary" data-testid="text-host-product">{j.title} · {j.owner.who}</p>
          <h1 className="font-display text-5xl font-extrabold leading-[0.95] md:text-6xl">{product === "flying" ? "Your empty airport shelves could earn" : "Your empty shelves could earn"}</h1>
          <p className="font-display mt-3 text-6xl font-extrabold text-primary md:text-7xl" data-testid="text-estimate">{usd(monthly).replace(".00", "")}<span className="text-2xl font-bold text-muted-foreground"> /month</span></p>
          <p className="mt-3 text-muted-foreground"><b className="text-foreground">{shelves} {product === "flying" ? "airport shelves" : "near-date shelves"}</b> at about {usd(avg).replace(".00", "")} each, {Math.round(OCCUPANCY * 100)}% rented</p>
          <p className="mt-4 max-w-md text-foreground/80 lg:max-w-none">{j.owner.pitch}</p>
          <input type="range" min={1} max={30} value={shelves} onChange={(e) => setShelves(Number(e.target.value))} className="mt-6 w-full max-w-md accent-[hsl(var(--primary))]" aria-label="Number of shelves" data-testid="input-shelves" />
          <div className="mt-4">
            <label className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm">
              <span className="font-semibold">{product === "flying" ? "Airport city" : "City"}</span>
              <select value={city} onChange={(e) => setCity(e.target.value)} className="bg-transparent outline-none" data-testid="select-host-city">
                {cities.map((c) => <option key={c} value={c}>{c}, {countryName(approved.find((s) => s.city === c)!.country)}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Estimate based on the rent of similar {product === "flying" ? "airport" : "neighbourhood"}{LIVE ? "" : " demo"} shops. Illustrative, not a promise of earnings.</p>
          <PrimaryButton className="mt-6" onClick={() => go(`/owner?product=${product}`)} data-testid="button-start-listing">{j.owner.cta} <ArrowRight className="h-4 w-4" /></PrimaryButton>
        </div>
        <figure className="overflow-hidden rounded-[2rem] border border-border">
          <ProductVideo product={product} className="aspect-[590/242]" alt={product === "flying" ? "A Made in Our Country shop at an airport gate" : "A neighbourhood grocery with an About to Expire shelf"} />
        </figure>
      </section>

      <section className="mt-20 grid gap-6 md:grid-cols-3">
        {j.owner.promises.map((p, i) => { const Icon = PROMISE_ICONS[i % PROMISE_ICONS.length]; return (
          <div key={p.title} className="text-center md:text-left">
            <Icon className="mx-auto h-8 w-8 text-primary md:mx-0" strokeWidth={1.5} />
            <p className="font-display mt-3 text-xl font-bold">{p.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
          </div>
        ); })}
      </section>

      <HowItWorks product={product} />

      <section className="mt-16" aria-labelledby="hosting-map">
        <h2 id="hosting-map" className="font-display text-center text-3xl font-bold">{product === "flying" ? "Airport shops already on InRaf" : "Neighbourhood shops already on InRaf"}</h2>
        <p className="mt-1 text-center text-sm text-muted-foreground">{nearby.length} in {city || "this city"} and nearby</p>
        <div className="mt-6 h-[340px]">
          <ShopMap shops={nearby} active={null} onPick={(id) => go(`/explore/${id}`)} />
        </div>
      </section>

      <section className="mt-20 rounded-[2rem] bg-muted/60 p-8" data-testid="section-protection">
        <h2 className="font-display text-3xl font-bold">Protection for shops and makers</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {PROTECTION.map((p) => (
            <Card key={p.title}>
              <p.icon className="h-6 w-6 text-primary" strokeWidth={1.5} />
              <p className="mt-2 font-semibold">{p.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-3xl">
        <h2 className="font-display text-center text-3xl font-bold">{product === "flying" ? "Questions airport shops ask" : "Questions shop owners ask"}</h2>
        <div className="mt-6 divide-y divide-border rounded-[1.75rem] border border-border">
          {j.owner.faq.map(([q, a], i) => (
            <div key={q}>
              <button onClick={() => setFaq(faq === i ? null : i)} aria-expanded={faq === i} className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left font-semibold" data-testid={`faq-${i}`}>
                {q}<ChevronDown className={`h-4 w-4 shrink-0 transition ${faq === i ? "rotate-180" : ""}`} />
              </button>
              {faq === i && <p className="px-6 pb-5 text-sm text-muted-foreground">{a}</p>}
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">Already listed? <Link href="/owner-dashboard" className="text-primary underline">Go to your owner portal</Link></p>
      </section>
    </Shell>
  );
}
