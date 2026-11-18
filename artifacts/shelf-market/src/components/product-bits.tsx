import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Check } from "lucide-react";
import { PRODUCT_JOURNEY, isProductId, type ProductId } from "@/lib/data";

const base = import.meta.env.BASE_URL;
export const asset = (p: string) => `${base}${p}`;

export type JourneyRole = "owner" | "holder";

/** The product picked earlier in the journey (?product=expiring|flying), or null. */
export function useProduct(): ProductId | null {
  const p = new URLSearchParams(useSearch()).get("product");
  return isProductId(p) ? p : null;
}

/** Host and Find-a-shelf are built per product: without one, send the visitor to choose first. */
export function useRequireProduct(role: JourneyRole): ProductId | null {
  const product = useProduct();
  const [, go] = useLocation();
  useEffect(() => { if (!product) go(`/start?as=${role}`, { replace: true }); }, [product, role, go]);
  return product;
}

/** Where each role goes once the product is understood. */
export const nextStep = (role: JourneyRole, p: ProductId) => (role === "owner" ? `/host?product=${p}` : `/explore?product=${p}`);

/** Choose → Understand → Apply. */
export function JourneySteps({ at }: { at: 1 | 2 | 3 }) {
  const steps = ["Choose a product", "See how it works", "Apply"];
  return (
    <ol className="mx-auto flex max-w-xl items-center justify-center gap-2 text-xs sm:text-sm" aria-label="Your progress">
      {steps.map((s, i) => {
        const n = i + 1, done = n < at, now = n === at;
        return (
          <li key={s} className="flex items-center gap-2" aria-current={now ? "step" : undefined}>
            {i > 0 && <span className={`h-px w-5 sm:w-10 ${done || now ? "bg-primary" : "bg-border"}`} aria-hidden />}
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${done ? "bg-primary text-primary-foreground" : now ? "border-2 border-primary text-primary" : "border border-border text-muted-foreground"}`}>
              {done ? <Check className="h-3.5 w-3.5" /> : n}
            </span>
            <span className={now ? "font-semibold" : "text-muted-foreground"}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Pill toggle between the two products, kept on the same page. */
export function ProductSwitch({ value, onChange }: { value: ProductId; onChange: (p: ProductId) => void }) {
  return (
    <div role="tablist" aria-label="Product" className="inline-flex rounded-full bg-muted p-1 text-sm">
      {(Object.keys(PRODUCT_JOURNEY) as ProductId[]).map((p) => (
        <button key={p} role="tab" aria-selected={value === p} onClick={() => onChange(p)} data-testid={`switch-product-${p}`}
          className={`rounded-full px-4 py-1.5 font-semibold transition ${value === p ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          {PRODUCT_JOURNEY[p].title}
        </button>
      ))}
    </div>
  );
}

/** The product's four steps and pillars, as text (the explanation image carries the same content as a picture). */
export function HowItWorks({ product, compact }: { product: ProductId; compact?: boolean }) {
  const j = PRODUCT_JOURNEY[product];
  return (
    <section aria-labelledby={`how-${product}`} className={compact ? "" : "mt-16"}>
      <h2 id={`how-${product}`} className="font-display text-center text-3xl font-bold">How {j.title} works</h2>
      <p className="mt-1 text-center text-muted-foreground">{j.motto}</p>
      <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {j.steps.map((s, i) => (
          <li key={s.title} className="rounded-[1.75rem] border border-border bg-card p-5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
            <p className="font-display mt-3 text-lg font-bold">{s.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
          </li>
        ))}
      </ol>
      <ul className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
        {j.pillars.map((p) => <li key={p} className="rounded-full bg-primary/10 px-4 py-1.5 font-medium text-primary">{p}</li>)}
      </ul>
    </section>
  );
}
