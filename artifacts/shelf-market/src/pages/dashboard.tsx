import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Shell, PageTitle, PrimaryButton } from "@/components/shell";
import { ShelfArt } from "@/components/shelf-art";
import { Card, Empty, ErrorNote, Pill, SmallButton, Stat, Tabs } from "@/components/kit";
import { useStore, usd } from "@/lib/store";
import { actions } from "@/lib/actions";
import { useAct } from "@/hooks/use-act";
import { YOU_HOLDER, holderOf } from "@/lib/ops";
import { contractOfToken, contractStatus, expiresSoon, holderMoney, invoiceStatus, isExpired, isLowStock, lateFeeFor, shelfBlockReason, shelfLabel } from "@/lib/selectors";
import { daysUntil, fmtDate, fmtTime, round2 } from "@/lib/util";

const STAGE: Record<string, string> = { A: "Token A · empty", requested: "Products awaiting owner", approved: "Approved · put on sale", rejected: "Product rejected", B: "Token B · stocked" };

export default function Dashboard() {
  const st = useStore();
  const [, go] = useLocation();
  const search = useSearch();
  const [tab, setTab] = useState(new URLSearchParams(search).get("tab") ?? "shelves");
  const { act, error, pending } = useAct();
  const me = holderOf(st, YOU_HOLDER);
  const tokens = st.tokens.filter((t) => t.holderId === YOU_HOLDER);
  const myContracts = st.contracts.filter((c) => c.holderId === YOU_HOLDER);
  const orders = st.orders.filter((o) => o.holderId === YOU_HOLDER).slice().reverse();
  const listings = st.listings.filter((l) => l.holderId === YOU_HOLDER && l.status !== "removed");
  const invoices = st.invoices.filter((i) => myContracts.some((c) => c.id === i.contractId));
  const money = holderMoney(st, YOU_HOLDER);

  const alerts: { text: string; href: string }[] = [
    ...listings.filter(isLowStock).map((l) => ({ text: `Low stock: ${l.name} (${l.available} left)`, href: `/shelf/${l.tokenId}` })),
    ...listings.filter((l) => l.status === "active" && l.available === 0).map((l) => ({ text: `Sold out: ${l.name}`, href: `/shelf/${l.tokenId}` })),
    ...listings.filter((l) => expiresSoon(l) || (isExpired(l) && l.available > 0)).map((l) => ({ text: `${isExpired(l) ? "Expired" : "Expiring"}: ${l.name} (${fmtDate(l.expiry)})`, href: `/shelf/${l.tokenId}` })),
    ...invoices.filter((i) => invoiceStatus(i) === "overdue").map((i) => ({ text: `Overdue rent: ${i.label} (${usd(i.total)})`, href: `/contracts/${i.contractId}` })),
    ...myContracts.filter((c) => contractStatus(c) === "active").flatMap((c) => { const end = c.versions.find((v) => v.status === "executed")!.snapshot.terms.end; return daysUntil(end) <= 30 ? [{ text: `${c.ref} ends ${fmtDate(end)} — renew?`, href: `/contracts/${c.id}` }] : []; }),
    ...myContracts.filter((c) => contractStatus(c) === "awaiting").map((c) => ({ text: `${c.ref} awaiting approval/signatures`, href: `/contracts/${c.id}` })),
  ];

  const sales = round2(orders.filter((o) => o.payment === "captured").reduce((a, o) => a + o.subtotal, 0));
  const commission = round2(orders.filter((o) => o.payment === "captured").reduce((a, o) => a + o.commission, 0));
  const legacy = round2(listings.reduce((a, l) => a + (l.legacyRevenue ?? 0), 0));
  const stockCost = round2(listings.reduce((a, l) => a + l.cost * l.initialQty, 0));
  const profit = round2(sales - commission + legacy - money.rentPaid - stockCost);
  const due = round2(invoices.filter((i) => ["due", "overdue"].includes(invoiceStatus(i))).reduce((a, i) => a + i.total + lateFeeFor(st, i), 0));

  return (
    <Shell title="Holder portal" back="/">
      <PageTitle title="My shelves" sub={`${me.name} · token-holder view`}>
        <Tabs value={tab} onChange={setTab} options={[{ id: "shelves", label: "Shelves", count: alerts.length }, { id: "contracts", label: "Contracts" }, { id: "orders", label: "Orders" }, { id: "money", label: "Money" }]} />
      </PageTitle>
      <div className="mx-auto mt-6 max-w-4xl"><ErrorNote error={error} /></div>

      {tab === "shelves" && (
        <div className="mx-auto mt-4 max-w-4xl space-y-4">
          {alerts.length > 0 && (
            <Card className="border-accent-foreground/20 bg-accent/40" testId="card-alerts">
              <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Needs attention</p>
              <ul className="mt-2 space-y-1 text-sm">{alerts.map((a, i) => <li key={i}><Link href={a.href} className="underline-offset-2 hover:underline" data-testid={`link-alert-${i}`}>{a.text}</Link></li>)}</ul>
            </Card>
          )}
          {tokens.length === 0 ? (
            <div className="flex flex-col items-center text-center" data-testid="empty-tokens">
              <ShelfArt tiers={2} hue={12} fill={[null, null]} className="w-48" />
              <p className="mt-4 text-muted-foreground">No shelves yet.</p>
              <PrimaryButton className="mt-6" onClick={() => go("/explore")} data-testid="button-explore">Find a shelf</PrimaryButton>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {tokens.map((t, i) => {
                const shop = st.shops.find((s) => s.id === t.shopId);
                const c = contractOfToken(st, t.id);
                const cs = c ? contractStatus(c) : "awaiting";
                const L = st.listings.filter((l) => l.tokenId === t.id && l.status !== "removed");
                const left = L.reduce((a, l) => a + l.available, 0);
                const block = shelfBlockReason(st, t);
                return (
                  <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="rounded-[1.75rem] border border-border p-5" data-testid={`card-token-${t.id}`}>
                    <div className="flex items-center gap-4">
                      <span className={`grid h-14 w-11 shrink-0 place-items-center rounded-xl font-display text-2xl font-bold ${t.stage === "B" ? "bg-secondary-foreground text-secondary" : "bg-primary text-primary-foreground"}`}>{t.stage === "B" ? "B" : "A"}</span>
                      <div className="min-w-0">
                        <p className="truncate font-display text-lg font-bold">{shop?.name ?? "Shop"}</p>
                        <p className="text-sm text-muted-foreground" data-testid={`status-token-${t.id}`}>{shop ? shelfLabel(shop, t.slot) : ""} · {t.released ? "Released" : STAGE[t.stage]}</p>
                      </div>
                      <div className="ml-auto"><Pill>{t.released ? "terminated" : cs}</Pill></div>
                    </div>
                    <ShelfArt tiers={1} hue={shop?.hue ?? 12} fill={[L.find((l) => l.status === "active" && l.available > 0)?.color ?? null]} className="mt-3 h-16 w-full" />
                    <p className="mt-2 text-sm text-muted-foreground">{L.length} product{L.length === 1 ? "" : "s"} · {left} units on shelf</p>
                    {block && <p className="mt-1 text-xs text-destructive">{block}</p>}
                    <div className="mt-4 flex gap-2">
                      {cs === "active" && !t.released
                        ? <Link href={`/shelf/${t.id}`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-foreground py-2.5 text-sm font-semibold text-background" data-testid={`link-shelf-${t.id}`}>Manage shelf <ArrowRight className="h-4 w-4" /></Link>
                        : c && <Link href={`/contracts/${c.id}`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-border py-2.5 text-sm font-medium" data-testid={`link-contract-${t.id}`}>Open contract <ArrowRight className="h-4 w-4" /></Link>}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "contracts" && (
        <div className="mx-auto mt-4 max-w-3xl space-y-3">
          {myContracts.length === 0 && <Empty title="No contracts" text="Request a shelf to create one." />}
          {myContracts.map((c) => {
            const shop = st.shops.find((s) => s.id === c.shopId);
            const v = c.versions[c.versions.length - 1];
            return (
              <Link key={c.id} href={`/contracts/${c.id}`} className="flex items-center gap-3 rounded-3xl border border-border p-4 hover:border-primary/40" data-testid={`link-contract-${c.id}`}>
                <div className="min-w-0 flex-1"><p className="font-medium">{c.ref} · {shop?.name}</p><p className="text-xs text-muted-foreground">v{v.v} {v.kind} · {fmtDate(v.snapshot.terms.start)} → {fmtDate(v.snapshot.terms.end)}</p></div>
                <Pill>{contractStatus(c)}</Pill>
              </Link>
            );
          })}
        </div>
      )}

      {tab === "orders" && (
        <div className="mx-auto mt-4 max-w-4xl space-y-2">
          {orders.length === 0 && <Empty title="No customer orders yet" text="Orders appear here when someone buys from your shelf's QR catalog." />}
          {orders.map((o) => (
            <Card key={o.id} className="flex flex-wrap items-center gap-3 py-3" testId={`row-order-${o.id}`}>
              <div className="min-w-0 flex-1"><p className="font-medium">{o.qty} × {o.productName}</p><p className="text-xs text-muted-foreground">{o.ref} · {fmtTime(o.createdAt)} · {o.customerLabel}</p></div>
              <span className="text-sm tabular-nums">net {usd(o.net)}</span>
              <Pill>{o.payment}</Pill>
              {o.payout !== "none" && <Pill tone={o.payout === "settled" ? "good" : o.payout === "reversed" || o.payout === "failed" ? "bad" : "warn"}>payout {o.payout}</Pill>}
              {o.refund?.status === "requested" && <Pill tone="warn">refund requested</Pill>}
              {(o.payout === "pending" || o.payout === "failed") && o.payment === "captured" && <SmallButton disabled={pending} onClick={() => act(() => actions.requestPayout(o.id, "holder"), "Payout sent to simulated provider")} testId={`button-payout-${o.id}`}>{o.payout === "failed" ? "Retry payout" : "Request payout"}</SmallButton>}
            </Card>
          ))}
        </div>
      )}

      {tab === "money" && (
        <div className="mx-auto mt-4 max-w-4xl space-y-6">
          <div className="rounded-[2rem] border border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">Simulated profit</p>
            <p className={`font-display text-6xl font-bold tabular-nums ${profit >= 0 ? "text-secondary-foreground" : "text-primary"}`} data-testid="text-profit">{usd(profit)}</p>
            <p className="mt-2 text-xs text-muted-foreground">Sales {usd(sales)} − commission {usd(commission)}{legacy ? ` + earlier demo sales ${usd(legacy)}` : ""} − rent paid {usd(money.rentPaid)} − stock cost {usd(stockCost)}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Payable to you" value={usd(money.payable)} sub="from ledger, after refunds" testId="text-payable" />
            <Stat label="Pending payout" value={usd(money.pending)} sub="captured, not sent" />
            <Stat label="Processing" value={usd(money.processing)} sub="awaiting provider" />
            <Stat label="Settled" value={usd(money.settled)} sub="provider confirmed (simulated)" testId="text-settled" />
          </div>
          {money.recovery > 0 && <p className="text-center text-sm text-destructive">Refunds after settlement: {usd(money.recovery)} owed back (offset against future payouts).</p>}
          <Card>
            <p className="font-display text-lg font-bold">Rent obligations</p>
            <p className="text-sm text-muted-foreground">Outstanding (incl. illustrative late fees): <b className="tabular-nums" data-testid="text-rent-due">{usd(due)}</b></p>
            <ul className="mt-3 divide-y divide-border text-sm">
              {invoices.filter((i) => invoiceStatus(i) !== "void").sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-2 py-2"><span className="flex-1">{i.label} · due {fmtDate(i.dueDate)}</span><span className="tabular-nums">{usd(i.total)}</span><Pill>{invoiceStatus(i)}</Pill>
                  {invoiceStatus(i) !== "paid" && <SmallButton tone="solid" disabled={pending} onClick={() => act(() => actions.payInvoice(i.id), "Rent payment simulated")} testId={`button-pay-${i.id}`}>Pay (simulated)</SmallButton>}
                </li>
              ))}
            </ul>
          </Card>
          <p className="text-center text-xs text-muted-foreground">Settlement only shows “settled” after a simulated provider confirmation in the admin console. Nothing is paid automatically. No bank details are collected in this demo.</p>
        </div>
      )}
    </Shell>
  );
}
