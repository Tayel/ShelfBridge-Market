import { useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, Boxes, Briefcase, CheckCircle2, ClipboardList, Download, FileText, Heart, Lock, MapPin,
  Package, Receipt, Search, Store as StoreIcon, Truck, UserCircle, Wallet, type LucideIcon,
} from "lucide-react";
import { Shell, PrimaryButton } from "@/components/shell";
import { ShelfArt } from "@/components/shelf-art";
import { Card, Empty, ErrorNote, Pill, ProductImage, SmallButton, Stat } from "@/components/kit";
import { MyOpportunities } from "@/components/my-opportunities";
import { CaseCard, DeliveryCard, NewCase, NewDelivery, caseLabel } from "@/components/store-ops";
import { categoryLabel, countryName } from "@/lib/data";
import { useSession, useStore, usd } from "@/lib/store";
import { actions } from "@/lib/actions";
import { useAct } from "@/hooks/use-act";
import { caseIsOpen, holderOf, offerExpired, offerNeeded } from "@/lib/ops";
import { longDate } from "@/lib/agreement";
import {
  contractOfToken, contractStatus, executedVersion, awaitingVersion, expiresSoon, holderMoney, invoiceStatus, isExpired, isLowStock, lateFeeFor,
  reservedQty, shelfBlockReason, shelfLabel, shelfUnits,
} from "@/lib/selectors";
import { daysUntil, downloadBlob, fmtDate, fmtTime, round2, toCsv, today } from "@/lib/util";
import type { Delivery, Listing, Order, State } from "@/lib/types";

/**
 * The token holder's remote retail office. Every figure is computed from the holder's own records — shelves,
 * contracts, products, stock movements, orders, ledger, invoices, store requests, incidents and deliveries — and
 * links to the record behind it. Where a capability needs something InRaf doesn't have yet (a store's till system,
 * live cameras, real payouts), the page says so instead of showing a number.
 */
type Sec = "business" | "shelves" | "products" | "deliveries" | "sales" | "money" | "contracts" | "requests" | "opportunities" | "reports" | "account";
const NAV: { id: Sec; label: string; icon: LucideIcon }[] = [
  { id: "business", label: "My business", icon: Briefcase }, { id: "shelves", label: "My shelves", icon: StoreIcon }, { id: "products", label: "Products & stock", icon: Package },
  { id: "deliveries", label: "Deliveries", icon: Truck }, { id: "sales", label: "Sales & orders", icon: BarChart3 }, { id: "money", label: "Money & ledger", icon: Wallet },
  { id: "contracts", label: "Contracts", icon: FileText }, { id: "requests", label: "Store requests", icon: ClipboardList }, { id: "opportunities", label: "Retail opportunities", icon: Search },
  { id: "reports", label: "Reports", icon: Download }, { id: "account", label: "My account", icon: UserCircle },
];
const LEGACY: Record<string, Sec> = { shelves: "shelves", contracts: "contracts", orders: "sales", money: "money" };
const paid = (o: Order) => o.payment === "captured";
const day = (o: Order) => (o.capturedAt ?? o.createdAt).slice(0, 10);
const dayOffset = (n: number) => new Date(Date.now() - n * 86400e3).toISOString().slice(0, 10);

export default function Dashboard() {
  const session = useSession();
  const [, go] = useLocation();
  if (session.live && !session.me) {
    return (
      <Shell title="Holder portal" back="/">
        <div className="mx-auto mt-10 max-w-lg rounded-[2rem] border border-border p-8 text-center" data-testid="holder-portal-signin">
          <Lock className="mx-auto h-8 w-8 text-primary" />
          <h1 className="font-display mt-3 text-3xl font-bold">Sign in to see your business</h1>
          <p className="mt-2 text-muted-foreground">Your shelves, products, stock, sales and money are private to your account.</p>
          <PrimaryButton className="mt-6 w-full" onClick={() => go(`/signin?next=${encodeURIComponent("/dashboard")}`)} data-testid="button-holder-signin">Sign in <ArrowRight className="h-4 w-4" /></PrimaryButton>
          <p className="mt-4 text-sm text-muted-foreground">New to InRaf? <Link href="/start?as=holder" className="text-primary underline">Find a shelf</Link></p>
        </div>
      </Shell>
    );
  }
  return <Portal />;
}

function Portal() {
  const st = useStore();
  const session = useSession();
  const search = useSearch();
  const q = new URLSearchParams(search).get("tab") ?? "business";
  const [sec, setSec] = useState<Sec>((LEGACY[q] ?? (NAV.some((n) => n.id === q) ? q : "business")) as Sec);
  const { act, error, pending } = useAct();
  const holderId = session.holderId;
  const me = st.holders.some((h) => h.id === holderId) || !session.me ? holderOf(st, holderId) : { ...holderOf(st, holderId), name: session.me.name || session.me.email };
  const d = useBusiness(st, holderId);
  const meName = me.name;
  const badge: Partial<Record<Sec, number>> = { business: d.attention.length || undefined, requests: d.cases.filter((c) => c.status === "awaiting-verification").length || undefined, deliveries: d.deliveries.filter((x) => x.status === "expected").length || undefined };

  return (
    <Shell title="Holder portal" back="/" wide>
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
        <nav aria-label="Holder portal" className="-mx-4 mb-6 flex gap-1 overflow-x-auto px-4 pb-1 lg:sticky lg:top-24 lg:mx-0 lg:mb-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0" data-testid="holder-nav">
          {NAV.map((n) => (
            <button key={n.id} type="button" onClick={() => { setSec(n.id); window.scrollTo({ top: 0 }); }} aria-current={sec === n.id ? "page" : undefined} data-testid={`nav-${n.id}`}
              className={`flex shrink-0 items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition ${sec === n.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
              <n.icon className="h-4 w-4" />{n.label}{badge[n.id] ? <span className={`ml-auto rounded-full px-1.5 text-[11px] font-bold ${sec === n.id ? "bg-background text-foreground" : "bg-primary text-primary-foreground"}`}>{badge[n.id]}</span> : null}
            </button>
          ))}
        </nav>
        <main className="min-w-0" data-testid={`holder-sec-${sec}`}>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
            <div><p className="text-sm text-muted-foreground">{meName} · token holder</p><h1 className="font-display text-3xl font-bold md:text-4xl">{NAV.find((n) => n.id === sec)?.label}</h1></div>
            <p className="text-xs text-muted-foreground">Figures from your records on InRaf · payments simulated</p>
          </div>
          <ErrorNote error={error} />
          {sec === "business" && <Business st={st} d={d} go={setSec} />}
          {sec === "shelves" && <Shelves st={st} d={d} act={act} pending={pending} go={setSec} />}
          {sec === "products" && <Products st={st} d={d} />}
          {sec === "deliveries" && <Deliveries st={st} d={d} act={act} pending={pending} />}
          {sec === "sales" && <Sales st={st} d={d} act={act} pending={pending} />}
          {sec === "money" && <Money st={st} d={d} act={act} pending={pending} />}
          {sec === "contracts" && <Contracts st={st} d={d} />}
          {sec === "requests" && <Requests st={st} d={d} act={act} pending={pending} meName={meName} />}
          {sec === "opportunities" && <MyOpportunities st={st} holderId={holderId} />}
          {sec === "reports" && <Reports st={st} d={d} />}
          {sec === "account" && <Account st={st} me={me} email={session.me?.email} />}
        </main>
      </div>
    </Shell>
  );
}

// ---------- everything computed once from the holder's records ----------
type Act = ReturnType<typeof useAct>["act"];
function useBusiness(st: State, holderId: string) {
  return useMemo(() => {
    const tokens = st.tokens.filter((t) => t.holderId === holderId);
    const live = tokens.filter((t) => !t.released);
    const contracts = st.contracts.filter((c) => c.holderId === holderId);
    const active = contracts.filter((c) => contractStatus(c) === "active");
    const expiring = active.filter((c) => daysUntil(executedVersion(c)!.snapshot.terms.end) <= 30);
    const pendingSign = contracts.filter((c) => { const v = awaitingVersion(c); return v && !c.terminatedAt && !v.holderSig; });
    const listings = st.listings.filter((l) => l.holderId === holderId && l.status !== "removed");
    const onSale = listings.filter((l) => l.status === "active");
    const low = listings.filter(isLowStock);
    const out = onSale.filter((l) => l.available === 0);
    const expired = listings.filter((l) => isExpired(l) && l.available > 0);
    const orders = st.orders.filter((o) => o.holderId === holderId).slice().sort((a, b) => (b.capturedAt ?? b.createdAt).localeCompare(a.capturedAt ?? a.createdAt));
    const captured = orders.filter(paid);
    const refunded = orders.filter((o) => o.payment === "refunded");
    const money = holderMoney(st, holderId);
    const invoices = st.invoices.filter((i) => contracts.some((c) => c.id === i.contractId) && invoiceStatus(i) !== "void").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const overdue = invoices.filter((i) => invoiceStatus(i) === "overdue");
    const dueNow = invoices.filter((i) => invoiceStatus(i) === "due" && i.dueDate <= today());
    const upcoming = invoices.filter((i) => invoiceStatus(i) === "due" && i.dueDate > today());
    const nextRent = upcoming[0] ?? dueNow[0];
    const owed = round2([...overdue, ...dueNow].reduce((a, i) => a + i.total + lateFeeFor(st, i), 0));
    const cases = st.cases.filter((c) => c.holderId === holderId).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const openTasks = cases.filter((c) => c.kind === "task" && caseIsOpen(c));
    const openIncidents = cases.filter((c) => c.kind === "incident" && caseIsOpen(c));
    const deliveries = st.deliveries.filter((x) => x.holderId === holderId).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const movements = st.movements.filter((m) => m.holderId === holderId);
    const sum = (os: Order[], k: "subtotal" | "commission" | "net" | "qty" | "tax") => round2(os.reduce((a, o) => a + (k === "qty" ? o.qty : o[k]), 0));
    const shopShare = round2(captured.reduce((a, o) => a + (o.shopShare ?? 0), 0));
    const unappliedCounts = cases.filter((c) => c.type === "count" && c.status === "completed" && !c.countAppliedAt && c.count?.some((l) => l.counted !== l.expected));
    const partialDeliveries = deliveries.filter((x) => x.status === "partial");

    const attention: { text: string; go: Sec; href?: string; tone: "warn" | "bad" }[] = [
      ...overdue.map((i) => ({ text: `Rent overdue: ${i.label} (${usd(i.total + lateFeeFor(st, i))})`, go: "money" as Sec, tone: "bad" as const })),
      ...pendingSign.map((c) => { const v = awaitingVersion(c)!; return { text: offerNeeded(v) ? `${c.ref} is waiting for the store owner's formal offer` : !v.adminApproval ? `${c.ref}: offer ${v.offer?.no ?? ""} received, InRaf is reviewing it` : `${c.ref}: accept offer ${v.offer?.no ?? ""} by ${longDate(v.offer?.validUntil)}`, go: "contracts" as Sec, href: `/contracts/${c.id}`, tone: "warn" as const }; }),
      ...cases.filter((c) => c.status === "awaiting-verification").map((c) => ({ text: `${c.ref} (${caseLabel(c)}): the store says it's done — check the evidence`, go: "requests" as Sec, tone: "warn" as const })),
      ...openIncidents.map((c) => ({ text: `Open incident ${c.ref}: ${caseLabel(c)}`, go: "requests" as Sec, tone: "bad" as const })),
      ...expired.map((l) => ({ text: `${l.name} is past its expiry date with ${l.available} on the shelf`, go: "products" as Sec, tone: "bad" as const })),
      ...out.map((l) => ({ text: `Out of stock: ${l.name}`, go: "products" as Sec, tone: "warn" as const })),
      ...low.map((l) => ({ text: `Low stock: ${l.name} (${l.available} left)`, go: "products" as Sec, tone: "warn" as const })),
      ...partialDeliveries.map((x) => ({ text: `${x.ref} arrived with differences`, go: "deliveries" as Sec, tone: "warn" as const })),
      ...unappliedCounts.map((c) => ({ text: `Count ${c.ref} differs from your stock: apply it or report an incident`, go: "requests" as Sec, tone: "warn" as const })),
      ...expiring.map((c) => ({ text: `${c.ref} ends ${fmtDate(executedVersion(c)!.snapshot.terms.end)}: renew?`, go: "contracts" as Sec, href: `/contracts/${c.id}`, tone: "warn" as const })),
      ...live.filter((t) => t.suspended).map((t) => ({ text: `A shelf is suspended by the store or InRaf: sales are blocked`, go: "shelves" as Sec, tone: "bad" as const })),
      ...listings.filter((l) => l.status === "rejected").map((l) => ({ text: `${l.name} was rejected${l.statusNote ? `: ${l.statusNote}` : ""}`, go: "products" as Sec, tone: "warn" as const })),
    ];
    return { holderId, tokens, live, contracts, active, expiring, pendingSign, listings, onSale, low, out, expired, orders, captured, refunded, money, invoices, overdue, dueNow, upcoming, nextRent, owed, cases, openTasks, openIncidents, deliveries, movements, sum, shopShare, unappliedCounts, partialDeliveries, attention };
  }, [st, holderId]);
}
type B = ReturnType<typeof useBusiness>;
const tokensFor = (st: State, d: B) => d.live.filter((t) => { const c = contractOfToken(st, t.id); return c && contractStatus(c) === "active"; })
  .map((t) => { const s = st.shops.find((x) => x.id === t.shopId); return { id: t.id, label: s ? `${s.name} · ${shelfLabel(s, t.slot)}` : t.id }; });

function Kpi({ label, value, sub, onClick, testId, tone }: { label: string; value: string; sub?: string; onClick?: () => void; testId: string; tone?: "bad" | "warn" }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-3xl border p-4 text-left transition hover:border-primary/40 ${tone === "bad" ? "border-destructive/40" : tone === "warn" ? "border-amber-400/60" : "border-border"}`} data-testid={testId}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </button>
  );
}

// ---------- my business ----------
function Business({ st, d, go }: { st: State; d: B; go: (s: Sec) => void }) {
  const stores = new Set(d.live.map((t) => t.shopId)).size;
  const units = d.onSale.reduce((a, l) => a + l.available, 0);
  if (d.tokens.length === 0 && d.contracts.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 text-center" data-testid="empty-tokens">
        <ShelfArt tiers={2} hue={12} fill={[null, null]} className="w-48" />
        <p className="mt-4 text-muted-foreground">No shelves yet. Your business starts with your first shelf.</p>
        <PrimaryButton className="mt-6" onClick={() => go("opportunities")} data-testid="button-explore">Find a shelf</PrimaryButton>
      </div>
    );
  }
  const health: { ok: boolean; title: string; detail: string; go: Sec }[] = [
    { ok: d.active.length > 0 && d.expiring.length === 0, title: "Rental agreements", detail: d.active.length ? `${d.active.length} active${d.expiring.length ? `, ${d.expiring.length} ending within 30 days` : ""}` : "No active agreement", go: "contracts" },
    { ok: d.overdue.length === 0, title: "Rent payments", detail: d.overdue.length ? `${d.overdue.length} overdue (${usd(d.owed)} incl. late fees)` : d.nextRent ? `Up to date · next ${usd(d.nextRent.total)} on ${fmtDate(d.nextRent.dueDate)}` : "Nothing due", go: "money" },
    { ok: !d.live.some((t) => t.suspended), title: "Shelf status", detail: d.live.some((t) => t.suspended) ? "A shelf is suspended" : `${d.live.length} shelf${d.live.length === 1 ? "" : "s"} open for sales`, go: "shelves" },
    { ok: d.out.length === 0 && d.expired.length === 0, title: "Stock", detail: `${units} units on sale · ${d.low.length} low · ${d.out.length} out · ${d.expired.length} expired`, go: "products" },
    { ok: !d.listings.some((l) => l.status === "pending" || l.status === "rejected"), title: "Product approvals", detail: `${d.listings.filter((l) => l.status === "pending").length} waiting · ${d.listings.filter((l) => l.status === "rejected").length} rejected`, go: "products" },
    { ok: d.unappliedCounts.length === 0 && d.partialDeliveries.length === 0, title: "Stock differences", detail: `${d.unappliedCounts.length} count${d.unappliedCounts.length === 1 ? "" : "s"} to reconcile · ${d.partialDeliveries.length} delivery difference${d.partialDeliveries.length === 1 ? "" : "s"}`, go: "requests" },
    { ok: d.cases.filter((c) => c.status === "awaiting-verification").length === 0, title: "Store requests", detail: `${d.openTasks.length} open · ${d.cases.filter((c) => c.status === "awaiting-verification").length} waiting for your check`, go: "requests" },
    { ok: d.openIncidents.length === 0, title: "Incidents", detail: d.openIncidents.length ? `${d.openIncidents.length} open` : "None open", go: "requests" },
    { ok: d.money.recovery === 0, title: "Settlements", detail: `${usd(d.money.settled)} settled · ${usd(d.money.pending + d.money.processing)} not yet paid out${d.money.recovery ? ` · ${usd(d.money.recovery)} owed back` : ""}`, go: "money" },
  ];
  const bad = health.filter((h) => !h.ok).length;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Gross product sales" value={usd(d.sum(d.captured, "subtotal"))} sub={`${d.sum(d.captured, "qty")} units · ${d.captured.length} paid order${d.captured.length === 1 ? "" : "s"}`} onClick={() => go("sales")} testId="kpi-gross" />
        <Kpi label="Net earnings" value={usd(d.sum(d.captured, "net"))} sub={`after ${usd(d.sum(d.captured, "commission"))} commission${d.shopShare ? ` and ${usd(d.shopShare)} store share` : ""}`} onClick={() => go("money")} testId="kpi-net" />
        <Kpi label="Not yet paid out" value={usd(round2(d.money.pending + d.money.processing))} sub={`${usd(d.money.settled)} already settled`} onClick={() => go("money")} testId="kpi-pending" />
        <Kpi label="Rent owed now" value={usd(d.owed)} sub={d.nextRent ? `next ${usd(d.nextRent.total)} on ${fmtDate(d.nextRent.dueDate)}` : "no rent scheduled"} onClick={() => go("money")} testId="kpi-rent" tone={d.overdue.length ? "bad" : undefined} />
        <Kpi label="Active shelves" value={String(d.live.length)} sub={`in ${stores} store${stores === 1 ? "" : "s"} · ${d.active.length} active contract${d.active.length === 1 ? "" : "s"}`} onClick={() => go("shelves")} testId="kpi-shelves" />
        <Kpi label="Products" value={`${d.onSale.length} / ${d.listings.length}`} sub="on sale / registered" onClick={() => go("products")} testId="kpi-products" />
        <Kpi label="Units available" value={String(units)} sub={`${d.low.length} low · ${d.out.length} out of stock`} onClick={() => go("products")} testId="kpi-units" tone={d.out.length ? "warn" : undefined} />
        <Kpi label="Store requests" value={`${d.openTasks.length} open`} sub={`${d.openIncidents.length} incident${d.openIncidents.length === 1 ? "" : "s"} · ${d.deliveries.filter((x) => x.status === "expected").length} deliveries on the way`} onClick={() => go("requests")} testId="kpi-requests" tone={d.openIncidents.length ? "bad" : undefined} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Card testId="card-health">
          <div className="flex items-center gap-2"><Heart className="h-5 w-5 text-primary" /><p className="font-display text-xl font-bold">Business health</p></div>
          <p className={`mt-1 text-sm font-semibold ${bad ? "text-amber-700" : "text-primary"}`} data-testid="health-summary">{bad ? `${bad} area${bad === 1 ? "" : "s"} need${bad === 1 ? "s" : ""} attention` : "Everything checks out"}</p>
          <p className="text-xs text-muted-foreground">Each line is a plain check on your records, not a score.</p>
          <ul className="mt-3 divide-y divide-border">
            {health.map((h) => (
              <li key={h.title}><button type="button" onClick={() => go(h.go)} className="flex w-full items-center gap-3 py-2.5 text-left text-sm hover:bg-muted/40" data-testid={`health-${h.title}`}>
                {h.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />}
                <span className="w-40 shrink-0 font-medium">{h.title}</span><span className="flex-1 text-muted-foreground">{h.detail}</span><ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button></li>
            ))}
          </ul>
        </Card>
        <Card testId="card-attention">
          <p className="flex items-center gap-2 font-display text-xl font-bold"><AlertTriangle className="h-5 w-5 text-primary" />Needs your attention <span className="text-sm font-normal text-muted-foreground">{d.attention.length}</span></p>
          {d.attention.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nothing waiting for you.</p> : (
            <ul className="mt-3 space-y-2 text-sm">
              {d.attention.slice(0, 12).map((a, i) => (
                <li key={i} className="flex items-start gap-2"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.tone === "bad" ? "bg-destructive" : "bg-amber-500"}`} />
                  {a.href ? <Link href={a.href} className="flex-1 hover:underline">{a.text}</Link> : <button type="button" onClick={() => go(a.go)} className="flex-1 text-left hover:underline">{a.text}</button>}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <ActivityFeed st={st} d={d} go={go} />
    </div>
  );
}

function ActivityFeed({ st, d, go }: { st: State; d: B; go: (s: Sec) => void }) {
  const items: { at: string; text: string; go: Sec; href?: string; icon: LucideIcon }[] = [
    ...d.orders.filter((o) => o.payment === "captured" || o.payment === "refunded").map((o) => ({ at: o.refundedAt ?? o.capturedAt ?? o.createdAt, text: o.payment === "refunded" ? `Refund: ${o.ref} · ${o.qty} × ${o.productName}` : `Sale ${o.ref}: ${o.qty} × ${o.productName} · ${usd(o.subtotal)}`, go: "sales" as Sec, icon: Receipt })),
    ...d.movements.map((m) => ({ at: m.at, text: `${m.type === "restock" ? "Stock added" : m.type === "delivery-received" ? "Stock received" : m.type === "delivery-damaged" ? "Damaged on arrival" : "Count adjustment"}: ${m.type === "delivery-damaged" ? m.units : m.qty > 0 ? `+${m.qty}` : m.qty} × ${st.listings.find((l) => l.id === m.listingId)?.name ?? "product"}${m.ref ? ` (${m.ref})` : ""}`, go: "products" as Sec, icon: Boxes })),
    ...d.deliveries.map((x) => ({ at: x.receivedAt ?? x.createdAt, text: `${x.ref} ${x.status === "expected" ? "registered" : x.status === "cancelled" ? "cancelled" : "received by the store"}`, go: "deliveries" as Sec, icon: Truck })),
    ...d.cases.flatMap((c) => c.events.map((e) => ({ at: e.at, text: `${c.ref} ${caseLabel(c)}: ${e.action} by ${e.byName}`, go: "requests" as Sec, icon: ClipboardList }))),
    ...st.ledger.filter((e) => e.holderId === d.holderId && ["rent_paid", "deposit_paid", "payout_settled", "payout_failed"].includes(e.type)).map((e) => ({ at: e.at, text: `${e.type === "rent_paid" ? "Rent paid" : e.type === "deposit_paid" ? "Deposit paid" : e.type === "payout_settled" ? "Payout settled" : "Payout failed"}: ${usd(Math.abs(e.amount))}`, go: "money" as Sec, icon: Wallet })),
    ...d.contracts.flatMap((c) => c.versions.filter((v) => v.holderSig).map((v) => ({ at: v.holderSig!.at, text: `${c.ref} v${v.v}: offer accepted`, go: "contracts" as Sec, href: `/contracts/${c.id}`, icon: FileText }))),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20);
  return (
    <Card testId="card-activity">
      <p className="flex items-center gap-2 font-display text-xl font-bold"><Activity className="h-5 w-5 text-primary" />Recent activity</p>
      {items.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No activity yet.</p> : (
        <ol className="mt-3 divide-y divide-border">{items.map((x, i) => (
          <li key={i} className="flex items-center gap-3 py-2 text-sm"><x.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            {x.href ? <Link href={x.href} className="flex-1 hover:underline">{x.text}</Link> : <button type="button" onClick={() => go(x.go)} className="flex-1 text-left hover:underline">{x.text}</button>}
            <span className="text-xs text-muted-foreground">{fmtTime(x.at)}</span></li>
        ))}</ol>
      )}
    </Card>
  );
}

// ---------- my shelves ----------
function Shelves({ st, d, act, pending, go }: { st: State; d: B; act: Act; pending: boolean; go: (s: Sec) => void }) {
  if (d.tokens.length === 0) return <Empty title="No shelves yet" text="Find a shelf in Retail opportunities." />;
  return (
    <div className="space-y-5">
      {d.tokens.map((t) => {
        const s = st.shops.find((x) => x.id === t.shopId); if (!s) return null;
        const c = contractOfToken(st, t.id); const cs = c ? contractStatus(c) : null; const v = c && (executedVersion(c) ?? awaitingVersion(c));
        const L = st.listings.filter((l) => l.tokenId === t.id && l.status !== "removed");
        const used = shelfUnits(st, t.id);
        const block = shelfBlockReason(st, t);
        const inspections = st.cases.filter((x) => x.tokenId === t.id && ["photo", "stock-check", "count", "display", "rearrange", "clean"].includes(x.type) && x.evidence.some((e) => e.by === "owner")).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        const latest = inspections[0]; const latestPhoto = latest?.evidence.filter((e) => e.by === "owner").at(-1);
        const owed = d.invoices.filter((i) => i.contractId === c?.id && ["due", "overdue"].includes(invoiceStatus(i)) && i.dueDate <= today()).reduce((a, i) => a + i.total + lateFeeFor(st, i), 0);
        const quick = async (type: string, description: string) => { await act(() => actions.openCase({ kind: "task", type, tokenId: t.id, description }), "Request sent to the store"); };
        return (
          <Card key={t.id} testId={`shelf-card-${t.id}`}>
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-display text-2xl font-bold">{s.name} · <span className="font-mono text-lg">{shelfLabel(s, t.slot)}</span></p>
                <p className="text-sm text-muted-foreground"><MapPin className="mr-1 inline h-3.5 w-3.5" />{s.address || `${s.location}, ${s.city}`}, {countryName(s.country)}{s.hours ? ` · open ${s.hours}` : ""}</p>
              </div>
              <Pill tone={t.suspended ? "bad" : undefined}>{t.released ? "ended" : t.suspended ? "suspended" : cs ?? "—"}</Pill>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="space-y-1 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Where it is</p>
                <p>{v?.snapshot.shelf.floorNote ?? s.floorNote}</p>
                <p>{s.shelf.widthCm} × {s.shelf.heightCm} × {s.shelf.depthCm} cm · up to {s.shelf.capacity} units · {s.listing.shelfType.replace("-", " ")}</p>
                <p>Store facilities: {s.listing.features.length ? s.listing.features.join(", ") : "none listed"} · ~{s.listing.footTraffic} shoppers/day (owner's estimate)</p>
                <div className="mt-2 flex gap-2">{s.photos.slice(0, 3).map((p, i) => <img key={i} src={p.url} alt={p.kind} referrerPolicy="no-referrer" className="h-14 w-20 rounded-lg object-cover" />)}</div>
                <p className="text-[11px] text-muted-foreground">Listing photos, {s.photos.some((p) => p.source === "owner") ? "taken by the owner" : "stock photos (sample store)"}.</p>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rental</p>
                {v ? <>
                  <p>{c!.ref} · {c!.model === "consignment" ? `consignment, ${v.snapshot.terms.salesSharePct}% commission` : `${usd(v.snapshot.terms.monthlyRent)}/month`}{v.snapshot.terms.pricing === "hybrid" ? ` + ${v.snapshot.terms.salesSharePct}% of sales` : ""}</p>
                  <p>{fmtDate(v.snapshot.terms.start)} → {fmtDate(v.snapshot.terms.end)} · paid monthly</p>
                  <p>Deposit {usd(v.snapshot.terms.deposit)} · {v.snapshot.terms.noticeDays ?? 30} days' notice · renewal {v.snapshot.terms.renewal}</p>
                  <p className={owed ? "font-semibold text-destructive" : ""}>Owed now: {usd(round2(owed))}</p>
                  {c && <Link href={`/contracts/${c.id}`} className="text-sm font-semibold text-primary underline">Open contract</Link>}
                </> : <p className="text-muted-foreground">No contract.</p>}
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Physical condition</p>
                <p>{used} of {s.shelf.capacity} units used ({Math.round((used / Math.max(1, s.shelf.capacity)) * 100)}%) · {L.filter((l) => l.status === "active").length} products on sale</p>
                {latest ? (
                  <div className="flex gap-3">
                    {latestPhoto && <a href={latestPhoto.url} target="_blank" rel="noopener"><img src={latestPhoto.url} alt="Latest shelf photo" className="h-16 w-20 rounded-lg object-cover" /></a>}
                    <p className="text-xs">Latest check: {latest.ref} ({caseLabel(latest)}) by {latest.assignee ?? latestPhoto?.byName ?? "the store"} · {fmtTime(latestPhoto?.at ?? latest.updatedAt)} · {latest.status === "completed" ? "accepted by you" : "not yet accepted by you"}</p>
                  </div>
                ) : <p className="text-xs text-muted-foreground" data-testid="no-inspection">No inspection on record yet. Ask the store for a photo or a stock check.</p>}
                {block && <p className="text-xs text-destructive">{block}</p>}
                {cs === "active" && !t.released && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <SmallButton disabled={pending} onClick={() => void quick("photo", "Please send an up-to-date photo of my shelf")} testId={`req-photo-${t.id}`}>Request a photo</SmallButton>
                    <SmallButton disabled={pending} onClick={() => void quick("stock-check", "Please check my shelf: display, arrangement, cleanliness and anything missing")} testId={`req-inspect-${t.id}`}>Request an inspection</SmallButton>
                    <SmallButton disabled={pending} onClick={() => void quick("count", "Please count every product on my shelf")} testId={`req-count-${t.id}`}>Request a stock count</SmallButton>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3 text-sm">
              {cs === "active" && !t.released && <Link href={`/shelf/${t.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 font-semibold text-background" data-testid={`link-shelf-${t.id}`}>Manage products on this shelf <ArrowRight className="h-4 w-4" /></Link>}
              <button type="button" onClick={() => go("requests")} className="rounded-full border border-border px-4 py-2">Inspection history ({inspections.length})</button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ---------- products & stock ----------
function stockOf(st: State, d: B, l: Listing) {
  const mv = d.movements.filter((m) => m.listingId === l.id);
  const received = mv.filter((m) => m.type === "delivery-received").reduce((a, m) => a + m.qty, 0);
  const restocked = mv.filter((m) => m.type === "restock").reduce((a, m) => a + m.qty, 0);
  const adjusted = mv.filter((m) => m.type === "count-adjustment").reduce((a, m) => a + m.qty, 0);
  const damaged = mv.filter((m) => m.type === "delivery-damaged").reduce((a, m) => a + m.units, 0);
  const opening = l.initialQty - received - restocked;
  const reserved = reservedQty(st, l.id);
  const lastCount = d.cases.filter((c) => c.type === "count" && c.status === "completed" && c.count?.some((x) => x.listingId === l.id)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const counted = lastCount?.count?.find((x) => x.listingId === l.id);
  return { opening, received, restocked, adjusted, damaged, reserved, counted, lastCount };
}
function Products({ st, d }: { st: State; d: B }) {
  const [f, setF] = useState<"all" | "active" | "low" | "out" | "expiring" | "pending">("all");
  const rows = d.listings.filter((l) => f === "all" || (f === "active" && l.status === "active") || (f === "low" && isLowStock(l)) || (f === "out" && l.status === "active" && l.available === 0) || (f === "expiring" && (expiresSoon(l) || isExpired(l))) || (f === "pending" && ["pending", "rejected", "draft", "approved"].includes(l.status)));
  const moves = [
    ...d.movements.map((m) => ({ at: m.at, listingId: m.listingId, label: m.type === "restock" ? "Stock added" : m.type === "delivery-received" ? "Delivery received" : m.type === "delivery-damaged" ? "Damaged on arrival (not on sale)" : "Count adjustment", qty: m.type === "delivery-damaged" ? 0 : m.qty, units: m.units, ref: m.ref ?? "", by: m.byName, source: m.source })),
    ...d.orders.filter((o) => o.stockDeducted || o.payment === "refunded").map((o) => ({ at: o.capturedAt ?? o.createdAt, listingId: o.listingId, label: "Sold", qty: -o.qty, units: o.qty, ref: o.ref, by: "Shopper (QR)", source: "system" as const })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const SOURCE: Record<string, string> = { "maker-reported": "you reported", "store-reported": "store reported", "physical-count": "physical count", system: "recorded by InRaf" };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">{([["all", "All"], ["active", "On sale"], ["low", "Low stock"], ["out", "Out of stock"], ["expiring", "Expiring / expired"], ["pending", "Awaiting approval"]] as const).map(([k, l]) => <button key={k} onClick={() => setF(k)} aria-pressed={f === k} className={`rounded-full border px-3 py-1.5 text-sm ${f === k ? "border-foreground bg-foreground text-background" : "border-border"}`} data-testid={`filter-products-${k}`}>{l}</button>)}</div>
      <p className="text-xs text-muted-foreground">You edit names, descriptions, prices and stock on each shelf's page; the store owner approves products before they go on sale. "Counted" is the latest physical count by the store — the only figure verified on the shelf.</p>
      {rows.length === 0 ? <Empty title="No products here" text="Add products from a shelf's page." /> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[980px] text-left text-sm" data-testid="table-stock">
            <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="p-3">Product</th><th className="p-3">Price</th><th className="p-3">Opening</th><th className="p-3">+ Received</th><th className="p-3">+ Added</th><th className="p-3">− Sold</th><th className="p-3">± Adjusted</th><th className="p-3">Available</th><th className="p-3">Reserved</th><th className="p-3">Counted</th><th className="p-3">Expiry</th><th className="p-3">Status</th></tr></thead>
            <tbody>{rows.map((l) => {
              const k = stockOf(st, d, l); const s = st.shops.find((x) => x.id === l.shopId); const t = st.tokens.find((x) => x.id === l.tokenId);
              return (
                <tr key={l.id} className="border-t border-border align-top" data-testid={`row-stock-${l.id}`}>
                  <td className="p-3"><div className="flex items-center gap-2"><ProductImage color={l.color} url={l.imageUrl} name={l.name} className="h-9 w-9" /><div><Link href={`/shelf/${l.tokenId}`} className="font-medium hover:underline">{l.name}</Link><p className="text-xs text-muted-foreground">{l.sku} · {categoryLabel(l.category)} · {s && t ? shelfLabel(s, t.slot) : ""}</p></div></div></td>
                  <td className="p-3 tabular-nums">{usd(l.retail)}{l.wasPrice ? <span className="block text-xs text-muted-foreground line-through">{usd(l.wasPrice)}</span> : null}</td>
                  <td className="p-3 tabular-nums">{k.opening}</td><td className="p-3 tabular-nums">{k.received}{k.damaged ? <span className="block text-xs text-destructive">{k.damaged} damaged</span> : null}</td>
                  <td className="p-3 tabular-nums">{k.restocked}</td><td className="p-3 tabular-nums">{l.sold}{l.returned ? <span className="block text-xs text-muted-foreground">{l.returned} returned</span> : null}</td>
                  <td className="p-3 tabular-nums">{k.adjusted > 0 ? `+${k.adjusted}` : k.adjusted}</td>
                  <td className={`p-3 font-semibold tabular-nums ${l.status === "active" && l.available === 0 ? "text-destructive" : isLowStock(l) ? "text-amber-700" : ""}`}>{l.available}</td>
                  <td className="p-3 tabular-nums">{k.reserved}</td>
                  <td className="p-3 text-xs">{k.counted ? <>{k.counted.counted} <span className="text-muted-foreground">({fmtDate(k.lastCount!.updatedAt.slice(0, 10))})</span></> : <span className="text-muted-foreground">never counted</span>}</td>
                  <td className="p-3 text-xs">{l.expiry ? <span className={isExpired(l) ? "font-semibold text-destructive" : expiresSoon(l) ? "text-amber-700" : ""}>{fmtDate(l.expiry)}</span> : "—"}</td>
                  <td className="p-3"><Pill>{l.status}</Pill></td>
                </tr>
              );
            })}</tbody>
          </table>
        </Card>
      )}
      <Card className="overflow-x-auto p-0">
        <p className="p-3 font-semibold">Stock movements</p>
        {moves.length === 0 ? <p className="px-3 pb-4 text-sm text-muted-foreground">No movements yet.</p> : (
          <table className="w-full min-w-[720px] text-left text-sm" data-testid="table-movements">
            <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="p-3">When</th><th className="p-3">Product</th><th className="p-3">Movement</th><th className="p-3">Units</th><th className="p-3">Reference</th><th className="p-3">By · source</th></tr></thead>
            <tbody>{moves.slice(0, 100).map((m, i) => (
              <tr key={i} className="border-t border-border"><td className="p-3 text-xs">{fmtTime(m.at)}</td><td className="p-3">{st.listings.find((l) => l.id === m.listingId)?.name ?? "—"}</td><td className="p-3">{m.label}</td><td className="p-3 tabular-nums">{m.label.startsWith("Damaged") ? m.units : m.qty > 0 ? `+${m.qty}` : m.qty}</td><td className="p-3 text-xs">{m.ref}</td><td className="p-3 text-xs">{m.by} · {SOURCE[m.source]}</td></tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ---------- deliveries ----------
function Deliveries({ st, d, act, pending }: { st: State; d: B; act: Act; pending: boolean }) {
  const [incidentFor, setIncidentFor] = useState<Delivery | null>(null);
  const tokens = tokensFor(st, d);
  return (
    <div className="space-y-5">
      <Card><p className="font-display text-lg font-bold">Send stock to a shelf</p><p className="text-sm text-muted-foreground">Register what's on its way so the store expects it. The store confirms what physically arrives; only good units go on sale.</p><div className="mt-4"><NewDelivery st={st} tokens={tokens} act={act} pending={pending} /></div></Card>
      {incidentFor && <Card><p className="font-display text-lg font-bold">Report the difference on {incidentFor.ref}</p><div className="mt-3"><NewCase st={st} tokens={tokens} act={act} pending={pending} kind="incident" preset={{ tokenId: incidentFor.tokenId, type: "delivery-discrepancy", deliveryId: incidentFor.id, description: incidentFor.lines.map((l) => `${l.name}: sent ${l.expected}, received ${l.received ?? 0}, damaged ${l.damaged ?? 0}`).join("; ") }} onDone={() => setIncidentFor(null)} /></div></Card>}
      {d.deliveries.length === 0 ? <Empty title="No deliveries yet" /> : d.deliveries.map((x) => <DeliveryCard key={x.id} st={st} d={x} viewer="holder" act={act} pending={pending} onIncident={setIncidentFor} />)}
    </div>
  );
}

// ---------- sales & orders ----------
function Sales({ st, d, act, pending }: { st: State; d: B; act: Act; pending: boolean }) {
  const [from, setFrom] = useState(dayOffset(29)); const [to, setTo] = useState(today());
  const [issue, setIssue] = useState<Order | null>(null);
  const inRange = (o: Order, a: string, b: string) => day(o) >= a && day(o) <= b;
  const range = d.captured.filter((o) => inRange(o, from, to));
  const len = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86400e3) + 1);
  const prevTo = new Date(Date.parse(from) - 86400e3).toISOString().slice(0, 10), prevFrom = new Date(Date.parse(from) - len * 86400e3).toISOString().slice(0, 10);
  const prev = d.captured.filter((o) => inRange(o, prevFrom, prevTo));
  const total = d.sum(range, "subtotal"), prevTotal = d.sum(prev, "subtotal");
  const change = prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
  const per = (o: Order) => o.subtotal;
  const group = (key: (o: Order) => string) => { const m = new Map<string, { n: number; units: number; sales: number }>(); range.forEach((o) => { const k = key(o); const x = m.get(k) ?? { n: 0, units: 0, sales: 0 }; x.n++; x.units += o.qty; x.sales = round2(x.sales + per(o)); m.set(k, x); }); return [...m.entries()].sort((a, b) => b[1].sales - a[1].sales); };
  const days = Array.from({ length: Math.min(len, 60) }, (_, i) => new Date(Date.parse(to) - (Math.min(len, 60) - 1 - i) * 86400e3).toISOString().slice(0, 10));
  const byDay = days.map((x) => round2(range.filter((o) => day(o) === x).reduce((a, o) => a + o.subtotal, 0)));
  const max = Math.max(1, ...byDay);
  const slow = d.onSale.filter((l) => !d.captured.some((o) => o.listingId === l.id && day(o) >= dayOffset(29)));
  const shopName = (o: Order) => st.shops.find((s) => s.id === o.shopId)?.name ?? "—";
  const shelfName = (o: Order) => { const s = st.shops.find((x) => x.id === o.shopId); const t = st.tokens.find((x) => x.id === o.tokenId); return s && t ? shelfLabel(s, t.slot) : "—"; };
  const catOf = (o: Order) => categoryLabel(st.listings.find((l) => l.id === o.listingId)?.category ?? "");
  const tokens = tokensFor(st, d);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Today" value={usd(d.sum(d.captured.filter((o) => day(o) === today()), "subtotal"))} />
        <Stat label="Last 7 days" value={usd(d.sum(d.captured.filter((o) => day(o) >= dayOffset(6)), "subtotal"))} />
        <Stat label="Last 30 days" value={usd(d.sum(d.captured.filter((o) => day(o) >= dayOffset(29)), "subtotal"))} />
        <Stat label="Average order" value={usd(d.captured.length ? round2(d.sum(d.captured, "subtotal") / d.captured.length) : 0)} sub="product value per paid order" />
      </div>
      <Card testId="card-sales-range">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted-foreground">From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-xl border border-input bg-background px-3 py-1.5 text-sm" data-testid="input-sales-from" /></label>
          <label className="text-xs text-muted-foreground">To<input type="date" value={to} min={from} max={today()} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-xl border border-input bg-background px-3 py-1.5 text-sm" data-testid="input-sales-to" /></label>
          <p className="ml-auto text-sm"><b className="font-display text-2xl" data-testid="sales-range-total">{usd(total)}</b> <span className="text-muted-foreground">· {range.length} order{range.length === 1 ? "" : "s"} · {d.sum(range, "qty")} units{change !== null ? ` · ${change >= 0 ? "+" : ""}${change}% vs the previous ${len} days` : prevTotal === 0 && total > 0 ? " · no sales in the previous period" : ""}</span></p>
        </div>
        {byDay.every((v) => v === 0) ? <p className="mt-4 text-sm text-muted-foreground">No paid sales in this period.</p> : (
          <svg viewBox={`0 0 ${days.length * 20} 150`} className="mt-4 max-h-56 w-full" role="img" aria-label="Daily product sales">
            {byDay.map((v, i) => <rect key={i} x={i * 20 + 2} y={135 - (v / max) * 125} width={16} height={(v / max) * 125} rx={3} className="fill-primary"><title>{`${fmtDate(days[i])}: ${usd(v)}`}</title></rect>)}
            <line x1={0} y1={135.5} x2={days.length * 20} y2={135.5} className="stroke-border" />
          </svg>
        )}
      </Card>
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        {([["By product", group((o) => o.productName)], ["By shelf", group(shelfName)], ["By store", group(shopName)], ["By category", group(catOf)]] as const).map(([title, rows]) => (
          <Card key={title}><p className="font-semibold">{title}</p>{rows.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">—</p> : <ul className="mt-2 space-y-1 text-sm">{rows.slice(0, 6).map(([k, x]) => <li key={k} className="flex justify-between gap-2"><span className="truncate">{k}</span><span className="tabular-nums text-muted-foreground">{x.units}u · {usd(x.sales)}</span></li>)}</ul>}</Card>
        ))}
      </div>
      {slow.length > 0 && <Card><p className="font-semibold">Slow movers: no sale in 30 days</p><p className="mt-1 text-sm text-muted-foreground">{slow.map((l) => l.name).join(" · ")}</p></Card>}
      {issue && <Card><p className="font-display text-lg font-bold">Report a problem with {issue.ref}</p><div className="mt-3"><NewCase st={st} tokens={tokens} act={act} pending={pending} kind="incident" preset={{ tokenId: issue.tokenId, type: "wrong-attribution", orderId: issue.id, listingId: issue.listingId, description: `${issue.ref}: ` }} onDone={() => setIssue(null)} /></div></Card>}
      <Card className="overflow-x-auto p-0">
        <p className="p-3 font-semibold">Transactions</p>
        {d.orders.length === 0 ? <p className="px-3 pb-4 text-sm text-muted-foreground">No orders yet. They appear when a shopper buys from your shelf's QR catalogue.</p> : (
          <table className="w-full min-w-[1080px] text-left text-sm" data-testid="table-transactions">
            <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="p-3">Order</th><th className="p-3">Store · shelf</th><th className="p-3">Product</th><th className="p-3">Qty × price</th><th className="p-3">Sale</th><th className="p-3">Commission</th><th className="p-3">Store share</th><th className="p-3">Net to you</th><th className="p-3">Payment</th><th className="p-3">Payout</th><th className="p-3" /></tr></thead>
            <tbody>{d.orders.map((o) => (
              <tr key={o.id} className="border-t border-border" data-testid={`row-order-${o.id}`}>
                <td className="p-3"><Link href={`/orders/${o.id}`} className="font-medium hover:underline">{o.ref}</Link><p className="text-xs text-muted-foreground">{fmtTime(o.capturedAt ?? o.createdAt)}</p></td>
                <td className="p-3 text-xs">{shopName(o)}<br />{shelfName(o)}</td>
                <td className="p-3">{o.productName}<p className="text-xs text-muted-foreground">{o.sku}</p></td>
                <td className="p-3 tabular-nums">{o.qty} × {usd(o.unit)}</td>
                <td className="p-3 tabular-nums">{usd(o.subtotal)}</td><td className="p-3 tabular-nums">−{usd(o.commission)}</td>
                <td className="p-3 tabular-nums">{o.shopShare ? `−${usd(o.shopShare)}` : "—"}</td><td className="p-3 font-semibold tabular-nums">{usd(o.net)}</td>
                <td className="p-3"><Pill>{o.payment}</Pill>{o.refund && <p className="mt-1 text-xs">refund {o.refund.status}</p>}</td>
                <td className="p-3"><Pill>{o.payout}</Pill>{(o.payout === "pending" || o.payout === "failed") && o.payment === "captured" && <SmallButton disabled={pending} onClick={() => act(() => actions.requestPayout(o.id, "holder"), "Payout sent to the simulated provider")} testId={`button-payout-${o.id}`}>{o.payout === "failed" ? "Retry" : "Request payout"}</SmallButton>}</td>
                <td className="p-3"><button type="button" onClick={() => setIssue(o)} className="text-xs text-primary underline" data-testid={`report-order-${o.id}`}>Report a problem</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
      <p className="text-xs text-muted-foreground">Sales are recorded when a shopper pays by scanning your shelf's QR code. Sales rung up on a store's own till aren't connected yet; there are no discounts on QR sales today, so the price shown is the price paid.</p>
    </div>
  );
}

// ---------- money & ledger ----------
const LEDGER_LABEL: Record<string, string> = {
  capture_gross: "Sale (incl. tax and service fee)", tax_collected: "Tax collected", platform_fee: "InRaf commission", holder_payable: "Earned by you", shop_share: "Store's share of the sale",
  payout_settled: "Payout settled", payout_failed: "Payout failed", refund_gross: "Refund to shopper", tax_reversed: "Tax reversed", platform_fee_reversed: "Commission reversed",
  holder_payable_reversed: "Earning reversed (refund)", shop_share_reversed: "Store share reversed", payout_reversed: "Payout reversed", holder_recovery: "Owed back after refund",
  rent_paid: "Rent paid", deposit_paid: "Deposit paid", shop_payout_settled: "Store share settled", shop_recovery: "Store share owed back",
};
function Money({ st, d, act, pending }: { st: State; d: B; act: Act; pending: boolean }) {
  const m = d.money;
  const ledger = st.ledger.filter((e) => e.financial && e.holderId === d.holderId).slice().sort((a, b) => b.seq - a.seq);
  const refundsAmt = round2(d.refunded.reduce((a, o) => a + o.subtotal, 0));
  const exportLedger = () => downloadBlob(`inraf-ledger-${today()}.csv`, toCsv(ledger.map((e) => ({ ref: e.id, date: e.at, type: LEDGER_LABEL[e.type] ?? e.type, amount: e.amount, order: st.orders.find((o) => o.id === e.orderId)?.ref ?? "", invoice: st.invoices.find((i) => i.id === e.invoiceId)?.ref ?? "", memo: e.memo }))), "text/csv");
  return (
    <div className="space-y-5">
      <Card testId="card-gross-to-net">
        <p className="font-display text-lg font-bold">From sales to what you receive</p>
        <dl className="mt-3 max-w-xl space-y-1.5 text-sm">
          <div className="flex justify-between"><dt>Product sales (paid orders)</dt><dd className="tabular-nums">{usd(d.sum(d.captured, "subtotal"))}</dd></div>
          <div className="flex justify-between text-muted-foreground"><dt>− InRaf commission</dt><dd className="tabular-nums">−{usd(d.sum(d.captured, "commission"))}</dd></div>
          {d.shopShare > 0 && <div className="flex justify-between text-muted-foreground"><dt>− Stores' share of sales</dt><dd className="tabular-nums">−{usd(d.shopShare)}</dd></div>}
          <div className="flex justify-between border-t border-border pt-1.5 font-semibold"><dt>Net earnings (confirmed)</dt><dd className="tabular-nums" data-testid="money-net">{usd(d.sum(d.captured, "net"))}</dd></div>
          <div className="flex justify-between text-muted-foreground"><dt>Refunded orders (not counted above)</dt><dd className="tabular-nums">{d.refunded.length} · {usd(refundsAmt)}</dd></div>
          <div className="flex justify-between text-muted-foreground"><dt>Rent and deposits you paid</dt><dd className="tabular-nums">{usd(m.rentPaid)}</dd></div>
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">Shoppers' tax and service fee are collected for the tax authority and InRaf; they aren't your income. All amounts are confirmed records; nothing here is projected.</p>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Settled to you" value={usd(m.settled)} testId="text-settled" />
        <Stat label="Waiting for payout" value={usd(m.pending)} sub="request a payout per order" />
        <Stat label="Payout processing" value={usd(m.processing)} sub="awaiting the provider" />
        <Stat label="Payable balance" value={usd(m.payable)} sub={m.recovery ? `${usd(m.recovery)} owed back after refunds` : "from the ledger"} testId="text-payable" />
      </div>
      <Card>
        <p className="font-display text-lg font-bold">Rent</p>
        <p className="text-sm text-muted-foreground">Owed now (incl. late fees): <b className="tabular-nums" data-testid="text-rent-due">{usd(d.owed)}</b>{d.nextRent ? ` · next ${usd(d.nextRent.total)} due ${fmtDate(d.nextRent.dueDate)}` : ""}</p>
        <ul className="mt-3 divide-y divide-border text-sm">
          {d.invoices.length === 0 && <li className="py-2 text-muted-foreground">No rent invoices yet.</li>}
          {d.invoices.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-2 py-2"><span className="flex-1">{i.label}<span className="block text-xs text-muted-foreground">{i.ref} · due {fmtDate(i.dueDate)}{i.receiptRef ? ` · receipt ${i.receiptRef}` : ""}</span></span><span className="tabular-nums">{usd(i.total)}{invoiceStatus(i) === "overdue" ? ` + ${usd(lateFeeFor(st, i))} late` : ""}</span><Pill>{invoiceStatus(i)}</Pill>
              {invoiceStatus(i) !== "paid" && <SmallButton tone="solid" disabled={pending} onClick={() => act(() => actions.payInvoice(i.id), "Rent payment recorded (simulated)")} testId={`button-pay-${i.id}`}>Pay (simulated)</SmallButton>}</li>
          ))}
        </ul>
      </Card>
      <Card className="overflow-x-auto p-0">
        <div className="flex items-center justify-between p-3"><p className="font-semibold">Financial ledger</p><SmallButton onClick={exportLedger} disabled={!ledger.length} testId="button-export-ledger"><Download className="h-4 w-4" />Export CSV</SmallButton></div>
        {ledger.length === 0 ? <p className="px-3 pb-4 text-sm text-muted-foreground">No financial records yet.</p> : (
          <table className="w-full min-w-[760px] text-left text-sm" data-testid="table-ledger">
            <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="p-3">When</th><th className="p-3">Entry</th><th className="p-3">Amount</th><th className="p-3">Related to</th><th className="p-3">Note</th></tr></thead>
            <tbody>{ledger.slice(0, 200).map((e) => (
              <tr key={e.id} className="border-t border-border"><td className="p-3 text-xs">{fmtTime(e.at)}<br /><span className="text-muted-foreground">{e.id}</span></td><td className="p-3">{LEDGER_LABEL[e.type] ?? e.type}</td><td className={`p-3 tabular-nums ${e.amount < 0 ? "text-destructive" : ""}`}>{usd(e.amount)}</td>
                <td className="p-3 text-xs">{e.orderId ? <Link href={`/orders/${e.orderId}`} className="underline">{st.orders.find((o) => o.id === e.orderId)?.ref}</Link> : e.contractId ? <Link href={`/contracts/${e.contractId}`} className="underline">{st.contracts.find((c) => c.id === e.contractId)?.ref}</Link> : "—"}</td><td className="p-3 text-xs text-muted-foreground">{e.memo}</td></tr>
            ))}</tbody>
          </table>
        )}
      </Card>
      <p className="text-xs text-muted-foreground">Payments and payouts are simulated today: no money moves and no bank details are collected. Real payouts will need a licensed payment provider.</p>
    </div>
  );
}

// ---------- contracts ----------
function Contracts({ st, d }: { st: State; d: B }) {
  if (!d.contracts.length) return <Empty title="No contracts" text="Request a shelf to create one." />;
  return (
    <div className="space-y-3">
      {d.contracts.slice().reverse().map((c) => {
        const s = st.shops.find((x) => x.id === c.shopId); const v = awaitingVersion(c) ?? executedVersion(c) ?? c.versions[c.versions.length - 1]; const cs = contractStatus(c);
        const aw = awaitingVersion(c);
        return (
          <Link key={c.id} href={`/contracts/${c.id}`} className="block rounded-3xl border border-border p-4 hover:border-primary/40" data-testid={`link-contract-${c.id}`}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1"><p className="font-medium">{c.ref} · {s?.name} · {v.snapshot.shelf.label}</p>
                <p className="text-xs text-muted-foreground">v{v.v} {v.kind} · {c.model === "consignment" ? "consignment" : "shelf rental"} · {fmtDate(v.snapshot.terms.start)} → {fmtDate(v.snapshot.terms.end)} · {c.model === "consignment" ? `${v.snapshot.terms.salesSharePct}% commission` : `${usd(v.snapshot.terms.monthlyRent)}/mo`} · deposit {usd(v.snapshot.terms.deposit)} · {v.snapshot.terms.noticeDays ?? 30} days' notice</p></div>
              {aw && <Pill tone="warn">{offerNeeded(aw) ? "owner's offer to come" : !aw.adminApproval ? "InRaf check" : !aw.holderSig ? "offer to accept" : "ready"}</Pill>}
              {cs === "active" && daysUntil(v.snapshot.terms.end) <= 30 && <Pill tone="warn">ends in {daysUntil(v.snapshot.terms.end)} days</Pill>}
              <Pill>{cs}</Pill>
            </div>
          </Link>
        );
      })}
      <p className="text-xs text-muted-foreground">Open a contract to sign, download the PDF, renew, amend or give notice. Changes to signed terms need a new version that both you and the store owner sign.</p>
    </div>
  );
}

// ---------- store requests & incidents ----------
function Requests({ st, d, act, pending, meName }: { st: State; d: B; act: Act; pending: boolean; meName: string }) {
  const [f, setF] = useState<"open" | "check" | "incidents" | "closed" | "all">("open");
  const [showNew, setShowNew] = useState(false);
  const rows = d.cases.filter((c) => f === "all" || (f === "open" && caseIsOpen(c)) || (f === "check" && c.status === "awaiting-verification") || (f === "incidents" && c.kind === "incident") || (f === "closed" && !caseIsOpen(c)));
  const tokens = tokensFor(st, d);
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-display text-lg font-bold">Ask the store, or report a problem</p><p className="text-sm text-muted-foreground">Restocking, rearranging, photos, expiry checks, stock counts, maintenance — or missing, damaged or wrongly sold products. You see who handles it, their evidence, and you confirm when it's really done.</p></div>
          {!showNew && <PrimaryButton onClick={() => setShowNew(true)} data-testid="button-new-request">New request</PrimaryButton>}</div>
        {showNew && <div className="mt-4"><NewCase st={st} tokens={tokens} act={act} pending={pending} onDone={() => setShowNew(false)} /></div>}
      </Card>
      <div className="flex flex-wrap gap-2">{([["open", "Open"], ["check", "Waiting for your check"], ["incidents", "Incidents"], ["closed", "Closed"], ["all", "All"]] as const).map(([k, l]) => <button key={k} onClick={() => setF(k)} aria-pressed={f === k} className={`rounded-full border px-3 py-1.5 text-sm ${f === k ? "border-foreground bg-foreground text-background" : "border-border"}`} data-testid={`filter-cases-${k}`}>{l}</button>)}</div>
      {rows.length === 0 ? <Empty title="Nothing here" /> : rows.map((c) => <CaseCard key={c.id} st={st} c={c} viewer="holder" viewerName={meName} act={act} pending={pending} defaultOpen={c.status === "awaiting-verification"} />)}
      <p className="text-xs text-muted-foreground">Messages on each request go to the store owner; escalations go to the InRaf team. Live shelf cameras and the store's own till system aren't connected yet.</p>
    </div>
  );
}

// ---------- reports ----------
function Reports({ st, d }: { st: State; d: B }) {
  const [from, setFrom] = useState(dayOffset(29)); const [to, setTo] = useState(today());
  const within = (iso: string) => iso.slice(0, 10) >= from && iso.slice(0, 10) <= to;
  const file = (name: string, rows: Record<string, string | number | undefined>[]) => downloadBlob(`inraf-${name}-${from}-to-${to}.csv`, toCsv(rows), "text/csv");
  const reports: [string, string, () => void, number][] = [
    ["Sales", "Every order with commission, store share and net", () => file("sales", d.orders.filter((o) => within(o.capturedAt ?? o.createdAt)).map((o) => ({ ref: o.ref, date: o.capturedAt ?? o.createdAt, product: o.productName, sku: o.sku, qty: o.qty, unit: o.unit, sale: o.subtotal, commission: o.commission, store_share: o.shopShare ?? 0, net: o.net, payment: o.payment, payout: o.payout }))), d.orders.filter((o) => within(o.capturedAt ?? o.createdAt)).length],
    ["Inventory", "Current stock per product", () => file("inventory", d.listings.map((l) => { const k = stockOf(st, d, l); return { product: l.name, sku: l.sku, status: l.status, opening: k.opening, received: k.received, added: k.restocked, sold: l.sold, returned: l.returned, adjusted: k.adjusted, available: l.available, reserved: k.reserved, last_counted: k.counted?.counted ?? "", expiry: l.expiry ?? "" }; })), d.listings.length],
    ["Stock movements", "Receipts, additions and count adjustments", () => file("movements", d.movements.filter((m) => within(m.at)).map((m) => ({ date: m.at, product: st.listings.find((l) => l.id === m.listingId)?.name, type: m.type, qty: m.qty, units: m.units, ref: m.ref ?? "", by: m.byName, source: m.source }))), d.movements.filter((m) => within(m.at)).length],
    ["Deliveries", "Sent, received, damaged and missing", () => file("deliveries", d.deliveries.filter((x) => within(x.createdAt)).flatMap((x) => x.lines.map((l) => ({ ref: x.ref, date: x.createdAt, status: x.status, product: l.name, sent: l.expected, received: l.received ?? "", damaged: l.damaged ?? "", received_by: x.receivedBy ?? "" })))), d.deliveries.filter((x) => within(x.createdAt)).length],
    ["Rent", "Rent and deposit invoices", () => file("rent", d.invoices.filter((i) => within(i.dueDate)).map((i) => ({ invoice: i.ref, label: i.label, due: i.dueDate, total: i.total, status: invoiceStatus(i), receipt: i.receiptRef ?? "" }))), d.invoices.filter((i) => within(i.dueDate)).length],
    ["Store requests and incidents", "Every request with status and outcome", () => file("requests", d.cases.filter((c) => within(c.createdAt)).map((c) => ({ ref: c.ref, kind: c.kind, type: caseLabel(c), opened: c.createdAt, status: c.status, handled_by: c.assignee ?? "", resolution: c.resolution ?? "" }))), d.cases.filter((c) => within(c.createdAt)).length],
  ];
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted-foreground">From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-xl border border-input bg-background px-3 py-1.5 text-sm" /></label>
          <label className="text-xs text-muted-foreground">To<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-xl border border-input bg-background px-3 py-1.5 text-sm" /></label>
          <p className="text-xs text-muted-foreground">CSV files open in Excel, Numbers or Google Sheets. The financial ledger is exported from Money & ledger.</p>
        </div>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">{reports.map(([t, sub, fn, n]) => (
        <Card key={t} className="flex items-center gap-3" testId={`report-${t}`}><div className="min-w-0 flex-1"><p className="font-semibold">{t}</p><p className="text-xs text-muted-foreground">{sub} · {n} record{n === 1 ? "" : "s"} in range</p></div><SmallButton onClick={fn} testId={`download-${t}`}><Download className="h-4 w-4" />CSV</SmallButton></Card>
      ))}</div>
    </div>
  );
}

// ---------- account ----------
function Account({ st, me, email }: { st: State; me: ReturnType<typeof holderOf>; email?: string }) {
  const notices = st.notifications.filter((n) => n.role === "holder").slice().reverse().slice(0, 8);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <p className="font-display text-lg font-bold">Profile</p>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Name</dt><dd>{me.name}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Email</dt><dd>{email ?? "this browser (demo)"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Type</dt><dd>{me.kind}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Country</dt><dd>{me.country ? countryName(me.country) : "not set"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Verification</dt><dd>{me.verification === "demo-reviewed" ? "reviewed" : "not started"}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">Payout and tax details aren't collected yet: payments are simulated until a licensed payment provider is connected. Sign-in is by one-time email link, so there's no password to manage.</p>
      </Card>
      <Card>
        <div className="flex items-center justify-between"><p className="font-display text-lg font-bold">Notifications</p><Link href="/notifications" className="text-sm text-primary underline">All</Link></div>
        {notices.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">None yet.</p> : <ul className="mt-3 space-y-2 text-sm">{notices.map((n) => <li key={n.id}>{n.link ? <Link href={n.link} className="hover:underline"><b>{n.title}.</b> <span className="text-muted-foreground">{n.body}</span></Link> : <><b>{n.title}.</b> {n.body}</>}</li>)}</ul>}
        <p className="mt-3 text-xs text-muted-foreground"><Link href="/terms" className="underline">Terms</Link> · <Link href="/privacy" className="underline">Privacy</Link> · <Link href="/support" className="underline">Support</Link></p>
      </Card>
    </div>
  );
}
