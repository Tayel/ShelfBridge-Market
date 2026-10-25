import { useState } from "react";
import { Link } from "wouter";
import { QrCode } from "lucide-react";
import { Shell, PageTitle } from "@/components/shell";
import { Card, Empty, Pill } from "@/components/kit";
import { ShelfQr } from "@/components/qr";
import { SameBrowserBanner } from "@/pages/catalog";
import { useStore } from "@/lib/store";
import { shelfBlockReason, shelfLabel } from "@/lib/selectors";
import { countryName } from "@/lib/data";

/** Customer entry: stand-in for physically scanning a shelf QR. */
export default function Scan() {
  const st = useStore();
  const [qr, setQr] = useState<string | null>(null);
  const shelves = st.tokens.filter((t) => !t.released && (
    !shelfBlockReason(st, t) ||
    st.listings.some((l) => l.tokenId === t.id && l.status === "active")
  ));
  return (
    <Shell title="Scan a shelf">
      <PageTitle title="Scan a shelf" sub="In a real store you'd scan the code on the shelf. Here, pick one of the demo shelves — or open its QR and scan it with this device." />
      <div className="mx-auto mt-6 max-w-2xl"><SameBrowserBanner /></div>
      <div className="mx-auto mt-6 grid max-w-3xl gap-4 sm:grid-cols-2">
        {shelves.length === 0 && <div className="sm:col-span-2"><Empty title="No shelves selling yet" text="Shelves appear here once a contract is active and a product is on sale." /></div>}
        {shelves.map((t) => {
          const shop = st.shops.find((s) => s.id === t.shopId);
          if (!shop) return null;
          const block = shelfBlockReason(st, t);
          const n = st.listings.filter((l) => l.tokenId === t.id && l.status === "active").length;
          return (
            <Card key={t.id} testId={`card-scan-${t.id}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-display text-lg font-bold">{shop.name}</p>
                  <p className="text-xs text-muted-foreground">{shelfLabel(shop, t.slot)} · {shop.city}, {countryName(shop.country)} · {n} product{n === 1 ? "" : "s"}</p>
                </div>
                <Pill>{block ? "blocked" : n ? "live" : "awaiting products"}</Pill>
              </div>
              <div className="mt-4 flex gap-2">
                <Link href={`/catalog/${t.id}`} className="flex-1 rounded-full bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground" data-testid={`link-catalog-${t.id}`}>Open catalog</Link>
                <button onClick={() => setQr(qr === t.id ? null : t.id)} className="inline-flex items-center gap-1 rounded-full border border-border px-3 text-sm" data-testid={`button-qr-${t.id}`}><QrCode className="h-4 w-4" />QR</button>
              </div>
              {qr === t.id && <div className="mt-4"><ShelfQr tokenId={t.id} label={shelfLabel(shop, t.slot)} size={180} /></div>}
            </Card>
          );
        })}
      </div>
      <p className="mt-8 text-center text-sm"><Link href="/orders" className="text-primary underline" data-testid="link-orders">My orders & receipts</Link></p>
    </Shell>
  );
}
