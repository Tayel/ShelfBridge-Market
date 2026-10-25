import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Shell } from "@/components/shell";

const base = import.meta.env.BASE_URL;

const JOURNEYS = [
  { href: "/owner", img: `${base}images/owner.png`, title: "I have a shop", sub: "Rent out a few empty shelves.", cta: "Apply as store owner", id: "owner" },
  { href: "/explore", img: `${base}images/holder.png`, title: "I make things", sub: "Hold a shelf token, stock it, sell.", cta: "Apply to hold a token", id: "holder" },
];

export default function Landing() {
  return (
    <Shell title="A little space. More possibility.">
      <section className="flex flex-col items-center pt-6 text-center md:pt-12">
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="font-display max-w-3xl text-5xl font-extrabold leading-[0.95] md:text-7xl">
          A little shelf.<br /><span className="text-primary">Anywhere.</span>
        </motion.h1>
        <p className="mt-5 max-w-md text-lg text-muted-foreground">Neighborhood shops share space. Small makers fill it.</p>
      </section>
      <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
        {JOURNEYS.map((j, i) => (
          <motion.div key={j.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.12, duration: 0.5 }}>
            <Link href={j.href} data-testid={`link-journey-${j.id}`}
              className="group flex h-full flex-col items-center rounded-[2rem] border border-border p-8 transition hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(120,60,30,.35)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30">
              <img src={j.img} alt="" className="h-56 w-auto object-contain transition duration-500 group-hover:scale-105" />
              <h2 className="font-display mt-4 text-3xl font-bold">{j.title}</h2>
              <p className="mt-1 text-muted-foreground">{j.sub}</p>
              <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground transition group-hover:gap-3">
                {j.cta} <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
      <img src={`${base}images/street.png`} alt="Three small shopfronts from different countries" className="mx-auto mt-16 w-full max-w-2xl opacity-90" />
    </Shell>
  );
}
