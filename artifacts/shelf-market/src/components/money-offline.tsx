/**
 * Money on the live site while InRaf doesn't move money itself (src/lib/payments.ts): the renter reports paying rent,
 * the store owner confirms receipt, returns the deposit, records till sales and refunds, and pays makers their share.
 * Every step is a record both sides see; nothing here charges a card or touches a bank.
 */
import { useState, type ReactNode } from "react";
import { Banknote, CheckCircle2, Receipt, RotateCcw, ShoppingBag } from "lucide-react";
import { GhostButton, PrimaryButton } from "@/components/shell";
import { ErrorNote, Field, Modal, Pill, SmallButton, inputCls } from "@/components/kit";
import { LIVE, usd } from "@/lib/store";
import { actions } from "@/lib/actions";
import { ONLINE_PAYMENTS, PAYMENT_METHODS, SETTLEMENT_DAYS } from "@/lib/payments";
import { longDate } from "@/lib/agreement";
import { invoiceStatus } from "@/lib/selectors";
import { round2, today } from "@/lib/util";
import type { Listing, Order, RentInvoice, Result, State } from "@/lib/types";

/** True on the live site while payments happen outside InRaf. */
export const OFFLINE = LIVE && !ONLINE_PAYMENTS;
type Act = (fn: () => Result | Promise<Result>, success?: string) => Promise<Result>;

function Dialog({ open, onClose, title, children, onSubmit, submit, pending, error }: { open: boolean; onClose: () => void; title: string; children: ReactNode; onSubmit: () => void; submit: string; pending: boolean; error: string | null }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-3">{children}</div>
      <div className="mt-3"><ErrorNote error={error} /></div>
      <div className="mt-5 flex gap-2"><PrimaryButton className="flex-1" disabled={pending} onClick={onSubmit} data-testid="button-dialog-submit">{submit}</PrimaryButton><GhostButton onClick={onClose}>Cancel</GhostButton></div>
    </Modal>
  );
}
const MethodSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <Field label="How it was paid"><select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} data-testid="select-method">{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
);

function useDialog(act: Act) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<Result>, ok: string) => { const r = await act(fn, ok); if (r.ok) { setOpen(false); setError(null); } else setError(r.error); };
  return { open, setOpen: (o: boolean) => { setOpen(o); setError(null); }, error, run };
}

/** Status line for an invoice paid outside InRaf. */
export function InvoiceNote({ inv }: { inv: RentInvoice }) {
  if (inv.returned) return <span className="block text-xs text-muted-foreground">Returned {usd(inv.returned.amount)} by {inv.returned.method} on {longDate(inv.returned.at)}{inv.returned.deductions ? ` · deductions: ${inv.returned.deductions}` : ""}</span>;
  if (inv.paidAt) return <span className="block text-xs text-muted-foreground">Received {longDate(inv.paidAt)}{inv.method ? ` by ${inv.method}` : ""}{inv.paymentRef ? ` · ref. ${inv.paymentRef}` : ""}{inv.lateFeeWaived ? " · late fee waived" : ""}</span>;
  if (inv.reported) return <span className="block text-xs text-amber-700">Renter reports paying on {longDate(inv.reported.paidOn)} by {inv.reported.method}{inv.reported.reference ? ` (ref. ${inv.reported.reference})` : ""}: waiting for the store to confirm</span>;
  return null;
}

/** The renter tells the store it has paid. */
export function ReportPaid({ inv, act, pending }: { inv: RentInvoice; act: Act; pending: boolean }) {
  const d = useDialog(act);
  const [paidOn, setPaidOn] = useState(today()); const [method, setMethod] = useState<string>(PAYMENT_METHODS[0]); const [reference, setReference] = useState("");
  const st = invoiceStatus(inv);
  if (st === "paid" || st === "void") return null;
  return (
    <>
      <SmallButton tone={inv.reported ? "outline" : "solid"} disabled={pending} onClick={() => d.setOpen(true)} testId={`button-report-paid-${inv.id}`}><Receipt className="h-4 w-4" />{inv.reported ? "Update payment details" : "I've paid"}</SmallButton>
      <Dialog open={d.open} onClose={() => d.setOpen(false)} title={`Tell the store you paid ${inv.ref}`} submit="Send to the store" pending={pending} error={d.error}
        onSubmit={() => void d.run(() => actions.reportInvoicePaid(inv.id, { paidOn, method, reference }), "The store has been told")}>
        <p className="text-sm text-muted-foreground">Pay {usd(inv.total)} directly to the store owner, then tell them here. They confirm when the money arrives and you get a receipt. InRaf doesn't take or hold the money.</p>
        <Field label="Date you paid"><input type="date" max={today()} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={inputCls} data-testid="input-paid-on" /></Field>
        <MethodSelect value={method} onChange={setMethod} />
        <Field label="Reference (optional)" hint="Bank transfer reference, receipt number…"><input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} className={inputCls} data-testid="input-reference" /></Field>
      </Dialog>
    </>
  );
}

/** The store owner confirms it received the money. */
export function ConfirmPaid({ inv, act, pending }: { inv: RentInvoice; act: Act; pending: boolean }) {
  const d = useDialog(act);
  const [method, setMethod] = useState<string>(inv.reported?.method ?? PAYMENT_METHODS[0]); const [reference, setReference] = useState(inv.reported?.reference ?? ""); const [waive, setWaive] = useState(false);
  const st = invoiceStatus(inv);
  if (st === "paid" || st === "void") return null;
  return (
    <>
      <SmallButton tone={inv.reported ? "solid" : "outline"} disabled={pending} onClick={() => { setMethod(inv.reported?.method ?? PAYMENT_METHODS[0]); setReference(inv.reported?.reference ?? ""); d.setOpen(true); }} testId={`button-confirm-paid-${inv.id}`}><CheckCircle2 className="h-4 w-4" />Confirm received</SmallButton>
      <Dialog open={d.open} onClose={() => d.setOpen(false)} title={`Confirm you received ${inv.ref}`} submit="Confirm and send receipt" pending={pending} error={d.error}
        onSubmit={() => void d.run(() => actions.confirmInvoicePaid(inv.id, { method, reference, waiveLateFee: waive }), "Payment confirmed, receipt sent")}>
        <p className="text-sm text-muted-foreground">Only confirm once the money is in your account or hand. The renter gets a receipt. {inv.reported ? `They report paying on ${longDate(inv.reported.paidOn)}; no late fee applies if that was within the grace period.` : ""}</p>
        <MethodSelect value={method} onChange={setMethod} />
        <Field label="Reference (optional)"><input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} className={inputCls} data-testid="input-confirm-reference" /></Field>
        {st === "overdue" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={waive} onChange={(e) => setWaive(e.target.checked)} data-testid="check-waive" />Waive the late fee</label>}
      </Dialog>
    </>
  );
}

/** After the agreement ends, the store returns the deposit (itemising deductions). */
export function ReturnDeposit({ inv, ended, act, pending }: { inv: RentInvoice; ended: boolean; act: Act; pending: boolean }) {
  const d = useDialog(act);
  const [amount, setAmount] = useState(inv.total); const [deductions, setDeductions] = useState(""); const [method, setMethod] = useState<string>(PAYMENT_METHODS[0]); const [reference, setReference] = useState("");
  if (inv.kind !== "deposit" || !inv.paidAt || inv.returned || !ended) return null;
  return (
    <>
      <SmallButton disabled={pending} onClick={() => d.setOpen(true)} testId={`button-return-deposit-${inv.id}`}><RotateCcw className="h-4 w-4" />Return deposit</SmallButton>
      <Dialog open={d.open} onClose={() => d.setOpen(false)} title="Return the security deposit" submit="Record the return" pending={pending} error={d.error}
        onSubmit={() => void d.run(() => actions.returnDeposit(inv.id, { amount, deductions, method, reference }), "Deposit return recorded")}>
        <p className="text-sm text-muted-foreground">Under clause 5 the deposit goes back within 14 days of the end, less only documented deductions for unpaid amounts or damage beyond fair wear and tear. The renter sees what you enter and can dispute it.</p>
        <Field label={`Amount returned (of ${usd(inv.total)})`}><input type="number" min={0} max={inv.total} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={inputCls} data-testid="input-return-amount" /></Field>
        {amount < inv.total && <Field label={`Deductions (${usd(round2(inv.total - amount))})`} hint="Each item, its cost and the evidence (photos or invoices on the shelf's incident)"><textarea rows={3} value={deductions} onChange={(e) => setDeductions(e.target.value)} className={inputCls} data-testid="input-deductions" /></Field>}
        <MethodSelect value={method} onChange={setMethod} />
        <Field label="Reference (optional)"><input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} className={inputCls} /></Field>
      </Dialog>
    </>
  );
}

/** The store records a sale rung up on its own till. */
export function TillSale({ l, act, pending }: { l: Listing; act: Act; pending: boolean }) {
  const [qty, setQty] = useState(1);
  if (l.status !== "active" || l.available < 1) return null;
  return (
    <div className="flex items-center gap-1">
      <input type="number" min={1} max={l.available} value={qty} onChange={(e) => setQty(Math.max(1, Math.round(Number(e.target.value))))} aria-label="Units sold" className="w-14 rounded-xl border border-input bg-background px-2 py-1 text-sm" data-testid={`input-till-qty-${l.id}`} />
      <SmallButton tone="solid" disabled={pending} onClick={async () => { const r = await act(() => actions.recordTillSale(l.id, qty), `${qty} × ${l.name} recorded`); if (r.ok) setQty(1); }} testId={`button-till-sale-${l.id}`}><ShoppingBag className="h-4 w-4" />Sold at till</SmallButton>
    </div>
  );
}

/** The store refunds a till sale. */
export function TillRefund({ o, act, pending }: { o: Order; act: Act; pending: boolean }) {
  const d = useDialog(act);
  const [note, setNote] = useState(""); const [restock, setRestock] = useState(true);
  if (o.channel !== "till" || o.payment !== "captured") return null;
  return (
    <>
      <SmallButton disabled={pending} onClick={() => d.setOpen(true)} testId={`button-till-refund-${o.id}`}>Refund</SmallButton>
      <Dialog open={d.open} onClose={() => d.setOpen(false)} title={`Refund ${o.ref}`} submit="Record the refund" pending={pending} error={d.error}
        onSubmit={() => void d.run(() => actions.recordTillRefund(o.id, restock, note), "Refund recorded")}>
        <p className="text-sm text-muted-foreground">Record a refund you gave at the store. The maker is told; if you already paid them for this sale, the amount is owed back to you.</p>
        <Field label="Reason"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={inputCls} data-testid="input-refund-note" /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />The product is back on the shelf and can be sold again</label>
      </Dialog>
    </>
  );
}

/** What the store owes each maker for till sales, and recording the payment. */
export function MakerSettlements({ st, shopIds, act, pending }: { st: State; shopIds: Set<string>; act: Act; pending: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0]); const [reference, setReference] = useState(""); const [error, setError] = useState<string | null>(null);
  const due = new Map<string, Order[]>();
  st.orders.filter((o) => shopIds.has(o.shopId) && o.channel === "till" && o.payment === "captured" && o.payout === "pending").forEach((o) => due.set(o.tokenId, [...(due.get(o.tokenId) ?? []), o]));
  const rows = [...due.entries()].map(([tokenId, list]) => {
    const t = st.tokens.find((x) => x.id === tokenId); const shop = st.shops.find((x) => x.id === t?.shopId);
    const holder = st.holders.find((h) => h.id === t?.holderId);
    return { tokenId, list, total: round2(list.reduce((a, o) => a + o.net, 0)), label: `${holder?.name ?? "Maker"} · ${shop?.name ?? ""}` };
  });
  const cur = rows.find((r) => r.tokenId === open);
  return (
    <div data-testid="card-settlements">
      <p className="font-display text-lg font-bold">Due to makers</p>
      <p className="text-sm text-muted-foreground">Shoppers pay you at the till. Pay each maker its part (the sale price minus your share) within {SETTLEMENT_DAYS} days after the end of each month, then record it here so the maker sees it.</p>
      {rows.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nothing due right now.</p> : (
        <ul className="mt-3 divide-y divide-border text-sm">
          {rows.map((r) => (
            <li key={r.tokenId} className="flex flex-wrap items-center gap-2 py-2" data-testid={`row-due-${r.tokenId}`}>
              <span className="flex-1">{r.label}<span className="block text-xs text-muted-foreground">{r.list.length} sale(s) since the last payment</span></span>
              <b className="tabular-nums">{usd(r.total)}</b>
              <SmallButton tone="solid" disabled={pending} onClick={() => { setOpen(r.tokenId); setError(null); setReference(""); }} testId={`button-settle-${r.tokenId}`}><Banknote className="h-4 w-4" />Record payment</SmallButton>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!cur} onClose={() => setOpen(null)} title={`Record paying ${cur?.label.split(" · ")[0] ?? "the maker"}`} submit={`Record ${cur ? usd(cur.total) : ""} paid`} pending={pending} error={error}
        onSubmit={async () => { if (!cur) return; const r = await act(() => actions.settleWithMaker(cur.tokenId, { method, reference }), "Payment to maker recorded"); if (r.ok) setOpen(null); else setError(r.error); }}>
        <p className="text-sm text-muted-foreground">Pay the maker first, then record it. They're told straight away and can raise an incident if it doesn't arrive.</p>
        <MethodSelect value={method} onChange={setMethod} />
        <Field label="Reference (optional)"><input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} className={inputCls} data-testid="input-settle-reference" /></Field>
      </Dialog>
    </div>
  );
}

export const OfflinePill = () => <Pill tone="info">Paid outside InRaf</Pill>;
