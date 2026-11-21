import { Link } from "wouter";
import { Shell, PageTitle } from "@/components/shell";
import { Card, SmallButton } from "@/components/kit";
import { actions } from "@/lib/actions";
import { useAct } from "@/hooks/use-act";
import { LIVE, useStore } from "@/lib/store";
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
  if (LIVE) return <LiveGuide />;
  return <DemoGuide />;
}

const LIVE_STEPS: [string, string, string, string][] = [
  ["Store owner", "Sign in with your email, list your shop with photos of the front and the shelf, your business registration, shelf size and rental terms.", "/start?as=owner", "List your shop"],
  ["InRaf team", "We review every new store before it's shown on InRaf. You'll see the decision in your notifications.", "/notifications", "Notifications"],
  ["Maker", "Sign in, find a shelf near your customers and request it. The request becomes a contract with a fixed version of the terms.", "/start?as=holder", "Find a shelf"],
  ["Both sides", "InRaf approves the contract, then the store owner and the maker each sign it. The shelf is yours once all three are done.", "/dashboard?tab=contracts", "Your contracts"],
  ["Maker", "Add your products with batch, expiry, tax and quantity. The store owner approves them, then you put them on sale.", "/dashboard", "Holder portal"],
  ["Shopper", "Scan the QR on the shelf or browse online, pick a quantity and check out. No account needed.", "/scan", "Scan a shelf"],
];

function LiveGuide() {
  return (
    <Shell title="How InRaf works" back="/">
      <PageTitle title="How InRaf works" sub={`Neighbourhood shops rent out empty shelves; small makers stock them and sell. Open in ${PRIORITY_COUNTRIES.map((c) => c.name).join(", ")}.`} />
      <div className="mx-auto mt-8 max-w-3xl space-y-6">
        <Card>
          <p className="font-display text-xl font-bold">From empty shelf to first sale</p>
          <ol className="mt-3 space-y-3 text-sm">
            {LIVE_STEPS.map(([who, what, href, cta], i) => (
              <li key={i} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span><span><b>{who}.</b> {what} <Link href={href} className="text-primary underline">{cta}</Link></span></li>
            ))}
          </ol>
        </Card>
        <Card>
          <p className="font-display text-xl font-bold">Accounts and privacy</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            <li>No passwords. You sign in with a one-time link sent to your email.</li>
            <li>Your name is shown to the store owners and makers you deal with. Business registration numbers are only seen by you and the InRaf team.</li>
            <li>Contracts, invoices, orders and earnings are only visible to the people involved and the InRaf team.</li>
          </ul>
        </Card>
        <Card className="border-amber-500/30">
          <p className="font-display text-xl font-bold">Still simulated</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            <li><b>No money moves yet.</b> Rent, sales, refunds and payouts are recorded, but no card is charged and nothing is paid out. References starting “SIMULATED-” are not payment IDs.</li>
            <li><b>Signatures.</b> Typed names record agreement on InRaf but are not certified electronic signatures. Contract wording is a template.</li>
            <li><b>Tax and fees.</b> Percentages are illustrative, not tax or legal advice for any country.</li>
            <li><b>Tokens</b> are a record of the right to use a shelf, not crypto or an investment.</li>
            <li><b>Sample stores</b> are shown as examples and can't be rented. Their reviews and ratings are made up.</li>
          </ul>
        </Card>
        <p className="text-center text-sm text-muted-foreground">Questions? <Link href="/support" className="text-primary underline">Help & refunds</Link></p>
      </div>
    </Shell>
  );
}

function DemoGuide() {
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
            <li>Marketplace search: where / start / length / product, quick filters and a full filter panel, a schematic map with price pins, saved shelves, ratings with six sub-scores, Instant book, owner response stats, cancellation policies and listing reports.</li>
            <li>Photos: a gallery on every shelf page and a cover photo on search cards. New listings must include a photo of the shelf and of the shop front; photos are resized in the browser and can be retaken in shop settings. Sample stores use real stock photos of similar shops, labelled as such.</li>
            <li>A host page with an earnings estimate, and a three-phase listing wizard with shelf type, foot traffic, pricing model (rent, share of sales or both) and a saved draft.</li>
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
            <li><b>Sample trust data.</b> Reviews, ratings, response rates and foot traffic on sample stores are made up. Share-of-sales terms are frozen into each contract when it is requested; the store's cut is taken from each sale, settled with the maker's payout and reversed on refunds.</li>
          </ul>
        </Card>
        <Card testId="card-compliance">
          <p className="font-display text-xl font-bold">Before real money moves</p>
          <p className="mt-1 text-sm text-muted-foreground">A live version with a token, stablecoin settlement and a payout on every sale would need, at least:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            <li><b>Token rules.</b> In the UAE, a review of whether the shelf token or any payment token falls under VARA rules, and the matching rules in each other market.</li>
            <li><b>KYB on both sides.</b> Business checks on every shop and every maker before a contract can start, not just a registration number.</li>
            <li><b>Payout screening.</b> Sanctions and watchlist screening of everyone who receives a payout, plus monitoring of sales and refunds for unusual patterns.</li>
            <li><b>Escrow and deposits.</b> Deposits held by a licensed provider, not by the platform's own wallet.</li>
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
