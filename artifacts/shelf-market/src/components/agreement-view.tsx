/**
 * The formal Rental Offer and Agreement as both parties read it, and the shared store record that both accounts see
 * once it is in force. Text comes from src/lib/agreement.ts, so what is shown here is exactly what is fingerprinted.
 */
import { Link } from "wouter";
import { Check, Clock, FileSignature, Link2 } from "lucide-react";
import { Card, Pill } from "@/components/kit";
import { usd } from "@/lib/store";
import { buildAgreement, longDate } from "@/lib/agreement";
import { caseIsOpen, offerExpired } from "@/lib/ops";
import { invoiceStatus } from "@/lib/selectors";
import { fmtTime } from "@/lib/util";
import type { Contract, ContractVersion, Signature, State } from "@/lib/types";

function SigBlock({ role, who, sig, pending }: { role: string; who: string; sig?: Signature; pending: string }) {
  return (
    <div className="rounded-2xl border border-border p-4" data-testid={`sigblock-${role.toLowerCase().replace(/\W+/g, "-")}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{role}</p>
      <p className="mt-1 font-medium">{who}</p>
      {sig ? (
        <>
          <p className="mt-2 font-display text-xl italic">{sig.name}</p>
          <p className="text-xs text-muted-foreground">{fmtTime(sig.at)} · {sig.via === "instant" ? "standard terms pre-agreed (Instant book)" : sig.via === "seed" ? "sample data" : sig.via === "simulated" ? "simulated" : "typed name on InRaf"}</p>
        </>
      ) : <p className="mt-2 text-sm text-muted-foreground">{pending}</p>}
    </div>
  );
}

export function AgreementDocument({ c, v, storeName }: { c: Contract; v: ContractVersion; storeName: string }) {
  const a = buildAgreement(c, v);
  const s = v.snapshot;
  const expired = offerExpired(v);
  const changed = !!v.offer && v.offer.fingerprint !== a.fingerprint;
  return (
    <article className="space-y-6" data-testid={`agreement-v${v.v}`}>
      <header className="rounded-2xl bg-muted/50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Rental offer</p>
            <h3 className="font-display text-2xl font-bold">{a.offerNo}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {v.holderSig ? <Pill tone="good" testId="offer-state">Accepted</Pill> : expired ? <Pill tone="bad" testId="offer-state">Expired</Pill> : v.offer ? <Pill tone="info" testId="offer-state">Open until {longDate(v.offer.validUntil)}</Pill> : <Pill tone="mute" testId="offer-state">Draft: not yet issued</Pill>}
          </div>
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div><dt className="inline text-muted-foreground">From: </dt><dd className="inline">{s.store.ownerName}, {storeName}</dd></div>
          <div><dt className="inline text-muted-foreground">To: </dt><dd className="inline font-medium">{s.holder.name}</dd></div>
          <div><dt className="inline text-muted-foreground">Date of offer: </dt><dd className="inline">{v.offer ? longDate(v.offer.issuedAt) : "on issue"}</dd></div>
          <div><dt className="inline text-muted-foreground">Open for acceptance until: </dt><dd className="inline">{v.offer ? longDate(v.offer.validUntil) : "set on issue"}</dd></div>
          <div className="sm:col-span-2"><dt className="inline text-muted-foreground">Subject: </dt><dd className="inline">Offer to {c.model === "consignment" ? "place goods on consignment on" : "rent"} {s.shelf.label} at {storeName}</dd></div>
        </dl>
      </header>

      <div className="space-y-3 text-sm leading-relaxed">
        {a.letter.map((p, i) => <p key={i}>{p}</p>)}
        <p>Yours faithfully,<br /><b>{s.store.ownerName}</b>, for {storeName}</p>
      </div>

      <section>
        <h4 className="font-display text-lg font-bold">Key terms</h4>
        <dl className="mt-2 grid gap-x-4 gap-y-1.5 rounded-2xl border border-border p-4 text-sm sm:grid-cols-[170px_1fr]" data-testid="agreement-summary">
          {a.summary.map(([k, x]) => [<dt key={`${k}k`} className="text-muted-foreground">{k}</dt>, <dd key={`${k}v`}>{x}</dd>])}
        </dl>
      </section>

      <section>
        <h4 className="font-display text-xl font-bold">{a.title}</h4>
        <ol className="mt-3 space-y-4" data-testid="agreement-clauses">
          {a.clauses.map((cl) => (
            <li key={cl.n} id={`clause-${cl.n}`}>
              <p className="font-semibold">{cl.n}. {cl.title}</p>
              {cl.paras.map((p, i) => <p key={i} className="mt-1 text-sm leading-relaxed text-muted-foreground"><span className="mr-1 text-foreground/60">{cl.n}.{i + 1}</span>{p}</p>)}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h4 className="font-display text-lg font-bold">Execution</h4>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <SigBlock role="Offered by the Shop Owner" who={`${s.store.ownerName}, for ${storeName}`} sig={v.ownerSig} pending="Offer not issued yet" />
          <SigBlock role="Accepted by the Token Holder" who={s.holder.name} sig={v.holderSig} pending={expired ? "Offer expired before acceptance" : "Awaiting acceptance"} />
          <SigBlock role="Reviewed by InRaf" who="InRaf platform review" sig={v.adminApproval} pending="Review pending" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground" data-testid="agreement-fingerprint">
          Document fingerprint <span className="font-mono text-foreground">{a.fingerprint}</span>
          {v.offer && <> · offered as <span className="font-mono">{v.offer.fingerprint}</span></>}
          {v.acceptance && <> · accepted as <span className="font-mono">{v.acceptance.fingerprint}</span></>}
          {changed && <b className="text-destructive"> · the text no longer matches the issued offer</b>}
          . The fingerprint is calculated from the exact text above; matching fingerprints show the text accepted is the text offered.
        </p>
      </section>
    </article>
  );
}

/** Formal confirmation shown to both parties once the Token Holder has accepted and the agreement is in force. */
export function AcceptanceConfirmation({ c, v }: { c: Contract; v: ContractVersion }) {
  if (!v.acceptance || v.status !== "executed" && v.status !== "superseded") return null;
  const t = v.snapshot.terms;
  return (
    <Card className="border-[hsl(150_45%_40%/.4)] bg-[hsl(150_45%_40%/.05)]" testId="card-confirmation">
      <p className="flex items-center gap-2 font-display text-xl font-bold"><FileSignature className="h-5 w-5 text-[hsl(150_45%_32%)]" />Confirmation of acceptance</p>
      <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[170px_1fr]">
        <dt className="text-muted-foreground">Offer</dt><dd>{v.offer?.no} issued {v.offer ? longDate(v.offer.issuedAt) : "—"} by {v.ownerSig?.name}</dd>
        <dt className="text-muted-foreground">Accepted</dt><dd>{fmtTime(v.acceptance.at)} by {v.acceptance.name}</dd>
        <dt className="text-muted-foreground">Agreement</dt><dd>{c.ref} version {v.v}, in force {longDate(t.start)} to {longDate(t.end)}</dd>
        <dt className="text-muted-foreground">Document</dt><dd className="font-mono">{v.acceptance.fingerprint}</dd>
        <dt className="text-muted-foreground">Confirmations</dt><dd>{v.acceptance.confirmedAt ? `Sent to the Shop Owner and the Token Holder on ${fmtTime(v.acceptance.confirmedAt)}` : "Sent when InRaf's review completes"}</dd>
      </dl>
    </Card>
  );
}

/** What both accounts see about the shelf under this agreement: the same records, live, on both sides. */
export function SharedRecord({ st, c, side }: { st: State; c: Contract; side: "owner" | "holder" | "admin" | "other" }) {
  const inv = st.invoices.filter((i) => i.contractId === c.id && !i.voidedAt);
  const by = (k: string) => inv.filter((i) => invoiceStatus(i) === k);
  const sum = (l: typeof inv) => l.reduce((a, i) => a + i.total + (i.lateFee ?? 0), 0);
  const dep = inv.find((i) => i.kind === "deposit");
  const listings = st.listings.filter((l) => l.tokenId === c.tokenId && l.status !== "removed");
  const orders = st.orders.filter((o) => o.tokenId === c.tokenId && o.payment === "captured" && !o.refundedAt);
  const cases = st.cases.filter((x) => x.tokenId === c.tokenId);
  const deliveries = st.deliveries.filter((d) => d.tokenId === c.tokenId);
  const moves = st.movements.filter((m) => m.tokenId === c.tokenId).sort((a, b) => b.at.localeCompare(a.at));
  const rows: [string, string, string?][] = [
    ["Rent and fees", `${by("paid").length} paid (${usd(sum(by("paid")))}) · ${by("due").length} to come · ${by("overdue").length} overdue${by("overdue").length ? ` (${usd(sum(by("overdue")))})` : ""}`],
    ["Security deposit", dep ? `${usd(dep.total)} · ${invoiceStatus(dep)}` : "none"],
    ["Products", `${listings.filter((l) => l.status === "active").length} on sale · ${listings.filter((l) => l.status === "pending").length} awaiting store approval · ${listings.reduce((a, l) => a + l.available, 0)} units on the shelf`],
    ["Sales", `${orders.length} completed · ${usd(orders.reduce((a, o) => a + o.subtotal, 0))} before tax${orders.some((o) => o.shopShare) ? ` · store's share ${usd(orders.reduce((a, o) => a + (o.shopShare ?? 0), 0))}` : ""}`],
    ["Deliveries", `${deliveries.filter((d) => d.status === "expected").length} expected · ${deliveries.filter((d) => d.status === "received" || d.status === "partial").length} received`],
    ["Requests and incidents", `${cases.filter(caseIsOpen).length} open · ${cases.length - cases.filter(caseIsOpen).length} closed`],
    ["Last stock change", moves[0] ? `${moves[0].type.replace(/-/g, " ")} · ${fmtTime(moves[0].at)}` : "none yet"],
  ];
  const portal = side === "owner" ? { href: "/owner-dashboard?tab=renters", label: "Open in your store dashboard" } : side === "holder" ? { href: "/dashboard?tab=shelves", label: "Open in your portal" } : null;
  return (
    <Card testId="card-shared-record">
      <p className="flex items-center gap-2 font-display text-xl font-bold"><Link2 className="h-5 w-5 text-primary" />Shared store record</p>
      <p className="mt-1 text-sm text-muted-foreground">The Shop Owner and the Token Holder see the same records for this shelf, updated as they happen. Clause 10 makes them the agreed record; either side can query an entry within 14 days.</p>
      <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[170px_1fr]">
        {rows.map(([k, x]) => [<dt key={`${k}k`} className="text-muted-foreground">{k}</dt>, <dd key={`${k}v`} data-testid={`shared-${k.split(" ")[0].toLowerCase()}`}>{x}</dd>])}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link href={`/shelf/${c.tokenId}`} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 font-medium hover:border-primary/40" data-testid="link-shared-shelf"><Check className="h-4 w-4" />Shelf and products</Link>
        {portal && <Link href={portal.href} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 font-medium hover:border-primary/40" data-testid="link-shared-portal"><Clock className="h-4 w-4" />{portal.label}</Link>}
      </div>
    </Card>
  );
}
