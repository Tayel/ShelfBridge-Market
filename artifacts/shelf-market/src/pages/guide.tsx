import { Link } from "wouter";
import { Shell, PageTitle } from "@/components/shell";
import { Card, SmallButton } from "@/components/kit";
import { actions } from "@/lib/actions";
import { useAct } from "@/hooks/use-act";
import { useStore } from "@/lib/store";
import { PRIORITY_COUNTRIES } from "@/lib/data";

const STEPS: [string, string, string][] = [
  ["Store owner", "List a shop, add registration (demo value), shelf size, capacity and rental terms. The admin approves the store.", "/owner"],
  ["Token holder", "Pick a shelf and request a contract. A versioned snapshot is frozen.", "/explore"],
  ["Platform admin", "Approve the contract version.", "/admin?tab=contracts"],
  ["Both parties", "Each reviews and types a name. Sample stores/holders use “simulate signature”. Activation needs all three.", "/dashboard?tab=contracts"],
  ["Token holder", "Add products (SKU, batch, expiry, tax, quantity). Owner approves; holder puts them on sale.", "/dashboard"],
  ["Customer", "Open the shelf catalog (or its QR), pick a quantity, review totals, simulate authorization, then capture.", "/scan"],
  ["Admin", "Initiate payouts and confirm or fail them as the simulated provider. Review refunds, reconcile, export CSV.", "/admin?tab=finance"],
];

export default function Guide() {
  const st = useStore();
  const { act, error } = useAct();
  return (
    <Shell title="Demo guide" back="/">
      <PageTitle title="How this demo works" sub={`Shelf rental, contracts, QR sales and settlement, simulated end-to-end. Priority markets: ${PRIORITY_COUNTRIES.map((c) => c.name).join(", ")}.`} />
      <div className="mx-auto mt-8 max-w-3xl space-y-6">
        <Card>
          <p className="font-display text-xl font-bold">Try it in seven steps</p>
          <ol className="mt-3 space-y-2 text-sm">
            {STEPS.map(([who, what, href], i) => (
              <li key={i} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span><span><b>{who}.</b> {what} <Link href={href} className="text-primary underline" data-testid={`link-step-${i + 1}`}>Go</Link></span></li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">Use “View as” in the header to switch views. It's a demo selector, not a login or a permission check — every page stays reachable.</p>
        </Card>
        <Card>
          <p className="font-display text-xl font-bold">What's included</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            <li>Stores with registration (demo value), shelf dimensions, capacity, floor-plan location and rental terms; admin approve/suspend.</li>
            <li>Contract requests with immutable versioned snapshots, platform approval, two separately recorded demo signatures, renewals/amendments as new unsigned versions, termination that releases the shelf, audit trail, and a downloadable PDF marked “DEMO — NOT A LEGAL CONTRACT”.</li>
            <li>Rent obligations (paid/due/overdue, illustrative late fees, demo receipts) kept separate from sales.</li>
            <li>Products with SKU, batch, expiry, tax, cost and quantity; capacity enforced; owner approval; low-stock and expiry alerts.</li>
            <li>Real, scannable shelf QR codes linked to <code>/catalog/&lt;shelf&gt;</code>; authorize → capture (or decline/cancel); only capture deducts stock, once.</li>
            <li>Append-only ledger, payout states (pending → processing → settled/failed) that only settle on a simulated provider confirmation, full refunds with optional restock, reconciliation and CSV export.</li>
            <li>In-app notifications for key events, per role, read/unread.</li>
          </ul>
        </Card>
        <Card className="border-destructive/30">
          <p className="font-display text-xl font-bold">Limits — please read</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            <li><b>Not legal.</b> Typed names are not electronic signatures; generated PDFs have no legal effect. Contract wording is a template.</li>
            <li><b>No money moves.</b> No payment provider, card fields, bank accounts or payouts. “SIMULATED-” references are not provider IDs.</li>
            <li><b>Illustrative tax & fees.</b> Demo USD; percentages are examples, not tax or legal advice for any jurisdiction.</li>
            <li><b>Tokens</b> are contractual shelf-use demo records, not crypto or investment assets.</li>
            <li><b>No security.</b> No real authentication, roles or access control. Don't enter real personal, identity or bank data.</li>
            <li><b>One browser only.</b> Data is saved in this browser's localStorage. Other devices (e.g. a phone scanning a QR) see their own copy — there is no server and no multi-device sync. Open tabs refresh each other, and each action re-checks the latest saved state, but this is not production-safe concurrency.</li>
            <li><b>No messaging.</b> Notifications are in-app only; no email or SMS.</li>
          </ul>
        </Card>
        <Card>
          <p className="font-display text-lg font-bold">Your data</p>
          <p className="mt-1 text-sm text-muted-foreground">{st.migratedFromV1 ? `Earlier demo data was migrated on ${new Date(st.migratedFromV1).toLocaleDateString()}: your shops and rentals were kept; old rentals now await admin approval and both signatures (none were fabricated). The original saved copy is untouched.` : "Saved in this browser."}</p>
          <div className="mt-3"><SmallButton tone="danger" onClick={() => { if (window.confirm("Reset all demo data in this browser to the starting samples? Your current shops, contracts and orders here will be replaced.")) act(() => actions.reset(), "Demo data reset"); }} testId="button-reset">Reset demo data</SmallButton></div>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </Card>
      </div>
    </Shell>
  );
}
