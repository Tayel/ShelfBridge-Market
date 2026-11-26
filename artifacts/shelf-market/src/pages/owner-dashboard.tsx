import { useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { AlertTriangle, ArrowRight, BarChart3, Check, Download, Lock, Pencil, Store as StoreIcon, Trash2, X } from "lucide-react";
import { Shell, PageTitle, PrimaryButton } from "@/components/shell";
import { ShelfArt } from "@/components/shelf-art";
import { IsoFloor } from "@/components/iso-floor";
import { Card, Empty, ErrorNote, Pill, ProductImage, SmallButton, Stat, Tabs } from "@/components/kit";
import { categoryLabel, countryName } from "@/lib/data";
import { isMine, useSession, useStore, usd } from "@/lib/store";
import { actions } from "@/lib/actions";
import { useAct } from "@/hooks/use-act";
import { holderOf } from "@/lib/ops";
import { CaseCard, DeliveryCard } from "@/components/store-ops";
import { caseIsOpen } from "@/lib/ops";
import { awaitingVersion, contractStatus, executedVersion, expiresSoon, invoiceStatus, isExpired, isLowStock, lateFeeFor, shelfLabel, shopShareMoney, slotsOf } from "@/lib/selectors";
import { daysUntil, downloadBlob, fmtDate, round2, toCsv, today } from "@/lib/util";
import type { Contract, Order, Shop, State } from "@/lib/types";

/**
 * The store owner's command centre. Everything here is derived from the marketplace records the owner is allowed to
 * see (their stores, the contracts, invoices, products and orders at those stores); nothing is estimated or made up.
 * Each figure links to the list behind it, and owner actions (approve products, sign, suspend a shelf, edit the
 * store) are one click away.
 */
type Tab = "overview" | "requests" | "products" | "orders" | "renters" | "shelves" | "money" | "analytics" | "stores";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" }, { id: "requests", label: "Store requests" }, { id: "products", label: "Products & stock" }, { id: "orders", label: "Orders & sales" },
  { id: "renters", label: "Renters & shoppers" }, { id: "shelves", label: "Shelves" }, { id: "money", label: "Money" },
  { id: "analytics", label: "Analytics" }, { id: "stores", label: "Store & settings" },
];
const LEGACY_TABS: Record<string, Tab> = { todo: "overview", rent: "money" };

const paid = (o: Order) => o.payment === "captured";
const when = (o: Order) => (o.capturedAt ?? o.createdAt).slice(0, 10);

export default function OwnerDashboard() {
  const session = useSession();
  if (session.live && !session.me) return <SignInFirst />;
  return <Portal />;
}

function SignInFirst() {
  const [, go] = useLocation();
  return (
    <Shell title="Owner portal" back="/">
      <div className="mx-auto mt-10 max-w-lg rounded-[2rem] border border-border p-8 text-center" data-testid="owner-portal-signin">
        <Lock className="mx-auto h-8 w-8 text-primary" />
        <h1 className="font-display mt-3 text-3xl font-bold">Sign in to see your shop</h1>
        <p className="mt-2 text-muted-foreground">Your stores, shelves, renters, sales and rent are private to your account. Sign in with your email: no password.</p>
        <PrimaryButton className="mt-6 w-full" onClick={() => go(`/signin?next=${encodeURIComponent("/owner-dashboard")}`)} data-testid="button-portal-signin">Sign in <ArrowRight className="h-4 w-4" /></PrimaryButton>
        <p className="mt-4 text-sm text-muted-foreground">New to InRaf? <Link href="/start?as=owner" className="text-primary underline">List your shop</Link></p>
      </div>
    </Shell>
  );
}

function Portal() {
  const st = useStore();
  const session = useSession();
  const [, go] = useLocation();
  const search = useSearch();
  const q = new URLSearchParams(search).get("tab") ?? "overview";
  const [tab, setTab] = useState<Tab>((LEGACY_TABS[q] ?? (TABS.some((t) => t.id === q) ? q : "overview")) as Tab);
  const own = st.shops.filter((s) => isMine(s, session));
  const [samples, setSamples] = useState(own.length === 0 && !session.live);
  const [only, setOnly] = useState<string>("all");
  const { act, error, pending } = useAct();

  const allShops = st.shops.filter((s) => isMine(s, session) || (s.seeded && samples));
  const shops = only === "all" ? allShops : allShops.filter((s) => s.id === only);
  const d = useDerived(st, shops);

  if (allShops.length === 0) {
    return (
      <Shell title="Owner portal" back="/">
        <PageTitle title="My shop" sub="Your stores, the shelves you rent out, and requests waiting for you." />
        {st.requests.length > 0 && <div className="mx-auto mt-6 max-w-3xl"><Applications st={st} /></div>}
        <div className="mt-10 flex flex-col items-center text-center" data-testid="empty-listings">
          <ShelfArt tiers={3} hue={150} fill={[null, null, null]} className="w-48" />
          <p className="mt-4 text-muted-foreground">{st.requests.length ? "Your application is with InRaf. Stores you list appear here." : "No store yet."}</p>
          <PrimaryButton className="mt-6" onClick={() => go("/start?as=owner")} data-testid="button-list-shop">List your shop</PrimaryButton>
          {!session.live && <label className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={samples} onChange={(e) => setSamples(e.target.checked)} data-testid="checkbox-samples" />Show sample stores</label>}
        </div>
      </Shell>
    );
  }

  const counts: Partial<Record<Tab, number>> = { requests: d.openCases.length + d.expectedDeliveries.length, overview: d.actions.length, products: d.pendingProducts.length, money: d.overdue.length };
  return (
    <Shell title="Owner portal" back="/" wide>
      <PageTitle title="My shop" sub={session.live ? "Your stores, shelves, renters, sales and rent, from the records on InRaf." : "Store-owner view. Sample stores use simulated owners."}>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {allShops.length > 1 && (
            <select value={only} onChange={(e) => setOnly(e.target.value)} className="rounded-full border border-border bg-background px-4 py-2 text-sm" data-testid="select-store" aria-label="Store">
              <option value="all">All my stores ({allShops.length})</option>
              {allShops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {!session.live && <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={samples} onChange={(e) => setSamples(e.target.checked)} data-testid="checkbox-samples" />Include sample stores</label>}
        </div>
        <div className="max-w-full overflow-x-auto"><Tabs value={tab} onChange={(v) => setTab(v as Tab)} options={TABS.map((t) => ({ ...t, count: counts[t.id] || undefined }))} /></div>
      </PageTitle>
      <div className="mx-auto mt-6 max-w-6xl"><ErrorNote error={error} /></div>

      <div className="mx-auto mt-4 max-w-6xl" data-testid={`owner-tab-${tab}`}>
        {tab === "overview" && <Overview st={st} d={d} setTab={setTab} />}
        {tab === "requests" && <Requests st={st} d={d} act={act} pending={pending} name={session.me?.name || session.me?.email || "Store owner"} />}
        {tab === "products" && <Products st={st} d={d} act={act} pending={pending} />}
        {tab === "orders" && <Orders st={st} d={d} />}
        {tab === "renters" && <Renters st={st} d={d} />}
        {tab === "shelves" && <Shelves st={st} d={d} act={act} pending={pending} />}
        {tab === "money" && <Money st={st} d={d} />}
        {tab === "analytics" && <Analytics d={d} />}
        {tab === "stores" && <Stores st={st} d={d} act={act} session={session} />}
      </div>
    </Shell>
  );
}

// ---------- everything the views need, from the records ----------
type Act = ReturnType<typeof useAct>["act"];
function useDerived(st: State, shops: Shop[]) {
  return useMemo(() => {
    const ids = new Set(shops.map((s) => s.id));
    const shopOf = (id: string) => shops.find((s) => s.id === id);
    const contracts = st.contracts.filter((c) => ids.has(c.shopId));
    const awaiting = contracts.filter((c) => { const v = awaitingVersion(c); return v && !c.terminatedAt && !v.ownerSig; });
    const active = contracts.filter((c) => contractStatus(c) === "active");
    const renewals = active.filter((c) => daysUntil(executedVersion(c)!.snapshot.terms.end) <= 30);
    const tokens = st.tokens.filter((t) => ids.has(t.shopId) && !t.released);
    const totalShelves = shops.reduce((a, s) => a + slotsOf(s), 0);
    const listings = st.listings.filter((l) => ids.has(l.shopId) && l.status !== "removed");
    const pendingProducts = listings.filter((l) => l.status === "pending");
    const onSale = listings.filter((l) => l.status === "active");
    const expiredOnShelf = onSale.filter((l) => isExpired(l) && l.available > 0);
    const lowStock = listings.filter(isLowStock);
    const orders = st.orders.filter((o) => ids.has(o.shopId)).slice().sort((a, b) => (b.capturedAt ?? b.createdAt).localeCompare(a.capturedAt ?? a.createdAt));
    const captured = orders.filter(paid);
    const refundRequests = orders.filter((o) => o.refund?.status === "requested");
    const invoices = st.invoices.filter((i) => contracts.some((c) => c.id === i.contractId) && invoiceStatus(i) !== "void");
    const overdue = invoices.filter((i) => invoiceStatus(i) === "overdue");
    // "due" covers the whole schedule; split what is payable now from what falls due later in the term.
    const dueNow = round2(invoices.filter((i) => invoiceStatus(i) === "due" && i.dueDate <= today()).reduce((a, i) => a + i.total, 0));
    const upcoming = round2(invoices.filter((i) => invoiceStatus(i) === "due" && i.dueDate > today()).reduce((a, i) => a + i.total, 0));
    const sumInv = (k: string) => round2(invoices.filter((i) => invoiceStatus(i) === k).reduce((a, i) => a + i.total + (k === "paid" ? i.lateFee ?? 0 : k === "overdue" ? lateFeeFor(st, i) : 0), 0));
    const share = shopShareMoney(st, [...ids]);
    const d30 = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10);
    const last30 = captured.filter((o) => when(o) >= d30);

    const cases = st.cases.filter((c) => ids.has(c.shopId)).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const openCases = cases.filter((c) => caseIsOpen(c) && c.status !== "awaiting-verification");
    const deliveries = st.deliveries.filter((x) => ids.has(x.shopId)).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const expectedDeliveries = deliveries.filter((x) => x.status === "expected");
    const actions: { text: string; tab: Tab; href?: string; tone: "warn" | "bad" }[] = [
      ...openCases.filter((c) => ["submitted", "received", "in-progress", "on-hold", "escalated"].includes(c.status)).map((c) => ({ text: `${c.ref}: ${holderOf(st, c.holderId).name} ${c.kind === "incident" ? "reported a problem" : "needs something done"}${c.priority === "urgent" ? " (urgent)" : ""}`, tab: "requests" as Tab, tone: (c.kind === "incident" || c.priority === "urgent" ? "bad" : "warn") as "bad" | "warn" })),
      ...expectedDeliveries.map((x) => ({ text: `Delivery ${x.ref} from ${holderOf(st, x.holderId).name} is on its way${x.expectedOn ? ` (${fmtDate(x.expectedOn)})` : ""}: confirm what arrives`, tab: "requests" as Tab, tone: "warn" as const })),
      ...awaiting.map((c) => {
        const v = awaitingVersion(c)!; const last = c.offers?.at(-1); const s = shopOf(c.shopId);
        const offer = c.model === "consignment" ? `consignment at ${v.snapshot.terms.salesSharePct}% commission` : s && v.snapshot.terms.monthlyRent !== s.price ? `an offer of ${usd(v.snapshot.terms.monthlyRent)}/mo (listed ${usd(s.price)})` : "a rental at your listed price";
        return { text: `${holderOf(st, c.holderId).name} wants ${v.snapshot.shelf.label}: ${offer}${last?.by === "owner" ? " — waiting for their reply" : ""}`, tab: "overview" as Tab, href: `/contracts/${c.id}`, tone: "warn" as const };
      }),
      ...pendingProducts.map((l) => ({ text: `Approve or reject ${l.initialQty} × ${l.name} from ${holderOf(st, l.holderId).name}`, tab: "products" as Tab, tone: "warn" as const })),
      ...expiredOnShelf.map((l) => ({ text: `${l.name} is past its expiry date (${fmtDate(l.expiry!)}) with ${l.available} on the shelf`, tab: "products" as Tab, tone: "bad" as const })),
      ...overdue.map((i) => ({ text: `Rent overdue: ${i.label} (${usd(i.total + lateFeeFor(st, i))})`, tab: "money" as Tab, href: `/contracts/${i.contractId}`, tone: "bad" as const })),
      ...refundRequests.map((o) => ({ text: `Refund requested on ${o.ref} (${o.productName}) — InRaf decides`, tab: "orders" as Tab, tone: "warn" as const })),
      ...renewals.map((c) => ({ text: `${c.ref} ends ${fmtDate(executedVersion(c)!.snapshot.terms.end)} — renew or re-let the shelf`, tab: "overview" as Tab, href: `/contracts/${c.id}`, tone: "warn" as const })),
      ...shops.filter((s) => !s.seeded).flatMap((s) => [
        ...(s.status === "pending" && !s.registration ? [{ text: `${s.name}: add your business registration number so InRaf can approve it`, tab: "stores" as Tab, href: `/owner-dashboard/shops/${s.id}`, tone: "bad" as const }] : []),
        ...(s.status === "suspended" ? [{ text: `${s.name} is suspended${s.statusNote ? `: ${s.statusNote}` : ""}`, tab: "stores" as Tab, tone: "bad" as const }] : []),
        ...(!s.hours ? [{ text: `${s.name}: add your opening hours`, tab: "stores" as Tab, href: `/owner-dashboard/shops/${s.id}`, tone: "warn" as const }] : []),
      ]),
    ];
    return { cases, openCases, deliveries, expectedDeliveries, dueNow, upcoming, shops, ids, shopOf, contracts, awaiting, active, renewals, tokens, totalShelves, listings, pendingProducts, onSale, expiredOnShelf, lowStock, orders, captured, refundRequests, invoices, overdue, sumInv, share, last30, actions };
  }, [st, shops]);
}
type D = ReturnType<typeof useDerived>;

// ---------- overview ----------
function Overview({ st, d, setTab }: { st: State; d: D; setTab: (t: Tab) => void }) {
  const occ = d.totalShelves ? Math.round((d.tokens.length / d.totalShelves) * 100) : 0;
  const units = d.onSale.reduce((a, l) => a + l.available, 0);
  const gross30 = round2(d.last30.reduce((a, o) => a + o.subtotal, 0));
  const Kpi = ({ label, value, sub, to, testId }: { label: string; value: string; sub?: string; to: Tab; testId: string }) => (
    <button type="button" onClick={() => setTab(to)} className="rounded-3xl border border-border p-4 text-left transition hover:border-primary/40" data-testid={testId}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </button>
  );
  const notices = st.notifications.filter((n) => n.role === "owner").slice().reverse().slice(0, 6);
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Shelves rented" value={`${d.tokens.length} / ${d.totalShelves}`} sub={`${occ}% taken · ${d.active.length} active contract${d.active.length === 1 ? "" : "s"}`} to="shelves" testId="kpi-occupancy" />
        <Kpi label="Rent collected" value={usd(d.sumInv("paid"))} sub={`${usd(d.dueNow)} due now · ${usd(d.sumInv("overdue"))} overdue · ${usd(d.upcoming)} upcoming`} to="money" testId="kpi-rent" />
        <Kpi label="Sales at your store, 30 days" value={usd(gross30)} sub={`${d.last30.length} paid order${d.last30.length === 1 ? "" : "s"} · your share ${usd(d.share.earned)} to date`} to="orders" testId="kpi-sales" />
        <Kpi label="On your shelves" value={`${units} units`} sub={`${d.onSale.length} product${d.onSale.length === 1 ? "" : "s"} on sale · ${d.pendingProducts.length} to approve`} to="products" testId="kpi-stock" />
      </div>

      <Card testId="card-actions">
        <p className="flex items-center gap-2 font-display text-xl font-bold"><AlertTriangle className="h-5 w-5 text-primary" />Needs your attention <span className="text-sm font-normal text-muted-foreground">{d.actions.length}</span></p>
        {d.actions.length === 0 ? <p className="mt-2 text-sm text-muted-foreground" data-testid="no-actions">Nothing waiting for you right now.</p> : (
          <ul className="mt-3 divide-y divide-border">
            {d.actions.map((a, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5 text-sm">
                <span className={`h-2 w-2 shrink-0 rounded-full ${a.tone === "bad" ? "bg-destructive" : "bg-amber-500"}`} />
                <span className="flex-1">{a.text}</span>
                {a.href ? <Link href={a.href} className="text-sm font-semibold text-primary underline" data-testid={`action-${i}`}>Open</Link>
                  : <button type="button" onClick={() => setTab(a.tab)} className="text-sm font-semibold text-primary underline" data-testid={`action-${i}`}>Open</button>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <p className="font-display text-lg font-bold">Your stores</p>
          <ul className="mt-3 space-y-3">
            {d.shops.map((s) => {
              const taken = d.tokens.filter((t) => t.shopId === s.id).length;
              return (
                <li key={s.id} className="flex items-center gap-3 text-sm">
                  <StoreIcon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1"><b>{s.name}</b> <span className="text-muted-foreground">· {s.city}, {countryName(s.country)}{s.hours ? ` · ${s.hours}` : ""}</span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-primary" style={{ width: `${(taken / Math.max(1, slotsOf(s))) * 100}%` }} /></span></span>
                  <span className="text-xs text-muted-foreground">{taken}/{slotsOf(s)}</span>
                  <Pill>{s.status}</Pill>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card>
          <div className="flex items-center justify-between"><p className="font-display text-lg font-bold">Latest updates</p><Link href="/notifications" className="text-sm text-primary underline">All notifications</Link></div>
          {notices.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No updates yet.</p> : (
            <ul className="mt-3 space-y-2 text-sm">{notices.map((n) => <li key={n.id}>{n.link ? <Link href={n.link} className="hover:underline"><b>{n.title}.</b> <span className="text-muted-foreground">{n.body}</span></Link> : <><b>{n.title}.</b> <span className="text-muted-foreground">{n.body}</span></>} <span className="text-xs text-muted-foreground">· {fmtDate(n.at.slice(0, 10))}</span></li>)}</ul>
          )}
        </Card>
      </div>
      {st.requests.length > 0 && <Applications st={st} />}
    </div>
  );
}

function Applications({ st }: { st: State }) {
  return (
    <Card testId="my-applications">
      <p className="font-display text-lg font-bold">Your applications</p>
      <div className="mt-3 space-y-2">
        {st.requests.slice().reverse().map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-3 text-sm" data-testid={`row-my-application-${r.id}`}>
            <div className="min-w-0 flex-1"><p className="font-medium">{r.ref} · {r.business.name}</p><p className="text-xs text-muted-foreground">{r.offers.map((o) => (o === "rent" ? "Space" : o === "sell" ? "Products" : "Surplus stock")).join(" · ")} · {fmtDate(r.createdAt.slice(0, 10))}{r.statusNote ? ` · ${r.statusNote}` : ""}</p></div>
            <Pill>{r.status === "received" ? "with InRaf" : r.status}</Pill>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------- store requests from makers ----------
function Requests({ st, d, act, pending, name }: { st: State; d: D; act: Act; pending: boolean; name: string }) {
  const [f, setF] = useState<"open" | "deliveries" | "closed" | "all">("open");
  const rows = d.cases.filter((c) => f === "all" || (f === "open" && caseIsOpen(c)) || (f === "closed" && !caseIsOpen(c)));
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Makers ask your store to restock, rearrange, photograph, count or check their shelf, and report problems here. Acknowledge, assign a staff member, and mark it done with a note and photos: the maker then checks your evidence. Confirm what arrives in each delivery so their stock is right.</p>
      <div className="flex flex-wrap gap-2">{([["open", `Open (${d.cases.filter(caseIsOpen).length})`], ["deliveries", `Deliveries (${d.expectedDeliveries.length} expected)`], ["closed", "Closed"], ["all", "All"]] as const).map(([k, l]) => <button key={k} onClick={() => setF(k)} aria-pressed={f === k} className={`rounded-full border px-3 py-1.5 text-sm ${f === k ? "border-foreground bg-foreground text-background" : "border-border"}`} data-testid={`filter-requests-${k}`}>{l}</button>)}</div>
      {f === "deliveries"
        ? (d.deliveries.length === 0 ? <Empty title="No deliveries" /> : d.deliveries.map((x) => <DeliveryCard key={x.id} st={st} d={x} viewer="owner" act={act} pending={pending} />))
        : (rows.length === 0 ? <Empty title="Nothing here" text="Requests from makers renting your shelves appear here." /> : rows.map((c) => <CaseCard key={c.id} st={st} c={c} viewer="owner" viewerName={name} act={act} pending={pending} defaultOpen={c.status === "submitted"} />))}
    </div>
  );
}

// ---------- products & stock ----------
const NOT_ON_SALE = ["inactive", "rejected", "approved", "draft"];
function Products({ st, d, act, pending }: { st: State; d: D; act: Act; pending: boolean }) {
  const [f, setF] = useState<"all" | "pending" | "active" | "low" | "expiring" | "expired" | "inactive">("all");
  const rows = d.listings.filter((l) => f === "all" || (f === "pending" && l.status === "pending") || (f === "active" && l.status === "active") || (f === "low" && isLowStock(l))
    || (f === "expiring" && expiresSoon(l)) || (f === "expired" && isExpired(l) && l.available > 0) || (f === "inactive" && NOT_ON_SALE.includes(l.status)));
  const filters: [typeof f, string, number][] = [["all", "All", d.listings.length], ["pending", "To approve", d.pendingProducts.length], ["active", "On sale", d.onSale.length], ["low", "Low stock", d.lowStock.length],
    ["expiring", "Expiring ≤30 days", d.listings.filter(expiresSoon).length], ["expired", "Expired on shelf", d.expiredOnShelf.length], ["inactive", "Not on sale", d.listings.filter((l) => NOT_ON_SALE.includes(l.status)).length]];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">{filters.map(([k, l, n]) => <button key={k} onClick={() => setF(k)} aria-pressed={f === k} className={`rounded-full border px-3 py-1.5 text-sm ${f === k ? "border-foreground bg-foreground text-background" : "border-border"}`} data-testid={`filter-products-${k}`}>{l} <span className="opacity-60">{n}</span></button>)}</div>
      <p className="text-xs text-muted-foreground">Makers own their products and set their prices and stock. You approve what goes on your shelves; if something is unsafe or expired, suspend the shelf in the Shelves tab and the maker is told.</p>
      {rows.length === 0 ? <Empty title="No products here" /> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[820px] text-left text-sm" data-testid="table-products">
            <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="p-3">Product</th><th className="p-3">Maker · shelf</th><th className="p-3">Price</th><th className="p-3">Stock</th><th className="p-3">Sold / returned</th><th className="p-3">Expiry</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
            <tbody>
              {rows.map((l) => {
                const s = d.shopOf(l.shopId)!; const tok = st.tokens.find((t) => t.id === l.tokenId);
                return (
                  <tr key={l.id} className="border-t border-border align-top" data-testid={`row-product-${l.id}`}>
                    <td className="p-3"><div className="flex items-center gap-3"><ProductImage color={l.color} url={l.imageUrl} name={l.name} className="h-10 w-10" /><div><p className="font-medium">{l.name}</p><p className="text-xs text-muted-foreground">{l.sku} · {categoryLabel(l.category)} · from {countryName(l.origin)}</p></div></div></td>
                    <td className="p-3 text-xs">{holderOf(st, l.holderId).name}<br /><span className="text-muted-foreground">{s.name} · {tok ? shelfLabel(s, tok.slot) : "—"}</span></td>
                    <td className="p-3 tabular-nums">{usd(l.retail)}{l.wasPrice ? <span className="block text-xs text-muted-foreground line-through">{usd(l.wasPrice)}</span> : null}</td>
                    <td className="p-3 tabular-nums">{l.available} / {l.initialQty}{isLowStock(l) && <span className="block text-xs text-amber-700">low</span>}</td>
                    <td className="p-3 tabular-nums">{l.sold} / {l.returned}</td>
                    <td className="p-3 text-xs">{l.expiry ? <span className={isExpired(l) ? "font-semibold text-destructive" : expiresSoon(l) ? "text-amber-700" : ""}>{fmtDate(l.expiry)}{isExpired(l) ? " · expired" : ` · ${daysUntil(l.expiry)} days`}</span> : "—"}</td>
                    <td className="p-3"><Pill>{l.status}</Pill>{l.statusNote && <p className="mt-1 text-xs text-muted-foreground">{l.statusNote}</p>}</td>
                    <td className="p-3">{l.status === "pending" && (
                      <div className="flex gap-1">
                        <SmallButton tone="solid" disabled={pending} onClick={() => act(() => actions.decideListing(l.id, true, ""), "Product approved")} testId={`button-approve-${l.id}`}><Check className="h-4 w-4" />Approve</SmallButton>
                        <SmallButton disabled={pending} onClick={() => { const n = window.prompt("Reason for rejection (shown to the maker)"); if (n !== null) act(() => actions.decideListing(l.id, false, n), "Product rejected"); }} testId={`button-reject-${l.id}`}><X className="h-4 w-4" />Reject</SmallButton>
                      </div>
                    )}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ---------- orders & sales ----------
function Orders({ st, d }: { st: State; d: D }) {
  const [f, setF] = useState<"all" | "paid" | "refunds" | "refunded" | "other">("all");
  const rows = d.orders.filter((o) => f === "all" || (f === "paid" && paid(o)) || (f === "refunds" && o.refund?.status === "requested") || (f === "refunded" && o.payment === "refunded") || (f === "other" && ["failed", "cancelled", "authorized"].includes(o.payment)));
  const gross = round2(d.captured.reduce((a, o) => a + o.subtotal, 0));
  const refunded = d.orders.filter((o) => o.payment === "refunded");
  const exportCsv = () => downloadBlob(`inraf-orders-${today()}.csv`, toCsv(rows.map((o) => ({ ref: o.ref, date: when(o), store: d.shopOf(o.shopId)?.name, product: o.productName, sku: o.sku, qty: o.qty, unit: o.unit, subtotal: o.subtotal, tax: o.tax, your_share: o.shopShare ?? 0, payment: o.payment, refund: o.refund?.status ?? "", maker: holderOf(st, o.holderId).name }))), "text/csv");
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Paid orders" value={String(d.captured.length)} sub={`${usd(gross)} in product sales`} testId="stat-paid-orders" />
        <Stat label="Your share of sales" value={usd(d.share.earned)} sub="only on share-of-sales or consignment contracts" />
        <Stat label="Refunded" value={String(refunded.length)} sub={usd(round2(refunded.reduce((a, o) => a + o.subtotal, 0)))} />
        <Stat label="Refunds waiting" value={String(d.refundRequests.length)} sub="InRaf decides refunds" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {([["all", "All"], ["paid", "Paid"], ["refunds", "Refund requested"], ["refunded", "Refunded"], ["other", "Unpaid / cancelled"]] as const).map(([k, l]) => <button key={k} onClick={() => setF(k)} aria-pressed={f === k} className={`rounded-full border px-3 py-1.5 text-sm ${f === k ? "border-foreground bg-foreground text-background" : "border-border"}`} data-testid={`filter-orders-${k}`}>{l}</button>)}
        <span className="flex-1" />
        <SmallButton onClick={exportCsv} disabled={rows.length === 0} testId="button-export-orders"><Download className="h-4 w-4" />Export CSV</SmallButton>
      </div>
      <p className="text-xs text-muted-foreground">Shoppers pay by scanning the QR on the shelf, so there's nothing for you to pack or ship: the product leaves your store with the shopper. Payments are simulated today.</p>
      {rows.length === 0 ? <Empty title="No orders yet" text="Orders appear here as soon as a shopper buys from a shelf in your store." /> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-left text-sm" data-testid="table-orders">
            <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="p-3">Order</th><th className="p-3">Product</th><th className="p-3">Qty</th><th className="p-3">Sale</th><th className="p-3">Your share</th><th className="p-3">Payment</th><th className="p-3">Refund</th></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-t border-border" data-testid={`row-order-${o.id}`}>
                  <td className="p-3"><p className="font-medium">{o.ref}</p><p className="text-xs text-muted-foreground">{fmtDate(when(o))} · {d.shopOf(o.shopId)?.name}</p></td>
                  <td className="p-3">{o.productName}<p className="text-xs text-muted-foreground">{holderOf(st, o.holderId).name}</p></td>
                  <td className="p-3 tabular-nums">{o.qty}</td>
                  <td className="p-3 tabular-nums">{usd(o.subtotal)}</td>
                  <td className="p-3 tabular-nums">{o.shopShare ? `${usd(o.payment === "refunded" ? 0 : o.shopShare)} (${o.sharePct}%)` : "—"}</td>
                  <td className="p-3"><Pill>{o.payment}</Pill></td>
                  <td className="p-3">{o.refund ? <Pill>{o.refund.status}</Pill> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ---------- renters & shoppers ----------
function Renters({ st, d }: { st: State; d: D }) {
  const holderIds = [...new Set(d.contracts.map((c) => c.holderId))];
  const shoppers = new Map<string, { orders: number; spent: number; last: string }>();
  d.captured.forEach((o) => { const k = o.customerLabel; const x = shoppers.get(k) ?? { orders: 0, spent: 0, last: "" }; x.orders++; x.spent = round2(x.spent + o.subtotal); x.last = when(o) > x.last ? when(o) : x.last; shoppers.set(k, x); });
  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-display text-xl font-bold">Makers renting from you <span className="text-sm font-normal text-muted-foreground">{holderIds.length}</span></h2>
        <p className="text-xs text-muted-foreground">The businesses and people who rent your shelves. You deal with them through offers and contracts on InRaf.</p>
        {holderIds.length === 0 ? <div className="mt-3"><Empty title="No renters yet" /></div> : (
          <Card className="mt-3 overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-left text-sm" data-testid="table-renters">
              <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="p-3">Maker</th><th className="p-3">Contracts</th><th className="p-3">Shelves</th><th className="p-3">Rent paid to you</th><th className="p-3">Their sales here</th><th className="p-3" /></tr></thead>
              <tbody>
                {holderIds.map((h) => {
                  const m = holderOf(st, h); const cs = d.contracts.filter((c) => c.holderId === h);
                  const rentPaid = round2(d.invoices.filter((i) => cs.some((c) => c.id === i.contractId) && invoiceStatus(i) === "paid").reduce((a, i) => a + i.total, 0));
                  const sales = d.captured.filter((o) => o.holderId === h);
                  const latest = cs[cs.length - 1];
                  return (
                    <tr key={h} className="border-t border-border" data-testid={`row-renter-${h}`}>
                      <td className="p-3"><p className="font-medium">{m.name}</p><p className="text-xs text-muted-foreground">{m.kind}{m.country ? ` · ${countryName(m.country)}` : ""}</p></td>
                      <td className="p-3 text-xs">{cs.map((c) => <span key={c.id} className="mr-1 inline-block"><Pill>{contractStatus(c)}</Pill></span>)}</td>
                      <td className="p-3 tabular-nums">{d.tokens.filter((t) => t.holderId === h).length}</td>
                      <td className="p-3 tabular-nums">{usd(rentPaid)}</td>
                      <td className="p-3 tabular-nums">{sales.length} · {usd(round2(sales.reduce((a, o) => a + o.subtotal, 0)))}</td>
                      <td className="p-3">{latest && <Link href={`/contracts/${latest.id}`} className="text-sm text-primary underline">Contract</Link>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </section>
      <section>
        <h2 className="font-display text-xl font-bold">Shoppers <span className="text-sm font-normal text-muted-foreground">{shoppers.size}</span></h2>
        <p className="text-xs text-muted-foreground">Shoppers buy by QR without giving their name or contact details, so InRaf shows each one only by a customer number. No personal data is shared with stores.</p>
        {shoppers.size === 0 ? <div className="mt-3"><Empty title="No paid orders yet" /></div> : (
          <Card className="mt-3 overflow-x-auto p-0">
            <table className="w-full min-w-[480px] text-left text-sm" data-testid="table-shoppers">
              <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="p-3">Customer</th><th className="p-3">Orders</th><th className="p-3">Spent</th><th className="p-3">Last order</th></tr></thead>
              <tbody>{[...shoppers.entries()].sort((a, b) => b[1].spent - a[1].spent).map(([k, x]) => <tr key={k} className="border-t border-border"><td className="p-3">{k}</td><td className="p-3 tabular-nums">{x.orders}</td><td className="p-3 tabular-nums">{usd(x.spent)}</td><td className="p-3">{fmtDate(x.last)}</td></tr>)}</tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}

// ---------- shelves ----------
function Shelves({ st, d, act, pending }: { st: State; d: D; act: Act; pending: boolean }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {d.shops.map((s) => {
        const slots = Array.from({ length: slotsOf(s) }, (_, i) => i);
        return (
          <Card key={s.id} testId={`card-occupancy-${s.id}`}>
            <div className="flex items-center justify-between"><p className="font-display text-lg font-bold">{s.name}</p><Pill>{s.status}</Pill></div>
            <p className="text-sm text-muted-foreground" data-testid={`text-rented-${s.id}`}>{d.tokens.filter((t) => t.shopId === s.id).length} of {slotsOf(s)} shelves taken · {s.shelf.widthCm}×{s.shelf.heightCm}×{s.shelf.depthCm} cm each</p>
            <ul className="mt-3 divide-y divide-border text-sm">
              {slots.map((slot) => {
                const t = d.tokens.find((x) => x.shopId === s.id && x.slot === slot);
                const c: Contract | undefined = t && st.contracts.find((x) => x.id === t.contractId);
                const cs = c ? contractStatus(c) : null;
                const units = t ? st.listings.filter((l) => l.tokenId === t.id && l.status === "active").reduce((a, l) => a + l.available, 0) : 0;
                const end = c && executedVersion(c)?.snapshot.terms.end;
                return (
                  <li key={slot} className="flex flex-wrap items-center gap-2 py-2" data-testid={`shelf-${s.id}-${slot}`}>
                    <span className="w-24 font-mono text-xs">{shelfLabel(s, slot)}</span>
                    <span className="min-w-0 flex-1">{t ? <>{holderOf(st, t.holderId).name}<span className="block text-xs text-muted-foreground">{units} units on sale{end ? ` · until ${fmtDate(end)}` : ""}{c?.model === "consignment" ? " · consignment" : ""}</span></> : <span className="text-muted-foreground">Free</span>}</span>
                    {t?.suspended && <Pill tone="bad">suspended</Pill>}
                    {c && <Link href={`/contracts/${c.id}`}><Pill>{cs}</Pill></Link>}
                    {t && !s.seeded && cs === "active" && (
                      <SmallButton tone={t.suspended ? "outline" : "danger"} disabled={pending} onClick={() => { const n = t.suspended ? "Reinstated by owner" : window.prompt("Why suspend sales on this shelf? (the maker sees this)"); if (n !== null) act(() => actions.setShelfSuspended(t.id, !t.suspended, n), t.suspended ? "Shelf reinstated" : "Shelf suspended"); }} testId={`button-suspend-${t.id}`}>{t.suspended ? "Reinstate" : "Suspend"}</SmallButton>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

// ---------- money ----------
function Money({ st, d }: { st: State; d: D }) {
  const deposits = round2(d.invoices.filter((i) => i.kind === "deposit" && invoiceStatus(i) === "paid").reduce((a, i) => a + i.total, 0));
  const rows = d.invoices.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const exportCsv = () => downloadBlob(`inraf-rent-${today()}.csv`, toCsv(rows.map((i) => { const c = d.contracts.find((x) => x.id === i.contractId)!; return { invoice: i.ref, contract: c.ref, store: d.shopOf(c.shopId)?.name, maker: holderOf(st, c.holderId).name, label: i.label, kind: i.kind, due: i.dueDate, amount: i.amount, tax: i.tax, total: i.total, status: invoiceStatus(i), late_fee: i.lateFee ?? (invoiceStatus(i) === "overdue" ? lateFeeFor(st, i) : 0), receipt: i.receiptRef ?? "" }; })), "text/csv");
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Rent collected" value={usd(round2(d.sumInv("paid") - deposits))} testId="text-earnings" />
        <Stat label="Deposits held" value={usd(deposits)} sub="returned to makers at the end" />
        <Stat label="Due now" value={usd(d.dueNow)} sub={`${usd(d.upcoming)} more scheduled later in the term`} />
        <Stat label="Overdue (+ late fees)" value={usd(d.sumInv("overdue"))} />
        <Stat label="Share of sales" value={usd(d.share.earned)} sub={`${usd(d.share.settled)} settled to you`} testId="text-share-earned" />
      </div>
      <p className="text-xs text-muted-foreground">InRaf doesn't charge you a fee on rent: its commission is taken from makers' product sales. Payments are simulated today: no money moves yet.</p>
      <Card className="overflow-x-auto p-0">
        <div className="flex items-center justify-between p-3"><p className="font-semibold">Rent and deposit invoices</p><SmallButton onClick={exportCsv} disabled={rows.length === 0} testId="button-export-rent"><Download className="h-4 w-4" />Export CSV</SmallButton></div>
        {rows.length === 0 ? <p className="px-3 pb-4 text-sm text-muted-foreground">No rent schedule yet: it starts when a contract becomes active.</p> : (
          <table className="w-full min-w-[640px] text-left text-sm" data-testid="table-invoices">
            <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="p-3">Invoice</th><th className="p-3">Maker</th><th className="p-3">Due</th><th className="p-3">Total</th><th className="p-3">Status</th></tr></thead>
            <tbody>{rows.map((i) => { const c = d.contracts.find((x) => x.id === i.contractId)!; return (
              <tr key={i.id} className="border-t border-border"><td className="p-3"><Link href={`/contracts/${c.id}`} className="hover:underline">{c.ref} · {i.label}</Link><p className="text-xs text-muted-foreground">{i.ref}{i.receiptRef ? ` · receipt ${i.receiptRef}` : ""}</p></td><td className="p-3">{holderOf(st, c.holderId).name}</td><td className="p-3">{fmtDate(i.dueDate)}</td><td className="p-3 tabular-nums">{usd(i.total)}</td><td className="p-3"><Pill>{invoiceStatus(i)}</Pill></td></tr>
            ); })}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ---------- analytics ----------
function Analytics({ d }: { d: D }) {
  const days = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 86400e3).toISOString().slice(0, 10));
  const byDay = days.map((day) => round2(d.captured.filter((o) => when(o) === day).reduce((a, o) => a + o.subtotal, 0)));
  const max = Math.max(1, ...byDay);
  const top = new Map<string, { name: string; qty: number; sales: number }>();
  d.captured.forEach((o) => { const x = top.get(o.listingId) ?? { name: o.productName, qty: 0, sales: 0 }; x.qty += o.qty; x.sales = round2(x.sales + o.subtotal); top.set(o.listingId, x); });
  const issued = d.invoices.filter((i) => i.dueDate <= today());
  const collected = issued.filter((i) => invoiceStatus(i) === "paid").length;
  return (
    <div className="space-y-5">
      <Card testId="card-sales-chart">
        <p className="flex items-center gap-2 font-display text-lg font-bold"><BarChart3 className="h-5 w-5 text-primary" />Product sales at your store, last 30 days</p>
        {byDay.every((v) => v === 0) ? <p className="mt-2 text-sm text-muted-foreground">No paid sales in the last 30 days.</p> : (
          <svg viewBox="0 0 600 160" className="mt-4 max-h-56 w-full" role="img" aria-label="Daily product sales, last 30 days">
            {byDay.map((v, i) => <rect key={i} x={i * 20 + 2} y={140 - (v / max) * 130} width={16} height={(v / max) * 130} rx={3} className="fill-primary"><title>{`${fmtDate(days[i])}: ${usd(v)}`}</title></rect>)}
            <line x1={0} y1={140.5} x2={600} y2={140.5} className="stroke-border" />
            <text x={0} y={156} fontSize={8} className="fill-muted-foreground">{fmtDate(days[0])}</text>
            <text x={600} y={156} textAnchor="end" fontSize={8} className="fill-muted-foreground">today</text>
          </svg>
        )}
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <p className="font-display text-lg font-bold">Best-selling products</p>
          {top.size === 0 ? <p className="mt-2 text-sm text-muted-foreground">No paid sales yet.</p> : (
            <ol className="mt-3 space-y-2 text-sm">{[...top.values()].sort((a, b) => b.sales - a.sales).slice(0, 8).map((p, i) => <li key={i} className="flex justify-between gap-3"><span>{i + 1}. {p.name}</span><span className="tabular-nums text-muted-foreground">{p.qty} sold · {usd(p.sales)}</span></li>)}</ol>
          )}
        </Card>
        <Card>
          <p className="font-display text-lg font-bold">Store performance</p>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground"><tr><th className="py-1">Store</th><th className="py-1">Shelves taken</th><th className="py-1">Paid orders</th><th className="py-1">Sales</th></tr></thead>
            <tbody>{d.shops.map((s) => { const os = d.captured.filter((o) => o.shopId === s.id); return <tr key={s.id} className="border-t border-border"><td className="py-1.5">{s.name}</td><td className="py-1.5 tabular-nums">{d.tokens.filter((t) => t.shopId === s.id).length}/{slotsOf(s)}</td><td className="py-1.5 tabular-nums">{os.length}</td><td className="py-1.5 tabular-nums">{usd(round2(os.reduce((a, o) => a + o.subtotal, 0)))}</td></tr>; })}</tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">Rent invoices paid, of those already due: {collected} of {issued.length}{issued.length ? ` (${Math.round((collected / issued.length) * 100)}%)` : ""}.</p>
        </Card>
      </div>
    </div>
  );
}

// ---------- store & settings ----------
function Stores({ st, d, act, session }: { st: State; d: D; act: Act; session: ReturnType<typeof useSession> }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        {d.shops.map((s) => {
          const rented = st.tokens.filter((t) => t.shopId === s.id).length;
          const checks: [boolean, string][] = [
            [!!s.registration || s.seeded, "Business registration number"], [s.photos.some((p) => p.kind === "front"), "Photo of the shop front"],
            [s.photos.some((p) => p.kind === "shelf"), "Photo of the shelf"], [!!s.hours, "Opening hours"], [s.status === "approved", "Approved by InRaf"],
          ];
          return (
            <Card key={s.id} testId={`card-listing-${s.id}`}>
              <IsoFloor width={s.width} depth={s.depth} bricks={s.bricks} hue={s.hue} />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-xl font-bold">{s.name}</p>
                  <p className="text-sm text-muted-foreground">{s.address || `${s.location}, ${s.city}`}, {countryName(s.country)}</p>
                  <p className="text-sm text-muted-foreground">{s.hours ? `Open ${s.hours}` : "Opening hours not set"} · {usd(s.price)}/mo per shelf · min {s.terms.months} months</p>
                  <div className="mt-1 flex gap-2"><Pill testId={`status-store-${s.id}`}>{s.status}</Pill>{s.seeded && <Pill tone="mute">sample</Pill>}</div>
                  {s.statusNote && <p className="mt-1 text-xs text-muted-foreground">{s.statusNote}</p>}
                </div>
                {isMine(s, session) && (
                  <div className="flex gap-1">
                    <Link href={`/owner-dashboard/shops/${s.id}`} aria-label="Edit store" className="rounded-full p-2 text-muted-foreground hover:bg-muted" data-testid={`link-edit-${s.id}`}><Pencil className="h-4 w-4" /></Link>
                    <button aria-label="Remove listing" disabled={rented > 0} title={rented ? "Has rentals on record" : "Remove"}
                      onClick={() => { if (window.confirm(session.live ? "Remove this store from InRaf?" : "Remove this demo store?")) act(() => actions.deleteShop(s.id), "Store removed"); }}
                      className="rounded-full p-2 text-muted-foreground transition hover:bg-muted disabled:opacity-30" data-testid={`button-delete-${s.id}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
              <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2" data-testid={`checklist-${s.id}`}>
                {checks.map(([ok, l]) => <li key={l} className={`flex items-center gap-1.5 ${ok ? "" : "text-muted-foreground"}`}>{ok ? <Check className="h-4 w-4 text-primary" /> : <X className="h-4 w-4" />}{l}</li>)}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">Rental terms: {s.terms.deposit ? `${usd(s.terms.deposit)} deposit` : "no deposit"} · {s.terms.noticeDays ?? 30} days' notice · late fee {s.terms.lateFeePct}% after {s.terms.graceDays} days · {s.listing.instantBook ? "instant book on" : "requests need your OK"}.</p>
            </Card>
          );
        })}
      </div>
      {st.requests.length > 0 && <Applications st={st} />}
      <Card>
        <p className="font-display text-lg font-bold">Account and access</p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li>Signed in as <b className="text-foreground">{session.me?.email ?? "this browser (demo)"}</b>. Only this account can manage these stores.</li>
          <li>Staff accounts and shared access aren't available yet: one account manages a store today.</li>
          <li>Notifications appear under the bell at the top of every page. <Link href="/notifications" className="text-primary underline">Open notifications</Link></li>
          <li>The policies makers agree to come from your rental terms above and the <Link href="/terms" className="text-primary underline">InRaf Terms</Link>.</li>
        </ul>
      </Card>
    </div>
  );
}
