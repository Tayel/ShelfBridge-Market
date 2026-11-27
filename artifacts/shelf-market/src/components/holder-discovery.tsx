import { useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CalendarClock, Check, Clock, Package, Play, Plane, Recycle, Shirt, ShoppingBag, Store, Volume2, type LucideIcon } from "lucide-react";
import { Player } from "@/components/product-video";
import { LoopVideo } from "@/components/loop-video";
import { PRODUCT_JOURNEY, type ProductId } from "@/lib/data";
import { OPPORTUNITIES, freeShelves, geography, storesFor, type OpportunityId } from "@/lib/opportunities";
import { useStore } from "@/lib/store";

const ICON: Record<OpportunityId, LucideIcon> = { airport: Plane, mall: ShoppingBag, independent: Store, fashion: Shirt, outlet: Recycle, "expiring-rentals": CalendarClock };
const SHORT: Record<OpportunityId, string> = { airport: "Airport duty-free", mall: "Shopping malls", independent: "Local boutiques", fashion: "Fashion space", outlet: "Outlet & near-date", "expiring-rentals": "Freeing up soon" };
const JOURNEY = ["Choose channel", "Select product", "Verify & apply", "Go live"];
const ROADMAP = [
  { t: "Request & formal offer", d: "You send a request or your own terms; the store owner replies with a formal rental offer addressed to you." },
  { t: "InRaf review & acceptance", d: "InRaf reviews it, you accept it by signing, and you both get a written confirmation." },
  { t: "Shelf live", d: "You get your shelf ID and QR code, stock it and start selling." },
];

/**
 * "Apply to hold a retail token": the start of the token holder journey, laid out as one organised screen — a
 * four-step journey bar, InRaf's two product films side by side (looping silently, with sound on request), and three
 * steps: pick a retail channel, pick a product type, then see the roadmap and start. Counts come from real stores.
 */
export function HolderDiscovery() {
  const st = useStore();
  const [, go] = useLocation();
  const [channel, setChannel] = useState<OpportunityId>("airport");
  const [type, setType] = useState<"standard" | "near-expiry">("standard");
  const at = 2; // a channel and a product type are always picked, so "Verify & apply" is next

  const start = () => go(`/opportunities/${channel}${type === "near-expiry" ? "?type=near-expiry" : ""}`);

  return (
    <section className="mt-4" data-testid="holder-discovery">
      {/* Journey bar */}
      <ol className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm" aria-label="Your journey" data-testid="holder-journey">
        {JOURNEY.map((s, i) => (
          <li key={s} className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-2 font-semibold ${i <= at ? "text-foreground" : "text-muted-foreground"}`}>
              <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${i < at ? "bg-primary text-primary-foreground" : i === at ? "border-2 border-primary text-primary" : "border border-border"}`}>{i < at ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
              {s}
            </span>
            {i < JOURNEY.length - 1 && <span className={`hidden h-0.5 w-10 rounded sm:block ${i < at ? "bg-primary" : "bg-border"}`} />}
          </li>
        ))}
      </ol>

      <div className="mx-auto mt-10 max-w-3xl text-center">
        <h1 className="font-display text-4xl font-extrabold leading-[1.05] md:text-6xl">Apply to hold a retail token</h1>
        <p className="mt-4 text-lg text-muted-foreground">Rent a real shelf in an airport, a mall or a boutique from verified store owners. Pick a channel and a product type, check the shelf, agree the terms and go live.</p>
      </div>

      {/* The two product films, side by side */}
      <div className="mx-auto mt-10 grid max-w-6xl gap-5 md:grid-cols-2" data-testid="holder-videos">
        <FilmCard product="flying" kicker="Airport · local makers" />
        <FilmCard product="expiring" kicker="Neighbourhood grocery · near-date stock" />
      </div>

      {/* Three steps */}
      <div className="mx-auto mt-8 grid max-w-6xl gap-5 lg:grid-cols-[1.25fr_1fr_1fr]">
        <StepCard n={1} title="Pick your retail shelf">
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Retail channel">
            {OPPORTUNITIES.map((o) => {
              const Icon = ICON[o.id]; const on = channel === o.id;
              const stores = storesFor(st, o.id); const free = stores.reduce((t, x) => t + freeShelves(st, x), 0);
              return (
                <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => setChannel(o.id)} data-testid={`channel-${o.id}`}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center transition ${on ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                  <Icon className={`h-6 w-6 ${on ? "text-primary" : "text-foreground/70"}`} strokeWidth={1.6} />
                  <span className="text-xs font-semibold leading-tight">{SHORT[o.id]}</span>
                  <span className="text-[10px] text-muted-foreground" data-testid={`count-${o.id}`}>{stores.length ? `${free} shelves` : "Coming soon"}</span>
                </button>
              );
            })}
          </div>
          <ChannelNote id={channel} st={st} />
        </StepCard>

        <StepCard n={2} title="Choose product type">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Product type">
            {([["standard", "Standard retail", "Your own products at full price", Package], ["near-expiry", "Near-expiry", "Stock close to its date, sold at a discount", Clock]] as const).map(([k, l, h, Icon]) => {
              const on = type === k;
              return (
                <button key={k} type="button" role="radio" aria-checked={on} onClick={() => setType(k)} data-testid={`type-${k}`}
                  className={`flex flex-col items-center gap-2 rounded-2xl border-2 px-3 py-4 text-center transition ${on ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                  <span className={`relative h-6 w-11 rounded-full transition ${on ? "bg-primary" : "bg-muted"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`} /></span>
                  <Icon className="h-5 w-5 text-foreground/70" strokeWidth={1.6} />
                  <span className="text-sm font-semibold leading-tight">{l}</span>
                  <span className="text-[11px] leading-snug text-muted-foreground">{h}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{type === "near-expiry" ? "Shows stores that accept food and drinks. Products need their expiry date and must not be expired." : "Rent the shelf (monthly rent) or place products on consignment (the store keeps a commission). You choose on the store page."}</p>
        </StepCard>

        <StepCard n={3} title="Your roadmap">
          <div className="flex gap-1" aria-hidden="true">
            {ROADMAP.map((_, i) => <span key={i} className={`h-2.5 flex-1 rounded-full ${i === 0 ? "bg-primary/40" : i === 1 ? "bg-primary" : "bg-muted"}`} />)}
          </div>
          <ol className="mt-3 grid grid-cols-3 gap-2 text-center">
            {ROADMAP.map((r, i) => (
              <li key={r.t}><p className="text-xs font-bold">{i + 1}. {r.t}</p><p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{r.d}</p></li>
            ))}
          </ol>
          <button type="button" onClick={start} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 font-semibold text-primary-foreground shadow-[0_8px_24px_-10px_hsl(12_72%_52%/.6)] transition hover:-translate-y-0.5" data-testid="button-start-application">
            Start application <ArrowRight className="h-4 w-4" />
          </button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">Timing depends on the store owner and InRaf's review. Nothing is charged until both sides sign.</p>
        </StepCard>
      </div>

      <div className="mx-auto mt-6 grid max-w-6xl gap-3 text-sm md:grid-cols-2">
        <p className="rounded-2xl bg-muted/60 px-5 py-3"><b>Model A · Rent a shelf.</b> <span className="text-muted-foreground">Monthly rent; you manage your own products.</span></p>
        <p className="rounded-2xl bg-muted/60 px-5 py-3"><b>Model B · Consignment.</b> <span className="text-muted-foreground">No rent; the store sells for you and keeps a commission.</span></p>
      </div>
      <p className="mx-auto mt-3 max-w-3xl text-center text-xs text-muted-foreground">Holding an InRaf token doesn't give you a shelf by itself: your rights to a shelf come from the contract you sign with the store.</p>
    </section>
  );
}

function StepCard({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * n, duration: 0.35 }}
      className="flex flex-col rounded-[1.75rem] border border-border bg-card p-6 shadow-[0_24px_60px_-45px_rgba(120,60,30,.5)]" data-testid={`step-${n}`}>
      <p className="font-display text-xl font-bold">Step {n}: {title}</p>
      <div className="mt-4 flex-1">{children}</div>
    </motion.div>
  );
}

/** What the picked channel offers right now, from real stores. */
function ChannelNote({ id, st }: { id: OpportunityId; st: ReturnType<typeof useStore> }) {
  const o = OPPORTUNITIES.find((x) => x.id === id)!;
  const stores = storesFor(st, id);
  const samples = stores.filter((x) => x.seeded).length;
  const countries = geography(st, stores).size;
  return (
    <p className="mt-3 text-xs text-muted-foreground" data-testid="channel-note">
      <b className="text-foreground">{o.title}.</b> {o.text} {stores.length ? `${stores.length} store${stores.length === 1 ? "" : "s"}${samples ? ` (${samples === stores.length ? "samples" : `${samples} sample`})` : ""} in ${countries} countr${countries === 1 ? "y" : "ies"}.` : "First stores coming soon."}
    </p>
  );
}

/** One product film: loops silently, wide. Clicking anywhere on the card opens the full film with sound; it doesn't
 *  navigate — the journey starts from "Start application". */
function FilmCard({ product, kicker }: { product: ProductId; kicker: string }) {
  const j = PRODUCT_JOURNEY[product];
  const [watch, setWatch] = useState(false);
  return (
    <motion.article initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="group overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[0_30px_70px_-50px_rgba(120,60,30,.6)]" data-testid={`film-${product}`}>
      <button type="button" onClick={() => setWatch(true)} aria-label={`Watch the ${j.title} film with sound`} className="block w-full text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring/30" data-testid={`watch-${product}`}>
        <div className="relative aspect-video bg-black">
          <LoopVideo src={j.video.preview} className="transition duration-700 group-hover:scale-[1.02]" />
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur group-hover:bg-background">
            <Volume2 className="h-3.5 w-3.5 text-primary" />Watch with sound
          </span>
        </div>
        <span className="flex items-center justify-between gap-4 p-5">
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-primary">{kicker}</span>
            <span className="font-display block text-2xl font-bold leading-tight">{j.title}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{j.summary}</span>
          </span>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition group-hover:scale-105"><Play className="h-4 w-4 fill-current" /></span>
        </span>
      </button>
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>{watch && <Player product={product} startAt={0} onClose={() => setWatch(false)} />}</AnimatePresence>,
        document.body,
      )}
    </motion.article>
  );
}
