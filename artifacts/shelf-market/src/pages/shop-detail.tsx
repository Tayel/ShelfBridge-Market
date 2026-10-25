import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Ticket } from "lucide-react";
import { Shell, PrimaryButton, GhostButton } from "@/components/shell";
import { IsoFloor } from "@/components/iso-floor";
import { ShelfArt } from "@/components/shelf-art";
import { businessOf, categoryLabel, countryName } from "@/lib/data";
import { actions, takenSlots, useStore, usd } from "@/lib/store";

export default function ShopDetail() {
  const { id } = useParams<{ id: string }>();
  const st = useStore();
  const [, go] = useLocation();
  const shop = st.shops.find((s) => s.id === id);
  const [brick, setBrick] = useState<number | null>(null);
  const [tier, setTier] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const taken = useMemo(() => (shop ? takenSlots(st, shop.id) : new Set<number>()), [st, shop]);

  if (!shop) return (
    <Shell title="Not found" back="/explore">
      <p className="mt-20 text-center text-muted-foreground">This shop isn't here anymore. <Link href="/explore" className="text-primary underline">Explore</Link></p>
    </Shell>
  );

  const slot = (bIdx: number, t: number) => bIdx * shop.tiers + t;
  const busy = new Set(shop.bricks.filter((b, bi) => Array.from({ length: shop.tiers }).every((_, t) => taken.has(slot(bi, t)))));
  const bi = brick === null ? -1 : shop.bricks.indexOf(brick);
  const B = businessOf(shop.business);

  const rent = () => {
    if (bi < 0 || tier === null) return;
    const tok = actions.rent(shop.id, slot(bi, tier));
    if (tok) go(`/stock/${tok}?new=1`);
  };

  return (
    <Shell title={shop.name} back="/explore">
      <div className="text-center">
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><B.icon className="h-4 w-4" />{B.label} · {shop.city}, {countryName(shop.country)}</p>
        <h1 className="font-display mt-1 text-4xl font-bold md:text-5xl" data-testid="text-shop-name">{shop.name}</h1>
      </div>
      <div className="mt-6 grid items-center gap-6 md:grid-cols-2">
        <div>
          <IsoFloor width={shop.width} depth={shop.depth} bricks={shop.bricks} busy={busy} highlight={brick} hue={shop.hue} onPick={(i) => { setBrick(i); setTier(null); }} />
          <p className="text-center text-sm text-muted-foreground">{brick === null ? "Tap a raised spot" : "Now pick a shelf"}</p>
        </div>
        <div className="flex flex-col items-center">
          <AnimatePresence mode="wait">
            {bi >= 0 ? (
              <motion.div key={brick} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex w-full max-w-xs flex-col gap-2">
                {Array.from({ length: shop.tiers }).map((_, t) => {
                  const isTaken = taken.has(slot(bi, t));
                  return (
                    <button key={t} disabled={isTaken} onClick={() => setTier(t)} aria-pressed={tier === t} data-testid={`button-tier-${t}`}
                      className={`relative rounded-2xl border-2 p-2 transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 ${tier === t ? "border-primary" : "border-transparent hover:border-primary/30"}`}>
                      <ShelfArt tiers={1} hue={shop.hue} fill={[isTaken ? undefined : null] as (string | null)[]} className="h-14 w-full" />
                      <span className="absolute right-4 top-2 text-xs font-medium text-muted-foreground">{isTaken ? "Rented" : `Shelf ${t + 1}`}</span>
                    </button>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <ShelfArt tiers={shop.tiers} hue={shop.hue} className="w-56" />
              </motion.div>
            )}
          </AnimatePresence>
          <p className="mt-4 text-center text-sm text-muted-foreground">{shop.categories.map(categoryLabel).join(" · ")}</p>
        </div>
      </div>
      <div className="mt-8 flex justify-center">
        <PrimaryButton disabled={tier === null} onClick={() => setConfirm(true)} data-testid="button-rent">Rent for {usd(shop.price)}/mo</PrimaryButton>
      </div>

      <AnimatePresence>
        {confirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 p-4 backdrop-blur-sm" role="dialog" aria-modal aria-label="Confirm rental">
            <motion.div initial={{ y: 30, scale: 0.96 }} animate={{ y: 0, scale: 1 }} className="w-full max-w-sm rounded-[2rem] bg-background p-8 text-center shadow-2xl">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10"><Ticket className="h-8 w-8 text-primary" /></div>
              <h2 className="font-display mt-4 text-2xl font-bold">Get Token A</h2>
              <p className="mt-2 text-muted-foreground">One month of shelf {tier !== null ? tier + 1 : ""} at {shop.name}. Simulated. No money charged.</p>
              <div className="mt-6 flex flex-col gap-2">
                <PrimaryButton onClick={rent} data-testid="button-confirm-rent">Confirm simulated rental</PrimaryButton>
                <GhostButton onClick={() => setConfirm(false)} data-testid="button-cancel-rent">Cancel</GhostButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  );
}
