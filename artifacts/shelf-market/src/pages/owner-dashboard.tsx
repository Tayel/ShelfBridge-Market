import { useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Trash2, X } from "lucide-react";
import { Shell, PrimaryButton, GhostButton, Segmented } from "@/components/shell";
import { ShelfArt } from "@/components/shelf-art";
import { IsoFloor } from "@/components/iso-floor";
import { categoryLabel, countryName } from "@/lib/data";
import { runChecks } from "@/lib/checks";
import { actions, productOf, slotsOf, useStore, usd } from "@/lib/store";

export default function OwnerDashboard() {
  const st = useStore();
  const [, go] = useLocation();
  const [tab, setTab] = useState<"requests" | "listings" | "earnings">("requests");
  const mine = st.shops.filter((s) => !s.seeded);
  const myIds = new Set(mine.map((s) => s.id));
  const myTokens = st.tokens.filter((t) => myIds.has(t.shopId));
  const pending = myTokens.filter((t) => t.stage === "requested");
  const earned = myTokens.reduce((a, t) => a + t.rent, 0);

  return (
    <Shell title="My shop" back="/">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="font-display text-4xl font-bold md:text-5xl">My shop</h1>
        {mine.length > 0 && (
          <Segmented value={tab} onChange={(value) => { if (value === "requests" || value === "listings" || value === "earnings") setTab(value); }} options={[
            { id: "requests", label: `Requests${pending.length ? ` (${pending.length})` : ""}` },
            { id: "listings", label: "Listings" },
            { id: "earnings", label: "Earnings" },
          ]} />
        )}
      </div>

      {mine.length === 0 ? (
        <div className="mt-14 flex flex-col items-center text-center" data-testid="empty-listings">
          <ShelfArt tiers={3} hue={150} fill={[null, null, null]} className="w-48" />
          <p className="mt-4 text-muted-foreground">No listing yet.</p>
          <PrimaryButton className="mt-6" onClick={() => go("/owner")} data-testid="button-list-shop">List your shop</PrimaryButton>
        </div>
      ) : tab === "requests" ? (
        <div className="mx-auto mt-10 max-w-lg space-y-4">
          {pending.length === 0 && (
            <div className="flex flex-col items-center text-center text-muted-foreground" data-testid="empty-requests">
              <ShelfArt tiers={1} hue={150} fill={[null]} className="w-48" />
              <p className="mt-3">No product requests right now.</p>
            </div>
          )}
          <AnimatePresence>
            {pending.map((t) => {
              const shop = st.shops.find((s) => s.id === t.shopId)!;
              const p = productOf(t.productId)!;
              const checks = runChecks(p, shop, t.origin ?? "");
              return (
                <motion.div key={t.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 60 }}
                  className="rounded-[1.75rem] border border-border p-6" data-testid={`card-request-${t.id}`}>
                  <ShelfArt tiers={1} hue={shop.hue} fill={[p.color]} className="h-16 w-full" />
                  <p className="font-display mt-3 text-xl font-bold">{t.qty} × {p.name}</p>
                  <p className="text-sm text-muted-foreground">From {countryName(t.origin ?? "")} · {shop.name} · {categoryLabel(p.category)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Sample checks: {checks.filter((c) => c.ok).length}/{checks.length} pass (illustrative)</p>
                  <div className="mt-4 flex gap-2">
                    <PrimaryButton className="flex-1" onClick={() => actions.decide(t.id, true)} data-testid={`button-approve-${t.id}`}><Check className="h-4 w-4" />Approve</PrimaryButton>
                    <GhostButton onClick={() => actions.decide(t.id, false)} data-testid={`button-reject-${t.id}`}><X className="h-4 w-4" />Reject</GhostButton>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : tab === "listings" ? (
        <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
          {mine.map((s) => {
            const rented = st.tokens.filter((t) => t.shopId === s.id).length;
            return (
              <div key={s.id} className="rounded-[1.75rem] border border-border p-5" data-testid={`card-listing-${s.id}`}>
                <IsoFloor width={s.width} depth={s.depth} bricks={s.bricks} hue={s.hue} />
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display text-xl font-bold">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.city}, {countryName(s.country)} · {usd(s.price)}/mo</p>
                  </div>
                  <button aria-label="Remove listing" disabled={rented > 0} title={rented ? "Has rented shelves" : "Remove"}
                    onClick={() => { if (confirm("Remove this demo listing?")) actions.deleteShop(s.id); }}
                    className="rounded-full p-2 text-muted-foreground transition hover:bg-muted disabled:opacity-30" data-testid={`button-delete-${s.id}`}><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-secondary-foreground transition-all" style={{ width: `${(rented / slotsOf(s)) * 100}%` }} /></div>
                <p className="mt-1 text-sm text-muted-foreground" data-testid={`text-rented-${s.id}`}>{rented} of {slotsOf(s)} shelves rented</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mx-auto mt-10 max-w-md text-center">
          <div className="rounded-[2rem] border border-border p-8">
            <p className="text-sm text-muted-foreground">Simulated rental earnings</p>
            <p className="font-display text-6xl font-bold tabular-nums text-secondary-foreground" data-testid="text-earnings">{usd(earned)}</p>
            <p className="mt-3 text-sm text-muted-foreground">{myTokens.length} shelf rental{myTokens.length === 1 ? "" : "s"} across {mine.length} listing{mine.length === 1 ? "" : "s"}</p>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Demo only. No money was received.</p>
        </div>
      )}
    </Shell>
  );
}
