import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Shell, PrimaryButton, Segmented } from "@/components/shell";
import { ShelfArt } from "@/components/shelf-art";
import { actions, productOf, remaining, useStore, usd, type Token } from "@/lib/store";

const STAGE: Record<Token["stage"], string> = { A: "Token A · empty", requested: "Awaiting owner", approved: "Approved · stock it", rejected: "Rejected", B: "Token B · stocked" };

export default function Dashboard() {
  const st = useStore();
  const [, go] = useLocation();
  const [tab, setTab] = useState<"shelves" | "money">("shelves");
  const tokens = st.tokens;
  const rent = tokens.reduce((a, t) => a + t.rent, 0);
  const stock = tokens.reduce((a, t) => a + (t.stockCost ?? 0), 0);
  const revenue = tokens.reduce((a, t) => a + t.revenue, 0);
  const profit = revenue - rent - stock;

  return (
    <Shell title="My shelves" back="/">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="font-display text-4xl font-bold md:text-5xl">My shelves</h1>
        <Segmented value={tab} onChange={(value) => { if (value === "shelves" || value === "money") setTab(value); }} options={[{ id: "shelves", label: "Shelves" }, { id: "money", label: "Money" }]} />
      </div>

      {tokens.length === 0 ? (
        <div className="mt-14 flex flex-col items-center text-center" data-testid="empty-tokens">
          <ShelfArt tiers={2} hue={12} fill={[null, null]} className="w-48" />
          <p className="mt-4 text-muted-foreground">No shelves yet.</p>
          <PrimaryButton className="mt-6" onClick={() => go("/explore")} data-testid="button-explore">Find a shelf</PrimaryButton>
        </div>
      ) : tab === "shelves" ? (
        <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
          {tokens.map((t, i) => {
            const shop = st.shops.find((s) => s.id === t.shopId);
            const p = productOf(t.productId);
            const left = remaining(t);
            const pct = t.qty ? (t.sold / t.qty) * 100 : 0;
            return (
              <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="rounded-[1.75rem] border border-border p-5" data-testid={`card-token-${t.id}`}>
                <div className="flex items-center gap-4">
                  <span className={`grid h-14 w-11 shrink-0 place-items-center rounded-xl font-display text-2xl font-bold ${t.stage === "B" ? "bg-secondary-foreground text-secondary" : "bg-primary text-primary-foreground"}`}>{t.stage === "B" ? "B" : "A"}</span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-bold">{shop?.name ?? "Shop"}</p>
                    <p className="text-sm text-muted-foreground" data-testid={`status-token-${t.id}`}>{STAGE[t.stage]}</p>
                  </div>
                </div>
                <ShelfArt tiers={1} hue={shop?.hue ?? 12} fill={[t.stage === "B" && left > 0 && p ? p.color : null]} className="mt-3 h-16 w-full" />
                {t.stage === "B" && p ? (
                  <>
                    <div className="mt-2 flex justify-between text-sm"><span>{p.name}</span><span className="tabular-nums" data-testid={`text-left-${t.id}`}>{left}/{t.qty} left</span></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><motion.div className="h-full origin-left bg-primary" animate={{ scaleX: pct / 100 }} style={{ width: "100%" }} /></div>
                    <button disabled={left <= 0} onClick={() => actions.sell(t.id)} data-testid={`button-sell-${t.id}`}
                      className="mt-4 w-full rounded-full bg-foreground py-3 font-semibold text-background transition active:scale-[.97] disabled:opacity-30">
                      {left > 0 ? `Simulate sale · ${usd(p.retail)}` : "Sold out"}
                    </button>
                  </>
                ) : (
                  <Link href={`/stock/${t.id}`} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border py-3 font-medium transition hover:bg-muted" data-testid={`link-continue-${t.id}`}>
                    Continue <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="mx-auto mt-10 max-w-md">
          <div className="rounded-[2rem] border border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">Simulated profit</p>
            <p className={`font-display text-6xl font-bold tabular-nums ${profit >= 0 ? "text-secondary-foreground" : "text-primary"}`} data-testid="text-profit">{usd(profit)}</p>
            <div className="mt-6 grid grid-cols-3 gap-2 text-sm">
              <div><p className="text-muted-foreground">Sales</p><p className="font-semibold tabular-nums" data-testid="text-revenue">{usd(revenue)}</p></div>
              <div><p className="text-muted-foreground">Rent</p><p className="font-semibold tabular-nums" data-testid="text-rent">{usd(rent)}</p></div>
              <div><p className="text-muted-foreground">Stock</p><p className="font-semibold tabular-nums" data-testid="text-stock">{usd(stock)}</p></div>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">Demo figures from your simulated actions only. No returns are promised.</p>
        </div>
      )}
    </Shell>
  );
}
