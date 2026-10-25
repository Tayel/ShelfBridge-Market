import { Link } from "wouter";
import { Shell, PageTitle } from "@/components/shell";
import { Card } from "@/components/kit";

const FAQ: [string, string][] = [
  ["Who sells me the product?", "The token holder renting that shelf. The store provides the space; pricing, stock and product quality are the holder's responsibility."],
  ["What does the total include?", "Item price, an illustrative tax amount and a disclosed platform service fee. All amounts are demo USD."],
  ["When am I charged?", "In this demo: authorization only holds the amount and reserves stock. Capture completes the (simulated) payment and deducts stock."],
  ["How do refunds work?", "Open your receipt and request a refund. A platform admin reviews it. Approved refunds are full and happen once; usable returned goods may be restocked."],
  ["Is my data shared?", "Everything stays in this browser. There's no account, no server and no card data."],
];

export default function Support() {
  return (
    <Shell title="Help & refunds" back="/orders">
      <PageTitle title="Help & refunds" sub="Customer support information for the demo." />
      <div className="mx-auto mt-8 max-w-2xl space-y-3">
        {FAQ.map(([q, a]) => <Card key={q}><p className="font-medium">{q}</p><p className="mt-1 text-sm text-muted-foreground">{a}</p></Card>)}
        <Card>
          <p className="font-medium">Contact</p>
          <p className="mt-1 text-sm text-muted-foreground">Support messaging, email and phone are not connected in this demo. Use refund requests on your <Link href="/orders" className="text-primary underline" data-testid="link-orders">receipts</Link>.</p>
        </Card>
      </div>
    </Shell>
  );
}
