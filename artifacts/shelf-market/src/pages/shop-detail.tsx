import { useMemo, useState } from "react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck, Clock, Flag, Gem, MapPin, MessageSquare, Ruler, Share2, ShieldCheck, Sparkles, Star, Users, Zap,
  Eye,
} from "lucide-react";
import { Shell, PrimaryButton, GhostButton } from "@/components/shell";
import { IsoFloor } from "@/components/iso-floor";
import { ShelfArt } from "@/components/shelf-art";
import { PhotoGallery } from "@/components/photos";
import { Card, ErrorNote, Field, Modal, Notice, Pill, inputCls } from "@/components/kit";
import { ListingBadges, SaveHeart, priceText } from "@/components/listing-bits";
import {
  CANCELLATION, CATEGORIES, PREMIUM_TOKEN_NOTE, PRICING_LABEL, RESTRICTIONS, SHELF_TYPES, businessOf, categoryLabel, countryName, featureLabel,
} from "@/lib/data";
import { SUB_SCORES, isFavourite, ratingOf, reviewsOf } from "@/lib/reviews";
import { LIVE, slotsOf, takenSlots, useSession, useStore, usd } from "@/lib/store";
import { actions } from "@/lib/actions";
import { useAct } from "@/hooks/use-act";
import { useToast } from "@/hooks/use-toast";
import { holderOf, rentOf } from "@/lib/ops";
import { addMonths, fmtDate, round2, today } from "@/lib/util";
import type { Shop } from "@/lib/types";

/** Short, data-backed reasons this shelf stands out. */
function highlights(shop: Shop) {
  const L = shop.listing;
  const r = ratingOf(shop);
  const out: { icon: typeof Star; title: string; text: string }[] = [];
  const type = SHELF_TYPES.find((t) => t.id === L.shelfType);
  if (type) out.push({ icon: Sparkles, title: `${type.label} shelf`, text: type.hint + "." });
  if (r) {
    const best = SUB_SCORES.map((s) => ({ ...s, v: r.subs[s.id] })).sort((a, b) => b.v - a.v)[0];
    const fives = reviewsOf(shop.id).filter((x) => x.scores[best.id] === 5).length;
    out.push({ icon: Star, title: `Strong on ${best.label.toLowerCase()}`, text: `${Math.round((fives / r.count) * 100)}% of renters gave ${best.label.toLowerCase()} 5 stars.` });
  }
  if (L.footTraffic >= 350) out.push({ icon: Users, title: "Busy shop", text: `About ${L.footTraffic} shoppers a day, as declared by the owner.` });
  if (L.features.includes("restock")) out.push({ icon: BadgeCheck, title: "Restocks for you", text: "Leave a back-up box and the shop refills your shelf." });
  if (L.instantBook) out.push({ icon: Zap, title: "Instant book", text: "The owner agreed to the standard terms up front, so only the platform check and your signature remain." });
  return out.slice(0, 3);
}

export default function ShopDetail() {
  const { id } = useParams<{ id: string }>();
  const params = new URLSearchParams(useSearch());
  const st = useStore();
  const { holderId: YOU_HOLDER, me: account, live } = useSession();
  const [, go] = useLocation();
  const { toast } = useToast();
  const shop = st.shops.find((s) => s.id === id);
  const [brick, setBrick] = useState<number | null>(null);
  const [tier, setTier] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [report, setReport] = useState(false);
  const [reason, setReason] = useState("");
  const [start, setStart] = useState(() => { const q = params.get("start"); return q && q >= today() ? q : today(); });
  const [months, setMonths] = useState(() => Number(params.get("months")) || 0);
  const [model, setModel] = useState<"rental" | "consignment">("rental");
  const [offering, setOffering] = useState(false);
  const [offerRent, setOfferRent] = useState(0);
  const [sharePct, setSharePct] = useState(0);
  const [offerNote, setOfferNote] = useState("");
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
  const L = shop.listing;
  const open = shop.status === "approved";
  const free = slotsOf(shop) - taken.size;
  const rating = ratingOf(shop);
  const reviews = reviewsOf(shop.id);
  const term = Math.max(months, T.months);
  const monthly = rentOf(shop);
  const shelfPhoto = shop.photos.find((p) => p.kind === "shelf");
  const rent = round2(monthly * term);
  const tax = round2((rent * T.taxRate) / 100);
  const lengths = [...new Set([T.months, 3, 6, 12, 24].filter((m) => m >= T.months))].sort((a, b) => a - b);
  const banned = CATEGORIES.filter((c) => !shop.categories.includes(c.id));
  const pct = sharePct || L.salesSharePct || 15;
  // Anything other than the listing's own rent is a proposal: the owner has to accept it (no instant booking).
  const proposal = model === "consignment" || (offering && (offerRent || monthly) !== monthly);
  const instant = L.instantBook && !proposal;

  const request = async () => {
    if (bi < 0 || tier === null) return;
    const offer = model === "consignment" ? { sharePct: pct, note: offerNote } : offering ? { monthlyRent: offerRent || monthly, note: offerNote } : offerNote.trim() ? { note: offerNote } : undefined;
    const r = await act(() => actions.requestContract({ shopId: shop.id, slot: slot(bi, tier), holderId: YOU_HOLDER, start, months: term, model, offer }), proposal ? "Offer sent to the store owner" : "Contract request created");
    if (r.ok && r.id) go(`/contracts/${r.id}`);
  };
  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); toast({ title: "Link copied" }); }
    catch { toast({ title: "Couldn't copy the link", description: window.location.href }); }
  };
  const sendReport = async () => {
    const r = await act(() => actions.reportShop(shop.id, reason), "Report sent to InRaf");
    if (r.ok) { setReport(false); setReason(""); }
  };

  return (
    <Shell title={shop.name} back="/explore">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><B.icon className="h-4 w-4" />{B.label} · {shop.city}, {countryName(shop.country)}{shop.hours ? ` · Open ${shop.hours}` : ""}</p>
          <h1 className="font-display mt-1 text-4xl font-bold md:text-5xl" data-testid="text-shop-name">{shop.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {rating ? <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-foreground" /><b>{rating.overall.toFixed(2)}</b> · <a href="#reviews" className="underline">{rating.count} review{rating.count === 1 ? "" : "s"}</a></span> : <span className="font-semibold text-primary">New listing</span>}
            <ListingBadges shop={shop} />
            {!open && <Pill testId="status-shop">{shop.status}</Pill>}
          </div>
        </div>
        <div className="flex gap-2">
          <GhostButton onClick={share} data-testid="button-share"><Share2 className="h-4 w-4" />Share</GhostButton>
          <SaveHeart shopId={shop.id} saved={st.saved.includes(shop.id)} className="h-10 w-10 border border-border" />
        </div>
      </div>

      <div className="mt-5"><PhotoGallery shop={shop} /></div>

      <p className="mt-4 text-sm text-muted-foreground" data-testid="text-key-facts">
        {SHELF_TYPES.find((t) => t.id === L.shelfType)?.label} · {shop.shelf.widthCm}×{shop.shelf.heightCm}×{shop.shelf.depthCm} cm · {shop.shelf.capacity} units · ~{L.footTraffic} shoppers/day · {slotsOf(shop)} shelves
      </p>

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

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-10">
          <section className="space-y-4 border-b border-border pb-8" data-testid="section-highlights">
            {highlights(shop).map((h) => (
              <div key={h.title} className="flex gap-4">
                <h.icon className="mt-0.5 h-6 w-6 shrink-0" strokeWidth={1.5} />
                <div><p className="font-semibold">{h.title}</p><p className="text-sm text-muted-foreground">{h.text}</p></div>
              </div>
            ))}
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <Card testId="card-shelf-spec">
              <p className="flex items-center gap-2 font-display text-lg font-bold"><Ruler className="h-4 w-4 text-primary" />Each shelf</p>
              <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">W × H × D</dt><dd>{shop.shelf.widthCm} × {shop.shelf.heightCm} × {shop.shelf.depthCm} cm</dd>
                <dt className="text-muted-foreground">Capacity</dt><dd>{shop.shelf.capacity} units</dd>
                <dt className="text-muted-foreground">Where</dt><dd>{shop.floorNote}</dd>
                <dt className="text-muted-foreground">Shop offers</dt><dd>{L.features.map(featureLabel).join(", ") || "Shelf space only"}</dd>
              </dl>
            </Card>
            <Card testId="card-area">
              <p className="flex items-center gap-2 font-display text-lg font-bold"><MapPin className="h-4 w-4 text-primary" />The area</p>
              <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Shoppers/day</dt><dd>~{L.footTraffic} (owner-declared)</dd>
                <dt className="text-muted-foreground">Sells well</dt><dd>{L.sellsWell || "Not stated yet"}</dd>
                <dt className="text-muted-foreground">Nearby</dt><dd>{L.nearby.join(", ") || "—"}</dd>
                <dt className="text-muted-foreground">Address</dt><dd>{shop.address || shop.location}</dd>
              </dl>
            </Card>
          </section>

          <section id="reviews" data-testid="section-reviews">
            {rating ? (
              <>
                <h2 className="font-display flex items-center gap-2 text-2xl font-bold"><Star className="h-5 w-5 fill-foreground" />{rating.overall.toFixed(2)} · {rating.count} review{rating.count === 1 ? "" : "s"}</h2>
                {isFavourite(shop) && <p className="mt-1 text-sm text-muted-foreground">Maker favourite: one of the best-rated shelves, based on ratings and reviews.</p>}
                <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
                  {SUB_SCORES.map((s) => (
                    <div key={s.id} data-testid={`score-${s.id}`}>
                      <div className="flex justify-between text-sm"><span>{s.label}</span><b className="tabular-nums">{rating.subs[s.id].toFixed(1)}</b></div>
                      <div className="mt-1 h-1 rounded-full bg-muted"><div className="h-1 rounded-full bg-foreground" style={{ width: `${(rating.subs[s.id] / 5) * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">{rating.tags.map(([t, c]) => <span key={t} className="rounded-full border border-border px-3 py-1 text-sm">{t} <span className="text-muted-foreground">{c}</span></span>)}</div>
                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  {reviews.map((r) => (
                    <div key={r.author + r.at}>
                      <p className="font-semibold">{r.author}</p>
                      <p className="text-xs text-muted-foreground">Rented {r.months} months · {fmtDate(r.at)}</p>
                      <p className="mt-2 text-sm">{r.text}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">{LIVE ? "Sample reviews on an example store. Only renters with a completed contract can review." : "Sample reviews for the demo. In the real product only renters with a completed contract can review, and shops review renters too."}</p>
              </>
            ) : (
              <>
                <h2 className="font-display text-2xl font-bold">No reviews yet</h2>
                <p className="mt-1 text-sm text-muted-foreground">Reviews open once a renter finishes a contract here.</p>
              </>
            )}
          </section>

          <section className="rounded-[1.75rem] bg-muted/60 p-6" data-testid="section-owner">
            <h2 className="font-display text-2xl font-bold">Meet the store owner</h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-[auto_1fr]">
              <div className="flex flex-col items-center rounded-3xl bg-background p-5 text-center shadow-sm">
                <div className="grid h-16 w-16 place-items-center rounded-full font-display text-2xl font-bold text-white" style={{ background: `hsl(${shop.hue} 45% 45%)` }}>{shop.ownerName.charAt(0)}</div>
                <p className="mt-2 font-semibold">{shop.ownerName}</p>
                <p className="text-xs text-muted-foreground">Hosting since {L.ownerSince}</p>
              </div>
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2"><MessageSquare className="h-4 w-4" />Response rate: <b>{L.responseRate}%</b></p>
                <p className="flex items-center gap-2"><Clock className="h-4 w-4" />Usually replies within <b>{L.responseHours} hour{L.responseHours === 1 ? "" : "s"}</b></p>
                <p className="flex items-center gap-2"><BadgeCheck className="h-4 w-4" />Business registration on file: {shop.registration}</p>
                <p className="flex items-start gap-2 pt-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />To protect your stock and payments, always pay and agree terms through InRaf, never off-platform.</p>
              </div>
            </div>
          </section>

          <section data-testid="section-things-to-know">
            <h2 className="font-display text-2xl font-bold">Things to know</h2>
            <div className="mt-4 grid gap-6 text-sm md:grid-cols-3">
              <div>
                <p className="font-semibold">Shelf rules</p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {shop.restrictions.map((r) => <li key={r}>{RESTRICTIONS.find((x) => x.id === r)?.label ?? r}</li>)}
                  <li>{T.display}</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold">Not accepted here</p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {banned.length ? banned.map((c) => <li key={c.id}>{c.label}</li>) : <li>Any category the shop's licence allows</li>}
                  <li>Expired, recalled or unlabelled goods</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold">Cancellation · {CANCELLATION[L.cancellation].label}</p>
                <p className="mt-2 text-muted-foreground">{CANCELLATION[L.cancellation].text}</p>
              </div>
            </div>
            <div className="mt-8 rounded-3xl border border-border p-5" data-testid="card-verification">
              <p className="font-display text-xl font-bold">Check before you rent</p>
              <p className="mt-1 text-sm text-muted-foreground">You may be renting in a country you've never visited, so here is what InRaf can confirm today, and what is still coming.</p>
              <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{shop.seeded ? "Sample store: it shows how InRaf works and can't be rented." : "Owner approved by InRaf after a business registration check."}</li>
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{shop.photos.some((p) => p.source === "owner") ? "Photos taken by the owner of the actual shop and shelf." : "Stock photos of a similar shop (sample store)."}</li>
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Exact shelf, size ({shop.shelf.widthCm}×{shop.shelf.heightCm}×{shop.shelf.depthCm} cm) and position written into your contract.</li>
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />A unique contract number, shelf ID and QR code once both of you sign.</li>
                <li className="flex gap-2 text-muted-foreground"><Eye className="mt-0.5 h-4 w-4 shrink-0" />360° views, video walkthroughs and live shelf cameras: coming soon, where the store and local law allow.</li>
                <li className="flex gap-2 text-muted-foreground"><Eye className="mt-0.5 h-4 w-4 shrink-0" />Escrow for rent and deposits: coming with real payments.</li>
              </ul>
            </div>
            {(!live || shop.registration) && <p className="mt-6 text-xs text-muted-foreground">Registration: {shop.registration}{live ? "" : " (demo value)"}</p>}
            <button onClick={() => setReport(true)} className="mt-2 inline-flex items-center gap-1.5 text-sm underline" data-testid="button-report"><Flag className="h-3.5 w-3.5" />Report this listing</button>
          </section>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card className="shadow-[0_20px_50px_-30px_rgba(60,40,20,.45)]" testId="card-booking">
            {free > 0 && free <= 2 && <p className="mb-3 flex items-center gap-1.5 rounded-2xl bg-accent px-3 py-2 text-sm text-accent-foreground" data-testid="text-rare"><Gem className="h-4 w-4" />Rare find: only {free} shelf{free === 1 ? "" : "s"} left here.</p>}
            {shelfPhoto && (
              <div className="mb-4 flex items-center gap-3">
                <img src={shelfPhoto.url} alt="The shelf you'd rent" referrerPolicy="no-referrer" className="h-14 w-20 rounded-xl object-cover" />
                <p className="text-xs text-muted-foreground">The shelf you'd rent{shelfPhoto.source === "stock" ? " (stock photo, sample store)" : ", photographed by the owner"}</p>
              </div>
            )}
            <p className="font-display text-2xl font-bold" data-testid="text-price">{priceText(shop)}</p>
            <p className="text-sm text-muted-foreground">{PRICING_LABEL[L.pricing]}{L.pricing !== "fixed" ? `: the shop keeps ${L.salesSharePct}% of each sale before your payout` : ""}</p>
            <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="How you work with this store">
              {([["rental", "Rent the shelf", "Model A · monthly rent"], ["consignment", "Consignment", "Model B · store sells for a commission"]] as const).map(([k, l, h]) => (
                <button key={k} type="button" role="radio" aria-checked={model === k} onClick={() => setModel(k)} data-testid={`model-${k}`}
                  className={`rounded-2xl border-2 p-3 text-left transition ${model === k ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                  <span className="block text-sm font-semibold">{l}</span><span className="block text-[11px] text-muted-foreground">{h}</span>
                </button>
              ))}
            </div>
            {model === "rental" ? (
              <div className="mt-3 rounded-2xl bg-muted/50 p-3 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={offering} onChange={(e) => { setOffering(e.target.checked); if (!offerRent) setOfferRent(monthly); }} data-testid="check-offer" />Propose a different monthly rent</label>
                {offering && <label className="mt-2 flex items-center gap-2"><span className="text-muted-foreground">USD / month</span><input type="number" min={1} value={offerRent || ""} onChange={(e) => setOfferRent(Math.max(0, Number(e.target.value)))} className="w-28 rounded-xl border border-input bg-background px-3 py-1.5" data-testid="input-offer-rent" /></label>}
              </div>
            ) : (
              <div className="mt-3 rounded-2xl bg-muted/50 p-3 text-sm">
                <label className="flex items-center gap-2"><span className="text-muted-foreground">Store's commission per sale</span><input type="number" min={1} max={50} value={pct} onChange={(e) => setSharePct(Math.min(50, Math.max(1, Number(e.target.value))))} className="w-20 rounded-xl border border-input bg-background px-3 py-1.5" data-testid="input-share-pct" />%</label>
                <p className="mt-1 text-[11px] text-muted-foreground">No rent. The store sells your products and keeps this share of each sale; you keep ownership of unsold stock.</p>
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-2xl border border-border">
              <label className="flex flex-col border-r border-border px-3 py-2">
                <span className="text-[10px] font-bold uppercase">Start</span>
                <input type="date" min={today()} value={start} onChange={(e) => setStart(e.target.value)} className="bg-transparent text-sm outline-none" data-testid="input-start" />
              </label>
              <label className="flex flex-col px-3 py-2">
                <span className="text-[10px] font-bold uppercase">Length</span>
                <select value={term} onChange={(e) => setMonths(Number(e.target.value))} className="bg-transparent text-sm outline-none" data-testid="select-term">
                  {lengths.map((m) => <option key={m} value={m}>{m} months{m === T.months ? " (min)" : ""}</option>)}
                </select>
              </label>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Ends {start ? fmtDate(addMonths(start, term)) : "—"} · {tier !== null ? `Shelf ${tier + 1} picked` : "Pick a shelf on the floor plan"}</p>
            <PrimaryButton className="mt-4 w-full" disabled={tier === null || !open} onClick={() => setConfirm(true)} data-testid="button-rent">
              {instant && <Zap className="h-4 w-4" />}{proposal ? "Send my offer" : instant ? "Book this shelf" : "Request this shelf"}
            </PrimaryButton>
            <p className="mt-2 text-center text-xs text-muted-foreground">You won't be charged yet</p>
            {L.access === "premium" && <div className="mt-3"><Notice tone="info" testId="notice-premium">{PREMIUM_TOKEN_NOTE}</Notice></div>}
            <dl className="mt-4 space-y-1.5 text-sm" data-testid="price-breakdown">
              {model === "consignment" ? (
                <>
                  <div className="flex justify-between gap-2"><dt>Rent</dt><dd>None</dd></div>
                  <div className="flex justify-between gap-2"><dt>Store's commission</dt><dd>{pct}% of each sale</dd></div>
                  {T.deposit > 0 && <div className="flex justify-between gap-2"><dt>Deposit, returned at the end</dt><dd>{usd(T.deposit)}</dd></div>}
                  <div className="flex justify-between gap-2 border-t border-border pt-2 font-semibold"><dt>Paid up front</dt><dd data-testid="text-term-total">{usd(T.deposit)}</dd></div>
                </>
              ) : (() => {
                const m = offering ? (offerRent || monthly) : monthly, r = round2(m * term), tx = round2((r * T.taxRate) / 100);
                return (
                  <>
                    {m > 0 && <div className="flex justify-between gap-2"><dt>{usd(m)} × {term} months{offering ? " (your offer)" : ""}</dt><dd>{usd(r)}</dd></div>}
                    {m > 0 && <div className="flex justify-between gap-2"><dt>Tax ({T.taxRate}%, illustrative)</dt><dd>{usd(tx)}</dd></div>}
                    {T.deposit > 0 && <div className="flex justify-between gap-2"><dt>Deposit, returned at the end</dt><dd>{usd(T.deposit)}</dd></div>}
                    {L.pricing !== "fixed" && <div className="flex justify-between gap-2 text-muted-foreground"><dt>Share of sales</dt><dd>{L.salesSharePct}% per sale</dd></div>}
                    <div className="flex justify-between gap-2 border-t border-border pt-2 font-semibold"><dt>{L.pricing === "share" ? "Paid up front" : "Total over the term"}</dt><dd data-testid="text-term-total">{usd(round2(r + tx + T.deposit))}</dd></div>
                  </>
                );
              })()}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">{model === "consignment" ? "No rent invoices: the store keeps its commission from each sale before your payout." : monthly > 0 ? "Rent is invoiced monthly once the platform approves and both sides sign." : "No rent invoices: the shop's share is taken from each sale."} Cancellation: {CANCELLATION[L.cancellation].label.toLowerCase()}.</p>
            {!open && <p className="mt-2 text-sm text-muted-foreground">This store isn't taking rentals ({shop.status}).</p>}
          </Card>
        </aside>
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title={proposal ? "Send your offer" : instant ? "Book this shelf" : "Request a contract"}>
        <p className="text-sm text-muted-foreground">
          Shelf {tier !== null ? tier + 1 : ""} at {shop.name}, as <b>{live ? (account ? account.name || account.email : "you (you'll sign in next)") : holderOf(st, YOU_HOLDER).name}</b>.{" "}
          {proposal ? "The owner can accept your offer by signing, or reply with a counter-offer. Nothing is active until the platform approves and both of you sign." : instant ? "This shop uses Instant book, so the owner's agreement is recorded straight away. The platform check and your signature are still needed." : "Nothing is active until the platform approves and both of you sign."}
        </p>
        <div className="mt-4 space-y-1 text-sm">
          <p>{fmtDate(start)} → {fmtDate(addMonths(start, term))} · {term} months</p>
          <p>{model === "consignment" ? `Consignment: no rent, ${pct}% commission to the store on each sale` : offering ? `Your offer: ${usd(offerRent || monthly)} a month (listed ${usd(monthly)})` : priceText(shop)}{T.deposit ? ` · ${usd(T.deposit)} deposit` : ""}</p>
          <label className="mt-3 block"><span className="text-xs text-muted-foreground">Message to the owner (optional)</span>
            <textarea value={offerNote} onChange={(e) => setOfferNote(e.target.value.slice(0, 500))} rows={2} className={inputCls} placeholder="What you'll sell, when you can stock it, any questions" data-testid="input-offer-note" /></label>
          <ErrorNote error={error} />
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <PrimaryButton disabled={pending} onClick={request} data-testid="button-confirm-rent">{proposal ? "Send offer" : instant ? "Book and continue to contract" : "Create contract request"}</PrimaryButton>
          <GhostButton onClick={() => setConfirm(false)} data-testid="button-cancel-rent">Cancel</GhostButton>
        </div>
      </Modal>

      <Modal open={report} onClose={() => setReport(false)} title="Report this listing">
        <Field label="What's wrong?" hint="Goes to the InRaf team, who review every report.">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={inputCls} placeholder="e.g. photos don't match the shop, asked to pay off-platform" data-testid="input-report-reason" />
        </Field>
        <div className="mt-3"><ErrorNote error={error} /></div>
        <div className="mt-5 flex flex-col gap-2">
          <PrimaryButton disabled={pending} onClick={sendReport} data-testid="button-send-report">Send report</PrimaryButton>
          <GhostButton onClick={() => setReport(false)}>Cancel</GhostButton>
        </div>
      </Modal>
    </Shell>
  );
}
