import { useRef, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, Grid2x2, ImagePlus, Store, Trash2, X } from "lucide-react";
import { Modal } from "@/components/kit";
import { nowIso } from "@/lib/util";
import type { PhotoKind, Shop, ShopPhoto } from "@/lib/types";

export const KIND_LABEL: Record<PhotoKind, string> = { front: "Shop front", inside: "Inside the shop", shelf: "The shelf" };

/** Shelf photos first on cards: that's what the maker is renting. */
export const coverOf = (photos: ShopPhoto[]) => photos.find((p) => p.kind === "shelf") ?? photos[0];

/**
 * Shrinks a camera photo to a JPEG data URL (long edge 1280px). Everything in this demo is
 * kept in the browser's storage, which only holds a few MB, so full-size photos won't fit.
 */
export function compressPhoto(file: File, maxEdge = 1280, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("That file isn't a photo."));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read that photo. Try a JPEG or PNG.")); };
    img.src = url;
  });
}

function Img({ p, className = "" }: { p: ShopPhoto; className?: string }) {
  return <img src={p.url} alt={p.caption || KIND_LABEL[p.kind]} loading="lazy" referrerPolicy="no-referrer" className={`h-full w-full object-cover ${className}`} />;
}

function SourceNote({ photos }: { photos: ShopPhoto[] }) {
  if (photos.some((p) => p.source === "stock")) return <p className="mt-2 text-xs text-muted-foreground" data-testid="text-photo-source">Sample store: real stock photos of a similar shop (Unsplash), not this exact shop. Owners of real listings upload their own.</p>;
  const latest = photos.map((p) => p.addedAt).sort().pop();
  return <p className="mt-2 text-xs text-muted-foreground" data-testid="text-photo-source">Photos uploaded by the store owner{latest ? ` · last updated ${new Date(latest).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}` : ""}.</p>;
}

/** Airbnb-style grid: one large photo and up to four small ones, plus a full gallery. */
export function PhotoGallery({ shop }: { shop: Shop }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<number | null>(null);
  const photos = [...shop.photos].sort((a, b) => order(a) - order(b));
  if (!photos.length) {
    return (
      <div className="flex items-center gap-3 rounded-[1.75rem] border border-dashed border-border px-5 py-4 text-sm text-muted-foreground" data-testid="no-photos">
        <Camera className="h-5 w-5 shrink-0" />No photos yet. Ask the owner for photos of the shop and the shelf before you rent.
      </div>
    );
  }
  const [main, ...rest] = photos;
  const small = rest.slice(0, 4);
  return (
    <div data-testid="photo-gallery">
      <div className={`relative grid h-[260px] gap-2 overflow-hidden rounded-[1.75rem] md:h-[400px] ${small.length ? "md:grid-cols-[2fr_1fr_1fr] md:grid-rows-2" : ""}`}>
        <button className="relative md:row-span-2" onClick={() => setView(0)} data-testid="photo-0"><Img p={main} className="transition hover:brightness-90" /><Tag p={main} /></button>
        {small.map((p, i) => (
          <button key={i} className={`relative hidden md:block ${small.length < 3 ? "md:row-span-2" : ""}`} onClick={() => setView(i + 1)} data-testid={`photo-${i + 1}`}><Img p={p} className="transition hover:brightness-90" /><Tag p={p} /></button>
        ))}
        <button onClick={() => setOpen(true)} className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-xl border border-foreground/20 bg-background px-3 py-1.5 text-sm font-semibold shadow" data-testid="button-all-photos">
          <Grid2x2 className="h-4 w-4" />Show all {photos.length} photos
        </button>
      </div>
      <SourceNote photos={photos} />

      <Modal open={open} onClose={() => setOpen(false)} title="Photos" wide>
        <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
          {(["shelf", "front", "inside"] as PhotoKind[]).map((k) => {
            const list = photos.filter((p) => p.kind === k);
            if (!list.length) return null;
            return (
              <section key={k}>
                <p className="font-semibold">{KIND_LABEL[k]}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {list.map((p) => (
                    <button key={p.url} onClick={() => setView(photos.indexOf(p))} className="overflow-hidden rounded-2xl text-left">
                      <div className="aspect-[4/3]"><Img p={p} /></div>
                      {p.caption && <p className="mt-1 text-sm text-muted-foreground">{p.caption}</p>}
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
          <SourceNote photos={photos} />
        </div>
      </Modal>

      {view !== null && <Lightbox photos={photos} i={view} set={setView} />}
    </div>
  );
}

const order = (p: ShopPhoto) => ({ shelf: 0, front: 1, inside: 2 })[p.kind];

function Tag({ p }: { p: ShopPhoto }) {
  return <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-semibold shadow-sm">{KIND_LABEL[p.kind]}</span>;
}

function Lightbox({ photos, i, set }: { photos: ShopPhoto[]; i: number; set: (n: number | null) => void }) {
  const p = photos[i];
  const go = (d: number) => set((i + d + photos.length) % photos.length);
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95 p-4 text-white" role="dialog" aria-modal aria-label="Photo viewer" data-testid="lightbox"
      onKeyDown={(e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); if (e.key === "Escape") set(null); }} tabIndex={-1} ref={(el) => el?.focus()}>
      <div className="flex items-center justify-between">
        <button onClick={() => set(null)} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 hover:bg-white/10" data-testid="button-close-lightbox"><X className="h-4 w-4" />Close</button>
        <span className="text-sm">{i + 1} / {photos.length}</span>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <img src={p.url} alt={p.caption || KIND_LABEL[p.kind]} referrerPolicy="no-referrer" className="max-h-full max-w-full rounded-lg object-contain" />
        {photos.length > 1 && <>
          <button onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-0 grid h-10 w-10 place-items-center rounded-full bg-white/15 hover:bg-white/25"><ChevronLeft /></button>
          <button onClick={() => go(1)} aria-label="Next photo" className="absolute right-0 grid h-10 w-10 place-items-center rounded-full bg-white/15 hover:bg-white/25"><ChevronRight /></button>
        </>}
      </div>
      <p className="mt-3 text-center text-sm">{KIND_LABEL[p.kind]}{p.caption && p.caption !== KIND_LABEL[p.kind] ? ` · ${p.caption}` : ""}{p.source === "stock" ? " · stock photo" : ""}</p>
    </div>
  );
}

const SLOTS: { kind: PhotoKind; title: string; hint: string; required: boolean }[] = [
  { kind: "shelf", title: "The shelf you're renting out", hint: "Straight on, in daylight, empty or as it looks today.", required: true },
  { kind: "front", title: "Shop front", hint: "From the street, so makers can find you.", required: true },
  { kind: "inside", title: "Inside the shop", hint: "Where the shelf sits, and the aisle shoppers walk.", required: false },
];

/** Upload slots per photo kind. Owners must show the shelf and the shop (front or inside). */
export function PhotoUploader({ photos, onChange, max = 8 }: { photos: ShopPhoto[]; onChange: (p: ShopPhoto[]) => void; max?: number }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<PhotoKind>("shelf");

  const pick = (kind: PhotoKind) => { target.current = kind; input.current?.click(); };
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setError(null);
    try {
      const room = max - photos.length;
      if (room <= 0) throw new Error(`Up to ${max} photos.`);
      const urls = await Promise.all([...files].slice(0, room).map((f) => compressPhoto(f)));
      onChange([...photos, ...urls.map((url) => ({ url, kind: target.current, caption: "", source: "owner" as const, addedAt: nowIso() }))]);
      if (files.length > room) setError(`Only the first ${room} were added (up to ${max} photos).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that photo.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const update = (i: number, patch: Partial<ShopPhoto>) => onChange(photos.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <div className="space-y-4" data-testid="photo-uploader">
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => add(e.target.files)} data-testid="input-photo-file" />
      {SLOTS.map((slot) => {
        const list = photos.map((p, i) => ({ p, i })).filter((x) => x.p.kind === slot.kind);
        const missing = slot.required && !list.length;
        return (
          <div key={slot.kind} className={`rounded-3xl border-2 p-4 ${missing ? "border-dashed border-primary/40" : "border-border"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-semibold">{slot.kind === "shelf" ? <ImagePlus className="h-4 w-4 text-primary" /> : <Store className="h-4 w-4 text-primary" />}{slot.title}{slot.required && <span className="text-xs font-normal text-primary">required</span>}</p>
                <p className="text-sm text-muted-foreground">{slot.hint}</p>
              </div>
              <button type="button" disabled={busy || photos.length >= max} onClick={() => pick(slot.kind)} data-testid={`button-add-photo-${slot.kind}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm font-medium transition hover:bg-muted disabled:opacity-40">
                <Camera className="h-4 w-4" />{busy && target.current === slot.kind ? "Adding…" : "Add photo"}
              </button>
            </div>
            {list.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {list.map(({ p, i }) => (
                  <div key={i} className="space-y-1.5">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                      <Img p={p} />
                      <button type="button" onClick={() => onChange(photos.filter((_, j) => j !== i))} aria-label="Remove photo" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background/90 shadow" data-testid={`button-remove-photo-${i}`}><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <input value={p.caption ?? ""} onChange={(e) => update(i, { caption: e.target.value })} placeholder="Caption (optional)" className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary" data-testid={`input-caption-${i}`} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <p className="text-center text-xs text-muted-foreground">{photos.length}/{max} photos · resized in your browser before saving</p>
      {error && <p role="alert" className="text-center text-sm text-destructive" data-testid="text-photo-error">{error}</p>}
    </div>
  );
}

/** True when the shop has what makers need to feel comfortable: the shelf and the shop itself. */
export const photosComplete = (photos: ShopPhoto[]) => photos.some((p) => p.kind === "shelf") && photos.some((p) => p.kind === "front");
