import { useState } from "react";
import { Link, useParams } from "wouter";
import { Check, Download, FileText, RefreshCw, ShieldCheck, Signature as SigIcon, XCircle } from "lucide-react";
import { Shell, PrimaryButton, GhostButton } from "@/components/shell";
import { Card, ErrorNote, Field, Modal, Notice, Pill, SmallButton, inputCls } from "@/components/kit";
import { LIVE, isMine, useSession, useStore, usd } from "@/lib/store";
import { actions } from "@/lib/actions";
import { useAct } from "@/hooks/use-act";
import { awaitingVersion, contractStatus, executedVersion, invoiceStatus, lateFeeFor } from "@/lib/selectors";
import { holderOf, offerNeeded } from "@/lib/ops";
import { OFFER_VALIDITY_CHOICES, OFFER_VALID_DAYS, buildAgreement, longDate } from "@/lib/agreement";
import { AcceptanceConfirmation, AgreementDocument, SharedRecord } from "@/components/agreement-view";
import { ConfirmPaid, InvoiceNote, OFFLINE, ReportPaid, ReturnDeposit } from "@/components/money-offline";
import { fmtDate, fmtTime, today } from "@/lib/util";
import { downloadContractPdf } from "@/lib/pdf";
import type { Signature } from "@/lib/types";

function SigRow({ label, sig, testId }: { label: string; sig?: Signature; testId: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3" data-testid={testId}>
      <span className={`grid h-8 w-8 place-items-center rounded-full ${sig ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>{sig ? <Check className="h-4 w-4" /> : <SigIcon className="h-4 w-4" />}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{sig ? `“${sig.name}” · ${fmtTime(sig.at)} · ${sig.via === "ui" ? "typed in this browser" : sig.via === "seed" ? "sample seed data" : sig.via === "instant" ? "pre-agreed via Instant book" : "simulated"}` : "Not recorded yet"}</p>
      </div>
    </div>
  );
}

export default function ContractPage() {
  const { id } = useParams<{ id: string }>();
  const st = useStore();
  const session = useSession();
  const { act, error, pending, clearError } = useAct();
  const [name, setName] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [authority, setAuthority] = useState(false);
  const [electronic, setElectronic] = useState(false);
  const [validDays, setValidDays] = useState<number>(OFFER_VALID_DAYS);
  const [modal, setModal] = useState<null | "renewal" | "amendment" | "terminate" | "reject">(null);
  const [months, setMonths] = useState(6);
  const [rent, setRent] = useState(0);
  const [note, setNote] = useState("");
  const [co, setCo] = useState<{ rent: number; months: number; pct: number; note: string } | null>(null);

  const c = st.contracts.find((x) => x.id === id);
  if (!c) return <Shell title="Contract not found" back="/dashboard"><p className="mt-20 text-center text-muted-foreground">No contract here. <Link href="/dashboard" className="text-primary underline">Holder portal</Link></p></Shell>;

  const shop = st.shops.find((s) => s.id === c.shopId);
  const holder = holderOf(st, c.holderId);
  const status = contractStatus(c);
  const aw = awaitingVersion(c);
  const ex = executedVersion(c);
  const shown = aw ?? ex ?? c.versions[c.versions.length - 1];
  const invoices = st.invoices.filter((i) => i.contractId === c.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const trail = st.audit.filter((a) => a.ref.startsWith(c.ref) || invoices.some((i) => i.ref === a.ref)).slice().reverse();

  // Next required step for the awaiting version
  // The Shop Owner issues the formal offer, InRaf reviews it, then the Token Holder accepts.
  const next = !aw || c.terminatedAt ? null : offerNeeded(aw) ? "owner" : !aw.adminApproval ? "admin" : !aw.holderSig ? "holder" : null;
  const iAmOwner = !!shop && isMine(shop, session); const iAmHolder = c.holderId === session.holderId;
  const side = st.role === "admin" ? "admin" : iAmOwner ? "owner" : iAmHolder ? "holder" : "other";
  const canAct = !session.live || (next === "owner" ? iAmOwner : next === "holder" ? iAmHolder : !!session.me?.isAdmin);
  const doc = aw ? buildAgreement(c, aw) : null;
  // Simulated counter-signatures exist only in the browser demo; live contracts need both real parties.
  const ownerSim = !session.live && !!shop?.seeded; const holderSim = !session.live && holder.seeded;
  const simName = (n: string) => n.replace(/\s*\(sample\)/, "");

  const doNext = async () => {
    if (!aw || !next) return;
    if (next === "owner" && !(reviewed && authority)) { act(() => ({ ok: false, error: "Confirm that you have read the agreement and may make this offer for the store." })); return; }
    if (next === "holder" && !(reviewed && authority && electronic)) { act(() => ({ ok: false, error: "Tick all three confirmations to accept the offer." })); return; }
    const r = await (next === "admin" ? act(() => actions.approveContract(c.id, name || "Platform reviewer"), "InRaf review recorded")
      : next === "owner" ? act(() => actions.sign(c.id, "owner", ownerSim ? simName(shop?.ownerName ?? "Owner") : name, ownerSim, { validDays }), `Offer sent to ${holder.name}`)
      : act(() => actions.sign(c.id, "holder", holderSim ? simName(holder.name) : name, holderSim, { fingerprint: doc?.fingerprint }), "Offer accepted. Confirmations sent to both parties"));
    if (r.ok) { setName(""); setReviewed(false); setAuthority(false); setElectronic(false); }
  };
  const reissue = !!aw?.ownerSig && !!aw && offerNeeded(aw);
  const nextLabel = next === "admin" ? (LIVE ? "Approve after review" : "Approve as platform (simulated admin)")
    : next === "owner" ? (ownerSim ? "Simulate issuing the offer" : reissue ? `Re-issue the offer to ${holder.name}` : `Issue the formal offer to ${holder.name}`)
    : next === "holder" ? (holderSim ? "Simulate acceptance" : `Accept offer ${aw?.offer?.no ?? ""}`) : "";
  const waitingFor = next === "owner" ? `${shop?.ownerName ?? "The store owner"} to issue the formal offer` : next === "admin" ? "InRaf to review the agreement" : next === "holder" ? `${holder.name} to accept the offer` : "";
  const needsName = next === "admin" || (next === "owner" && !ownerSim) || (next === "holder" && !holderSim);

  const openVersion = (k: "renewal" | "amendment") => { const base = ex ?? shown; setMonths(base.snapshot.terms.months); setRent(base.snapshot.terms.monthlyRent); setNote(""); clearError(); setModal(k); };

  return (
    <Shell title={`Contract ${c.ref}`} back={st.role === "owner" ? "/owner-dashboard" : st.role === "admin" ? "/admin?tab=contracts" : "/dashboard"}>
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm text-muted-foreground">{shop?.name} · {shown.snapshot.shelf.label} · {holder.name}</p>
        <h1 className="font-display text-4xl font-bold md:text-5xl" data-testid="text-contract-ref">{c.ref}</h1>
        <div className="flex flex-wrap justify-center gap-2"><Pill testId="status-contract">{status}</Pill><Pill tone="mute">v{shown.v} · {shown.kind}</Pill></div>
      </div>

      <Notice tone="info" testId="text-legal-disclaimer">{LIVE ? <>InRaf's standard rental agreement, offered by the Shop Owner and accepted by the Token Holder. Acceptance by typed name is recorded with the time and a fingerprint of the exact text. It is a template, not legal advice: <b>take your own legal advice</b> if you are unsure. Payments are still simulated.</> : <>Demo record: <b>not a legal contract</b>. Typed names are recorded with timestamps but are not signatures.</>}</Notice>

      <div className="mx-auto mt-6 grid max-w-5xl gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {aw && next && !canAct && (
            <Card testId="card-next-step"><p className="text-xs uppercase tracking-wide text-muted-foreground">Next step · v{aw.v}</p><p className="mt-1 font-medium">Waiting for {waitingFor}.</p>{next === "holder" && aw.offer && <p className="mt-1 text-sm text-muted-foreground">Offer {aw.offer.no} is open until {longDate(aw.offer.validUntil)}.</p>}</Card>
          )}
          {aw && next && canAct && (
            <Card className="border-primary/40" testId="card-next-step">
              <p className="text-xs uppercase tracking-wide text-primary">Next step · v{aw.v}</p>
              <h2 className="font-display mt-1 text-2xl font-bold">{nextLabel}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {next === "admin" ? (LIVE ? "Check the store, the renter and the terms before the offer can be accepted." : "Platform review is a simulated admin action in this demo.")
                  : next === "owner" ? `${reissue ? (aw.offer ? `The earlier offer expired on ${longDate(aw.offer.validUntil)}. ` : "Your earlier signature was recorded before formal offers; issue the offer so the renter can accept it. ") : ""}This sends the Rental Offer and Agreement below to ${holder.name}, addressed to them, for acceptance within the period you choose. You can't change it once issued; a counter-offer replaces it.${ownerSim ? " This store is a sample, so the owner's side is simulated." : ""}`
                  : `Read the Rental Offer and the full Agreement below. When you accept, InRaf records your acceptance and sends a written confirmation to you and to ${shop?.ownerName ?? "the store owner"}.${holderSim ? " This holder is a sample profile, so acceptance is simulated." : ""}`}
              </p>
              <div className="mt-4 space-y-3">
                {next === "owner" && (
                  <Field label="Offer open for"><select value={validDays} onChange={(e) => setValidDays(Number(e.target.value))} className={inputCls} data-testid="select-offer-validity">{OFFER_VALIDITY_CHOICES.map((d) => <option key={d} value={d}>{d} days</option>)}</select></Field>
                )}
                {next !== "admin" && (
                  <div className="space-y-2 rounded-2xl bg-muted/50 p-3 text-sm">
                    <label className="flex items-start gap-2"><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} data-testid="checkbox-reviewed" className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" />I have read the Rental Offer and all {doc?.clauses.length} clauses of the Agreement (version {aw.v}){next === "holder" ? " and I accept them" : ""}.</label>
                    <label className="flex items-start gap-2"><input type="checkbox" checked={authority} onChange={(e) => setAuthority(e.target.checked)} data-testid="checkbox-authority" className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" />{next === "owner" ? `I am authorised to make this offer on behalf of ${shop?.name ?? "the store"}.` : `I am ${holder.name}, or authorised to accept on their behalf, and the details about me are correct.`}</label>
                    {next === "holder" && <label className="flex items-start gap-2"><input type="checkbox" checked={electronic} onChange={(e) => setElectronic(e.target.checked)} data-testid="checkbox-electronic" className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" />I agree to accept electronically: my typed full name below is my signature, recorded with the time and document fingerprint {doc?.fingerprint}.</label>}
                  </div>
                )}
                {needsName && <input value={name} onChange={(e) => setName(e.target.value)} placeholder={next === "admin" ? "Reviewer name" : "Your full legal name"} className={inputCls} data-testid="input-signer-name" />}
                <ErrorNote error={error} />
                <div className="flex flex-wrap items-center gap-2">
                  <PrimaryButton disabled={pending} onClick={doNext} data-testid="button-next-step">{nextLabel}</PrimaryButton>
                  {next === "admin" && <GhostButton onClick={() => { setNote(""); setModal("reject"); }} data-testid="button-reject-version">Reject version</GhostButton>}
                  {next === "holder" && !ex && <GhostButton onClick={() => { setNote(""); clearError(); setModal("terminate"); }} data-testid="button-decline-offer">Decline offer</GhostButton>}
                </div>
              </div>
            </Card>
          )}

          {(c.offers?.length ?? 0) > 0 && (() => {
            const open = c.versions.length === 1 && c.versions[0].status === "awaiting" && !c.terminatedAt && !(c.versions[0].ownerSig && c.versions[0].holderSig);
            const sides: ("holder" | "owner")[] = [...(c.holderId === session.holderId ? ["holder" as const] : []), ...(shop && isMine(shop, session) ? ["owner" as const] : [])];
            const cons = c.model === "consignment";
            const last = c.offers!.at(-1)!;
            const send = async (by: "holder" | "owner") => {
              if (!co) return;
              const r = await act(() => actions.counterOffer(c.id, by, { monthlyRent: cons ? undefined : co.rent, sharePct: cons ? co.pct : undefined, months: co.months, note: co.note }), "Counter-offer sent");
              if (r.ok) setCo(null);
            };
            return (
              <Card testId="card-negotiation">
                <h2 className="font-display text-xl font-bold">Negotiation</h2>
                <p className="mt-1 text-sm text-muted-foreground">{open ? "Accept the latest offer by signing it, or reply with your own. Each new offer replaces the unsigned draft and clears any signatures on it." : "Agreed. The signed version below is what counts."}</p>
                <ol className="mt-4 space-y-2" data-testid="offer-thread">
                  {c.offers!.map((o, i) => (
                    <li key={i} className={`rounded-2xl border p-3 text-sm ${i === c.offers!.length - 1 ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                      <p className="font-semibold">{o.by === "holder" ? holder.name : shop?.ownerName ?? "Store owner"} · {cons ? `${o.sharePct}% commission` : `${usd(o.monthlyRent)} a month`} · {o.months} months</p>
                      {o.note && <p className="mt-0.5 text-muted-foreground">“{o.note}”</p>}
                      <p className="text-xs text-muted-foreground">{fmtTime(o.at)}{i === c.offers!.length - 1 ? " · current offer" : ""}</p>
                    </li>
                  ))}
                </ol>
                {open && sides.length > 0 && !co && <SmallButton onClick={() => { clearError(); setCo({ rent: last.monthlyRent, months: last.months, pct: last.sharePct || 15, note: "" }); }} testId="button-counter">Make a counter-offer</SmallButton>}
                {open && co && (
                  <div className="mt-3 space-y-3 rounded-2xl border border-border p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {cons ? <Field label="Store's commission (%)"><input type="number" min={1} max={50} value={co.pct} onChange={(e) => setCo({ ...co, pct: Number(e.target.value) })} className={inputCls} data-testid="input-counter-pct" /></Field>
                        : <Field label="Monthly rent (USD)"><input type="number" min={1} value={co.rent} onChange={(e) => setCo({ ...co, rent: Number(e.target.value) })} className={inputCls} data-testid="input-counter-rent" /></Field>}
                      <Field label="Months"><input type="number" min={1} max={36} value={co.months} onChange={(e) => setCo({ ...co, months: Number(e.target.value) })} className={inputCls} data-testid="input-counter-months" /></Field>
                    </div>
                    <Field label="Message (optional)"><textarea rows={2} value={co.note} onChange={(e) => setCo({ ...co, note: e.target.value.slice(0, 500) })} className={inputCls} data-testid="input-counter-note" /></Field>
                    <ErrorNote error={error} />
                    <div className="flex flex-wrap gap-2">
                      {sides.map((sd) => <PrimaryButton key={sd} disabled={pending} onClick={() => void send(sd)} data-testid={`button-send-counter-${sd}`}>{sides.length > 1 ? `Send as ${sd === "owner" ? "store owner" : "renter"}` : "Send counter-offer"}</PrimaryButton>)}
                      <GhostButton onClick={() => setCo(null)}>Cancel</GhostButton>
                    </div>
                  </div>
                )}
              </Card>
            );
          })()}

          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold">Rental offer and agreement · v{shown.v}</h2>
              <SmallButton onClick={() => downloadContractPdf(c, shown, trail.slice().reverse())} testId="button-download-pdf"><Download className="h-4 w-4" />{LIVE ? "PDF" : "PDF (demo)"}</SmallButton>
            </div>
            {shown.note && <p className="mt-2 text-sm text-muted-foreground">{shown.note}</p>}
            <div className="mt-4"><AgreementDocument c={c} v={shown} storeName={shown.snapshot.store.name} /></div>
            <p className="mt-3 text-xs text-muted-foreground">The terms are frozen when the version is created. Later changes to the store listing don't change this version.</p>
          </Card>

          {ex && <AcceptanceConfirmation c={c} v={ex} />}
          {ex && <SharedRecord st={st} c={c} side={side} />}

          {invoices.length > 0 && (
            <Card testId="card-rent-schedule">
              <h2 className="font-display text-xl font-bold">Rent obligations</h2>
              <p className="text-xs text-muted-foreground">{OFFLINE ? "Paid directly to the store owner (bank transfer, cash or another agreed method). The renter tells the store when it has paid; the store confirms receipt and a receipt is issued. Both sides see the same status." : "Separate from product sales. Payments are simulated; receipts are records only and no money moved."}</p>
              <ul className="mt-3 divide-y divide-border">
                {invoices.map((i) => {
                  const s = invoiceStatus(i); const fee = lateFeeFor(st, i);
                  return (
                    <li key={i.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm" data-testid={`row-invoice-${i.id}`}>
                      <span className="min-w-0 flex-1"><b>{i.label}</b><br /><span className="text-xs text-muted-foreground">{i.ref} · due {fmtDate(i.dueDate)}{i.receiptRef ? ` · receipt ${i.receiptRef} (${fmtDate(i.paidAt)})` : ""}</span>{OFFLINE && <InvoiceNote inv={i} />}</span>
                      <span className="tabular-nums">{usd(i.total)}{fee ? <span className="text-destructive"> +{usd(fee)}</span> : null}{i.lateFee ? <span className="text-muted-foreground"> +{usd(i.lateFee)} late</span> : null}</span>
                      <Pill>{s}</Pill>
                      {!OFFLINE && (s === "due" || s === "overdue") && <SmallButton tone="solid" disabled={pending} onClick={() => act(() => actions.payInvoice(i.id), "Rent payment simulated")} testId={`button-pay-${i.id}`}>Simulate payment</SmallButton>}
                      {OFFLINE && iAmHolder && <ReportPaid inv={i} act={act} pending={pending} />}
                      {OFFLINE && iAmOwner && <ConfirmPaid inv={i} act={act} pending={pending} />}
                      {OFFLINE && iAmOwner && <ReturnDeposit inv={i} ended={!!c.terminatedAt || (!!ex && ex.snapshot.terms.end <= today())} act={act} pending={pending} />}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="font-display text-lg font-bold">Offer and acceptance</h3>
            <p className="text-xs text-muted-foreground">The agreement takes effect when all three are recorded.</p>
            <div className="mt-3 space-y-2">
              <SigRow label={`1. Offer issued by the store owner${ownerSim ? " (sample)" : ""}`} sig={shown.ownerSig} testId="row-sig-owner" />
              <SigRow label="2. Reviewed by InRaf" sig={shown.adminApproval} testId="row-sig-admin" />
              <SigRow label={`3. Accepted by the token holder${holderSim ? " (sample)" : ""}`} sig={shown.holderSig} testId="row-sig-holder" />
            </div>
            {status === "active" && <Link href={`/shelf/${c.tokenId}`} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-2.5 text-sm font-semibold text-background" data-testid="link-open-shelf">Open shelf & products</Link>}
          </Card>

          <Card>
            <h3 className="font-display text-lg font-bold">Versions</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {c.versions.slice().reverse().map((v) => (
                <li key={v.v} className="flex items-center gap-2" data-testid={`row-version-${v.v}`}>
                  <FileText className="h-4 w-4 text-muted-foreground" /><span className="flex-1">v{v.v} · {v.kind} · {fmtDate(v.createdAt)}</span><Pill>{v.status}</Pill>
                  <button aria-label={`Download v${v.v}`} onClick={() => downloadContractPdf(c, v, trail.slice().reverse())} className="rounded-full p-1 hover:bg-muted" data-testid={`button-pdf-v${v.v}`}><Download className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
            {!c.terminatedAt && (
              <div className="mt-4 flex flex-wrap gap-2">
                <SmallButton disabled={!ex || !!aw} onClick={() => openVersion("renewal")} testId="button-renew" title={!ex ? "Needs an executed version" : aw ? "Finish the pending version first" : ""}><RefreshCw className="h-3.5 w-3.5" />Renew</SmallButton>
                <SmallButton disabled={!ex || !!aw} onClick={() => openVersion("amendment")} testId="button-amend"><ShieldCheck className="h-3.5 w-3.5" />Amend</SmallButton>
                <SmallButton tone="danger" onClick={() => { setNote(""); clearError(); setModal("terminate"); }} testId="button-terminate"><XCircle className="h-3.5 w-3.5" />{ex ? "End agreement" : iAmHolder ? "Withdraw request" : "Cancel request"}</SmallButton>
              </div>
            )}
            {c.terminatedAt && <p className="mt-3 text-sm text-destructive">Terminated {fmtDate(c.terminatedAt)}: {c.terminationReason}</p>}
          </Card>

          <Card>
            <h3 className="font-display text-lg font-bold">Audit trail</h3>
            <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto text-xs" data-testid="list-audit">
              {trail.map((a) => <li key={a.id}><span className="text-muted-foreground">{fmtTime(a.at)} · {a.actor}</span><br />{a.action} — {a.detail}</li>)}
            </ul>
          </Card>
        </div>
      </div>

      <Modal open={modal === "renewal" || modal === "amendment"} onClose={() => setModal(null)} title={modal === "renewal" ? "Draft a renewal" : "Draft an amendment"}>
        <p className="text-sm text-muted-foreground">Creates a new unsigned version. {modal === "renewal" ? "It starts when the current term ends." : "Unpaid future rent from the current version is replaced once it executes."} The current version stays in force meanwhile.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Months"><input type="number" min={1} max={36} value={months} onChange={(e) => setMonths(Number(e.target.value))} className={inputCls} data-testid="input-version-months" /></Field>
          <Field label="Rent / month (USD)"><input type="number" min={1} step="0.5" value={rent} onChange={(e) => setRent(Number(e.target.value))} className={inputCls} data-testid="input-version-rent" /></Field>
        </div>
        <div className="mt-3"><Field label="Note"><input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="What changes?" data-testid="input-version-note" /></Field></div>
        <div className="mt-3"><ErrorNote error={error} /></div>
        <PrimaryButton className="mt-5 w-full" disabled={pending} onClick={async () => { const r = await act(() => actions.newVersion(c.id, modal === "renewal" ? "renewal" : "amendment", { months, monthlyRent: rent, note }, st.role), "New version drafted"); if (r.ok) setModal(null); }} data-testid="button-create-version">Create unsigned version</PrimaryButton>
      </Modal>

      <Modal open={modal === "terminate" || modal === "reject"} onClose={() => setModal(null)} title={modal === "reject" ? "Reject this version" : ex ? "End the agreement" : iAmHolder ? "Decline the offer" : "Cancel the request"}>
        <p className="text-sm text-muted-foreground">{modal === "reject" ? "The version is voided. If nothing was ever executed, the shelf is released." : "The shelf is released, all sales on it stop immediately, open checkouts are released and unpaid future rent is voided."}</p>
        <div className="mt-4"><Field label="Reason"><input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} data-testid="input-reason" /></Field></div>
        <div className="mt-3"><ErrorNote error={error} /></div>
        <PrimaryButton className="mt-5 w-full" disabled={pending} onClick={async () => { const r = await (modal === "reject" ? act(() => actions.rejectVersion(c.id, note), "Version rejected") : act(() => actions.terminate(c.id, note, st.role), "Contract terminated")); if (r.ok) setModal(null); }} data-testid="button-confirm-terminate">Confirm</PrimaryButton>
      </Modal>
    </Shell>
  );
}
