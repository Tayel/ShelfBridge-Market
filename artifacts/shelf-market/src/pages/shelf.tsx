import { useState } from "react";
import { Link, useParams } from "wouter";
import { AlertTriangle, Clock, Pencil, Plus, Power, QrCode, Sparkles, Trash2 } from "lucide-react";
import { Shell } from "@/components/shell";
import { Card, Empty, ErrorNote, Modal, Notice, Pill, ProductImage, SmallButton, Field, inputCls } from "@/components/kit";
import { ShelfQr } from "@/components/qr";
import { useStore, usd } from "@/lib/store";
import { actions } from "@/lib/actions";
import { useAct } from "@/hooks/use-act";
import { contractOfToken, contractStatus, expiresSoon, isExpired, isLowStock, reservedQty, shelfBlockReason, shelfLabel, shelfUnits } from "@/lib/selectors";
import { holderOf } from "@/lib/ops";
import { fmtDate } from "@/lib/util";

export default function ShelfPage() {
  const { tokenId } = useParams<{ tokenId: string }>();
  const st = useStore();
  const { act, error, pending } = useAct();
  const [restock, setRestock] = useState<string | null>(null);
  const [qty, setQty] = useState(5);
  const [showQr, setShowQr] = useState(false);

  const token = st.tokens.find((t) => t.id === tokenId);
  const shop = st.shops.find((s) => s.id === token?.shopId);
  if (!token || !shop) return <Shell title="Shelf not found" back="/dashboard"><p className="mt-20 text-center text-muted-foreground">No shelf here. <Link href="/dashboard" className="text-primary underline">Holder portal</Link></p></Shell>;

  const c = contractOfToken(st, token.id);
  const cs = c ? contractStatus(c) : "awaiting";
  const block = shelfBlockReason(st, token);
  const label = shelfLabel(shop, token.slot);
  const listings = st.listings.filter((l) => l.tokenId === token.id && l.status !== "removed");
  const used = shelfUnits(st, token.id);
  const holder = holderOf(st, token.holderId);

  return (
    <Shell title={`Shelf ${label}`} back="/dashboard">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm text-muted-foreground">{shop.name} · {shop.city} · {holder.name}</p>
        <h1 className="font-display text-4xl font-bold md:text-5xl" data-testid="text-shelf-label">{label}</h1>
        <div className="flex flex-wrap justify-center gap-2">
          <Pill testId="status-shelf">{block ? "blocked" : "live"}</Pill>
          {c && <Link href={`/contracts/${c.id}`} className="text-sm text-primary underline" data-testid="link-contract">Contract {c.ref} · {cs}</Link>}
        </div>
      </div>

      {block && <div className="mx-auto mt-5 max-w-2xl"><Notice tone="bad" testId="text-block-reason">{block} Products can't be activated or sold until this is resolved.</Notice></div>}

      <div className="mx-auto mt-6 grid max-w-5xl gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-display text-xl font-bold">Products</p>
              <p className="text-sm text-muted-foreground" data-testid="text-capacity">{used} / {shop.shelf.capacity} units of shelf capacity</p>
            </div>
            <div className="flex gap-2">
              <Link href={`/stock/${token.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm font-medium hover:bg-muted" data-testid="link-quick-add"><Sparkles className="h-4 w-4" />From samples</Link>
              <Link href={`/shelf/${token.id}/new`} className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-sm font-semibold text-background" data-testid="link-add-product"><Plus className="h-4 w-4" />Add product</Link>
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, (used / shop.shelf.capacity) * 100)}%` }} /></div>
          <ErrorNote error={error} />
          {listings.length === 0 ? (
            <Empty title="Nothing on this shelf yet" text="Add a product. The store owner approves it, then you activate it once the contract is active." />
          ) : listings.map((l) => {
            const reserved = reservedQty(st, l.id);
            const st8 = l.status === "active" && l.available === 0 ? "sold out" : l.status;
            return (
              <Card key={l.id} testId={`card-listing-${l.id}`}>
                <div className="flex gap-4">
                  <ProductImage color={l.color} url={l.imageUrl} name={l.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-display text-lg font-bold">{l.name}</p><Pill testId={`status-listing-${l.id}`}>{st8}</Pill>
                      {isLowStock(l) && <Pill tone="warn">low stock</Pill>}
                      {expiresSoon(l) && <Pill tone="warn"><Clock className="h-3 w-3" />expires {fmtDate(l.expiry)}</Pill>}
                      {isExpired(l) && <Pill tone="bad"><AlertTriangle className="h-3 w-3" />expired</Pill>}
                    </div>
                    <p className="text-xs text-muted-foreground">{l.sku} · batch {l.batch || "—"} · {usd(l.retail)} + {l.taxRate}% tax*</p>
                    <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
                      <div><p className="text-muted-foreground">Initial</p><p className="font-semibold tabular-nums">{l.initialQty}</p></div>
                      <div><p className="text-muted-foreground">Sold</p><p className="font-semibold tabular-nums" data-testid={`text-sold-${l.id}`}>{l.sold}</p></div>
                      <div><p className="text-muted-foreground">Left</p><p className="font-semibold tabular-nums" data-testid={`text-available-${l.id}`}>{l.available}</p></div>
                      <div><p className="text-muted-foreground">In checkout</p><p className="font-semibold tabular-nums">{reserved}</p></div>
                    </div>
                    {l.statusNote && <p className="mt-2 text-xs text-muted-foreground">{l.statusNote}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(l.status === "approved" || l.status === "inactive") && <SmallButton tone="solid" disabled={pending} onClick={() => act(() => actions.activateListing(l.id), "Product is live")} testId={`button-activate-${l.id}`}><Power className="h-3.5 w-3.5" />Put on sale</SmallButton>}
                      {l.status === "active" && <SmallButton disabled={pending} onClick={() => act(() => actions.deactivateListing(l.id), "Taken off sale")} testId={`button-deactivate-${l.id}`}>Take off sale</SmallButton>}
                      {(l.status === "approved" || l.status === "active" || l.status === "inactive") && <SmallButton onClick={() => { setQty(5); setRestock(l.id); }} testId={`button-restock-${l.id}`}>Restock</SmallButton>}
                      <Link href={`/products/${l.id}/edit`} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm font-medium hover:bg-muted" data-testid={`link-edit-${l.id}`}><Pencil className="h-3.5 w-3.5" />Edit</Link>
                      <SmallButton tone="danger" disabled={pending} onClick={() => { if (window.confirm(`Remove ${l.name} from the shelf?`)) act(() => actions.removeListing(l.id), "Product removed"); }} testId={`button-remove-${l.id}`}><Trash2 className="h-3.5 w-3.5" /></SmallButton>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
          <p className="text-xs text-muted-foreground">*Tax rates are illustrative demo values only.</p>
        </div>

        <div className="space-y-4">
          <Card testId="card-qr">
            <p className="flex items-center gap-2 font-display text-lg font-bold"><QrCode className="h-4 w-4 text-primary" />Shelf QR</p>
            <p className="mt-1 text-sm text-muted-foreground">Links to this shelf's catalog only.</p>
            <Notice tone="warn" testId="text-same-browser-warning"><b>Same-browser demo.</b> Inventory lives in this browser's storage. A phone scanning this code opens the page, but sees its own empty copy — not this shelf's live stock.</Notice>
            <div className="mt-4">{showQr ? <ShelfQr tokenId={token.id} label={label} size={200} /> : <SmallButton onClick={() => setShowQr(true)} testId="button-show-qr">Show QR code</SmallButton>}</div>
            <Link href={`/catalog/${token.id}`} className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-border py-2 text-sm font-medium hover:bg-muted" data-testid="link-open-catalog">Open catalog here</Link>
          </Card>
          <Card>
            <p className="font-display text-lg font-bold">Shelf profile</p>
            <dl className="mt-2 grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Size</dt><dd>{shop.shelf.widthCm}×{shop.shelf.heightCm}×{shop.shelf.depthCm} cm</dd>
              <dt className="text-muted-foreground">Capacity</dt><dd>{shop.shelf.capacity} units</dd>
              <dt className="text-muted-foreground">Rent</dt><dd>{usd(token.rent)}/mo</dd>
              <dt className="text-muted-foreground">Where</dt><dd>{shop.floorNote}</dd>
            </dl>
          </Card>
        </div>
      </div>

      <Modal open={!!restock} onClose={() => setRestock(null)} title="Restock (simulated)">
        <Field label="Units to add" hint={`Free capacity: ${Math.max(0, shop.shelf.capacity - used)} units`}><input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className={inputCls} data-testid="input-restock" /></Field>
        <div className="mt-3"><ErrorNote error={error} /></div>
        <SmallButton tone="solid" disabled={pending} onClick={() => { if (restock) { const r = act(() => actions.restockListing(restock, qty), "Restocked"); if (r.ok) setRestock(null); } }} testId="button-confirm-restock">Add units</SmallButton>
      </Modal>
    </Shell>
  );
}
