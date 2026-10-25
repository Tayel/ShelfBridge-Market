import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { Download } from "lucide-react";
import { Shell, PageTitle } from "@/components/shell";
import { Card, Empty, ErrorNote, Notice, Pill, SmallButton, Stat, Tabs, inputCls } from "@/components/kit";
import { useStore, usd } from "@/lib/store";
import { actions } from "@/lib/actions";
import { useAct } from "@/hooks/use-act";
import { holderOf } from "@/lib/ops";
import {
  awaitingVersion, contractStatus, executedVersion, expiresSoon, holderMoney, invoiceStatus, isLowStock, reconcile, shelfBlockReason, shelfLabel, slotsOf,
} from "@/lib/selectors";
import { countryName } from "@/lib/data";
import { daysUntil, downloadBlob, fmtDate, fmtTime, round2, toCsv } from "@/lib/util";
import type { State } from "@/lib/types";

function Overview({ st }: { st: State }) {
  const m = holderMoney(st);
  const occupied = st.tokens.filter((t) => !t.released).length;
  const total = st.shops.reduce((a, s) => a + slotsOf(s), 0);
  const active = st.contracts.filter((c) => contractStatus(c) === "active");
  const count = (k: string) => st.orders.filter((o) => o.payment === k).length;
  const rentDue = round2(st.invoices.filter((i) => ["due", "overdue"].includes(invoiceStatus(i))).reduce((a, i) => a + i.total, 0));
  const overdue = st.invoices.filter((i) => invoiceStatus(i) === "overdue");
  const low = st.listings.filter(isLowStock);
  const exp = st.listings.filter((l) => l.status === "active" && expiresSoon(l));
  const ending = active.filter((c) => daysUntil(executedVersion(c)!.snapshot.terms.end) <= 30);
  const holders = new Set(st.tokens.filter((t) => !t.released).map((t) => t.holderId));
  const owners = new Set(st.shops.filter((s) => s.status === "approved").map((s) => s.ownerName));
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Stores" value={st.shops.length} sub={`${st.shops.filter((s) => s.status === "pending").length} pending · ${st.shops.filter((s) => s.status === "suspended").length} suspended`} testId="text-stat-stores" />
        <Stat label="Active owners / holders" value={`${owners.size} / ${holders.size}`} />
        <Stat label="Shelf occupancy" value={`${occupied}/${total}`} sub={`${total ? ((occupied / total) * 100).toFixed(1) : 0}%`} />
        <Stat label="Active contracts" value={active.length} sub={`${st.contracts.filter((c) => contractStatus(c) === "awaiting").length} awaiting`} />
        <Stat label="Listed products" value={st.listings.filter((l) => l.status !== "removed").length} sub={`${st.listings.filter((l) => l.status === "active").length} on sale · ${st.listings.reduce((a, l) => a + (l.status === "active" ? l.available : 0), 0)} units`} />
        <Stat label="GMV (captured, net of refunds)" value={usd(m.gross)} testId="text-stat-gmv" />
        <Stat label="Platform revenue" value={usd(m.fees)} sub="commission + service fees" />
        <Stat label="Payable to holders" value={usd(round2(m.payable - m.settled))} sub={`${usd(m.settled)} settled`} />
        <Stat label="Rent due to owners" value={usd(rentDue)} sub={`${overdue.length} overdue invoices`} />
        <Stat label="Transactions" value={st.orders.length} sub={`${count("captured")} captured · ${count("authorized")} pending · ${count("failed")} failed · ${count("refunded")} refunded`} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><p className="font-display font-bold">Low stock</p><ul className="mt-2 text-sm">{low.length === 0 ? <li className="text-muted-foreground">None</li> : low.map((l) => <li key={l.id}><Link href={`/shelf/${l.tokenId}`} className="underline" data-testid={`link-low-${l.id}`}>{l.name} — {l.available} left</Link></li>)}</ul></Card>
        <Card><p className="font-display font-bold">Expiring batches (30 days)</p><ul className="mt-2 text-sm">{exp.length === 0 ? <li className="text-muted-foreground">None</li> : exp.map((l) => <li key={l.id}>{l.name} — {fmtDate(l.expiry)}</li>)}</ul></Card>
        <Card><p className="font-display font-bold">Overdue rent</p><ul className="mt-2 text-sm">{overdue.length === 0 ? <li className="text-muted-foreground">None</li> : overdue.map((i) => <li key={i.id}><Link href={`/contracts/${i.contractId}`} className="underline" data-testid={`link-overdue-${i.id}`}>{i.ref} · {i.label} · {usd(i.total)}</Link></li>)}</ul></Card>
        <Card><p className="font-display font-bold">Contracts ending (30 days)</p><ul className="mt-2 text-sm">{ending.length === 0 ? <li className="text-muted-foreground">None</li> : ending.map((c) => <li key={c.id}><Link href={`/contracts/${c.id}`} className="underline" data-testid={`link-ending-${c.id}`}>{c.ref} · {fmtDate(executedVersion(c)!.snapshot.terms.end)}</Link></li>)}</ul></Card>
      </div>
    </div>
  );
}

function Finance({ st }: { st: State }) {
  const { act, error, pending } = useAct();
  const [view, setView] = useState("orders");
  const [f, setF] = useState({ from: "", to: "", shop: "", token: "", holder: "", q: "", status: "" });
  const [restock, setRestock] = useState<Record<string, boolean>>({});
  const inRange = (at: string) => (!f.from || at.slice(0, 10) >= f.from) && (!f.to || at.slice(0, 10) <= f.to);
  const orders = useMemo(() => st.orders.filter((o) => inRange(o.createdAt) && (!f.shop || o.shopId === f.shop) && (!f.token || o.tokenId === f.token) && (!f.holder || o.holderId === f.holder)
    && (!f.status || o.payment === f.status || o.payout === f.status || (f.status === "refund-requested" && o.refund?.status === "requested"))
    && (!f.q || `${o.ref} ${o.productName} ${o.sku} ${o.simRef}`.toLowerCase().includes(f.q.toLowerCase()))).reverse(),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [st.orders, f]);
  const ledger = useMemo(() => st.ledger.filter((e) => inRange(e.at) && (!f.shop || e.shopId === f.shop) && (!f.token || e.tokenId === f.token) && (!f.holder || e.holderId === f.holder)
    && (!f.q || `${e.id} ${e.type} ${e.memo} ${st.orders.find((o) => o.id === e.orderId)?.ref ?? ""} ${st.listings.find((l) => l.id === e.listingId)?.sku ?? ""}`.toLowerCase().includes(f.q.toLowerCase()))).reverse(),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [st.ledger, f]);
  const rec = reconcile(st);
  const shopName = (id: string) => st.shops.find((s) => s.id === id)?.name ?? id;
  const tokLabel = (id?: string) => { const t = st.tokens.find((x) => x.id === id); const s = st.shops.find((x) => x.id === t?.shopId); return t && s ? shelfLabel(s, t.slot) : ""; };

  const exportCsv = () => {
    if (view === "ledger") downloadBlob(`inraf-ledger-${Date.now()}.csv`, toCsv(ledger.map((e) => ({ entry: e.id, at: e.at, type: e.type, amount_usd: e.amount, financial: e.financial ? "yes" : "no", order: st.orders.find((o) => o.id === e.orderId)?.ref, invoice: st.invoices.find((i) => i.id === e.invoiceId)?.ref, store: shopName(e.shopId), shelf: tokLabel(e.tokenId), holder: holderOf(st, e.holderId).name, memo: e.memo }))), "text/csv");
    else downloadBlob(`inraf-orders-${Date.now()}.csv`, toCsv(orders.map((o) => ({ order: o.ref, created: o.createdAt, captured: o.capturedAt, settled: o.settledAt, store: shopName(o.shopId), shelf: tokLabel(o.tokenId), holder: holderOf(st, o.holderId).name, product: o.productName, sku: o.sku, qty: o.qty, gross: o.gross, tax: o.tax, fees: round2(o.commission + o.serviceFee), net: o.net, payment: o.payment, payout: o.payout, refund: o.refund?.status, sim_ref: o.simRef, customer: o.customerLabel }))), "text/csv");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={view} onChange={setView} options={[{ id: "orders", label: "Transactions" }, { id: "ledger", label: "Ledger" }, { id: "rec", label: "Reconciliation", count: rec.filter((r) => !r.ok).length }]} />
        {view !== "rec" && <SmallButton onClick={exportCsv} testId="button-export-csv"><Download className="h-4 w-4" />Export CSV</SmallButton>}
      </div>
      {view !== "rec" && (
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
          <input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className={inputCls} aria-label="From date" data-testid="input-from" />
          <input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className={inputCls} aria-label="To date" data-testid="input-to" />
          <select value={f.shop} onChange={(e) => setF({ ...f, shop: e.target.value, token: "" })} className={inputCls} data-testid="select-store"><option value="">All stores</option>{st.shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select value={f.token} onChange={(e) => setF({ ...f, token: e.target.value })} className={inputCls} data-testid="select-shelf"><option value="">All shelves</option>{st.tokens.filter((t) => !f.shop || t.shopId === f.shop).map((t) => <option key={t.id} value={t.id}>{tokLabel(t.id)}</option>)}</select>
          <select value={f.holder} onChange={(e) => setF({ ...f, holder: e.target.value })} className={inputCls} data-testid="select-holder"><option value="">All holders</option>{st.holders.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
          <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={inputCls} data-testid="select-status"><option value="">Any status</option>{["authorized", "captured", "failed", "cancelled", "refunded", "pending", "processing", "settled", "reversed", "refund-requested"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Search ref, product, SKU" className={inputCls} data-testid="input-search" />
        </div>
      )}
      <ErrorNote error={error} />
      {view === "orders" && (orders.length === 0 ? <Empty title="No matching transactions" /> : (
        <div className="space-y-2">
          {orders.map((o) => (
            <Card key={o.id} className="py-3" testId={`row-txn-${o.id}`}>
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{o.ref} · {o.qty} × {o.productName} <span className="text-xs text-muted-foreground">({o.sku})</span></p>
                  <p className="text-xs text-muted-foreground">{shopName(o.shopId)} · {tokLabel(o.tokenId)} · {holderOf(st, o.holderId).name} · {o.customerLabel} · {fmtTime(o.createdAt)} · {o.simRef}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">gross {usd(o.gross)} · tax {usd(o.tax)} · fees {usd(round2(o.commission + o.serviceFee))} · net {usd(o.net)}{o.settledAt ? ` · settled ${fmtTime(o.settledAt)}` : ""}</p>
                </div>
                <Pill>{o.payment}</Pill>
                {o.payout !== "none" && <Pill tone={o.payout === "settled" ? "good" : o.payout === "failed" || o.payout === "reversed" ? "bad" : "warn"}>payout {o.payout}</Pill>}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(o.payout === "pending" || o.payout === "failed") && o.payment === "captured" && <SmallButton disabled={pending} onClick={() => act(() => actions.requestPayout(o.id, "admin"), "Payout initiated (simulated)")} testId={`button-initiate-${o.id}`}>{o.payout === "failed" ? "Retry payout" : "Initiate payout"}</SmallButton>}
                {o.payout === "processing" && <>
                  <SmallButton tone="solid" disabled={pending} onClick={() => act(() => actions.confirmPayout(o.id, true), "Settlement confirmed (simulated provider)")} testId={`button-settle-${o.id}`}>Simulate provider confirmation</SmallButton>
                  <SmallButton tone="danger" disabled={pending} onClick={() => act(() => actions.confirmPayout(o.id, false), "Payout failed (simulated)")} testId={`button-fail-${o.id}`}>Simulate provider failure</SmallButton>
                </>}
                {o.refund?.status === "requested" && <div className="flex w-full flex-wrap items-center gap-2 rounded-2xl bg-accent/50 p-2 text-sm">
                  <span className="flex-1">Refund request: “{o.refund.reason}”</span>
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!!restock[o.id]} onChange={(e) => setRestock({ ...restock, [o.id]: e.target.checked })} data-testid={`checkbox-restock-${o.id}`} />Goods returned & usable — restock</label>
                  <SmallButton tone="solid" disabled={pending} onClick={() => act(() => actions.decideRefund(o.id, true, !!restock[o.id], ""), "Full refund approved")} testId={`button-approve-refund-${o.id}`}>Approve full refund</SmallButton>
                  <SmallButton disabled={pending} onClick={() => act(() => actions.decideRefund(o.id, false, false, window.prompt("Reason shown to customer") ?? ""), "Refund declined")} testId={`button-reject-refund-${o.id}`}>Decline</SmallButton>
                </div>}
              </div>
            </Card>
          ))}
        </div>
      ))}
      {view === "ledger" && (ledger.length === 0 ? <Empty title="No matching ledger entries" /> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-muted/60 text-muted-foreground"><tr><th className="p-2">Entry</th><th className="p-2">Time</th><th className="p-2">Type</th><th className="p-2 text-right">USD</th><th className="p-2">Ref</th><th className="p-2">Store / shelf</th><th className="p-2">Memo</th></tr></thead>
            <tbody>{ledger.map((e) => <tr key={e.id} className="border-t border-border" data-testid={`row-ledger-${e.id}`}><td className="p-2 font-mono">{e.id}</td><td className="p-2">{fmtTime(e.at)}</td><td className="p-2">{e.type}{!e.financial && <span className="text-muted-foreground"> (event)</span>}</td><td className={`p-2 text-right tabular-nums ${e.amount < 0 ? "text-destructive" : ""}`}>{e.amount.toFixed(2)}</td><td className="p-2">{st.orders.find((o) => o.id === e.orderId)?.ref ?? st.invoices.find((i) => i.id === e.invoiceId)?.ref ?? ""}</td><td className="p-2">{shopName(e.shopId)} {tokLabel(e.tokenId)}</td><td className="p-2">{e.memo}</td></tr>)}</tbody>
          </table>
          <p className="p-3 text-xs text-muted-foreground">Append-only: entries are never edited; refunds and reversals add new negative entries.</p>
        </Card>
      ))}
      {view === "rec" && (
        <Card>
          <p className="text-sm text-muted-foreground">Each captured or refunded order is checked against its ledger entries: gross = tax + platform fees + holder net; one settlement max; stock deducted; refunds offset captures.</p>
          <ul className="mt-3 divide-y divide-border text-sm">
            {rec.length === 0 && <li className="py-2 text-muted-foreground">Nothing captured yet.</li>}
            {rec.map((r) => <li key={r.orderId} className="flex items-center gap-2 py-2" data-testid={`row-rec-${r.orderId}`}><span className="w-24 font-mono">{r.orderRef}</span><span className="flex-1">{r.note}</span><Pill tone={r.ok ? "good" : "bad"}>{r.ok ? "ok" : "mismatch"}</Pill></li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}

export default function Admin() {
  const st = useStore();
  const search = useSearch();
  const [tab, setTab] = useState(new URLSearchParams(search).get("tab") ?? "overview");
  const { act, error, pending } = useAct();
  const awaiting = st.contracts.filter((c) => { const v = awaitingVersion(c); return v && !v.adminApproval && !c.terminatedAt; });
  const refunds = st.orders.filter((o) => o.refund?.status === "requested").length;

  return (
    <Shell title="Admin console" back="/">
      <PageTitle title="Admin console" sub="Platform view, derived live from this browser's demo data. Admin actions are simulations, not real permissions.">
        <Tabs value={tab} onChange={setTab} options={[
          { id: "overview", label: "Overview" }, { id: "stores", label: "Stores", count: st.shops.filter((s) => s.status === "pending").length },
          { id: "shelves", label: "Shelves" }, { id: "holders", label: "Holders" }, { id: "contracts", label: "Contracts", count: awaiting.length },
          { id: "finance", label: "Finance", count: refunds }, { id: "audit", label: "Audit" },
        ]} />
      </PageTitle>
      <div className="mx-auto mt-6 max-w-6xl space-y-4">
        <ErrorNote error={error} />
        {tab === "overview" && <Overview st={st} />}

        {tab === "stores" && st.shops.map((s) => (
          <Card key={s.id} className="flex flex-wrap items-center gap-3" testId={`row-store-${s.id}`}>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{s.name} {s.seeded && <span className="text-xs text-muted-foreground">(sample)</span>}{s.legacy && <span className="text-xs text-muted-foreground"> (earlier demo)</span>}</p>
              <p className="text-xs text-muted-foreground">{s.city}, {countryName(s.country)} · {s.registration} · {s.ownerName} · {slotsOf(s)} shelves · {s.shelf.widthCm}×{s.shelf.heightCm}×{s.shelf.depthCm} cm</p>
              {s.statusNote && <p className="text-xs text-muted-foreground">{s.statusNote}</p>}
            </div>
            <Pill testId={`status-store-${s.id}`}>{s.status}</Pill>
            {s.status !== "approved" && <SmallButton tone="solid" disabled={pending} onClick={() => act(() => actions.setShopStatus(s.id, "approved", s.status === "suspended" ? "Reinstated" : "Approved after demo review"), "Store approved")} testId={`button-approve-store-${s.id}`}>{s.status === "suspended" ? "Reinstate" : "Approve"}</SmallButton>}
            {s.status !== "suspended" && <SmallButton tone="danger" disabled={pending} onClick={() => { const n = window.prompt("Suspension reason"); if (n !== null) act(() => actions.setShopStatus(s.id, "suspended", n), "Store suspended"); }} testId={`button-suspend-store-${s.id}`}>Suspend</SmallButton>}
          </Card>
        ))}

        {tab === "shelves" && (st.tokens.length === 0 ? <Empty title="No shelves rented" /> : st.tokens.map((t) => {
          const s = st.shops.find((x) => x.id === t.shopId); if (!s) return null;
          const c = st.contracts.find((x) => x.id === t.contractId);
          const block = shelfBlockReason(st, t);
          return (
            <Card key={t.id} className="flex flex-wrap items-center gap-3" testId={`row-shelf-${t.id}`}>
              <div className="min-w-0 flex-1"><p className="font-medium">{shelfLabel(s, t.slot)} · {s.name}</p><p className="text-xs text-muted-foreground">{holderOf(st, t.holderId).name} · {st.listings.filter((l) => l.tokenId === t.id && l.status === "active").length} live products · {block ?? "selling"}</p></div>
              {c && <Link href={`/contracts/${c.id}`} data-testid={`link-shelf-contract-${t.id}`}><Pill>{c.ref} {contractStatus(c)}</Pill></Link>}
              {!t.released && <SmallButton tone={t.suspended ? "outline" : "danger"} disabled={pending} onClick={() => act(() => actions.setShelfSuspended(t.id, !t.suspended, t.suspended ? "Reinstated" : (window.prompt("Reason") ?? "")), t.suspended ? "Shelf reinstated" : "Shelf suspended")} testId={`button-suspend-shelf-${t.id}`}>{t.suspended ? "Reinstate" : "Suspend"}</SmallButton>}
              <Link href={`/shelf/${t.id}`} className="text-sm underline" data-testid={`link-shelf-${t.id}`}>Open</Link>
            </Card>
          );
        }))}

        {tab === "holders" && (
          <>
            <Notice tone="mute">Demo profiles only. No identity documents or bank details are collected or stored; “verification” is a label, not a check.</Notice>
            {st.holders.map((h) => {
              const m = holderMoney(st, h.id);
              const shelves = st.tokens.filter((t) => t.holderId === h.id && !t.released).length;
              return (
                <Card key={h.id} className="flex flex-wrap items-center gap-3" testId={`row-holder-${h.id}`}>
                  <div className="min-w-0 flex-1"><p className="font-medium">{h.name}</p><p className="text-xs text-muted-foreground">{h.kind} · {countryName(h.country)} · reg. (demo) {h.registration} · bank: not collected in demo</p></div>
                  <span className="text-xs text-muted-foreground">{shelves} shelves · payable {usd(m.payable)} · settled {usd(m.settled)} · rent paid {usd(m.rentPaid)}</span>
                  <Pill tone={h.verification === "demo-reviewed" ? "good" : "mute"}>{h.verification}</Pill>
                </Card>
              );
            })}
          </>
        )}

        {tab === "contracts" && (st.contracts.length === 0 ? <Empty title="No contracts" /> : st.contracts.slice().reverse().map((c) => {
          const v = c.versions[c.versions.length - 1];
          const aw = awaitingVersion(c);
          return (
            <Link key={c.id} href={`/contracts/${c.id}`} className="flex flex-wrap items-center gap-3 rounded-3xl border border-border p-4 hover:border-primary/40" data-testid={`link-admin-contract-${c.id}`}>
              <div className="min-w-0 flex-1"><p className="font-medium">{c.ref} · {v.snapshot.store.name} · {v.snapshot.shelf.label}</p><p className="text-xs text-muted-foreground">{v.snapshot.holder.name} · v{v.v} {v.kind} · {fmtDate(v.snapshot.terms.start)} → {fmtDate(v.snapshot.terms.end)}</p></div>
              {aw && <Pill tone="warn">{!aw.adminApproval ? "needs platform approval" : "awaiting signatures"}</Pill>}
              <Pill>{contractStatus(c)}</Pill>
            </Link>
          );
        }))}

        {tab === "finance" && <Finance st={st} />}

        {tab === "audit" && (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-muted/60 text-muted-foreground"><tr><th className="p-2">Time</th><th className="p-2">Actor</th><th className="p-2">Action</th><th className="p-2">Ref</th><th className="p-2">Detail</th></tr></thead>
              <tbody>{st.audit.slice().reverse().slice(0, 300).map((a) => <tr key={a.id} className="border-t border-border"><td className="p-2">{fmtTime(a.at)}</td><td className="p-2">{a.actor}</td><td className="p-2 font-mono">{a.action}</td><td className="p-2">{a.ref}</td><td className="p-2">{a.detail}</td></tr>)}</tbody>
            </table>
            <div className="p-3"><SmallButton onClick={() => downloadBlob(`inraf-audit-${Date.now()}.csv`, toCsv(st.audit.map((a) => ({ at: a.at, actor: a.actor, action: a.action, ref: a.ref, detail: a.detail }))), "text/csv")} testId="button-export-audit"><Download className="h-4 w-4" />Export audit CSV</SmallButton></div>
          </Card>
        )}
      </div>
    </Shell>
  );
}
