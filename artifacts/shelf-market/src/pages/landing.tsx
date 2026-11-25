import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Shell } from "@/components/shell";
import { LIVE, useSession } from "@/lib/store";
import { JourneyVideo } from "@/components/journey-video";
import { useMouseHover } from "@/components/product-video";
import { CountryStreet } from "@/components/country-street";
import { LittleShelf } from "@/components/little-shelf";

const base = import.meta.env.BASE_URL;

const JOURNEYS = [
  { href: "/start?as=owner", img: `${base}images/owner.png`, title: "I have a shop", sub: "Rent out a few empty shelves.", cta: "Apply as store owner", id: "owner", video: `${base}videos/inraf-shop-owner-ad.mp4` },
  { href: "/start?as=holder", img: `${base}images/holder.png`, title: "I make things", sub: "Hold a shelf token, stock it, sell.", cta: "Apply to hold a token", id: "holder", video: `${base}videos/inraf-maker-ad.mp4` },
];

export default function Landing() {
  const session = useSession();
  return (
    <Shell title="A little space. More possibility.">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <CountryStreet />
        <p className="mt-1 text-center text-xs text-muted-foreground">Hover a country to meet the people behind its shelves.</p>
      </motion.div>
      <section className="flex flex-col items-center pt-10 text-center">
        <LittleShelf className="w-40 md:w-48" />
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="font-display mt-5 max-w-3xl text-5xl font-extrabold leading-[0.95] md:text-7xl">
          A little shelf.<br /><span className="text-primary">Anywhere.</span>
        </motion.h1>
        <p className="mt-5 max-w-md text-lg text-muted-foreground">Neighborhood shops share space. Small makers fill it.</p>
      </section>
      <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
        {JOURNEYS.map((j, i) => <JourneyCard key={j.id} j={j} i={i} />)}
      </div>
      <div className="mx-auto mt-10 flex max-w-4xl flex-wrap justify-center gap-2 text-sm">
        {[["/scan", "I'm shopping · scan a shelf", "scan"], ...(!LIVE || session.me?.isAdmin ? [["/admin", "Platform admin console", "admin"]] : []), ["/guide", LIVE ? "How InRaf works" : "How this demo works", "guide"]].map(([href, label, id]) => (
          <Link key={id} href={href} data-testid={`link-secondary-${id}`} className="rounded-full border border-border px-4 py-2 text-muted-foreground transition hover:border-primary/40 hover:text-foreground">{label}</Link>
        ))}
      </div>
      <p className="mx-auto mt-4 max-w-xl text-center text-xs text-muted-foreground">{LIVE ? "Open to shops and makers in Egypt, Portugal, Hungary, Türkiye and the UAE. Accounts and listings are real; payments, e-signatures and settlements are still simulated, so no money moves yet." : "Demo across Egypt, Portugal, Hungary, Türkiye and the UAE. Contracts, payments and settlements are simulated in this browser only."}</p>
    </Shell>
  );
}

type Journey = (typeof JOURNEYS)[number];

/** One journey card: the whole card links on, and hovering it (or tapping its picture) plays that journey's ad. */
function JourneyCard({ j, i }: { j: Journey; i: number }) {
  const { hovered, bind } = useMouseHover();
  const [focused, setFocused] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.12, duration: 0.5 }}>
      <Link href={j.href} data-testid={`link-journey-${j.id}`} {...bind}
        onFocus={(e: React.FocusEvent<HTMLAnchorElement>) => { if (e.currentTarget.matches(":focus-visible")) setFocused(true); }}
        onBlur={() => setFocused(false)}
        className="group flex h-full flex-col items-center rounded-[2rem] border border-border p-8 transition hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(120,60,30,.35)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30">
        <JourneyVideo img={j.img} video={j.video} label={j.id} active={hovered || focused} />
        <h2 className="font-display mt-4 text-3xl font-bold">{j.title}</h2>
        <p className="mt-1 text-muted-foreground">{j.sub}</p>
        <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground transition group-hover:gap-3">
          {j.cta} <ArrowRight className="h-4 w-4" />
        </span>
      </Link>
    </motion.div>
  );
}
