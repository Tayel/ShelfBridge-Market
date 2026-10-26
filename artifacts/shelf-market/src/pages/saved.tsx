import { Link } from "wouter";
import { Shell, PageTitle } from "@/components/shell";
import { Empty } from "@/components/kit";
import { ShopCard } from "@/pages/explore";
import { slotsOf, takenSlots, useStore } from "@/lib/store";

export default function Saved() {
  const st = useStore();
  const shops = st.saved.map((id) => st.shops.find((s) => s.id === id)).filter((s) => !!s);
  return (
    <Shell title="Saved shelves" back="/explore">
      <PageTitle title="Saved shelves" sub="Tap the heart on any shop to keep it here." />
      {shops.length === 0 ? (
        <div className="mx-auto mt-10 max-w-md"><Empty title="Nothing saved yet" text="Browse shops and save the ones you like." action={<Link href="/explore" className="text-primary underline">Find a shelf</Link>} /></div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((s, i) => <ShopCard key={s.id} shop={s} i={i} months={0} saved free={slotsOf(s) - takenSlots(st, s.id).size} />)}
        </div>
      )}
    </Shell>
  );
}
