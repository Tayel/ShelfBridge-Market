import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Clock, FileSignature, Minus, Plus, ShieldAlert, X } from "lucide-react";
import { Shell, PrimaryButton, GhostButton, Tile, StepDots } from "@/components/shell";
import { ShelfArt } from "@/components/shelf-art";
import { ErrorNote } from "@/components/kit";
import { COUNTRIES, PRODUCTS, countryName } from "@/lib/data";
import { runChecks, firstBlocker } from "@/lib/checks";
import { useStore, usd } from "@/lib/store";
import { actions } from "@/lib/actions";
import { useAct } from "@/hooks/use-act";
import { contractOfToken, contractStatus, shelfUnits } from "@/lib/selectors";

/** Guided "Token A → Token B" path using sample products. Creates a listing that the owner approves. */
export default function Stock() {
  const { tokenId } = useParams<{ tokenId: string }>();
  const st = useStore();
  const [, go] = useLocation();
  const token = st.tokens.find((t) => t.id === tokenId);
  const shop = st.shops.find((s) => s.id === token?.shopId);
  const [step, setStep] = useState(0);
  const [origin, setOrigin] = useState("");
  const [pid, setPid] = useState("");
  const [qty, setQty] = useState(12);
  const { act, error, pending } = useAct();

  if (!token || !shop) return (
    <Shell title="Token not found" back="/dashboard">
      <p className="mt-20 text-center text-muted-foreground">No token here. <Link href="/explore" className="text-primary underline">Find a shelf</Link></p>
    </Shell>
  );

  const c = contractOfToken(st, token.id);
  const cs = c ? contractStatus(c) : "awaiting";
  const free = Math.max(0, shop.shelf.capacity - shelfUnits(st, token.id));

  if (cs !== "active" || token.released) return (
    <Shell title="Contract first" back="/dashboard">
      <div className="mx-auto flex max-w-md flex-col items-center pt-8 text-center">
        <span className="grid h-32 w-24 place-items-center rounded-2xl bg-primary font-display text-5xl font-extrabold text-primary-foreground">A</span>
        <h1 className="font-display mt-6 text-4xl font-bold">Contract first</h1>
        <p className="mt-3 text-muted-foreground">Token A at {shop.name} is a shelf-use demo record. It turns into a stocked Token B only after the contract is approved and signed by both sides{token.released ? " — this one has ended" : ""}.</p>
        {c && <PrimaryButton className="mt-8" onClick={() => go(`/contracts/${c.id}`)} data-testid="button-open-contract"><FileSignature className="h-4 w-4" />Open contract ({cs})</PrimaryButton>}
      </div>
    </Shell>
  );

  const product = PRODUCTS.find((p) => p.id === pid);
  const checks = product && origin ? runChecks(product, shop, origin) : [];
  const STEPS = ["Where is it made?", "What goes on the shelf?", "How many?", "Quick checks"];
  const items = PRODUCTS.map((p) => ({ p, c: runChecks(p, shop, origin) })).filter((x) => x.p.origins.includes(origin));

  const submit = () => {
    if (!product) return;
    const r = act(() => actions.createListing(token.id, {
      name: product.name, sku: `${product.id.slice(0, 4).toUpperCase()}-${origin}-${String(Date.now()).slice(-3)}`, category: product.category, description: product.description ?? "",
      color: product.color, origin, retail: product.retail, cost: product.unitCost, taxRate: shop.terms.taxRate, batch: `B-${origin}-${new Date().getFullYear()}`, expiry: product.expiry, initialQty: qty,
    }), "Sent to store owner for approval");
    if (r.ok) go(`/shelf/${token.id}`);
  };

  const body = [
    <div key="0" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {COUNTRIES.map((c) => (
        <Tile key={c.code} selected={origin === c.code} onClick={() => { setOrigin(c.code); setPid(""); setStep(1); }} testId={`tile-origin-${c.code}`}>
          <span className="font-display text-3xl font-bold text-primary/80">{c.code}</span>
          <span className="font-medium">{c.name}</span>
        </Tile>
      ))}
    </div>,
    <div key="1" className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {items.length === 0 && <p className="col-span-full text-center text-muted-foreground">No sample products from {countryName(origin)}.</p>}
      {items.map(({ p, c: ch }) => {
        const block = firstBlocker(ch);
        return (
          <Tile key={p.id} selected={pid === p.id} disabled={!!block} onClick={() => { setPid(p.id); setQty(Math.min(12, free)); setStep(2); }} testId={`tile-product-${p.id}`}>
            <ShelfArt tiers={1} hue={20} fill={[p.color]} className="h-12 w-full" />
            <span className="font-medium">{p.name}</span>
            <span className="text-xs text-muted-foreground">{usd(p.unitCost)} wholesale</span>
            {block && <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground" data-testid={`reason-${p.id}`}><ShieldAlert className="h-3 w-3" />{block.note}</span>}
          </Tile>
        );
      })}
    </div>,
    <div key="2" className="flex flex-col items-center gap-6">
      {product && <ShelfArt tiers={1} hue={20} fill={[product.color]} className="w-56" />}
      <div className="flex items-center gap-4">
        <button aria-label="Fewer" onClick={() => setQty(Math.max(1, qty - 1))} className="grid h-12 w-12 place-items-center rounded-full border border-border active:scale-90" data-testid="button-qty-dec"><Minus className="h-4 w-4" /></button>
        <span className="font-display w-24 text-center text-5xl font-bold tabular-nums" data-testid="text-qty">{qty}</span>
        <button aria-label="More" onClick={() => setQty(Math.min(free, qty + 1))} className="grid h-12 w-12 place-items-center rounded-full border border-border active:scale-90" data-testid="button-qty-inc"><Plus className="h-4 w-4" /></button>
      </div>
      <p className="text-muted-foreground">{product && usd(product.unitCost * qty)} wholesale · {free} units of capacity free</p>
      {product?.expiry && <p className="inline-flex items-center gap-1 text-sm text-muted-foreground"><Clock className="h-4 w-4" />Batch expires {new Date(product.expiry).toLocaleDateString()}</p>}
    </div>,
    <div key="3" className="mx-auto max-w-md">
      <ul className="space-y-2">
        {checks.map((c, i) => (
          <motion.li key={c.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.12 }}
            className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3" data-testid={`check-${c.id}`}>
            <span className={`grid h-7 w-7 place-items-center rounded-full ${c.ok ? "bg-secondary text-secondary-foreground" : "bg-destructive/10 text-destructive"}`}>{c.ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}</span>
            <span className="font-medium">{c.label}</span>
            <span className="ml-auto text-right text-sm text-muted-foreground">{c.note}</span>
          </motion.li>
        ))}
      </ul>
      <p className="mt-4 text-center text-xs text-muted-foreground">Illustrative sample checks. Not legal clearance. No compliance guaranteed.</p>
      <div className="mt-3"><ErrorNote error={error} /></div>
    </div>,
  ][step];

  const valid = step === 3 && checks.length > 0 && checks.every((c) => c.ok) && qty >= 1 && qty <= free;

  return (
    <Shell title="Stock your shelf" back={`/shelf/${token.id}`}>
      <div className="flex flex-col items-center gap-3 text-center">
        <StepDots step={step} total={STEPS.length} />
        <h1 className="font-display text-4xl font-bold md:text-5xl">{STEPS[step]}</h1>
      </div>
      <div className="mt-10">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>{body}</motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-10 flex items-center justify-center gap-3">
        {step > 0 && <GhostButton onClick={() => setStep(step - 1)} data-testid="button-prev"><ArrowLeft className="h-4 w-4" /> Back</GhostButton>}
        {step === 2 && <PrimaryButton disabled={free < 1} onClick={() => setStep(3)} data-testid="button-next">Run checks <ArrowRight className="h-4 w-4" /></PrimaryButton>}
        {step === 3 && <PrimaryButton disabled={!valid || pending} onClick={submit} data-testid="button-request">Request owner approval</PrimaryButton>}
      </div>
    </Shell>
  );
}
