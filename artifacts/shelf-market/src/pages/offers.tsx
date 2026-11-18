import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Plane } from "lucide-react";
import { Shell } from "@/components/shell";
import { Empty, ProductImage } from "@/components/kit";
import { OfferNote } from "@/components/offer-bits";
import { useStore, usd } from "@/lib/store";
import { OFFERS, countryName } from "@/lib/data";
import { isExpired } from "@/lib/selectors";
import { daysUntil } from "@/lib/util";

/** One page per special offer: every live product on it, across all shops. */
export default function Offers() {
  const { id } = useParams<{ id: string }>();
  const st = useStore();
  const offer = OFFERS.find((o) => o.id === id);
  if (!offer) return <Shell title="Not found" back="/"><Empty title="No such offer" text="Pick About to expire or About to fly from the home page." /></Shell>;

  const live = st.listings
    .filter((l) => l.offer === offer.id && l.status === "active" && l.available > 0 && !isExpired(l))
    .sort((a, b) => (offer.id === "expiring" ? daysUntil(a.expiry ?? "9999-12-31") - daysUntil(b.expiry ?? "9999-12-31") : a.name.localeCompare(b.name)));
  const shopOf = (shopId: string) => st.shops.find((s) => s.id === shopId);
  const Icon = offer.id === "expiring" ? Clock : Plane;
  const other = OFFERS.find((o) => o.id !== offer.id)!;

  return (
    <Shell title={offer.title} back="/">
      <section className="flex flex-col items-center pt-4 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary"><Icon className="h-7 w-7" /></span>
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="font-display mt-4 text-4xl font-extrabold md:text-6xl">{offer.title}</motion.h1>
        <p className="mt-3 max-w-lg text-lg text-muted-foreground">{offer.sub}</p>
      </section>

      <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2" data-testid={`list-offer-${offer.id}`}>
        {live.length === 0 && <div className="sm:col-span-2"><Empty title="Nothing on this offer right now" text="When a maker lists a product under it, it shows up here." /></div>}
        {live.map((l, i) => {
          const shop = shopOf(l.shopId);
          return (
            <motion.div key={l.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
              <Link href={`/catalog/${l.tokenId}`} data-testid={`link-offer-item-${l.id}`}
                className="group flex h-full gap-4 rounded-3xl border border-border p-4 transition hover:-translate-y-0.5 hover:border-primary/40">
                <ProductImage color={l.color} url={l.imageUrl} name={l.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-lg font-bold leading-tight">{l.name}</p>
                    <span className="flex flex-col items-end">
                      <span className="font-display font-bold tabular-nums">{usd(l.retail)}</span>
                      {l.offer === "expiring" && l.wasPrice && <span className="text-xs text-muted-foreground line-through tabular-nums">{usd(l.wasPrice)}</span>}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{shop?.name} · {shop?.city} · made in {countryName(l.origin)}</p>
                  <OfferNote l={l} />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      <div className="mx-auto mt-10 max-w-4xl rounded-[2rem] border border-border p-6 text-sm text-muted-foreground">
        <p className="font-display text-base font-bold text-foreground">{offer.id === "expiring" ? "For factories" : "For local makers"}</p>
        <p className="mt-1">
          {offer.id === "expiring"
            ? "Rent a shelf, add the product and choose \"About to expire\": set the batch expiry (within 45 days) and the usual price, and shoppers see the saving."
            : "Rent a shelf in your own country, add the piece and choose \"About to fly\": tell the story behind it, and visitors read it before they buy."}
        </p>
        <Link href="/explore" className="mt-3 inline-flex items-center gap-1 font-semibold text-primary">Find a shelf <ArrowRight className="h-4 w-4" /></Link>
      </div>
      <p className="mt-6 text-center text-sm"><Link href={`/offers/${other.id}`} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">See {other.title.toLowerCase()} too</Link></p>
    </Shell>
  );
}
