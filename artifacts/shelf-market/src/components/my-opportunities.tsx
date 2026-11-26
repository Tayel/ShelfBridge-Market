import { Link } from "wouter";
import { ArrowRight, CalendarClock, Camera, Handshake, Heart, KeyRound, MapPin, ScrollText } from "lucide-react";
import { Card, Empty, Pill } from "@/components/kit";
import { ShelfQr } from "@/components/qr";
import { countryName } from "@/lib/data";
import { awaitingVersion, contractStatus, executedVersion } from "@/lib/selectors";
import { usd, type useStore } from "@/lib/store";
import { daysUntil, fmtDate } from "@/lib/util";
import type { Contract } from "@/lib/types";
import { offerNeeded } from "@/lib/ops";

/**
 * "My Retail Opportunities" in the token holder's portal: saved stores, offers in negotiation, contracts waiting
 * for signatures, signed shelves with their shelf ID and QR code, and renewals coming up.
 */
export function MyOpportunities({ st, holderId }: { st: ReturnType<typeof useStore>; holderId: string }) {
  const mine = st.contracts.filter((c) => c.holderId === holderId);
  const negotiating = mine.filter((c) => contractStatus(c) === "awaiting" && c.versions.length === 1 && (c.offers?.length ?? 0) > 0 && !c.versions[0].holderSig && !c.versions[0].ownerSig);
  const pending = mine.filter((c) => contractStatus(c) === "awaiting" && !negotiating.includes(c));
  const active = mine.filter((c) => contractStatus(c) === "active");
  const renewals = active.filter((c) => daysUntil(executedVersion(c)!.snapshot.terms.end) <= 30);
  const saved = st.shops.filter((s) => st.saved.includes(s.id));
  const shopOf = (c: Contract) => st.shops.find((s) => s.id === c.shopId);
  const terms = (c: Contract) => { const t = (awaitingVersion(c) ?? executedVersion(c) ?? c.versions[0]).snapshot.terms; return c.model === "consignment" ? `Consignment · ${t.salesSharePct}% commission` : `${usd(t.monthlyRent)}/mo`; };

  const Section = ({ icon: Icon, title, count, children }: { icon: typeof Heart; title: string; count: number; children: React.ReactNode }) => (
    <section>
      <h2 className="font-display flex items-center gap-2 text-xl font-bold"><Icon className="h-5 w-5 text-primary" />{title} <span className="text-sm font-normal text-muted-foreground">{count}</span></h2>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
  const Row = ({ c, right }: { c: Contract; right: React.ReactNode }) => {
    const s = shopOf(c); const v = awaitingVersion(c) ?? executedVersion(c) ?? c.versions[0];
    return (
      <Link href={`/contracts/${c.id}`} className="flex flex-wrap items-center gap-3 rounded-3xl border border-border p-4 hover:border-primary/40" data-testid={`opp-contract-${c.id}`}>
        <div className="min-w-0 flex-1"><p className="font-medium">{s?.name ?? v.snapshot.store.name} · {v.snapshot.shelf.label}</p><p className="text-xs text-muted-foreground"><MapPin className="mr-0.5 inline h-3 w-3" />{v.snapshot.store.city}, {countryName(v.snapshot.store.country)} · {c.ref} · {terms(c)} · {v.snapshot.terms.months} months</p></div>
        {right}
      </Link>
    );
  };

  return (
    <div className="mx-auto mt-4 max-w-4xl space-y-8" data-testid="my-opportunities">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] bg-muted/60 p-5">
        <div><p className="font-display text-xl font-bold">My retail opportunities</p><p className="text-sm text-muted-foreground">Everything from discovering a shelf to selling on it, in one place.</p></div>
        <Link href="/start?as=holder" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground" data-testid="link-discover">Explore opportunities <ArrowRight className="h-4 w-4" /></Link>
      </div>

      <Section icon={Handshake} title="Offers in negotiation" count={negotiating.length}>
        {negotiating.length === 0 ? <Empty title="No open offers" text="Propose your own rent or a consignment deal from any store page." /> : negotiating.map((c) => {
          const last = c.offers!.at(-1)!;
          return <Row key={c.id} c={c} right={<Pill tone={last.by === "owner" ? "warn" : "mute"}>{last.by === "owner" ? "Owner replied: your move" : "Waiting for the owner"}</Pill>} />;
        })}
      </Section>

      <Section icon={ScrollText} title="Contracts waiting for signatures" count={pending.length}>
        {pending.length === 0 ? <Empty title="Nothing waiting" /> : pending.map((c) => {
          const v = awaitingVersion(c)!;
          return <Row key={c.id} c={c} right={<Pill tone="warn">{offerNeeded(v) ? "Owner's offer to come" : !v.adminApproval ? "InRaf check" : !v.holderSig ? "Offer to accept" : "Ready"}</Pill>} />;
        })}
      </Section>

      <Section icon={KeyRound} title="My rented shelves" count={active.length}>
        {active.length === 0 ? <Empty title="No signed shelves yet" /> : active.map((c) => {
          const v = executedVersion(c)!; const s = shopOf(c);
          return (
            <Card key={c.id} testId={`opp-shelf-${c.id}`}>
              <div className="flex flex-wrap items-start gap-5">
                <ShelfQr tokenId={c.tokenId} label={c.tokenId} size={96} download={false} />
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <p className="font-display text-lg font-bold">{s?.name ?? v.snapshot.store.name}</p>
                  <p className="text-muted-foreground">{v.snapshot.store.address}, {countryName(v.snapshot.store.country)}</p>
                  <p><b>Shelf ID</b> <span className="font-mono" data-testid="text-shelf-id">{c.tokenId}</span> · {v.snapshot.shelf.label} · {v.snapshot.shelf.spec.widthCm}×{v.snapshot.shelf.spec.heightCm}×{v.snapshot.shelf.spec.depthCm} cm</p>
                  <p><b>Contract</b> {c.ref} v{v.v} · {fmtDate(v.snapshot.terms.start)} → {fmtDate(v.snapshot.terms.end)} · {terms(c)}</p>
                  <p className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Camera className="h-3.5 w-3.5" />Live shelf camera: coming soon where the store allows it.</p>
                  <div className="flex flex-wrap gap-3 pt-1 text-sm font-semibold text-primary">
                    <Link href={`/shelf/${c.tokenId}`} className="underline">Products and stock</Link>
                    <Link href={`/contracts/${c.id}`} className="underline">Contract and payments</Link>
                    <Link href={`/catalog/${c.tokenId}`} className="underline">Shoppers' QR page</Link>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </Section>

      <Section icon={CalendarClock} title="Renewals coming up" count={renewals.length}>
        {renewals.length === 0 ? <Empty title="No contract ends in the next 30 days" /> : renewals.map((c) => <Row key={c.id} c={c} right={<Pill tone="warn">Ends {fmtDate(executedVersion(c)!.snapshot.terms.end)}</Pill>} />)}
      </Section>

      <Section icon={Heart} title="Saved stores" count={saved.length}>
        {saved.length === 0 ? <Empty title="No saved stores" text="Tap the heart on a store to keep it here." /> : saved.map((s) => (
          <Link key={s.id} href={`/explore/${s.id}`} className="flex items-center gap-3 rounded-3xl border border-border p-4 hover:border-primary/40" data-testid={`opp-saved-${s.id}`}>
            <div className="min-w-0 flex-1"><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.city}, {countryName(s.country)}</p></div>
            <ArrowRight className="h-4 w-4 text-primary" />
          </Link>
        ))}
      </Section>
    </div>
  );
}
