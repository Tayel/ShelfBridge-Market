import { useRef, useState } from "react";
import { Link } from "wouter";
import { Camera, ChevronDown, ChevronRight, MessageSquare, Plus, Truck, X } from "lucide-react";
import { Card, ErrorNote, Field, Pill, SmallButton, inputCls } from "@/components/kit";
import { PrimaryButton, GhostButton } from "@/components/shell";
import { compressPhoto } from "@/components/photos";
import { actions } from "@/lib/actions";
import { INCIDENT_TYPES, TASK_TYPES, caseIsOpen, holderOf } from "@/lib/ops";
import { reservedQty, shelfLabel } from "@/lib/selectors";
import { usd, type useStore } from "@/lib/store";
import { fmtDate, fmtTime } from "@/lib/util";
import type { Delivery, OpsActor, OpsCase, State } from "@/lib/types";

/**
 * Remote store operations, shared by the maker's and the store owner's portals: requests to the store, incidents,
 * deliveries and counts. Each card shows the full history with who did what and when, the evidence (with its source),
 * and only the actions the viewer's role allows — the server enforces the same rules.
 */
type Act = (fn: () => Promise<unknown> | unknown, success?: string) => Promise<{ ok: boolean }>;
export const caseLabel = (c: OpsCase) => (c.kind === "incident" ? INCIDENT_TYPES : TASK_TYPES)[c.type] ?? c.type;
const STATUS_TEXT: Record<string, string> = {
  submitted: "Sent to the store", received: "Store has it", "in-progress": "In progress", "on-hold": "On hold", "awaiting-verification": "Done: waiting for your check",
  completed: "Completed", resolved: "Resolved", rejected: "Declined", cancelled: "Cancelled", escalated: "Escalated to InRaf",
};
export const statusText = (c: OpsCase, viewer: OpsActor) => (c.status === "awaiting-verification" && viewer !== "holder" ? "Waiting for the maker's check" : STATUS_TEXT[c.status] ?? c.status);

export function PhotoPicker({ photos, onChange, max = 4, label = "Add photos" }: { photos: string[]; onChange: (p: string[]) => void; max?: number; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const add = async (files: FileList | null) => {
    if (!files) return;
    setBusy(true);
    try { const out = [...photos]; for (const f of Array.from(files).slice(0, max - photos.length)) out.push(await compressPhoto(f, 1024, 0.7)); onChange(out); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {photos.map((p, i) => (
        <span key={i} className="relative"><img src={p} alt="" className="h-14 w-14 rounded-xl object-cover" /><button type="button" aria-label="Remove photo" onClick={() => onChange(photos.filter((_, k) => k !== i))} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-foreground text-background"><X className="h-3 w-3" /></button></span>
      ))}
      {photos.length < max && <button type="button" onClick={() => input.current?.click()} disabled={busy} className="inline-flex h-14 items-center gap-1.5 rounded-xl border border-dashed border-border px-3 text-xs text-muted-foreground hover:border-primary/40" data-testid="button-add-photo"><Camera className="h-4 w-4" />{busy ? "Adding…" : label}</button>}
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

/** One request or incident: status, history, evidence and the viewer's actions. */
export function CaseCard({ st, c, viewer, viewerName, act, pending, defaultOpen = false }: { st: State; c: OpsCase; viewer: OpsActor; viewerName: string; act: Act; pending: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [assignee, setAssignee] = useState(c.assignee ?? "");
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries((c.count ?? []).map((l) => [l.listingId, l.counted ?? l.expected])));
  const shop = st.shops.find((s) => s.id === c.shopId);
  const tok = st.tokens.find((t) => t.id === c.tokenId);
  const product = c.listingId ? st.listings.find((l) => l.id === c.listingId) : undefined;
  const order = c.orderId ? st.orders.find((o) => o.id === c.orderId) : undefined;
  const delivery = c.deliveryId ? st.deliveries.find((d) => d.id === c.deliveryId) : undefined;
  const run = async (action: string, extra: Record<string, unknown> = {}) => {
    const r = await act(() => actions.caseAction(c.id, viewer, viewerName, action, { note, photos, ...extra }), action === "comment" ? "Message sent" : "Updated");
    if (r.ok) { setNote(""); setPhotos([]); }
  };
  const tone = c.status === "escalated" || (c.kind === "incident" && caseIsOpen(c)) ? "bad" : c.status === "awaiting-verification" ? "warn" : undefined;
  const can = (a: string) => ({
    owner: ["receive", "start", "hold", "complete", "reject", "comment"], holder: ["accept", "concern", "cancel", "escalate", "comment"], admin: ["comment", "resolve", "reject"],
  }[viewer].includes(a));
  const openNow = caseIsOpen(c);
  return (
    <Card testId={`case-${c.id}`}>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 text-left">
        {open ? <ChevronDown className="mt-1 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-1 h-4 w-4 shrink-0" />}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2"><b>{c.ref}</b><span>{caseLabel(c)}</span>{c.priority === "urgent" && <Pill tone="bad">urgent</Pill>}</span>
          <span className="block text-xs text-muted-foreground">{shop?.name}{tok && shop ? ` · ${shelfLabel(shop, tok.slot)}` : ""} · {holderOf(st, c.holderId).name} · opened {fmtDate(c.createdAt.slice(0, 10))}{c.assignee ? ` · handled by ${c.assignee}` : ""}</span>
        </span>
        <Pill tone={tone}>{statusText(c, viewer)}</Pill>
      </button>
      {open && (
        <div className="mt-4 space-y-4 border-t border-border pt-4 text-sm">
          <p>{c.description}</p>
          {(product || order || delivery) && <p className="text-xs text-muted-foreground">{product && <>Product: {product.name} ({product.sku}) </>}{order && <>· Order {order.ref}: {order.qty} × {order.productName}, {usd(order.subtotal)} </>}{delivery && <>· Delivery {delivery.ref}</>}</p>}
          {c.count && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] text-left text-xs" data-testid="count-table">
                <thead className="text-muted-foreground"><tr><th className="py-1">Product</th><th className="py-1">Expected</th><th className="py-1">Counted</th><th className="py-1">Difference</th></tr></thead>
                <tbody>{c.count.map((l) => {
                  const editing = viewer === "owner" && ["received", "in-progress"].includes(c.status);
                  const counted = editing ? counts[l.listingId] : l.counted;
                  const diff = counted === undefined ? null : counted - l.expected;
                  return (
                    <tr key={l.listingId} className="border-t border-border">
                      <td className="py-1.5">{l.name}</td><td className="py-1.5 tabular-nums">{l.expected}</td>
                      <td className="py-1.5">{editing ? <input type="number" min={0} value={counts[l.listingId] ?? ""} onChange={(e) => setCounts({ ...counts, [l.listingId]: Math.max(0, Math.floor(Number(e.target.value))) })} className="w-20 rounded-lg border border-input bg-background px-2 py-1" data-testid={`input-count-${l.listingId}`} /> : counted ?? "Not counted yet"}</td>
                      <td className={`py-1.5 tabular-nums ${diff ? "font-semibold text-destructive" : ""}`}>{diff === null ? "—" : diff > 0 ? `+${diff}` : diff}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
              {c.countAppliedAt && <p className="mt-1 text-xs text-muted-foreground">Applied to stock on {fmtDate(c.countAppliedAt.slice(0, 10))}.</p>}
            </div>
          )}
          {c.resolution && <p className="rounded-2xl bg-muted/60 p-3"><b>{c.kind === "incident" ? "Resolution" : "What the store says was done"}:</b> {c.resolution}</p>}
          {c.evidence.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {c.evidence.map((e, i) => (
                  <a key={i} href={e.url} target="_blank" rel="noopener" className="block w-28 text-[11px] text-muted-foreground" data-testid="evidence-photo">
                    <img src={e.url} alt={e.caption ?? "Evidence"} className="h-20 w-28 rounded-xl object-cover" />
                    <span className="mt-1 block">{e.by === "owner" ? "From the store" : e.by === "holder" ? "From the maker" : "From InRaf"} · {e.byName}</span>
                    <span className="block">{fmtTime(e.at)}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
          <ol className="space-y-1.5 border-l-2 border-border pl-4" data-testid="case-history">
            {c.events.map((e, i) => (
              <li key={i} className="text-xs"><b>{e.byName}</b> <span className="text-muted-foreground">({e.by === "holder" ? "maker" : e.by === "owner" ? "store" : "InRaf"}) · {e.action}{e.status ? ` → ${statusText({ ...c, status: e.status }, viewer)}` : ""} · {fmtTime(e.at)}</span>{e.note && <span className="block">{e.note}</span>}</li>
            ))}
          </ol>
          {viewer === "holder" && c.type === "count" && c.status === "completed" && !c.countAppliedAt && c.count?.some((l) => l.counted !== l.expected) && (
            <div className="rounded-2xl border border-border p-3">
              <p className="font-semibold">Apply this count to your stock?</p>
              <p className="text-xs text-muted-foreground">Your stock on InRaf becomes what the store counted. The difference is recorded as a count adjustment — not as sales, losses or damage. Report an incident if you think units are missing.</p>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (required)" className={`${inputCls} mt-2`} data-testid="input-apply-count" />
              <SmallButton tone="solid" disabled={pending} onClick={async () => { const r = await act(() => actions.applyCount(c.id, note), "Stock updated from the count"); if (r.ok) setNote(""); }} testId="button-apply-count">Apply count</SmallButton>
            </div>
          )}
          {(openNow || can("comment")) && (
            <div className="space-y-2 rounded-2xl bg-muted/40 p-3">
              {viewer === "owner" && openNow && ["submitted", "received", "on-hold"].includes(c.status) && (
                <input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Staff member handling it (optional)" className={inputCls} data-testid="input-assignee" />
              )}
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={viewer === "owner" && openNow ? "What was done, or a message" : "Message"} className={inputCls} data-testid="input-case-note" />
              <PhotoPicker photos={photos} onChange={setPhotos} />
              <div className="flex flex-wrap gap-2">
                {viewer === "owner" && c.status === "submitted" && <SmallButton disabled={pending} onClick={() => void run("receive")} testId="case-receive">Acknowledge</SmallButton>}
                {viewer === "owner" && ["submitted", "received", "on-hold"].includes(c.status) && <SmallButton disabled={pending} onClick={() => void run("start", { assignee })} testId="case-start">Start</SmallButton>}
                {viewer === "owner" && ["received", "in-progress"].includes(c.status) && <SmallButton tone="solid" disabled={pending} onClick={() => void run("complete", { counts })} testId="case-complete">Mark done (with evidence)</SmallButton>}
                {viewer === "owner" && ["received", "in-progress"].includes(c.status) && <SmallButton disabled={pending} onClick={() => void run("hold")} testId="case-hold">Put on hold</SmallButton>}
                {(viewer === "owner" || viewer === "admin") && openNow && <SmallButton tone="danger" disabled={pending} onClick={() => void run("reject")} testId="case-reject">Decline</SmallButton>}
                {viewer === "holder" && c.status === "awaiting-verification" && <SmallButton tone="solid" disabled={pending} onClick={() => void run("accept")} testId="case-accept">Accept: it's done</SmallButton>}
                {viewer === "holder" && c.status === "awaiting-verification" && <SmallButton disabled={pending} onClick={() => void run("concern")} testId="case-concern">Not right: raise a concern</SmallButton>}
                {viewer === "holder" && ["submitted", "received"].includes(c.status) && <SmallButton disabled={pending} onClick={() => void run("cancel")} testId="case-cancel">Cancel request</SmallButton>}
                {viewer === "holder" && openNow && c.status !== "escalated" && <SmallButton tone="danger" disabled={pending} onClick={() => void run("escalate")} testId="case-escalate">Escalate to InRaf</SmallButton>}
                {viewer === "admin" && openNow && <SmallButton tone="solid" disabled={pending} onClick={() => void run("resolve")} testId="case-resolve">Resolve</SmallButton>}
                <SmallButton disabled={pending} onClick={() => void run("comment")} testId="case-comment"><MessageSquare className="h-4 w-4" />Send message</SmallButton>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/** A maker opens a request or reports an incident. */
export function NewCase({ st, tokens, act, pending, kind: initialKind = "task", preset, onDone }: { st: State; tokens: { id: string; label: string }[]; act: Act; pending: boolean; kind?: "task" | "incident"; preset?: { tokenId?: string; type?: string; listingId?: string; orderId?: string; deliveryId?: string; description?: string }; onDone?: () => void }) {
  const [kind, setKind] = useState<"task" | "incident">(initialKind);
  const [tokenId, setTokenId] = useState(preset?.tokenId ?? tokens[0]?.id ?? "");
  const [type, setType] = useState(preset?.type ?? (initialKind === "incident" ? "missing" : "restock"));
  const [listingId, setListingId] = useState(preset?.listingId ?? "");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [description, setDescription] = useState(preset?.description ?? "");
  const [photos, setPhotos] = useState<string[]>([]);
  const types = kind === "incident" ? INCIDENT_TYPES : TASK_TYPES;
  const products = st.listings.filter((l) => l.tokenId === tokenId && l.status !== "removed");
  if (!tokens.length) return <p className="text-sm text-muted-foreground">You need an active shelf to send requests.</p>;
  const submit = async () => {
    const r = await act(() => actions.openCase({ kind, type, tokenId, listingId: listingId || undefined, orderId: preset?.orderId, deliveryId: preset?.deliveryId, priority, description, photos }), kind === "incident" ? "Incident reported to the store" : "Request sent to the store");
    if (r.ok) { setDescription(""); setPhotos([]); onDone?.(); }
  };
  return (
    <div className="space-y-3" data-testid="new-case">
      <div className="inline-flex rounded-full bg-muted p-1 text-sm">
        {(["task", "incident"] as const).map((k) => <button key={k} type="button" onClick={() => { setKind(k); setType(k === "incident" ? "missing" : "restock"); }} className={`rounded-full px-4 py-1.5 font-semibold ${kind === k ? "bg-background shadow-sm" : "text-muted-foreground"}`} data-testid={`new-case-kind-${k}`}>{k === "task" ? "Ask the store to do something" : "Report a problem"}</button>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Shelf"><select value={tokenId} onChange={(e) => { setTokenId(e.target.value); setListingId(""); }} className={inputCls} data-testid="select-case-shelf">{tokens.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
        <Field label={kind === "task" ? "What do you need?" : "What happened?"}><select value={type} onChange={(e) => setType(e.target.value)} className={inputCls} data-testid="select-case-type">{Object.entries(types).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Product (optional)"><select value={listingId} onChange={(e) => setListingId(e.target.value)} className={inputCls} data-testid="select-case-product"><option value="">All / not specific</option>{products.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
        <Field label="Priority"><select value={priority} onChange={(e) => setPriority(e.target.value as "normal" | "urgent")} className={inputCls}><option value="normal">Normal</option><option value="urgent">Urgent</option></select></Field>
      </div>
      {type === "count" && <p className="text-xs text-muted-foreground">The store counts every product on this shelf; InRaf compares it with what's expected after sales and deliveries.</p>}
      <Field label="Details"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} placeholder={kind === "task" ? "e.g. Move the jam to eye level and face the labels forward" : "e.g. 2 jars missing since Tuesday's count"} data-testid="input-case-description" /></Field>
      <PhotoPicker photos={photos} onChange={setPhotos} label="Attach photos" />
      <PrimaryButton disabled={pending || description.trim().length < 5} onClick={() => void submit()} data-testid="button-send-case">{kind === "incident" ? "Report to the store" : "Send to the store"}</PrimaryButton>
    </div>
  );
}

/** A maker registers stock on its way to a shelf. */
export function NewDelivery({ st, tokens, act, pending, onDone }: { st: State; tokens: { id: string; label: string }[]; act: Act; pending: boolean; onDone?: () => void }) {
  const [tokenId, setTokenId] = useState(tokens[0]?.id ?? "");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [carrier, setCarrier] = useState(""); const [tracking, setTracking] = useState(""); const [expectedOn, setExpectedOn] = useState(""); const [note, setNote] = useState("");
  const products = st.listings.filter((l) => l.tokenId === tokenId && ["active", "inactive", "approved"].includes(l.status));
  if (!tokens.length) return <p className="text-sm text-muted-foreground">You need an active shelf to send stock.</p>;
  const submit = async () => {
    const r = await act(() => actions.recordDelivery({ tokenId, lines: Object.entries(qty).filter(([, n]) => n > 0).map(([listingId, expected]) => ({ listingId, expected })), carrier, tracking, expectedOn: expectedOn || undefined, note }), "Delivery registered: the store has been told");
    if (r.ok) { setQty({}); setCarrier(""); setTracking(""); setExpectedOn(""); setNote(""); onDone?.(); }
  };
  return (
    <div className="space-y-3" data-testid="new-delivery">
      <Field label="Shelf"><select value={tokenId} onChange={(e) => { setTokenId(e.target.value); setQty({}); }} className={inputCls} data-testid="select-delivery-shelf">{tokens.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
      {products.length === 0 ? <p className="text-sm text-muted-foreground">Add a product and have the store approve it before sending stock.</p> : (
        <div className="space-y-2">{products.map((l) => (
          <label key={l.id} className="flex items-center gap-3 text-sm"><span className="flex-1">{l.name} <span className="text-xs text-muted-foreground">({l.available} on shelf)</span></span>
            <input type="number" min={0} value={qty[l.id] ?? ""} onChange={(e) => setQty({ ...qty, [l.id]: Math.max(0, Math.floor(Number(e.target.value))) })} placeholder="0" className="w-24 rounded-xl border border-input bg-background px-3 py-1.5" data-testid={`input-delivery-qty-${l.id}`} /></label>
        ))}</div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Carrier (optional)"><input value={carrier} onChange={(e) => setCarrier(e.target.value)} className={inputCls} /></Field>
        <Field label="Tracking no. (optional)"><input value={tracking} onChange={(e) => setTracking(e.target.value)} className={inputCls} /></Field>
        <Field label="Expected on"><input type="date" value={expectedOn} onChange={(e) => setExpectedOn(e.target.value)} className={inputCls} /></Field>
      </div>
      <Field label="Note for the store (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} /></Field>
      <PrimaryButton disabled={pending || !Object.values(qty).some((n) => n > 0)} onClick={() => void submit()} data-testid="button-register-delivery"><Truck className="h-4 w-4" />Register delivery</PrimaryButton>
    </div>
  );
}

/** One delivery: what was sent, what the store received, and (for the owner) the receiving form. */
export function DeliveryCard({ st, d, viewer, act, pending, onIncident }: { st: State; d: Delivery; viewer: OpsActor; act: Act; pending: boolean; onIncident?: (d: Delivery) => void }) {
  const [rec, setRec] = useState<Record<string, { received: number; damaged: number }>>(() => Object.fromEntries(d.lines.map((l) => [l.listingId, { received: l.expected, damaged: 0 }])));
  const [note, setNote] = useState(""); const [photos, setPhotos] = useState<string[]>([]);
  const shop = st.shops.find((s) => s.id === d.shopId); const tok = st.tokens.find((t) => t.id === d.tokenId);
  const diff = d.lines.some((l) => l.received !== undefined && (l.received < l.expected || (l.damaged ?? 0) > 0));
  return (
    <Card testId={`delivery-${d.id}`}>
      <div className="flex flex-wrap items-start gap-3">
        <Truck className="mt-0.5 h-5 w-5 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{d.ref} · {d.lines.reduce((n, l) => n + l.expected, 0)} units</p>
          <p className="text-xs text-muted-foreground">{shop?.name}{tok && shop ? ` · ${shelfLabel(shop, tok.slot)}` : ""} · {holderOf(st, d.holderId).name} · registered {fmtDate(d.createdAt.slice(0, 10))}{d.expectedOn ? ` · expected ${fmtDate(d.expectedOn)}` : ""}{d.carrier ? ` · ${d.carrier}` : ""}{d.tracking ? ` ${d.tracking}` : ""}</p>
        </div>
        <Pill tone={d.status === "partial" ? "warn" : undefined}>{d.status === "expected" ? "on its way" : d.status === "partial" ? "received with differences" : d.status}</Pill>
      </div>
      <table className="mt-3 w-full text-left text-xs" data-testid="delivery-lines">
        <thead className="text-muted-foreground"><tr><th className="py-1">Product</th><th className="py-1">Sent</th><th className="py-1">Received</th><th className="py-1">Damaged</th><th className="py-1">Missing</th></tr></thead>
        <tbody>{d.lines.map((l) => {
          const editing = viewer === "owner" && d.status === "expected";
          const r = rec[l.listingId];
          return (
            <tr key={l.listingId} className="border-t border-border">
              <td className="py-1.5">{l.name}</td><td className="py-1.5 tabular-nums">{l.expected}</td>
              <td className="py-1.5">{editing ? <input type="number" min={0} value={r.received} onChange={(e) => setRec({ ...rec, [l.listingId]: { ...r, received: Math.max(0, Math.floor(Number(e.target.value))) } })} className="w-16 rounded-lg border border-input bg-background px-2 py-1" data-testid={`input-received-${l.listingId}`} /> : l.received ?? "—"}</td>
              <td className="py-1.5">{editing ? <input type="number" min={0} value={r.damaged} onChange={(e) => setRec({ ...rec, [l.listingId]: { ...r, damaged: Math.max(0, Math.floor(Number(e.target.value))) } })} className="w-16 rounded-lg border border-input bg-background px-2 py-1" data-testid={`input-damaged-${l.listingId}`} /> : l.damaged ?? "—"}</td>
              <td className="py-1.5 tabular-nums">{editing ? Math.max(0, l.expected - r.received - r.damaged) : l.received === undefined ? "—" : Math.max(0, l.expected - l.received - (l.damaged ?? 0))}</td>
            </tr>
          );
        })}</tbody>
      </table>
      {d.receivedAt && <p className="mt-2 text-xs text-muted-foreground">Received by {d.receivedBy} on {fmtTime(d.receivedAt)} (reported by the store){d.receiptNote ? ` · “${d.receiptNote}”` : ""}</p>}
      {d.photos && d.photos.length > 0 && <div className="mt-2 flex gap-2">{d.photos.map((p, i) => <a key={i} href={p} target="_blank" rel="noopener"><img src={p} alt="Delivery photo" className="h-14 w-14 rounded-xl object-cover" /></a>)}</div>}
      <div className="mt-3 flex flex-wrap gap-2">
        {viewer === "owner" && d.status === "expected" && (
          <div className="w-full space-y-2 rounded-2xl bg-muted/40 p-3">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (e.g. one box crushed)" className={inputCls} />
            <PhotoPicker photos={photos} onChange={setPhotos} />
            <SmallButton tone="solid" disabled={pending} onClick={() => void act(() => actions.receiveDelivery(d.id, { lines: d.lines.map((l) => ({ listingId: l.listingId, ...rec[l.listingId] })), note, photos }), "Delivery received: good units are on the shelf")} testId="button-receive-delivery">Confirm what arrived</SmallButton>
          </div>
        )}
        {viewer === "holder" && d.status === "expected" && <SmallButton disabled={pending} onClick={() => void act(() => actions.cancelDelivery(d.id), "Delivery cancelled")} testId="button-cancel-delivery">Cancel delivery</SmallButton>}
        {viewer === "holder" && diff && onIncident && <SmallButton tone="danger" onClick={() => onIncident(d)} testId="button-delivery-incident">Report the difference</SmallButton>}
      </div>
    </Card>
  );
}

export function NewCaseButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <GhostButton onClick={onClick}><Plus className="h-4 w-4" />{label}</GhostButton>;
}

export { reservedQty, Link };
export type StoreForOps = ReturnType<typeof useStore>;
