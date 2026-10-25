import { type ReactNode, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

export function Card({ children, className = "", testId }: { children: ReactNode; className?: string; testId?: string }) {
  return <div data-testid={testId} className={`rounded-[1.75rem] border border-border bg-background p-5 ${className}`}>{children}</div>;
}

const TONES: Record<string, string> = {
  good: "bg-secondary text-secondary-foreground",
  warn: "bg-accent text-accent-foreground",
  bad: "bg-destructive/10 text-destructive",
  info: "bg-primary/10 text-primary",
  mute: "bg-muted text-muted-foreground",
};
export type Tone = keyof typeof TONES;

export const toneFor = (status: string): Tone => {
  if (["active", "approved", "captured", "settled", "paid", "executed", "live", "ok"].includes(status)) return "good";
  if (["awaiting", "pending", "requested", "processing", "due", "authorized", "expiring", "low"].includes(status)) return "warn";
  if (["failed", "overdue", "rejected", "suspended", "terminated", "expired", "void", "refunded", "removed", "sold out", "blocked"].includes(status)) return "bad";
  return "mute";
};

export function Pill({ children, tone, testId }: { children: ReactNode; tone?: Tone; testId?: string }) {
  const t = tone ?? toneFor(String(children).toLowerCase());
  return <span data-testid={testId} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[t]}`}>{children}</span>;
}

export function Stat({ label, value, sub, testId }: { label: string; value: ReactNode; sub?: string; testId?: string }) {
  return (
    <div className="rounded-3xl border border-border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display mt-1 text-2xl font-bold tabular-nums" data-testid={testId}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function ErrorNote({ error, onClose }: { error: string | null; onClose?: () => void }) {
  if (!error) return null;
  return (
    <div role="alert" data-testid="text-error" className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="flex-1">{error}</span>
      {onClose && <button onClick={onClose} aria-label="Dismiss" data-testid="button-dismiss-error"><X className="h-4 w-4" /></button>}
    </div>
  );
}

export function Notice({ children, tone = "warn", testId }: { children: ReactNode; tone?: Tone; testId?: string }) {
  return <div data-testid={testId} className={`rounded-2xl px-4 py-3 text-sm ${TONES[tone]}`}>{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const inputCls = "w-full rounded-2xl border border-input bg-background px-4 py-2.5 text-base outline-none transition focus:border-primary focus:ring-4 focus:ring-ring/20";

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/20 p-4 backdrop-blur-sm" role="dialog" aria-modal aria-label={title}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <motion.div initial={{ y: 24, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 12, opacity: 0 }}
            className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-[2rem] bg-background p-6 shadow-2xl md:p-8`}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="font-display text-2xl font-bold">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-muted" data-testid="button-close-modal"><X className="h-4 w-4" /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[1.75rem] border border-dashed border-border px-6 py-12 text-center" data-testid="empty-state">
      <div className="mb-3 flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="h-10 w-3 rounded-full bg-muted" style={{ opacity: 1 - i * 0.25 }} />)}</div>
      <p className="font-display text-xl font-bold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ProductImage({ color, url, name, className = "h-16 w-16" }: { color: string; url?: string; name: string; className?: string }) {
  if (url) return <img src={url} alt={name} className={`${className} rounded-2xl object-cover`} referrerPolicy="no-referrer" />;
  return (
    <div className={`${className} relative grid place-items-center overflow-hidden rounded-2xl`} style={{ background: `${color}22` }} aria-label={name} role="img">
      <div className="h-3/5 w-2/5 rounded-xl shadow-inner" style={{ background: color }} />
      <div className="absolute bottom-[18%] h-[6%] w-3/5 rounded-full" style={{ background: `${color}55` }} />
    </div>
  );
}

export function Tabs({ value, options, onChange }: { value: string; options: { id: string; label: string; count?: number }[]; onChange: (v: string) => void }) {
  return (
    <div role="tablist" className="flex min-w-0 max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1">
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)} data-testid={`tab-${o.id}`}
          className={`relative shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${value === o.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          {value === o.id && <motion.span layoutId="kit-tab" className="absolute inset-0 rounded-full bg-background shadow-sm" />}
          <span className="relative">{o.label}{o.count ? <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{o.count}</span> : null}</span>
        </button>
      ))}
    </div>
  );
}

export function SmallButton({ children, onClick, disabled, testId, tone = "outline", title }: { children: ReactNode; onClick: () => void; disabled?: boolean; testId?: string; tone?: "outline" | "solid" | "danger"; title?: string }) {
  const cls = tone === "solid" ? "bg-foreground text-background hover:opacity-90" : tone === "danger" ? "border border-destructive/40 text-destructive hover:bg-destructive/5" : "border border-border hover:bg-muted";
  return (
    <button type="button" onClick={onClick} disabled={disabled} data-testid={testId} title={title}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-40 ${cls}`}>
      {children}
    </button>
  );
}

export function DemoFootnote({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-center text-xs text-muted-foreground">{children}</p>;
}
