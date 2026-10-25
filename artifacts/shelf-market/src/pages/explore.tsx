import { useMemo, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { MapPin, Store } from "lucide-react";
import { Shell } from "@/components/shell";
import { ShelfArt } from "@/components/shelf-art";
import { BUSINESSES, COUNTRIES, businessOf, countryName } from "@/lib/data";
import { slotsOf, takenSlots, useStore, usd } from "@/lib/store";

function Chip({ on, onClick, children, id }: { on: boolean; onClick: () => void; children: React.ReactNode; id: string }) {
  return (
    <button onClick={onClick} aria-pressed={on} data-testid={id}
      className={`shrink-0 rounded-full border px-4 py-2 text-sm transition active:scale-95 ${on ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/30"}`}>
      {children}
    </button>
  );
}

export default function Explore() {
  const st = useStore();
  const [country, setCountry] = useState("all");
  const [biz, setBiz] = useState("all");
  const shops = useMemo(() => st.shops.filter((s) => (country === "all" || s.country === country) && (biz === "all" || s.business === biz)), [st.shops, country, biz]);
  const usedCountries = COUNTRIES.filter((c) => st.shops.some((s) => s.country === c.code));

  return (
    <Shell title="Find a shelf" back="/">
      <h1 className="font-display text-center text-4xl font-bold md:text-5xl">Pick a shelf</h1>
      <div className="mt-8 space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Chip on={country === "all"} onClick={() => setCountry("all")} id="chip-country-all">All countries</Chip>
          {usedCountries.map((c) => <Chip key={c.code} on={country === c.code} onClick={() => setCountry(c.code)} id={`chip-country-${c.code}`}>{c.name}</Chip>)}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Chip on={biz === "all"} onClick={() => setBiz("all")} id="chip-biz-all">Any shop</Chip>
          {BUSINESSES.map((b) => <Chip key={b.code} on={biz === b.code} onClick={() => setBiz(b.code)} id={`chip-biz-${b.code}`}>{b.label}</Chip>)}
        </div>
      </div>
      {shops.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center text-muted-foreground" data-testid="empty-shops">
          <ShelfArt tiers={2} hue={30} fill={[null, null]} className="w-40" />
          <p className="mt-4">No shops here yet.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((s, i) => {
            const free = slotsOf(s) - takenSlots(st, s.id).size;
            const B = businessOf(s.business);
            return (
              <motion.div key={s.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link href={`/explore/${s.id}`} data-testid={`card-shop-${s.id}`}
                  className="group block rounded-[1.75rem] border border-border p-5 transition hover:-translate-y-1 hover:shadow-[0_24px_50px_-28px_rgba(120,60,30,.4)]">
                  <div className="rounded-2xl p-4" style={{ background: `hsl(${s.hue} 50% 97%)` }}>
                    <ShelfArt tiers={Math.min(s.tiers, 3)} hue={s.hue} className="mx-auto h-36 transition duration-500 group-hover:scale-105" />
                  </div>
                  <div className="mt-4 flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-display text-xl font-bold">{s.name}</h2>
                      <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{s.city}, {countryName(s.country)}</p>
                    </div>
                    <span className="font-display text-lg font-bold">{usd(s.price)}<span className="text-xs font-normal text-muted-foreground">/mo</span></span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1"><B.icon className="h-3 w-3" />{B.label}</span>
                    <span className={`rounded-full px-2.5 py-1 ${free ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>{free ? `${free} free` : "Full"}</span>
                    {!s.seeded && <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-accent-foreground"><Store className="h-3 w-3" />Yours</span>}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
