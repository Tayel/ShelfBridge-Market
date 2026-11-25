import { Link } from "wouter";
import { Shell, PageTitle } from "@/components/shell";
import { Card } from "@/components/kit";
import { LIVE } from "@/lib/store";
import { COMPANY } from "@/lib/legal";

const DEMO_FAQ: [string, string][] = [
  ["Who sells me the product?", "The token holder renting that shelf. The store provides the space; pricing, stock and product quality are the holder's responsibility."],
  ["What does the total include?", "Item price, an illustrative tax amount and a disclosed platform service fee. All amounts are demo USD."],
  ["When am I charged?", "In this demo: authorization only holds the amount and reserves stock. Capture completes the (simulated) payment and deducts stock."],
  ["How do refunds work?", "Open your receipt and request a refund. A platform admin reviews it. Approved refunds are full and happen once; usable returned goods may be restocked."],
  ["Is my data shared?", "Everything stays in this browser. There's no account, no server and no card data."],
];

const LIVE_FAQ: [string, string][] = [
  ["Who sells me the product?", "The token holder renting that shelf. The store provides the space; pricing, stock and product quality are the holder's responsibility."],
  ["What does the total include?", "Item price, an illustrative tax amount and a disclosed platform service fee, in USD."],
  ["Am I charged?", "Not yet. InRaf is open for stores and makers, but payments are still simulated: checking out reserves the item and records the order, and no card is charged."],
  ["How do refunds work?", "Open your receipt and request a refund. The InRaf team reviews it. Approved refunds are full and happen once; usable returned goods may be restocked."],
  ["Is my data shared?", "Store owners and makers sign in with their email. We show your name to the people you deal with; contracts, orders and earnings are only visible to the parties involved and the InRaf team. Shoppers don't need an account, and we never ask for card details."],
];

const FAQ = LIVE ? LIVE_FAQ : DEMO_FAQ;

export default function Support() {
  return (
    <Shell title="Help & refunds" back="/orders">
      <PageTitle title="Help & refunds" sub={LIVE ? "Questions about an order, a refund or your shelf." : "Customer support information for the demo."} />
      <div className="mx-auto mt-8 max-w-2xl space-y-3">
        {FAQ.map(([q, a]) => <Card key={q}><p className="font-medium">{q}</p><p className="mt-1 text-sm text-muted-foreground">{a}</p></Card>)}
        <Card>
          <p className="font-medium">Contact</p>
          <p className="mt-1 text-sm text-muted-foreground">{LIVE ? <>Email us at <a href={`mailto:${COMPANY.email}`} className="text-primary underline" data-testid="link-support-email">{COMPANY.email}</a>.</> : "Support messaging, email and phone are not connected in this demo."} Use refund requests on your <Link href="/orders" className="text-primary underline" data-testid="link-orders">receipts</Link>.</p>
        </Card>
      </div>
    </Shell>
  );
}
