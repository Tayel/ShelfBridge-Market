import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Clock, Hourglass, Minus, Plus, ShieldAlert, X } from "lucide-react";
import { Shell, PrimaryButton, GhostButton, Tile, StepDots } from "@/components/shell";
import { ShelfArt } from "@/components/shelf-art";
import { COUNTRIES, PRODUCTS, SHELF_CAPACITY, countryName } from "@/lib/data";
import { runChecks, firstBlocker } from "@/lib/checks";
import { actions, productOf, useStore, usd } from "@/lib/store";

function TokenChip({ kind }: { kind: "A" | "B" }) {
  return (
    <motion.div initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} transition={{ duration: 0.6 }}
      className={`mx-auto grid h-32 w-24 place-items-center rounded-2xl text-5xl font-extrabold font-display shadow-[0_20px_40px_-18px_rgba(120,60,30,.5)] ${kind === "A" ? "bg-primary text-primary-foreground" : "bg-secondary-foreground text-secondary"}`}
      data-testid={`token-${kind}`}>
      {kind}
    </motion.div>
  );
}

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
  const fresh = typeof window !== "undefined" && window.location.search.includes("new=1");

  if (!token || !shop) return (
    <Shell title="Token not found" back="/dashboard">
      <p className="mt-20 text-center text-muted-foreground">No token here. <Link href="/explore" className="text-primary underline">Find a shelf</Link></p>
    </Shell>
  );

  const product = productOf(token.productId ?? pid);

  if (token.stage !== "A") {
    const p = product!;
    const view = {
      requested: {
        icon: <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-accent"><Hourglass className="h-9 w-9 text-accent-foreground" /></div>,
        title: "Waiting for the owner",
        text: shop.seeded ? "This is a sample shop. You can simulate their answer." : "Approve it yourself from My shop.",
        main: shop.seeded
          ? <PrimaryButton onClick={() => actions.decide(token.id, true)} data-testid="button-simulate-approve">Simulate owner approval</PrimaryButton>
          : <PrimaryButton onClick={() => go("/owner-dashboard")} data-testid="button-go-owner">Open My shop</PrimaryButton>,
        extra: shop.seeded && <GhostButton onClick={() => actions.decide(token.id, false)} data-testid="button-simulate-reject">Simulate rejection</GhostButton>,
      },
      approved: {
        icon: <TokenChip kind="A" />,
        title: "Approved. Stock it.",
        text: `${token.qty} × ${p.name} · ${usd(p.unitCost * (token.qty ?? 0))} wholesale. Simulated purchase, no money charged.`,
        main: <PrimaryButton onClick={() => actions.stock(token.id)} data-testid="button-stock">Simulate stocking purchase</PrimaryButton>,
        extra: null,
      },
      rejected: {
        icon: <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-muted"><X className="h-9 w-9 text-muted-foreground" /></div>,
        title: "Not this time",
        text: "The owner passed on this product. Try another.",
        main: <PrimaryButton onClick={() => { actions.patch(token.id, { stage: "A", productId: undefined, qty: undefined, origin: undefined }); setStep(0); }} data-testid="button-retry">Choose another product</PrimaryButton>,
        extra: null,
      },
      B: {
        icon: <TokenChip kind="B" />,
        title: "Your shelf is stocked",
        text: `${token.qty} × ${p.name} at ${shop.name}. Token A became Token B.`,
        main: <PrimaryButton onClick={() => go("/dashboard")} data-testid="button-dashboard">Go to My shelves</PrimaryButton>,
        extra: null,
      },
    }[token.stage];
    return (
      <Shell title={view.title} back="/dashboard">
        <div className="mx-auto flex max-w-md flex-col items-center pt-8 text-center">
          {view.icon}
          <h1 className="font-display mt-6 text-4xl font-bold" data-testid="text-stage-title">{view.title}</h1>
          <p className="mt-3 text-muted-foreground">{view.text}</p>
          {token.stage === "B" && <ShelfArt tiers={1} hue={shop.hue} fill={[p.color]} className="mt-6 w-56" />}
          <div className="mt-8 flex flex-col items-center gap-2">{view.main}{view.extra}</div>
        </div>
      </Shell>
    );
  }

  const checks = product && origin ? runChecks(product, shop, origin) : [];
  const STEPS = ["Where is it made?", "What goes on the shelf?", "How many?", "Quick checks"];
  const items = PRODUCTS.map((p) => ({ p, c: runChecks(p, shop, origin) })).filter((x) => x.p.origins.includes(origin));

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
      {items.map(({ p, c }) => {
        const block = firstBlocker(c);
        return (
          <Tile key={p.id} selected={pid === p.id} disabled={!!block} onClick={() => { setPid(p.id); setStep(2); }} testId={`tile-product-${p.id}`}>
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
        <button aria-label="More" onClick={() => setQty(Math.min(SHELF_CAPACITY, qty + 1))} className="grid h-12 w-12 place-items-center rounded-full border border-border active:scale-90" data-testid="button-qty-inc"><Plus className="h-4 w-4" /></button>
      </div>
      <p className="text-muted-foreground">{product && usd(product.unitCost * qty)} wholesale · max {SHELF_CAPACITY} per shelf</p>
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
    </div>,
  ][step];

  const valid = [!!origin, !!pid, qty > 0, checks.length > 0 && checks.every((c) => c.ok)][step];

  return (
    <Shell title="Stock your shelf" back="/dashboard">
      {fresh && step === 0 && (
        <div className="mb-6 flex items-center justify-center gap-3 text-sm text-muted-foreground" data-testid="text-token-issued">
          <span className="grid h-8 w-6 place-items-center rounded-md bg-primary font-display font-bold text-primary-foreground">A</span>
          Token A issued for {shop.name}. Simulated, no money charged.
        </div>
      )}
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
        {step === 2 && <PrimaryButton onClick={() => setStep(3)} data-testid="button-next">Run checks <ArrowRight className="h-4 w-4" /></PrimaryButton>}
        {step === 3 && <PrimaryButton disabled={!valid} onClick={() => actions.request(token.id, pid, origin, qty)} data-testid="button-request">Request owner approval</PrimaryButton>}
      </div>
    </Shell>
  );
}
