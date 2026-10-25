import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { FileSignature, Ruler } from "lucide-react";
import { Shell, PrimaryButton, GhostButton } from "@/components/shell";
import { IsoFloor } from "@/components/iso-floor";
import { ShelfArt } from "@/components/shelf-art";
import { Card, ErrorNote, Field, Modal, Pill, inputCls } from "@/components/kit";
import { businessOf, categoryLabel, countryName, RESTRICTIONS } from "@/lib/data";
import { takenSlots, useStore, usd } from "@/lib/store";
import { actions } from "@/lib/actions";
import { useAct } from "@/hooks/use-act";
import { holderOf, YOU_HOLDER } from "@/lib/ops";
import { addMonths, today } from "@/lib/util";

export default function ShopDetail() {
  const { id } = useParams<{ id: string }>();
  const st = useStore();
  const [, go] = useLocation();
  const shop = st.shops.find((s) => s.id === id);
  const [brick, setBrick] = useState<number | null>(null);
  const [tier, setTier] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [start, setStart] = useState(today());
  const { act, error, pending } = useAct();
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
  const T = shop.terms;
  const open = shop.status === "approved";

  const request = () => {
    if (bi < 0 || tier === null) return;
    const r = act(() => actions.requestContract({ shopId: shop.id, slot: slot(bi, tier), holderId: YOU_HOLDER, start }), "Contract request created");
    if (r.ok && r.id) go(`/contracts/${r.id}`);
  };

  return (
    <Shell title={shop.name} back="/explore">
      <div className="text-center">
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><B.icon className="h-4 w-4" />{B.label} · {shop.city}, {countryName(shop.country)}</p>
        <h1 className="font-display mt-1 text-4xl font-bold md:text-5xl" data-testid="text-shop-name">{shop.name}</h1>
        {!open && <div className="mt-3"><Pill testId="status-shop">{shop.status}</Pill></div>}
      </div>
      <div className="mt-6 grid items-center gap-6 md:grid-cols-2">
        <div>
          <IsoFloor width={shop.width} depth={shop.depth} bricks={shop.bricks} busy={busy} highlight={brick} hue={shop.hue} onPick={(i) => { setBrick(i); setTier(null); }} />
          <p className="text-center text-sm text-muted-foreground">{brick === null ? "Floor plan · tap a raised spot" : "Now pick a shelf"}</p>
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
                      <span className="absolute right-4 top-2 text-xs font-medium text-muted-foreground">{isTaken ? "Taken" : `Shelf ${t + 1}`}</span>
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

      <div className="mx-auto mt-8 grid max-w-4xl gap-4 md:grid-cols-2">
        <Card testId="card-shelf-spec">
          <p className="flex items-center gap-2 font-display text-lg font-bold"><Ruler className="h-4 w-4 text-primary" />Each shelf</p>
          <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">W × H × D</dt><dd>{shop.shelf.widthCm} × {shop.shelf.heightCm} × {shop.shelf.depthCm} cm</dd>
            <dt className="text-muted-foreground">Capacity</dt><dd>{shop.shelf.capacity} units</dd>
            <dt className="text-muted-foreground">Where</dt><dd>{shop.floorNote}</dd>
            <dt className="text-muted-foreground">Rules</dt><dd>{shop.restrictions.map((r) => RESTRICTIONS.find((x) => x.id === r)?.label ?? r).join(", ") || "None"}</dd>
          </dl>
        </Card>
        <Card testId="card-terms">
          <p className="font-display text-lg font-bold">Rental terms</p>
          <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Rent</dt><dd>{usd(shop.price)}/mo + {T.taxRate}% tax*</dd>
            <dt className="text-muted-foreground">Duration</dt><dd>{T.months} months</dd>
            <dt className="text-muted-foreground">Deposit</dt><dd>{T.deposit ? usd(T.deposit) : "None"}</dd>
            <dt className="text-muted-foreground">Renewal</dt><dd className="capitalize">{T.renewal.replace("-", " ")}</dd>
            <dt className="text-muted-foreground">Late fee</dt><dd>{T.lateFeePct}% after {T.graceDays} days</dd>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">*Illustrative demo rate, not tax advice.</p>
        </Card>
      </div>

      <div className="mt-8 flex flex-col items-center gap-2">
        <PrimaryButton disabled={tier === null || !open} onClick={() => setConfirm(true)} data-testid="button-rent"><FileSignature className="h-4 w-4" />Request rental contract</PrimaryButton>
        {!open && <p className="text-sm text-muted-foreground">This store isn't taking rentals ({shop.status}).</p>}
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Request a contract">
        <p className="text-sm text-muted-foreground">Shelf {tier !== null ? tier + 1 : ""} at {shop.name}, as <b>{holderOf(st, YOU_HOLDER).name}</b>. Nothing is active until the platform approves and both of you sign.</p>
        <div className="mt-4 space-y-3">
          <Field label="Start date"><input type="date" min={today()} value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} data-testid="input-start" /></Field>
          <p className="text-sm">{T.months} months · ends {start ? addMonths(start, T.months) : "—"} · {usd(shop.price)}/mo</p>
          <ErrorNote error={error} />
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <PrimaryButton disabled={pending} onClick={request} data-testid="button-confirm-rent">Create contract request</PrimaryButton>
          <GhostButton onClick={() => setConfirm(false)} data-testid="button-cancel-rent">Cancel</GhostButton>
        </div>
      </Modal>
    </Shell>
  );
}
