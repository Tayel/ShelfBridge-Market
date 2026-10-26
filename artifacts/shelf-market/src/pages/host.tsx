import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, BadgeCheck, Boxes, ChevronDown, Coins, IdCard, ShieldCheck, Sparkles } from "lucide-react";
import { Shell, PrimaryButton } from "@/components/shell";
import { Card } from "@/components/kit";
import { ShopMap } from "@/components/listing-bits";
import { PLATFORM_COMMISSION_PCT, countryName } from "@/lib/data";
import { useStore, usd } from "@/lib/store";

/** Share of shelves assumed rented in the estimate. Illustrative only. */
const OCCUPANCY = 0.7;

const PROMISES = [
  { icon: Sparkles, title: "Easy to list", text: "Three short phases: your shop, what makes it stand out, then price and rules. Save and come back any time." },
  { icon: Coins, title: "Worth it", text: `Free to list. On sales through your shelves the platform keeps ${PLATFORM_COMMISSION_PCT}%, and only after a sale is captured.` },
  { icon: ShieldCheck, title: "You're protected", text: "Every renter's business is checked, contracts are signed on the platform, and stock is counted in and out." },
];

const PROTECTION = [
  { icon: IdCard, title: "Checks on both sides", text: "Shops and makers both go through a business check (KYB) before a contract can start." },
  { icon: Boxes, title: "Stock counted in and out", text: "Delivery works like check-in: a counted, photographed stock list. Collection at the end works the same way." },
  { icon: BadgeCheck, title: "Inventory protection", text: "Planned cover for theft or damage of a maker's stock while it's on your shelf. Not offered in this demo." },
];

const FAQ = [
  ["Do I need special shelving?", "No. Any clean, safe shelf works. You set its size and capacity so makers know what fits."],
  ["Who sets the product prices?", "The maker does. You choose how you're paid: fixed monthly rent, a share of each sale, or both."],
  ["What if a product breaks my shop's rules?", "You approve every product before it goes on sale, and you can reject anything that doesn't fit your rules or licence."],
  ["How do I get paid?", "Rent is invoiced monthly. In this demo all payments and payouts are simulated, and no money moves."],
];

export default function Host() {
  const st = useStore();
  const [, go] = useLocation();
  const approved = st.shops.filter((s) => s.status === "approved");
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
    <Shell title="List your shop" back="/">
      <section className="grid items-center gap-10 lg:grid-cols-2" data-testid="section-estimator">
        <div className="text-center lg:text-left">
          <h1 className="font-display text-5xl font-extrabold leading-[0.95] md:text-6xl">Your empty shelves could earn</h1>
          <p className="font-display mt-3 text-6xl font-extrabold text-primary md:text-7xl" data-testid="text-estimate">{usd(monthly).replace(".00", "")}<span className="text-2xl font-bold text-muted-foreground"> /month</span></p>
          <p className="mt-3 text-muted-foreground"><b className="text-foreground">{shelves} shelves</b> at about {usd(avg).replace(".00", "")} each, {Math.round(OCCUPANCY * 100)}% rented</p>
          <input type="range" min={1} max={30} value={shelves} onChange={(e) => setShelves(Number(e.target.value))} className="mt-6 w-full max-w-md accent-[hsl(var(--primary))]" aria-label="Number of shelves" data-testid="input-shelves" />
          <div className="mt-4">
            <label className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm">
              <span className="font-semibold">City</span>
              <select value={city} onChange={(e) => setCity(e.target.value)} className="bg-transparent outline-none" data-testid="select-host-city">
                {cities.map((c) => <option key={c} value={c}>{c}, {countryName(approved.find((s) => s.city === c)!.country)}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Estimate based on the rent of similar demo shops nearby. Illustrative, not a promise of earnings.</p>
          <PrimaryButton className="mt-6" onClick={() => go("/owner")} data-testid="button-start-listing">List your shop <ArrowRight className="h-4 w-4" /></PrimaryButton>
        </div>
        <div className="h-[380px]">
          <ShopMap shops={nearby} active={null} onPick={(id) => go(`/explore/${id}`)} />
        </div>
      </section>

      <section className="mt-20 grid gap-6 md:grid-cols-3">
        {PROMISES.map((p) => (
          <div key={p.title} className="text-center md:text-left">
            <p.icon className="mx-auto h-8 w-8 text-primary md:mx-0" strokeWidth={1.5} />
            <p className="font-display mt-3 text-xl font-bold">{p.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
          </div>
        ))}
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
        <h2 className="font-display text-center text-3xl font-bold">Questions shop owners ask</h2>
        <div className="mt-6 divide-y divide-border rounded-[1.75rem] border border-border">
          {FAQ.map(([q, a], i) => (
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
