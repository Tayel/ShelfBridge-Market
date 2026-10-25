import { useState } from "react";
import { Link, useParams } from "wouter";
import { Printer } from "lucide-react";
import { Shell, PageTitle, PrimaryButton } from "@/components/shell";
import { Card, Empty, ErrorNote, Field, Pill, SmallButton, inputCls } from "@/components/kit";
import { useStore, usd } from "@/lib/store";
import { actions } from "@/lib/actions";
import { useAct } from "@/hooks/use-act";
import { shelfLabel } from "@/lib/selectors";
import { fmtTime } from "@/lib/util";

export function OrdersList() {
  const st = useStore();
  const orders = st.orders.slice().reverse();
  return (
    <Shell title="My orders">
      <PageTitle title="My orders" sub="Every order placed in this browser. On a shared demo device, that's everyone's." />
      <div className="mx-auto mt-8 max-w-2xl space-y-3">
        {orders.length === 0 && <Empty title="No orders yet" text="Scan a demo shelf to buy something." action={<Link href="/scan" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground" data-testid="link-scan">Scan a shelf</Link>} />}
        {orders.map((o) => (
          <Link key={o.id} href={`/orders/${o.id}`} className="flex items-center gap-3 rounded-3xl border border-border p-4 transition hover:border-primary/40" data-testid={`link-order-${o.id}`}>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{o.qty} × {o.productName}</p>
              <p className="text-xs text-muted-foreground">{o.ref} · {fmtTime(o.createdAt)}</p>
            </div>
            <span className="tabular-nums">{usd(o.gross)}</span>
            <Pill>{o.payment}</Pill>
            {o.refund?.status === "requested" && <Pill tone="warn">refund requested</Pill>}
          </Link>
        ))}
      </div>
    </Shell>
  );
}

export function Receipt() {
  const { id } = useParams<{ id: string }>();
  const st = useStore();
  const { act, error, pending } = useAct();
  const [reason, setReason] = useState("");
  const o = st.orders.find((x) => x.id === id);
  if (!o) return <Shell title="Order not found" back="/orders"><p className="mt-20 text-center text-muted-foreground">No order with that ID in this browser.</p></Shell>;
  const shop = st.shops.find((s) => s.id === o.shopId);
  const token = st.tokens.find((t) => t.id === o.tokenId);
  const steps: [string, string | undefined][] = [["Created", o.createdAt], ["Authorized", o.authorizedAt], ["Captured", o.capturedAt], ["Failed", o.failedAt], ["Cancelled", o.cancelledAt], ["Refund requested", o.refund?.requestedAt], ["Refunded", o.refundedAt]];

  return (
    <Shell title={`Receipt ${o.ref}`} back="/orders">
      <div className="mx-auto max-w-md">
        <Card testId="card-receipt">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Demo receipt</p>
              <p className="font-display text-2xl font-bold" data-testid="text-order-ref">{o.ref}</p>
            </div>
            <Pill testId="status-payment">{o.payment}</Pill>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{shop?.name} · {shop && token ? shelfLabel(shop, token.slot) : ""} · {o.customerLabel}</p>
          <dl className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt>{o.qty} × {o.productName} <span className="text-muted-foreground">({o.sku})</span></dt><dd className="tabular-nums">{usd(o.subtotal)}</dd></div>
            <div className="flex justify-between text-muted-foreground"><dt>Tax {o.taxRate}% (illustrative)</dt><dd className="tabular-nums">{usd(o.tax)}</dd></div>
            <div className="flex justify-between text-muted-foreground"><dt>Service fee</dt><dd className="tabular-nums">{usd(o.serviceFee)}</dd></div>
            <div className="flex justify-between border-t border-border pt-2 font-display text-lg font-bold"><dt>Total</dt><dd className="tabular-nums">{usd(o.gross)}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">Simulation reference {o.simRef}. Not a provider transaction ID. No money moved.</p>
          <ol className="mt-4 space-y-1 border-t border-border pt-3 text-xs">
            {steps.filter(([, at]) => at).map(([k, at]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="text-muted-foreground">{fmtTime(at)}</span></li>)}
          </ol>
          <SmallButton onClick={() => window.print()} testId="button-print"><Printer className="h-3.5 w-3.5" />Print</SmallButton>
        </Card>

        <div className="mt-4 space-y-3">
          <ErrorNote error={error} />
          {o.payment === "authorized" && (
            <Card>
              <p className="font-medium">This payment is authorized but not captured.</p>
              <div className="mt-3 flex gap-2">
                <SmallButton tone="solid" disabled={pending} onClick={() => act(() => actions.capture(o.id), "Captured (simulated)")} testId="button-capture">Simulate capture</SmallButton>
                <SmallButton disabled={pending} onClick={() => act(() => actions.cancelAuthorization(o.id), "Cancelled")} testId="button-cancel">Cancel</SmallButton>
              </div>
            </Card>
          )}
          {o.payment === "captured" && !o.refund && (
            <Card>
              <p className="font-display text-lg font-bold">Request a refund or return</p>
              <p className="text-sm text-muted-foreground">A platform admin reviews it (simulated). Approved refunds are full refunds, once.</p>
              <div className="mt-3"><Field label="Reason"><input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} placeholder="e.g. jar arrived cracked" data-testid="input-refund-reason" /></Field></div>
              <PrimaryButton className="mt-4 w-full" disabled={pending} onClick={() => act(() => actions.requestRefund(o.id, reason), "Refund requested")} data-testid="button-request-refund">Request refund</PrimaryButton>
            </Card>
          )}
          {o.refund && (
            <Card testId="card-refund-status">
              <p className="font-medium">Refund: <Pill>{o.refund.status}</Pill></p>
              <p className="mt-1 text-sm text-muted-foreground">“{o.refund.reason}”{o.refund.note ? ` — ${o.refund.note}` : ""}</p>
              {o.refund.status === "requested" && <p className="mt-2 text-xs text-muted-foreground">Waiting for admin review. <Link href="/admin?tab=finance" className="underline" data-testid="link-admin-review">Open admin console (simulation)</Link></p>}
            </Card>
          )}
          <p className="text-center text-xs text-muted-foreground"><Link href="/support" className="underline" data-testid="link-support">Help & support</Link></p>
        </div>
      </div>
    </Shell>
  );
}
