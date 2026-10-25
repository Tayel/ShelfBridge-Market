import { useState } from "react";
import { Link, useParams } from "wouter";
import { Check, Download, FileText, RefreshCw, ShieldCheck, Signature as SigIcon, XCircle } from "lucide-react";
import { Shell, PrimaryButton, GhostButton } from "@/components/shell";
import { Card, ErrorNote, Field, Modal, Notice, Pill, SmallButton, inputCls } from "@/components/kit";
import { useStore, usd } from "@/lib/store";
import { actions } from "@/lib/actions";
import { useAct } from "@/hooks/use-act";
import { awaitingVersion, contractStatus, executedVersion, invoiceStatus, lateFeeFor } from "@/lib/selectors";
import { holderOf } from "@/lib/ops";
import { categoryLabel, countryName } from "@/lib/data";
import { fmtDate, fmtTime } from "@/lib/util";
import { downloadContractPdf } from "@/lib/pdf";
import type { ContractVersion, Signature } from "@/lib/types";

function SigRow({ label, sig, testId }: { label: string; sig?: Signature; testId: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3" data-testid={testId}>
      <span className={`grid h-8 w-8 place-items-center rounded-full ${sig ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>{sig ? <Check className="h-4 w-4" /> : <SigIcon className="h-4 w-4" />}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{sig ? `“${sig.name}” · ${fmtTime(sig.at)} · ${sig.via === "ui" ? "typed in this browser" : sig.via === "seed" ? "sample seed data" : "simulated"}` : "Not recorded yet"}</p>
      </div>
    </div>
  );
}

function Snapshot({ v }: { v: ContractVersion }) {
  const s = v.snapshot; const t = s.terms;
  const rows: [string, string][] = [
    ["Store", `${s.store.name}, ${s.store.address}, ${countryName(s.store.country)}`],
    ["Registration (demo)", s.store.registration],
    ["Owner", s.store.ownerName],
    ["Holder", `${s.holder.name} · ${s.holder.kind} · ${s.holder.registration}`],
    ["Shelf", `${s.shelf.label} · ${s.shelf.count} shelf · ${s.shelf.spec.widthCm}×${s.shelf.spec.heightCm}×${s.shelf.spec.depthCm} cm · ${s.shelf.areaCm2} cm² · ${s.shelf.spec.capacity} units`],
    ["Location", s.shelf.floorNote],
    ["Categories", s.shelf.categories.map(categoryLabel).join(", ")],
    ["Term", `${fmtDate(t.start)} → ${fmtDate(t.end)} (${t.months} mo) · renewal ${t.renewal}`],
    ["Rent", `${usd(t.monthlyRent)}/mo monthly + ${t.taxRate}% illustrative tax · deposit ${usd(t.deposit)}`],
    ["Late payment", `${t.lateFeePct}% after ${t.graceDays} days`],
    ["Maintenance", t.maintenance], ["Display & stock", t.display], ["Liability", t.liability], ["Disputes", t.dispute],
  ];
  return (
    <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[150px_1fr]" data-testid={`snapshot-v${v.v}`}>
      {rows.map(([k, val]) => [<dt key={`${k}-k`} className="text-muted-foreground">{k}</dt>, <dd key={`${k}-v`}>{val}</dd>])}
    </dl>
  );
}

export default function ContractPage() {
  const { id } = useParams<{ id: string }>();
  const st = useStore();
  const { act, error, pending, clearError } = useAct();
  const [name, setName] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [modal, setModal] = useState<null | "renewal" | "amendment" | "terminate" | "reject">(null);
  const [months, setMonths] = useState(6);
  const [rent, setRent] = useState(0);
  const [note, setNote] = useState("");

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
  const next = !aw || c.terminatedAt ? null : !aw.adminApproval ? "admin" : !aw.ownerSig ? "owner" : !aw.holderSig ? "holder" : null;
  const ownerSim = !!shop?.seeded; const holderSim = holder.seeded;
  const simName = (n: string) => n.replace(/\s*\(sample\)/, "");

  const doNext = () => {
    if (!aw || !next) return;
    if (next !== "admin" && !reviewed) { act(() => ({ ok: false, error: "Tick “I reviewed this version” first." })); return; }
    const r = next === "admin" ? act(() => actions.approveContract(c.id, name || "Platform reviewer"), "Platform approval recorded (simulated)")
      : next === "owner" ? act(() => actions.sign(c.id, "owner", ownerSim ? simName(shop?.ownerName ?? "Owner") : name, ownerSim), "Owner signature recorded (demo)")
      : act(() => actions.sign(c.id, "holder", holderSim ? simName(holder.name) : name, holderSim), "Holder signature recorded (demo)");
    if (r.ok) { setName(""); setReviewed(false); }
  };
  const nextLabel = next === "admin" ? "Approve as platform (simulated admin)"
    : next === "owner" ? (ownerSim ? "Simulate owner signature" : "Sign as store owner")
    : next === "holder" ? (holderSim ? "Simulate holder signature" : "Sign as token holder") : "";
  const needsName = next === "admin" || (next === "owner" && !ownerSim) || (next === "holder" && !holderSim);

  const openVersion = (k: "renewal" | "amendment") => { const base = ex ?? shown; setMonths(base.snapshot.terms.months); setRent(base.snapshot.terms.monthlyRent); setNote(""); clearError(); setModal(k); };

  return (
    <Shell title={`Contract ${c.ref}`} back={st.role === "owner" ? "/owner-dashboard" : st.role === "admin" ? "/admin?tab=contracts" : "/dashboard"}>
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm text-muted-foreground">{shop?.name} · {shown.snapshot.shelf.label} · {holder.name}</p>
        <h1 className="font-display text-4xl font-bold md:text-5xl" data-testid="text-contract-ref">{c.ref}</h1>
        <div className="flex flex-wrap justify-center gap-2"><Pill testId="status-contract">{status}</Pill><Pill tone="mute">v{shown.v} · {shown.kind}</Pill></div>
      </div>

      <Notice tone="info" testId="text-legal-disclaimer">Demo record — <b>not a legal contract</b>. Typed names are recorded with timestamps but are not legally valid electronic signatures.</Notice>

      <div className="mx-auto mt-6 grid max-w-5xl gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {aw && next && (
            <Card className="border-primary/40" testId="card-next-step">
              <p className="text-xs uppercase tracking-wide text-primary">Next step · v{aw.v}</p>
              <h2 className="font-display mt-1 text-2xl font-bold">{nextLabel}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {next === "admin" ? "Platform review is a simulated admin action in this demo." : `Both parties must review and accept this exact version. ${next === "owner" && ownerSim ? "This store is a sample — its owner's signature is simulated." : next === "holder" && holderSim ? "This holder is a sample profile — their signature is simulated." : "Type your full name as a demo signature."}`}
              </p>
              <div className="mt-4 space-y-3">
                {next !== "admin" && (
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} data-testid="checkbox-reviewed" className="h-4 w-4 accent-[hsl(var(--primary))]" />I reviewed version {aw.v} and accept its terms (demo)</label>
                )}
                {needsName && <input value={name} onChange={(e) => setName(e.target.value)} placeholder={next === "admin" ? "Reviewer name" : "Full name"} className={inputCls} data-testid="input-signer-name" />}
                <ErrorNote error={error} />
                <div className="flex flex-wrap items-center gap-2">
                  <PrimaryButton disabled={pending} onClick={doNext} data-testid="button-next-step">{nextLabel}</PrimaryButton>
                  {next === "admin" && <GhostButton onClick={() => { setNote(""); setModal("reject"); }} data-testid="button-reject-version">Reject version</GhostButton>}
                </div>
              </div>
            </Card>
          )}

          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold">Agreement · v{shown.v}</h2>
              <SmallButton onClick={() => downloadContractPdf(c, shown, trail.slice().reverse())} testId="button-download-pdf"><Download className="h-4 w-4" />PDF (demo)</SmallButton>
            </div>
            {shown.note && <p className="mt-2 text-sm text-muted-foreground">{shown.note}</p>}
            <div className="mt-4"><Snapshot v={shown} /></div>
            <p className="mt-3 text-xs text-muted-foreground">Snapshot frozen at creation. Later store edits do not change this version.</p>
          </Card>

          {invoices.length > 0 && (
            <Card testId="card-rent-schedule">
              <h2 className="font-display text-xl font-bold">Rent obligations</h2>
              <p className="text-xs text-muted-foreground">Separate from product sales. Payments are simulated; receipts are demo records.</p>
              <ul className="mt-3 divide-y divide-border">
                {invoices.map((i) => {
                  const s = invoiceStatus(i); const fee = lateFeeFor(st, i);
                  return (
                    <li key={i.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm" data-testid={`row-invoice-${i.id}`}>
                      <span className="min-w-0 flex-1"><b>{i.label}</b><br /><span className="text-xs text-muted-foreground">{i.ref} · due {fmtDate(i.dueDate)}{i.receiptRef ? ` · receipt ${i.receiptRef} (${fmtDate(i.paidAt)})` : ""}</span></span>
                      <span className="tabular-nums">{usd(i.total)}{fee ? <span className="text-destructive"> +{usd(fee)}</span> : null}{i.lateFee ? <span className="text-muted-foreground"> +{usd(i.lateFee)} late</span> : null}</span>
                      <Pill>{s}</Pill>
                      {(s === "due" || s === "overdue") && <SmallButton tone="solid" disabled={pending} onClick={() => act(() => actions.payInvoice(i.id), "Rent payment simulated")} testId={`button-pay-${i.id}`}>Simulate payment</SmallButton>}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="font-display text-lg font-bold">Activation needs all three</h3>
            <div className="mt-3 space-y-2">
              <SigRow label="Platform approval" sig={shown.adminApproval} testId="row-sig-admin" />
              <SigRow label={`Store owner${ownerSim ? " (sample)" : ""}`} sig={shown.ownerSig} testId="row-sig-owner" />
              <SigRow label={`Token holder${holderSim ? " (sample)" : ""}`} sig={shown.holderSig} testId="row-sig-holder" />
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
                <SmallButton tone="danger" onClick={() => { setNote(""); clearError(); setModal("terminate"); }} testId="button-terminate"><XCircle className="h-3.5 w-3.5" />{ex ? "Terminate" : "Cancel request"}</SmallButton>
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
        <PrimaryButton className="mt-5 w-full" disabled={pending} onClick={() => { const r = act(() => actions.newVersion(c.id, modal === "renewal" ? "renewal" : "amendment", { months, monthlyRent: rent, note }, st.role), "New version drafted"); if (r.ok) setModal(null); }} data-testid="button-create-version">Create unsigned version</PrimaryButton>
      </Modal>

      <Modal open={modal === "terminate" || modal === "reject"} onClose={() => setModal(null)} title={modal === "reject" ? "Reject this version" : ex ? "Terminate contract" : "Cancel request"}>
        <p className="text-sm text-muted-foreground">{modal === "reject" ? "The version is voided. If nothing was ever executed, the shelf is released." : "The shelf is released, all sales on it stop immediately, open checkouts are released and unpaid future rent is voided."}</p>
        <div className="mt-4"><Field label="Reason"><input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} data-testid="input-reason" /></Field></div>
        <div className="mt-3"><ErrorNote error={error} /></div>
        <PrimaryButton className="mt-5 w-full" disabled={pending} onClick={() => { const r = modal === "reject" ? act(() => actions.rejectVersion(c.id, note), "Version rejected") : act(() => actions.terminate(c.id, note, st.role), "Contract terminated"); if (r.ok) setModal(null); }} data-testid="button-confirm-terminate">Confirm</PrimaryButton>
      </Modal>
    </Shell>
  );
}
