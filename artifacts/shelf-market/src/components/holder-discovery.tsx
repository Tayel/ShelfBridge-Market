import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Eye, FileSignature, Globe2, Handshake, KeyRound, MonitorSmartphone, Search, ShieldCheck } from "lucide-react";
import { ProductVideo, useMouseHover } from "@/components/product-video";
import { SceneArt } from "@/components/owner-scenes";
import { OPPORTUNITIES, freeShelves, geography, storesFor, type OpportunityId } from "@/lib/opportunities";
import { useStore } from "@/lib/store";

const STEPS = [
  { icon: Search, t: "Discover" }, { icon: Globe2, t: "Explore the country and store" }, { icon: Eye, t: "Inspect the exact shelf" },
  { icon: ShieldCheck, t: "Check the owner" }, { icon: Handshake, t: "Negotiate" }, { icon: FileSignature, t: "Sign" },
  { icon: KeyRound, t: "Get your shelf ID and QR" }, { icon: MonitorSmartphone, t: "Track sales and stock" },
];

/**
 * "Explore global retail opportunities": the start of the token holder journey. One picture made of six kinds of
 * shelf; each tile opens its country → city → store → shelf exploration. Airport and outlet tiles keep InRaf's
 * own product videos. Counts come from real stores; a kind with none yet says "Coming soon".
 */
export function HolderDiscovery() {
  const st = useStore();
  return (
    <section className="mt-8" data-testid="holder-discovery">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">From token holder to global retail presence</p>
        <h1 className="font-display mt-2 text-4xl font-extrabold leading-[1.05] md:text-6xl">Explore global retail opportunities</h1>
        <p className="mt-4 text-lg text-muted-foreground">Rent a real shelf in an airport, a mall or a boutique, from verified store owners. Inspect it remotely, agree the terms, sign, and follow your sales from your InRaf account.</p>
      </div>

      {/* One picture: six kinds of shelf, side by side in one frame. */}
      <div className="mx-auto mt-10 max-w-6xl overflow-hidden rounded-[2rem] border border-border bg-card p-2 shadow-[0_40px_80px_-50px_rgba(120,60,30,.55)]">
        <div className="grid gap-2 md:grid-cols-4 md:grid-rows-2">
          {OPPORTUNITIES.map((o, i) => <Tile key={o.id} id={o.id} size={i === 0 ? "hero" : i === OPPORTUNITIES.length - 1 ? "wide" : "small"} delay={i * 0.06} st={st} />)}
        </div>
      </div>

      <ol className="mx-auto mt-10 grid max-w-6xl grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8" aria-label="How it works">
        {STEPS.map((s, i) => (
          <li key={s.t} className="flex flex-col items-center gap-2 rounded-3xl border border-border p-3 text-center">
            <span className="relative grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary"><s.icon className="h-5 w-5" /><span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{i + 1}</span></span>
            <span className="text-xs font-medium leading-tight">{s.t}</span>
          </li>
        ))}
      </ol>

      <div className="mx-auto mt-8 grid max-w-6xl gap-4 md:grid-cols-2">
        <div className="rounded-[2rem] border border-border p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Model A</p>
          <p className="font-display text-xl font-bold">Rent a shelf</p>
          <p className="mt-1 text-sm text-muted-foreground">You rent the space for a monthly rent and manage your own products on it. The contract sets the shelf, access, duties and your right to check it.</p>
        </div>
        <div className="rounded-[2rem] border border-border p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Model B</p>
          <p className="font-display text-xl font-bold">Place products on consignment</p>
          <p className="mt-1 text-sm text-muted-foreground">No rent: the store sells your products for you and keeps an agreed commission on each sale. You still own the stock until it sells.</p>
        </div>
      </div>
      <p className="mx-auto mt-4 max-w-3xl text-center text-xs text-muted-foreground">Holding an InRaf token doesn't give you a shelf by itself: your rights to a shelf come from the contract you sign with the store.</p>
    </section>
  );
}

function Tile({ id, size, delay, st }: { id: OpportunityId; size: "hero" | "wide" | "small"; delay: number; st: ReturnType<typeof useStore> }) {
  const big = size !== "small";
  const o = OPPORTUNITIES.find((x) => x.id === id)!;
  const stores = storesFor(st, id);
  const free = stores.reduce((t, x) => t + freeShelves(st, x), 0);
  const countries = geography(st, stores).size;
  const soon = stores.length === 0;
  const samples = stores.filter((x) => x.seeded).length;
  const href = `/opportunities/${id}`;
  const { hovered, bind } = useMouseHover();
  return (
    <motion.div {...bind} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay, duration: 0.4 }}
      className={`group relative flex overflow-hidden rounded-[1.5rem] bg-muted ${size === "hero" ? "flex-col md:col-span-2 md:row-span-2" : size === "wide" ? "flex-col md:col-span-4 md:flex-row" : "flex-col"}`} data-testid={`opportunity-${id}`}>
      <div className={`relative ${size === "hero" ? "aspect-[16/10] md:aspect-auto md:flex-1" : size === "wide" ? "aspect-[16/10] md:aspect-[16/6] md:w-2/3" : "aspect-[16/10]"}`}>
        {o.video
          ? <ProductVideo product={o.video} active={hovered} className="absolute inset-0 h-full w-full" imgClassName="transition duration-500 group-hover:scale-[1.03]"
              playerExtra={<Link href={href} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground">Explore {o.title.toLowerCase()} <ArrowRight className="h-4 w-4" /></Link>} />
          : <SceneArt venue={o.scene} className="absolute inset-0 h-full w-full transition duration-500 group-hover:scale-105" />}
        {soon && <span className="absolute right-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold backdrop-blur">Coming soon</span>}
      </div>
      <Link href={href} className={`flex justify-between gap-3 bg-card p-4 ${size === "wide" ? "items-end md:flex-1 md:items-center md:p-8" : "items-end"} focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring/30`} data-testid={`link-opportunity-${id}`}>
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-primary">{o.tagline}</span>
          <span className={`font-display block font-bold leading-tight ${big ? "text-2xl" : "text-lg"}`}>{o.title}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground" data-testid={`count-${id}`}>{soon ? "First stores coming soon" : `${stores.length} store${stores.length === 1 ? "" : "s"}${samples ? ` (${samples === stores.length ? "samples" : `${samples} sample`})` : ""} · ${countries} countr${countries === 1 ? "y" : "ies"} · ${free} shelves free`}</span>
        </span>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition group-hover:translate-x-0.5"><ArrowRight className="h-4 w-4" /></span>
      </Link>
    </motion.div>
  );
}
