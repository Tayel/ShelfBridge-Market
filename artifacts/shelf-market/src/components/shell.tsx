import { type ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Bell, ChevronDown, Menu } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStore } from "@/lib/store";
import { actions } from "@/lib/actions";
import { ROLE_LABEL } from "@/lib/ops";
import type { Role } from "@/lib/types";

const HOME: Record<Role, string> = { owner: "/owner-dashboard", holder: "/dashboard", customer: "/scan", admin: "/admin" };

const MENU: { group: string; items: { href: string; label: string }[] }[] = [
  { group: "Store owner", items: [{ href: "/owner-dashboard", label: "Owner portal" }, { href: "/owner", label: "List a new shop" }] },
  { group: "Token holder", items: [{ href: "/dashboard", label: "Holder portal" }, { href: "/explore", label: "Find a shelf" }] },
  { group: "Customer", items: [{ href: "/scan", label: "Scan a shelf (demo QR)" }, { href: "/orders", label: "My orders & receipts" }, { href: "/support", label: "Help & refunds" }] },
  { group: "Platform", items: [{ href: "/admin", label: "Admin console" }, { href: "/notifications", label: "Notifications" }, { href: "/guide", label: "Demo guide & limits" }] },
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
    <Link href="/guide" data-testid="badge-demo" title="Demo only. Nothing is real, no money moves."
      className="hidden rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground ring-1 ring-amber-300/60 sm:inline-flex">
      Demo · no real money
    </Link>
  );
}

function RoleSwitch() {
  const st = useStore();
  const [, go] = useLocation();
  const unread = st.notifications.filter((n) => n.role === st.role && !n.read).length;
  return (
    <div className="ml-auto flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/50 px-3 py-1.5 text-xs font-semibold text-primary" data-testid="button-role-switch">
          <span className="hidden text-muted-foreground sm:inline">View as</span> {ROLE_LABEL[st.role]} <ChevronDown className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 rounded-2xl">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Demo view selector — simulation, not a login or permission check.</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={st.role} onValueChange={(v) => { const r = v as Role; actions.setRole(r); go(HOME[r]); }}>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <DropdownMenuRadioItem key={r} value={r} data-testid={`option-role-${r}`}>{ROLE_LABEL[r]}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Link href="/notifications" aria-label={`Notifications, ${unread} unread`} data-testid="link-notifications"
        className="relative rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground">
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground" data-testid="badge-unread">{unread}</span>}
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Menu" data-testid="button-menu">
          <Menu className="h-5 w-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60 rounded-2xl">
          {MENU.map((g, gi) => (
            <div key={g.group}>
              {gi > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">{g.group}</DropdownMenuLabel>
              {g.items.map((i) => (
                <DropdownMenuItem key={i.href} onSelect={() => go(i.href)} data-testid={`menu-${i.href.slice(1)}`}>{i.label}</DropdownMenuItem>
              ))}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function Shell({ children, title, back, wide }: { children: ReactNode; title: string; back?: string; wide?: boolean }) {
  const [loc] = useLocation();
  useEffect(() => { document.title = `${title} · InRaf shelf-rental demo`; }, [title]);
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Logo />
          <DemoBadge />
          <RoleSwitch />
        </div>
      </header>
      <motion.main key={loc} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className={`mx-auto ${wide ? "max-w-6xl" : "max-w-6xl"} px-4 pb-24 pt-6`}>
        {back && (
          <Link href={back} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        )}
        {children}
      </motion.main>
      <footer className="border-t border-border/60 px-4 py-6 text-center text-xs text-muted-foreground">
        Browser-only demo. Amounts in demo USD; tax and fees are illustrative, not advice for any jurisdiction. No real payments, signatures, identity checks, email or SMS.{" "}
        <Link href="/guide" className="underline" data-testid="link-footer-guide">Read the demo guide</Link>
      </footer>
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

export function PageTitle({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <h1 className="font-display text-4xl font-bold md:text-5xl">{title}</h1>
      {sub && <p className="max-w-xl text-muted-foreground">{sub}</p>}
      {children}
    </div>
  );
}
