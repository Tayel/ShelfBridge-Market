import { useState } from "react";
import { localApprox } from "@/lib/data";
import { Link, useParams } from "wouter";
import { Shell, PrimaryButton } from "@/components/shell";
import { Card, ErrorNote, Field, Notice, Pill, inputCls } from "@/components/kit";
import { IsoFloor } from "@/components/iso-floor";
import { PhotoGallery, PhotoUploader } from "@/components/photos";
import { LIVE, isMine, useSession, useStore } from "@/lib/store";
import { actions } from "@/lib/actions";
import { useAct } from "@/hooks/use-act";
import type { RentalTerms, Shop, ShelfSpec } from "@/lib/types";

export default function ShopSettings() {
  const { id } = useParams<{ id: string }>();
  const st = useStore();
  const shop = st.shops.find((s) => s.id === id);
  if (!shop) return <Shell title="Store not found" back="/owner-dashboard"><p className="mt-20 text-center text-muted-foreground">No store here.</p></Shell>;
  return <Form key={shop.id} shop={shop} />;
}

function Form({ shop }: { shop: Shop }) {
  const session = useSession();
  const { act, error, pending } = useAct();
  const [info, setInfo] = useState({ name: shop.name, address: shop.address, registration: shop.registration, ownerName: shop.ownerName, price: shop.price, floorNote: shop.floorNote, city: shop.city, hours: shop.hours ?? "" });
  const [shelf, setShelf] = useState<ShelfSpec>(shop.shelf);
  const [terms, setTerms] = useState<RentalTerms>(shop.terms);
  const [photos, setPhotos] = useState(shop.photos);
  const isNew = typeof window !== "undefined" && window.location.search.includes("new=1");

  const save = () => act(() => actions.updateShop(shop.id, { ...info, photos, price: Number(info.price), shelf: { widthCm: Number(shelf.widthCm), heightCm: Number(shelf.heightCm), depthCm: Number(shelf.depthCm), capacity: Math.floor(Number(shelf.capacity)) }, terms: { ...terms, months: Math.floor(Number(terms.months)), deposit: Number(terms.deposit), taxRate: Number(terms.taxRate), lateFeePct: Number(terms.lateFeePct), graceDays: Math.floor(Number(terms.graceDays)) } }), "Store details saved");
  const n = (v: string) => (v === "" ? 0 : Number(v));
  const ro = !isMine(shop, session) && !session.me?.isAdmin;

  return (
    <Shell title={`${shop.name} settings`} back="/owner-dashboard?tab=stores">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold md:text-5xl">{shop.name}</h1>
        <div className="mt-2 flex justify-center gap-2"><Pill testId="status-store">{shop.status}</Pill></div>
      </div>
      <div className="mx-auto mt-5 max-w-3xl space-y-3">
        {isNew && <Notice tone="good">Submitted. Add the details below — they go into every new contract snapshot.</Notice>}
        {shop.status === "pending" && <Notice tone="warn">{session.live ? <>Waiting for approval. The InRaf team reviews every new store, and you'll see the decision in your notifications.{session.me?.isAdmin && <> Approve it in the <Link href="/admin?tab=stores" className="underline" data-testid="link-admin-stores">Admin console</Link>.</>}</> : <>Waiting for platform approval. In this demo, switch to the admin view and approve it in the <Link href="/admin?tab=stores" className="underline" data-testid="link-admin-stores">Admin console</Link>.</>}</Notice>}
        {ro && <Notice tone="mute">Sample store — read-only.</Notice>}
      </div>
      <div className="mx-auto mt-6 grid max-w-3xl gap-5">
        <Card className="space-y-4">
          <p className="font-display text-lg font-bold">Store & registration</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Store name"><input disabled={ro} value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} className={inputCls} data-testid="input-name" /></Field>
            <Field label="Owner name"><input disabled={ro} value={info.ownerName} onChange={(e) => setInfo({ ...info, ownerName: e.target.value })} className={inputCls} data-testid="input-owner" /></Field>
            <Field label="Address"><input disabled={ro} value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} className={inputCls} data-testid="input-address" /></Field>
            <Field label="Opening hours" hint="Shown to makers, e.g. Sat–Thu 9:00–22:00, Fri 14:00–22:00"><input disabled={ro} maxLength={120} value={info.hours} onChange={(e) => setInfo({ ...info, hours: e.target.value })} className={inputCls} data-testid="input-hours" /></Field>
            <Field label="Registration no." hint={LIVE ? "Your trade licence or commercial registration number. Only you and the InRaf team see it." : "Demo value only — don't enter real registration data."}><input disabled={ro} value={info.registration} onChange={(e) => setInfo({ ...info, registration: e.target.value })} className={inputCls} data-testid="input-registration" /></Field>
          </div>
        </Card>
        <Card className="space-y-4" testId="card-photos">
          <div>
            <p className="font-display text-lg font-bold">Photos</p>
            <p className="text-sm text-muted-foreground">Makers see these first. Retake them when the shelf or the shop changes.</p>
          </div>
          {ro ? <PhotoGallery shop={shop} /> : <PhotoUploader photos={photos} onChange={setPhotos} />}
        </Card>
        <Card className="space-y-4">
          <p className="font-display text-lg font-bold">Each shelf</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Width cm"><input disabled={ro} type="number" value={shelf.widthCm} onChange={(e) => setShelf({ ...shelf, widthCm: n(e.target.value) })} className={inputCls} data-testid="input-width" /></Field>
            <Field label="Height cm"><input disabled={ro} type="number" value={shelf.heightCm} onChange={(e) => setShelf({ ...shelf, heightCm: n(e.target.value) })} className={inputCls} data-testid="input-height" /></Field>
            <Field label="Depth cm"><input disabled={ro} type="number" value={shelf.depthCm} onChange={(e) => setShelf({ ...shelf, depthCm: n(e.target.value) })} className={inputCls} data-testid="input-depth" /></Field>
            <Field label="Capacity units"><input disabled={ro} type="number" value={shelf.capacity} onChange={(e) => setShelf({ ...shelf, capacity: n(e.target.value) })} className={inputCls} data-testid="input-capacity" /></Field>
          </div>
          <Field label="Location in store"><input disabled={ro} value={info.floorNote} onChange={(e) => setInfo({ ...info, floorNote: e.target.value })} className={inputCls} data-testid="input-floor" /></Field>
          <div className="mx-auto w-full max-w-xs"><IsoFloor width={shop.width} depth={shop.depth} bricks={shop.bricks} hue={shop.hue} /></div>
          <p className="text-center text-xs text-muted-foreground">Floor plan: raised spots hold {shop.tiers} shelf tier{shop.tiers === 1 ? "" : "s"} each.</p>
        </Card>
        <Card className="space-y-4">
          <p className="font-display text-lg font-bold">Rental terms</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Rent USD / month" hint={localApprox(info.price, shop.country) || undefined}><input disabled={ro} type="number" value={info.price} onChange={(e) => setInfo({ ...info, price: n(e.target.value) })} className={inputCls} data-testid="input-price" /></Field>
            <Field label="Duration (months)"><input disabled={ro} type="number" value={terms.months} onChange={(e) => setTerms({ ...terms, months: n(e.target.value) })} className={inputCls} data-testid="input-months" /></Field>
            <Field label="Deposit USD"><input disabled={ro} type="number" value={terms.deposit} onChange={(e) => setTerms({ ...terms, deposit: n(e.target.value) })} className={inputCls} data-testid="input-deposit" /></Field>
            <Field label="Tax % (illustrative)"><input disabled={ro} type="number" value={terms.taxRate} onChange={(e) => setTerms({ ...terms, taxRate: n(e.target.value) })} className={inputCls} data-testid="input-tax" /></Field>
            <Field label="Late fee %"><input disabled={ro} type="number" value={terms.lateFeePct} onChange={(e) => setTerms({ ...terms, lateFeePct: n(e.target.value) })} className={inputCls} data-testid="input-late" /></Field>
            <Field label="Grace days"><input disabled={ro} type="number" value={terms.graceDays} onChange={(e) => setTerms({ ...terms, graceDays: n(e.target.value) })} className={inputCls} data-testid="input-grace" /></Field>
            <Field label="Notice to end early (days)" hint="A maker who leaves before the end pays rent for these days."><input disabled={ro} type="number" min={0} max={90} value={terms.noticeDays ?? 30} onChange={(e) => setTerms({ ...terms, noticeDays: Math.min(90, Math.max(0, n(e.target.value))) })} className={inputCls} data-testid="input-notice" /></Field>
          </div>
          <Field label="Renewal"><select disabled={ro} value={terms.renewal} onChange={(e) => setTerms({ ...terms, renewal: e.target.value as RentalTerms["renewal"] })} className={inputCls} data-testid="select-renewal"><option value="manual">Manual renewal (new signed version)</option><option value="auto-offer">Offer renewal before expiry</option><option value="none">No renewal</option></select></Field>
          {(["maintenance", "display", "liability", "dispute"] as const).map((k) => (
            <Field key={k} label={k[0].toUpperCase() + k.slice(1)}><textarea disabled={ro} rows={2} value={terms[k]} onChange={(e) => setTerms({ ...terms, [k]: e.target.value })} className={inputCls} data-testid={`input-${k}`} /></Field>
          ))}
          <p className="text-xs text-muted-foreground">{LIVE ? "Template wording. Not legal advice; have your terms reviewed for your country." : "Template wording for the demo. Not legal advice; have real terms reviewed for your jurisdiction."}</p>
        </Card>
        <ErrorNote error={error} />
        {!ro && <PrimaryButton disabled={pending} onClick={save} data-testid="button-save-store">Save details</PrimaryButton>}
      </div>
    </Shell>
  );
}
