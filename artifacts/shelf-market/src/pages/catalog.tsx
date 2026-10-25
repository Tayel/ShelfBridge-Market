import { useState } from "react";
import { Link, useParams } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, CreditCard, Minus, Plus, Smartphone, X } from "lucide-react";
import { Shell, PrimaryButton, GhostButton } from "@/components/shell";
import { Card, Empty, ErrorNote, Notice, ProductImage } from "@/components/kit";
import { useStore, usd } from "@/lib/store";
import { actions } from "@/lib/actions";
import { useAct } from "@/hooks/use-act";
import { listingBlockReason, reservedQty, shelfBlockReason, shelfLabel } from "@/lib/selectors";
import { CUSTOMER_SERVICE_FEE, categoryLabel, countryName } from "@/lib/data";
import { round2, fmtDate } from "@/lib/util";

type Step = "browse" | "qty" | "review" | "authorized" | "failed" | "done";

export function SameBrowserBanner() {
  return (
    <Notice tone="warn" testId="text-same-browser-warning">
      <span className="inline-flex items-start gap-2"><Smartphone className="mt-0.5 h-4 w-4 shrink-0" /><span><b>Same-browser demo:</b> this catalog reads stock saved in <i>this</i> browser. Scanning on another phone opens the right page but shows that device's own copy — nothing is shared through a server.</span></span>
    </Notice>
  );
}

export default function Catalog() {
  const { tokenId } = useParams<{ tokenId: string }>();
  const st = useStore();
  const { act, error, pending, clearError } = useAct();
  const [step, setStep] = useState<Step>("browse");
  const [pick, setPick] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [decline, setDecline] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  const token = st.tokens.find((t) => t.id === tokenId);
  const shop = st.shops.find((s) => s.id === token?.shopId);
  if (!token || !shop) return (
    <Shell title="Shelf not found" back="/scan">
      <div className="mx-auto max-w-md space-y-4 pt-10 text-center">
        <p className="text-muted-foreground">This QR doesn't match a shelf saved in this browser.</p>
        <SameBrowserBanner />
        <Link href="/scan" className="text-primary underline" data-testid="link-scan">See demo shelves</Link>
      </div>
    </Shell>
  );

  const block = shelfBlockReason(st, token);
  const listings = st.listings.filter((l) => l.tokenId === token.id && l.status === "active");
  const l = listings.find((x) => x.id === pick) ?? st.listings.find((x) => x.id === pick);
  const free = l ? Math.max(0, l.available - reservedQty(st, l.id)) : 0;
  const order = st.orders.find((o) => o.id === orderId);

  const subtotal = l ? round2(l.retail * qty) : 0;
  const tax = l ? round2((subtotal * l.taxRate) / 100) : 0;
  const total = round2(subtotal + tax + CUSTOMER_SERVICE_FEE);

  const authorize = () => {
    if (!l) return;
    const r = act(() => actions.authorize(l.id, qty, decline));
    if (r.ok && r.id) { setOrderId(r.id); setStep(decline ? "failed" : "authorized"); }
  };
  const captureIt = () => { if (!orderId) return; const r = act(() => actions.capture(orderId), "Payment captured (simulated)"); if (r.ok) setStep("done"); else setStep("browse"); };
  const cancel = () => { if (!orderId) return; const r = act(() => actions.cancelAuthorization(orderId), "Cancelled — nothing charged"); if (r.ok) { setStep("browse"); setOrderId(null); } };
  const restart = () => { setStep("browse"); setPick(null); setQty(1); setDecline(false); setOrderId(null); clearError(); };

  return (
    <Shell title={`${shop.name} shelf`}>
      <div className="mx-auto max-w-md">
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{shelfLabel(shop, token.slot)} · {shop.city}, {countryName(shop.country)}</p>
          <h1 className="font-display mt-1 text-3xl font-bold" data-testid="text-catalog-shop">{shop.name}</h1>
        </div>
        <div className="mt-4"><SameBrowserBanner /></div>
        <div className="mt-3"><ErrorNote error={error} onClose={clearError} /></div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="mt-5">
            {step === "browse" && (block ? <Empty title="Not selling right now" text={block} /> : listings.length === 0 ? <Empty title="This shelf is empty" text="Nothing on sale here yet." /> : (
              <div className="space-y-3">
                {listings.map((x) => {
                  const why = listingBlockReason(st, x);
                  return (
                    <button key={x.id} disabled={!!why} onClick={() => { setPick(x.id); setQty(1); setStep("qty"); }} data-testid={`button-product-${x.id}`}
                      className="flex w-full items-center gap-4 rounded-3xl border border-border p-4 text-left transition hover:border-primary/40 active:scale-[.99] disabled:opacity-50">
                      <ProductImage color={x.color} url={x.imageUrl} name={x.name} />
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-lg font-bold">{x.name}</p>
                        <p className="text-xs text-muted-foreground">{categoryLabel(x.category)} · {countryName(x.origin)}{x.expiry ? ` · best before ${fmtDate(x.expiry)}` : ""}</p>
                        <p className="text-xs text-muted-foreground">{why ?? `${x.available - reservedQty(st, x.id)} available`}</p>
                      </div>
                      <span className="font-display text-lg font-bold tabular-nums">{usd(x.retail)}</span>
                    </button>
                  );
                })}
              </div>
            ))}

            {step === "qty" && l && (
              <Card className="text-center">
                <ProductImage color={l.color} url={l.imageUrl} name={l.name} className="mx-auto h-28 w-28" />
                <p className="font-display mt-3 text-2xl font-bold">{l.name}</p>
                <p className="text-sm text-muted-foreground">{l.description}</p>
                <div className="mt-5 flex items-center justify-center gap-4">
                  <button aria-label="Fewer" onClick={() => setQty(Math.max(1, qty - 1))} className="grid h-12 w-12 place-items-center rounded-full border border-border active:scale-90" data-testid="button-qty-dec"><Minus className="h-4 w-4" /></button>
                  <span className="font-display w-16 text-5xl font-bold tabular-nums" data-testid="text-qty">{qty}</span>
                  <button aria-label="More" disabled={qty >= Math.min(free, 20)} onClick={() => setQty(Math.min(free, 20, qty + 1))} className="grid h-12 w-12 place-items-center rounded-full border border-border active:scale-90 disabled:opacity-30" data-testid="button-qty-inc"><Plus className="h-4 w-4" /></button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{free} available</p>
                <div className="mt-6 flex flex-col gap-2">
                  <PrimaryButton disabled={free < 1} onClick={() => setStep("review")} data-testid="button-review">Review · {usd(subtotal)}</PrimaryButton>
                  <GhostButton onClick={() => setStep("browse")} data-testid="button-back-browse"><ArrowLeft className="h-4 w-4" />Back</GhostButton>
                </div>
              </Card>
            )}

            {step === "review" && l && (
              <Card>
                <p className="font-display text-xl font-bold">Review</p>
                <dl className="mt-3 space-y-1.5 text-sm" data-testid="list-totals">
                  <div className="flex justify-between"><dt>{qty} × {l.name}</dt><dd className="tabular-nums">{usd(subtotal)}</dd></div>
                  <div className="flex justify-between text-muted-foreground"><dt>Tax {l.taxRate}% (illustrative)</dt><dd className="tabular-nums">{usd(tax)}</dd></div>
                  <div className="flex justify-between text-muted-foreground"><dt>Platform service fee (disclosed)</dt><dd className="tabular-nums">{usd(CUSTOMER_SERVICE_FEE)}</dd></div>
                  <div className="flex justify-between border-t border-border pt-2 font-display text-lg font-bold"><dt>Total</dt><dd className="tabular-nums" data-testid="text-total">{usd(total)}</dd></div>
                </dl>
                <p className="mt-2 text-xs text-muted-foreground">Sold by the token holder of this shelf, not by {shop.name}. Demo USD.</p>
                <label className="mt-4 flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm"><input type="checkbox" checked={decline} onChange={(e) => setDecline(e.target.checked)} data-testid="checkbox-decline" />Simulate a declined payment</label>
                <div className="mt-5 flex flex-col gap-2">
                  <PrimaryButton disabled={pending} onClick={authorize} data-testid="button-authorize"><CreditCard className="h-4 w-4" />Simulate authorization</PrimaryButton>
                  <GhostButton onClick={() => setStep("qty")} data-testid="button-back-qty">Change quantity</GhostButton>
                </div>
                <p className="mt-3 text-center text-[11px] text-muted-foreground">No card details are collected. No payment provider is contacted.</p>
              </Card>
            )}

            {step === "authorized" && order && (
              <Card className="text-center">
                <p className="text-xs uppercase tracking-wide text-primary">Authorized · not charged yet</p>
                <p className="font-display mt-1 text-3xl font-bold tabular-nums">{usd(order.gross)}</p>
                <p className="mt-2 text-sm text-muted-foreground">{order.qty} unit(s) are held for you. Stock is only deducted when the payment is captured.</p>
                <div className="mt-5 flex flex-col gap-2">
                  <PrimaryButton disabled={pending} onClick={captureIt} data-testid="button-capture"><Check className="h-4 w-4" />Simulate capture</PrimaryButton>
                  <GhostButton disabled={pending} onClick={cancel} data-testid="button-cancel-auth"><X className="h-4 w-4" />Cancel</GhostButton>
                </div>
              </Card>
            )}

            {step === "failed" && order && (
              <Card className="text-center">
                <p className="font-display text-2xl font-bold text-destructive">Payment declined</p>
                <p className="mt-2 text-sm text-muted-foreground">Simulated decline ({order.ref}). Nothing was charged and no stock was held.</p>
                <PrimaryButton className="mt-5" onClick={() => { setDecline(false); setStep("review"); }} data-testid="button-try-again">Try again</PrimaryButton>
              </Card>
            )}

            {step === "done" && order && (
              <Card className="text-center">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-secondary text-secondary-foreground"><Check className="h-8 w-8" /></span>
                <p className="font-display mt-3 text-2xl font-bold">Paid (simulated)</p>
                <p className="mt-1 text-sm text-muted-foreground">{order.ref} · {order.qty} × {order.productName} · {usd(order.gross)}</p>
                <div className="mt-5 flex flex-col gap-2">
                  <Link href={`/orders/${order.id}`} className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground" data-testid="link-receipt">View receipt</Link>
                  <GhostButton onClick={restart} data-testid="button-shop-more">Keep shopping</GhostButton>
                </div>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>
        <p className="mt-6 text-center text-xs text-muted-foreground"><Link href="/support" className="underline" data-testid="link-support">Help, returns & refunds</Link></p>
      </div>
    </Shell>
  );
}
