import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { Shell, PageTitle, PrimaryButton } from "@/components/shell";
import { ShelfArt } from "@/components/shelf-art";
import { IsoFloor } from "@/components/iso-floor";
import { Card, Empty, ErrorNote, Pill, ProductImage, SmallButton, Stat, Tabs } from "@/components/kit";
import { categoryLabel, countryName } from "@/lib/data";
import { useStore, usd } from "@/lib/store";
import { actions } from "@/lib/actions";
import { useAct } from "@/hooks/use-act";
import { holderOf } from "@/lib/ops";
import { awaitingVersion, contractStatus, executedVersion, invoiceStatus, lateFeeFor, shelfLabel, slotsOf } from "@/lib/selectors";
import { daysUntil, fmtDate, round2 } from "@/lib/util";

export default function OwnerDashboard() {
  const st = useStore();
  const [, go] = useLocation();
  const search = useSearch();
  const [tab, setTab] = useState(new URLSearchParams(search).get("tab") ?? "todo");
  const own = st.shops.filter((s) => !s.seeded);
  const [samples, setSamples] = useState(own.length === 0);
  const { act, error, pending } = useAct();

  const shops = st.shops.filter((s) => !s.seeded || samples);
  const ids = new Set(shops.map((s) => s.id));
  const contracts = st.contracts.filter((c) => ids.has(c.shopId));
  const toSign = contracts.filter((c) => { const v = awaitingVersion(c); return v && !c.terminatedAt && !v.ownerSig; });
  const products = st.listings.filter((l) => ids.has(l.shopId) && l.status === "pending");
  const invoices = st.invoices.filter((i) => contracts.some((c) => c.id === i.contractId) && invoiceStatus(i) !== "void");
  const sumBy = (k: string) => round2(invoices.filter((i) => invoiceStatus(i) === k).reduce((a, i) => a + i.total + (k === "paid" ? i.lateFee ?? 0 : lateFeeFor(st, i)), 0));
  const expiring = contracts.filter((c) => contractStatus(c) === "active" && daysUntil(executedVersion(c)!.snapshot.terms.end) <= 30);

  return (
    <Shell title="Owner portal" back="/">
      <PageTitle title="My shop" sub="Store-owner view. Your stores are yours to sign; sample stores use simulated owner actions.">
        <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={samples} onChange={(e) => setSamples(e.target.checked)} data-testid="checkbox-samples" />Include sample stores (simulated owners)</label>
        <Tabs value={tab} onChange={setTab} options={[{ id: "todo", label: "To do", count: toSign.length + products.length }, { id: "shelves", label: "Shelves" }, { id: "rent", label: "Rent" }, { id: "stores", label: "Stores", count: expiring.length }]} />
      </PageTitle>
      <div className="mx-auto mt-6 max-w-4xl"><ErrorNote error={error} /></div>

      {shops.length === 0 ? (
        <div className="mt-10 flex flex-col items-center text-center" data-testid="empty-listings">
          <ShelfArt tiers={3} hue={150} fill={[null, null, null]} className="w-48" />
          <p className="mt-4 text-muted-foreground">No store yet.</p>
          <PrimaryButton className="mt-6" onClick={() => go("/owner")} data-testid="button-list-shop">List your shop</PrimaryButton>
        </div>
      ) : tab === "todo" ? (
        <div className="mx-auto mt-4 max-w-3xl space-y-6">
          <section>
            <h2 className="font-display text-xl font-bold">Contracts to sign</h2>
            <div className="mt-3 space-y-2">
              {toSign.length === 0 && <Empty title="Nothing to sign" />}
              {toSign.map((c) => {
                const v = awaitingVersion(c)!;
                return (
                  <Link key={c.id} href={`/contracts/${c.id}`} className="flex items-center gap-3 rounded-3xl border border-border p-4 hover:border-primary/40" data-testid={`link-sign-${c.id}`}>
                    <div className="min-w-0 flex-1"><p className="font-medium">{c.ref} v{v.v} · {v.snapshot.shelf.label}</p><p className="text-xs text-muted-foreground">{holderOf(st, c.holderId).name} · {v.kind} · {v.adminApproval ? "platform approved" : "awaiting platform"}</p></div>
                    <Pill tone="warn">review & sign</Pill>
                  </Link>
                );
              })}
            </div>
          </section>
          <section>
            <h2 className="font-display text-xl font-bold">Products to approve</h2>
            <div className="mt-3 space-y-3">
              {products.length === 0 && <Empty title="No product requests" />}
              {products.map((l) => {
                const shop = st.shops.find((s) => s.id === l.shopId)!;
                const allowed = shop.categories.includes(l.category);
                return (
                  <Card key={l.id} testId={`card-request-${l.id}`}>
                    <div className="flex gap-4">
                      <ProductImage color={l.color} url={l.imageUrl} name={l.name} />
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-lg font-bold">{l.initialQty} × {l.name}</p>
                        <p className="text-sm text-muted-foreground">{l.sku} · {categoryLabel(l.category)} · from {countryName(l.origin)} · {shop.name}</p>
                        <p className="text-xs text-muted-foreground">{usd(l.retail)} · batch {l.batch || "—"}{l.expiry ? ` · expires ${fmtDate(l.expiry)}` : ""} · {holderOf(st, l.holderId).name}</p>
                        {!allowed && <p className="mt-1 text-xs text-destructive">Category not in this store's list (sample check).</p>}
                        {l.statusNote && <p className="mt-1 text-xs text-muted-foreground">{l.statusNote}</p>}
                        <div className="mt-3 flex gap-2">
                          <SmallButton tone="solid" disabled={pending} onClick={() => act(() => actions.decideListing(l.id, true, ""), "Product approved")} testId={`button-approve-${l.id}`}><Check className="h-4 w-4" />Approve</SmallButton>
                          <SmallButton disabled={pending} onClick={() => { const n = window.prompt("Reason for rejection (shown to holder)") ?? ""; act(() => actions.decideListing(l.id, false, n), "Product rejected"); }} testId={`button-reject-${l.id}`}><X className="h-4 w-4" />Reject</SmallButton>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        </div>
      ) : tab === "shelves" ? (
        <div className="mx-auto mt-4 grid max-w-4xl gap-5 md:grid-cols-2">
          {shops.map((s) => {
            const toks = st.tokens.filter((t) => t.shopId === s.id && !t.released);
            return (
              <Card key={s.id} testId={`card-occupancy-${s.id}`}>
                <div className="flex items-center justify-between"><p className="font-display text-lg font-bold">{s.name}</p><Pill>{s.status}</Pill></div>
                <p className="text-sm text-muted-foreground" data-testid={`text-rented-${s.id}`}>{toks.length} of {slotsOf(s)} shelves taken</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-secondary-foreground" style={{ width: `${(toks.length / Math.max(1, slotsOf(s))) * 100}%` }} /></div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {toks.map((t) => {
                    const c = st.contracts.find((x) => x.id === t.contractId);
                    const units = st.listings.filter((l) => l.tokenId === t.id && l.status === "active").reduce((a, l) => a + l.available, 0);
                    return (
                      <li key={t.id} className="flex items-center gap-2"><span className="flex-1">{shelfLabel(s, t.slot)} · {holderOf(st, t.holderId).name}</span><span className="text-xs text-muted-foreground">{units} units</span>{t.suspended && <Pill tone="bad">suspended</Pill>}{c && <Link href={`/contracts/${c.id}`} data-testid={`link-occ-contract-${t.id}`}><Pill>{contractStatus(c)}</Pill></Link>}</li>
                    );
                  })}
                  {toks.length === 0 && <li className="text-muted-foreground">No rentals yet.</li>}
                </ul>
              </Card>
            );
          })}
        </div>
      ) : tab === "rent" ? (
        <div className="mx-auto mt-4 max-w-4xl space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Paid (simulated)" value={usd(sumBy("paid"))} testId="text-earnings" />
            <Stat label="Due" value={usd(sumBy("due"))} />
            <Stat label="Overdue (+ late fees)" value={usd(sumBy("overdue"))} />
          </div>
          <Card>
            <ul className="divide-y divide-border text-sm">
              {invoices.length === 0 && <li className="py-3 text-muted-foreground">No rent schedule yet — it starts when a contract activates.</li>}
              {invoices.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((i) => {
                const c = contracts.find((x) => x.id === i.contractId)!;
                return <li key={i.id} className="flex flex-wrap items-center gap-2 py-2.5"><span className="flex-1">{c.ref} · {i.label}<br /><span className="text-xs text-muted-foreground">{i.ref} · due {fmtDate(i.dueDate)}{i.receiptRef ? ` · receipt ${i.receiptRef}` : ""}</span></span><span className="tabular-nums">{usd(i.total)}</span><Pill>{invoiceStatus(i)}</Pill></li>;
              })}
            </ul>
          </Card>
          <p className="text-center text-xs text-muted-foreground">Rent is paid by the token holder (simulated). It's tracked separately from product sales.</p>
        </div>
      ) : (
        <div className="mx-auto mt-4 grid max-w-4xl gap-5 md:grid-cols-2">
          {expiring.length > 0 && (
            <Card className="md:col-span-2 bg-accent/40" testId="card-renewals">
              <p className="font-semibold">Renewal reminders</p>
              <ul className="mt-1 text-sm">{expiring.map((c) => <li key={c.id}><Link href={`/contracts/${c.id}`} className="underline" data-testid={`link-renew-${c.id}`}>{c.ref} ends {fmtDate(executedVersion(c)!.snapshot.terms.end)}</Link></li>)}</ul>
            </Card>
          )}
          {shops.map((s) => {
            const rented = st.tokens.filter((t) => t.shopId === s.id).length;
            return (
              <Card key={s.id} testId={`card-listing-${s.id}`}>
                <IsoFloor width={s.width} depth={s.depth} bricks={s.bricks} hue={s.hue} />
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-xl font-bold">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.city}, {countryName(s.country)} · {usd(s.price)}/mo</p>
                    <div className="mt-1 flex gap-2"><Pill testId={`status-store-${s.id}`}>{s.status}</Pill>{s.seeded && <Pill tone="mute">sample</Pill>}</div>
                    {s.statusNote && <p className="mt-1 text-xs text-muted-foreground">{s.statusNote}</p>}
                  </div>
                  {!s.seeded && (
                    <div className="flex gap-1">
                      <Link href={`/owner-dashboard/shops/${s.id}`} aria-label="Edit store" className="rounded-full p-2 text-muted-foreground hover:bg-muted" data-testid={`link-edit-${s.id}`}><Pencil className="h-4 w-4" /></Link>
                      <button aria-label="Remove listing" disabled={rented > 0} title={rented ? "Has rentals on record" : "Remove"}
                        onClick={() => { if (window.confirm("Remove this demo store?")) act(() => actions.deleteShop(s.id), "Store removed"); }}
                        className="rounded-full p-2 text-muted-foreground transition hover:bg-muted disabled:opacity-30" data-testid={`button-delete-${s.id}`}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
