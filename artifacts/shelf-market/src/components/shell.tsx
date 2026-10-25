import { type ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/dashboard", label: "My shelves" },
  { href: "/owner-dashboard", label: "My shop" },
];

export function Logo() {
  return (
    <Link href="/" className="inraf-wordmark" data-testid="link-home" aria-label="InRaf home">
      <span className="inraf-latin" aria-hidden="true">In</span>
      <span className="inraf-arabic" lang="ar" dir="rtl" aria-hidden="true">رف</span>
    </Link>
  );
}

export function DemoBadge() {
  return (
    <span data-testid="badge-demo" title="Demo only. Nothing is real, no money moves."
      className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground ring-1 ring-amber-300/60">
      Demo · no real money
    </span>
  );
}

export function Shell({ children, title, back }: { children: ReactNode; title: string; back?: string }) {
  const [loc] = useLocation();
  useEffect(() => { document.title = `${title} · InRaf (demo)`; }, [title]);
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Logo />
          <DemoBadge />
          <nav className="ml-auto flex gap-1 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} data-testid={`link-nav-${n.href.slice(1)}`}
                className={`rounded-full px-3 py-1.5 transition-colors ${loc.startsWith(n.href) ? "bg-muted font-semibold" : "text-muted-foreground hover:text-foreground"}`}>
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <motion.main key={loc} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="mx-auto max-w-6xl px-4 pb-24 pt-6">
        {back && (
          <Link href={back} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        )}
        {children}
      </motion.main>
    </div>
  );
}

export function PrimaryButton({ children, className = "", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...p}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 font-semibold text-primary-foreground shadow-[0_8px_24px_-10px_hsl(12_72%_52%/.6)] transition active:scale-[.97] hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 ${className}`}>
      {children}
    </button>
  );
}

export function GhostButton({ children, className = "", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...p}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 disabled:opacity-40 ${className}`}>
      {children}
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="inline-flex rounded-full bg-muted p-1">
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)} data-testid={`tab-${o.id}`}
          className={`relative rounded-full px-4 py-1.5 text-sm font-medium transition ${value === o.id ? "text-foreground" : "text-muted-foreground"}`}>
          {value === o.id && <motion.span layoutId="seg" className="absolute inset-0 rounded-full bg-background shadow-sm" />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Tile({ selected, onClick, children, disabled, testId }: { selected?: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean; testId?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected} data-testid={testId}
      className={`group relative flex flex-col items-center justify-center gap-2 rounded-3xl border-2 p-5 text-center transition active:scale-[.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:-translate-y-0.5"}`}>
      {children}
    </button>
  );
}

export function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-primary" : i < step ? "w-3 bg-primary/40" : "w-3 bg-muted"}`} />
      ))}
    </div>
  );
}
