import { Link, useLocation, useSearch } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Plane, Clock } from "lucide-react";
import { Shell, PrimaryButton, GhostButton } from "@/components/shell";
import { ProductVideo, useMouseHover } from "@/components/product-video";
import { HowItWorks, JourneySteps, asset, nextStep, type JourneyRole } from "@/components/product-bits";
import { PRODUCT_JOURNEY, isProductId, type ProductId } from "@/lib/data";
import OwnerJourney from "./owner-journey";
import { HolderDiscovery } from "@/components/holder-discovery";

const ROLE: Record<JourneyRole, { label: string; ask: string; next: string }> = {
  owner: { label: "Apply as store owner", ask: "Which product will your shelves host?", next: "See what your shelves could earn" },
  holder: { label: "Apply to hold a token", ask: "Which product do you want to sell?", next: "Find a shelf" },
};

/**
 * The start of every application: pick one of the two products, see its explanation (the product's own
 * one-pager), then continue to the page built for it — "Your empty shelves could earn" for shop owners,
 * "Find a shelf" for token holders.
 */
export default function Start() {
  const q = new URLSearchParams(useSearch());
  // Store owners get the full "I have a shop" journey: where, what, which products, their space, earnings, listing.
  if (q.get("as") === "owner") return <OwnerJourney />;
  return <HolderStart />;
}

function HolderStart() {
  const q = new URLSearchParams(useSearch());
  const [, go] = useLocation();
  const role: JourneyRole = q.get("as") === "owner" ? "owner" : "holder";
  const pq = q.get("product");
  const product: ProductId | null = isProductId(pq) ? pq : null;
  const url = (p: ProductId | null, r: JourneyRole = role) => `/start?as=${r}${p ? `&product=${p}` : ""}`;

  return (
    <Shell title={ROLE[role].label} back={product ? url(null) : "/"}>
      <div className="flex flex-col items-center gap-4 text-center">
        <div role="tablist" aria-label="I am" className="inline-flex rounded-full bg-muted p-1 text-sm">
          {(["owner", "holder"] as JourneyRole[]).map((r) => (
            <button key={r} role="tab" aria-selected={role === r} onClick={() => go(url(product, r), { replace: true })} data-testid={`switch-role-${r}`}
              className={`rounded-full px-4 py-1.5 font-semibold transition ${role === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {r === "owner" ? "I have a shop" : "I make or supply products"}
            </button>
          ))}
        </div>
        {product && <JourneySteps at={2} />}
      </div>

      <AnimatePresence mode="wait">
        {!product ? (
          <motion.section key="choose" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }} className="mt-2">
            <HolderDiscovery />
            <h2 className="font-display mt-20 text-center text-4xl font-extrabold md:text-5xl" id="products">{ROLE[role].ask}</h2>
            <p className="mt-3 text-center text-muted-foreground">InRaf runs two products. Pick one to see how it works before you apply.</p>
            <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-2">
              {(Object.keys(PRODUCT_JOURNEY) as ProductId[]).map((p, i) => (
                <motion.div key={p} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.12, duration: 0.45 }}>
                  <ProductCard product={p} role={role} href={url(p)} />
                </motion.div>
              ))}
            </div>
          </motion.section>
        ) : (
          <Explain key={product} product={product} role={role} onBack={() => go(url(null))} onOther={() => go(url(product === "expiring" ? "flying" : "expiring"))} onNext={() => go(nextStep(role, product))} />
        )}
      </AnimatePresence>
    </Shell>
  );
}

/** One product: hover (or tap) the picture to play its video, click it to watch larger; the text goes on to "how it works". */
function ProductCard({ product, role, href }: { product: ProductId; role: JourneyRole; href: string }) {
  const j = PRODUCT_JOURNEY[product];
  const Icon = product === "expiring" ? Clock : Plane;
  const { hovered, bind } = useMouseHover();
  const tag = product === "expiring" ? (role === "owner" ? "Neighbourhood shops" : "Factories & producers") : (role === "owner" ? "Airport shops" : "Local manufacturers");
  return (
    <div {...bind} className="group flex h-full flex-col overflow-hidden rounded-[2rem] border border-border transition hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(120,60,30,.35)]" data-testid={`card-product-${product}`}>
      <ProductVideo product={product} active={hovered} className="h-52" imgClassName="transition duration-500 group-hover:scale-[1.03]"
        playerExtra={<Link href={href} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground">See how it works <ArrowRight className="h-4 w-4" /></Link>} />
      <Link href={href} data-testid={`choose-product-${product}`}
        className="flex flex-1 flex-col items-center p-7 text-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring/30">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"><Icon className="h-3.5 w-3.5" />{tag}</span>
        <h2 className="font-display mt-3 text-3xl font-bold">{j.title}</h2>
        <p className="mt-2 text-muted-foreground">{j.summary}</p>
        <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground transition group-hover:gap-3">
          See how it works <ArrowRight className="h-4 w-4" />
        </span>
      </Link>
    </div>
  );
}

function Explain({ product, role, onBack, onOther, onNext }: { product: ProductId; role: JourneyRole; onBack: () => void; onOther: () => void; onNext: () => void }) {
  const j = PRODUCT_JOURNEY[product];
  const side = role === "owner" ? j.owner : j.holder;
  const other = PRODUCT_JOURNEY[product === "expiring" ? "flying" : "expiring"];
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }} className="mt-8" data-testid={`explain-${product}`}>
      <div className="text-center">
        <h1 className="font-display text-4xl font-extrabold leading-[1] md:text-6xl">{j.title}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">Here is how it works. Take a look, then continue when you're ready.</p>
      </div>

      <figure className="mx-auto mt-8 max-w-5xl overflow-hidden rounded-[2rem] border border-border bg-card shadow-[0_30px_60px_-40px_rgba(120,60,30,.45)]">
        <a href={asset(j.image)} target="_blank" rel="noopener" aria-label={`Open the ${j.title} explanation full size`}>
          <img src={asset(j.image)} alt={j.imageAlt} className="w-full" data-testid={`image-explain-${product}`} />
        </a>
        <figcaption className="px-4 py-2 text-center text-xs text-muted-foreground md:hidden">Tap the picture to open it full size</figcaption>
      </figure>
      {/* On phones the picture is small, so the same four steps follow as text. */}
      <div className="mx-auto mt-8 max-w-5xl md:hidden"><HowItWorks product={product} compact /></div>

      <div className="mx-auto mt-10 grid max-w-5xl gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-[2rem] border border-border p-7">
          <p className="text-sm text-muted-foreground">{side.who}</p>
          <p className="font-display mt-1 text-2xl font-bold">What it means for you</p>
          <ul className="mt-4 space-y-3">
            {side.promises.map((x) => (
              <li key={x.title} className="flex gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Check className="h-3.5 w-3.5" /></span>
                <span><b>{x.title}.</b> <span className="text-muted-foreground">{x.text}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col justify-center rounded-[2rem] bg-muted/60 p-7 text-center">
          <p className="font-display text-xl font-bold">Ready to apply?</p>
          <p className="mt-1 text-sm text-muted-foreground">{side.pitch}</p>
          <PrimaryButton className="mt-5" onClick={onNext} data-testid="button-continue">{ROLE[role].next} <ArrowRight className="h-4 w-4" /></PrimaryButton>
          <div className="mt-3 flex flex-wrap justify-center gap-1">
            <GhostButton onClick={onBack} data-testid="button-back-to-products"><ArrowLeft className="h-4 w-4" />Both products</GhostButton>
            <GhostButton onClick={onOther} data-testid="button-other-product">See {other.title} instead</GhostButton>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
