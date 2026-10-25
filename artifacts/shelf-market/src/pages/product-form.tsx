import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Check, X } from "lucide-react";
import { Shell, PrimaryButton } from "@/components/shell";
import { Card, ErrorNote, Field, ProductImage, inputCls } from "@/components/kit";
import { useStore } from "@/lib/store";
import { actions } from "@/lib/actions";
import { useAct } from "@/hooks/use-act";
import { CATEGORIES, COUNTRIES, SWATCHES, categoryLabel, countryName } from "@/lib/data";
import { shelfLabel, shelfUnits } from "@/lib/selectors";
import { addDays, today } from "@/lib/util";
import type { ListingInput } from "@/lib/ops";

export default function ProductForm() {
  const params = useParams<{ tokenId?: string; id?: string }>();
  const st = useStore();
  const [, go] = useLocation();
  const { act, error, pending } = useAct();
  const existing = params.id ? st.listings.find((l) => l.id === params.id) : undefined;
  const tokenId = existing?.tokenId ?? params.tokenId ?? "";
  const token = st.tokens.find((t) => t.id === tokenId);
  const shop = st.shops.find((s) => s.id === token?.shopId);

  const [f, setF] = useState<ListingInput>(() => existing
    ? { name: existing.name, sku: existing.sku, category: existing.category, description: existing.description, color: existing.color, imageUrl: existing.imageUrl, origin: existing.origin, retail: existing.retail, cost: existing.cost, taxRate: existing.taxRate, batch: existing.batch, expiry: existing.expiry, initialQty: existing.initialQty }
    : { name: "", sku: "", category: shop?.categories[0] ?? "food", description: "", color: SWATCHES[0], imageUrl: "", origin: shop?.country ?? "EG", retail: 9.5, cost: 4, taxRate: shop?.terms.taxRate ?? 10, batch: "", expiry: "", initialQty: 6 });
  const set = <K extends keyof ListingInput>(k: K, v: ListingInput[K]) => setF((x) => ({ ...x, [k]: v }));

  const checks = useMemo(() => {
    if (!shop) return [];
    const minExp = addDays(today(), 60);
    return [
      { id: "cat", ok: shop.categories.includes(f.category), text: shop.categories.includes(f.category) ? `${categoryLabel(f.category)} allowed here` : `${shop.name} doesn't take ${categoryLabel(f.category).toLowerCase()}` },
      { id: "exp", ok: !f.expiry || f.expiry >= minExp, text: !f.expiry ? "Not perishable" : f.expiry >= minExp ? "Expiry is 60+ days away" : "Expires within 60 days (sample rule)" },
      { id: "alc", ok: !(f.category === "alcohol" && shop.country === "AE"), text: f.category === "alcohol" && shop.country === "AE" ? "Alcohol restricted at this store (sample rule)" : "No sample destination rule hit" },
      { id: "cap", ok: shelfUnits(st, tokenId, existing?.id) + (existing && existing.status !== "pending" && existing.status !== "rejected" ? existing.available : f.initialQty) <= shop.shelf.capacity, text: `Shelf capacity ${shop.shelf.capacity} units` },
    ];
  }, [f, shop, st, tokenId, existing]);

  if (!token || !shop) return <Shell title="Not found" back="/dashboard"><p className="mt-20 text-center text-muted-foreground">Shelf not found. <Link href="/dashboard" className="text-primary underline">Holder portal</Link></p></Shell>;

  const lockedQty = !!existing && existing.status !== "pending" && existing.status !== "rejected" && existing.status !== "draft";
  const submit = () => {
    const payload: ListingInput = { ...f, imageUrl: f.imageUrl?.trim() || undefined, expiry: f.expiry || undefined, retail: Number(f.retail), cost: Number(f.cost), taxRate: Number(f.taxRate), initialQty: Math.floor(Number(f.initialQty)) };
    const r = existing ? act(() => actions.updateListing(existing.id, payload), "Product saved") : act(() => actions.createListing(token.id, payload), "Sent to store owner for approval");
    if (r.ok) go(`/shelf/${token.id}`);
  };
  const num = (k: "retail" | "cost" | "taxRate" | "initialQty") => (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value === "" ? 0 : Number(e.target.value));

  return (
    <Shell title={existing ? `Edit ${existing.name}` : "Add a product"} back={`/shelf/${token.id}`}>
      <div className="text-center">
        <p className="text-sm text-muted-foreground">{shop.name} · {shelfLabel(shop, token.slot)}</p>
        <h1 className="font-display text-4xl font-bold md:text-5xl">{existing ? "Edit product" : "Add a product"}</h1>
      </div>
      <div className="mx-auto mt-8 grid max-w-5xl gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product name"><input value={f.name} onChange={(e) => set("name", e.target.value)} className={inputCls} data-testid="input-product-name" /></Field>
            <Field label="SKU"><input value={f.sku} onChange={(e) => set("sku", e.target.value)} className={inputCls} placeholder="e.g. DUKK-EG-02" data-testid="input-sku" /></Field>
            <Field label="Category"><select value={f.category} onChange={(e) => set("category", e.target.value)} className={inputCls} data-testid="select-category">{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
            <Field label="Made in"><select value={f.origin} onChange={(e) => set("origin", e.target.value)} className={inputCls} data-testid="select-origin">{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></Field>
          </div>
          <Field label="Description"><textarea rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} className={inputCls} data-testid="input-description" /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Retail (USD)"><input type="number" step="0.1" min={0} value={f.retail} onChange={num("retail")} className={inputCls} data-testid="input-retail" /></Field>
            <Field label="Unit cost (USD)"><input type="number" step="0.1" min={0} value={f.cost} onChange={num("cost")} className={inputCls} data-testid="input-cost" /></Field>
            <Field label="Tax % (illustrative)"><input type="number" step="0.5" min={0} max={40} value={f.taxRate} onChange={num("taxRate")} className={inputCls} data-testid="input-tax" /></Field>
            <Field label="Batch"><input value={f.batch} onChange={(e) => set("batch", e.target.value)} className={inputCls} data-testid="input-batch" /></Field>
            <Field label="Expiry (optional)"><input type="date" min={today()} value={f.expiry ?? ""} onChange={(e) => set("expiry", e.target.value)} className={inputCls} data-testid="input-expiry" /></Field>
            <Field label="Initial quantity" hint={lockedQty ? "Use Restock on the shelf page" : undefined}><input type="number" min={1} step={1} disabled={lockedQty} value={f.initialQty} onChange={num("initialQty")} className={inputCls} data-testid="input-qty" /></Field>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Image</p>
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map((c) => <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={f.color === c && !f.imageUrl} onClick={() => { set("color", c); set("imageUrl", ""); }} className={`h-8 w-8 rounded-full ring-offset-2 transition ${f.color === c && !f.imageUrl ? "ring-2 ring-primary" : ""}`} style={{ background: c }} data-testid={`swatch-${c.slice(1)}`} />)}
            </div>
            <input value={f.imageUrl ?? ""} onChange={(e) => set("imageUrl", e.target.value)} className={`${inputCls} mt-2`} placeholder="…or a short https:// image URL (no uploads in this demo)" data-testid="input-image-url" />
          </div>
          <ErrorNote error={error} />
          <PrimaryButton disabled={pending} onClick={submit} data-testid="button-save-product">{existing ? "Save changes" : "Submit for owner approval"}</PrimaryButton>
          {existing && <p className="text-xs text-muted-foreground">Changing name, price, category, tax, batch or expiry sends it back for owner approval.</p>}
        </Card>
        <div className="space-y-4">
          <Card className="flex flex-col items-center text-center">
            <ProductImage color={f.color} url={f.imageUrl || undefined} name={f.name || "Preview"} className="h-28 w-28" />
            <p className="font-display mt-3 text-lg font-bold">{f.name || "Your product"}</p>
            <p className="text-sm text-muted-foreground">{countryName(f.origin)} · {categoryLabel(f.category)}</p>
          </Card>
          <Card>
            <p className="font-display font-bold">Sample compatibility checks</p>
            <ul className="mt-2 space-y-1.5 text-sm" data-testid="list-checks">
              {checks.map((c) => <li key={c.id} className="flex items-start gap-2"><span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${c.ok ? "bg-secondary text-secondary-foreground" : "bg-destructive/10 text-destructive"}`}>{c.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}</span>{c.text}</li>)}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">Demonstrative only. Not legal, customs or regulatory clearance. Capacity is enforced; the others inform the owner's decision.</p>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
