import type { ReactNode } from "react";
import { Link } from "wouter";
import { Mail, MapPin, ShieldCheck, Store, Users } from "lucide-react";
import { Shell, PageTitle } from "@/components/shell";
import { Card } from "@/components/kit";
import { COMPANY, TERMS_UPDATED } from "@/lib/legal";

const operator = `${COMPANY.operator}${COMPANY.registeredIn ? `, registered in ${COMPANY.registeredIn}` : ""}${COMPANY.address ? `, ${COMPANY.address}` : ""}`;
const Mailto = () => <a href={`mailto:${COMPANY.email}`} className="text-primary underline">{COMPANY.email}</a>;

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="space-y-2" id={`s${n}`}>
      <h2 className="font-display text-xl font-bold">{n}. {title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground [&_b]:text-foreground [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </section>
  );
}

function LegalPage({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <Shell title={title} back="/">
      <PageTitle title={title} sub={sub} />
      <Card className="mx-auto mt-6 max-w-3xl space-y-7 p-6 md:p-10">
        <p className="text-xs text-muted-foreground">Last updated {TERMS_UPDATED} · Operated by {operator} · Questions: <Mailto /></p>
        {children}
      </Card>
    </Shell>
  );
}

export function Terms() {
  return (
    <LegalPage title="Terms of use" sub="The rules for store owners, makers and shoppers on InRaf.">
      <Section n={1} title="Who we are">
        <p>InRaf (inraf.com) is operated by {operator} (“InRaf”, “we”). Contact us at <Mailto />.</p>
      </Section>
      <Section n={2} title="What InRaf is">
        <p>InRaf is a marketplace that connects <b>store owners</b> who rent out shelf space with <b>makers</b> (token holders) who stock those shelves, and with the <b>shoppers</b> who buy from them.</p>
        <p>InRaf is not the seller of the products on a shelf: each product is sold by the maker who rents that shelf. The rental contract is between the store owner and the maker; InRaf provides the platform, the contract template and approvals.</p>
        <p>A <b>shelf token</b> is a record of a maker’s right to use a shelf under a contract. It is <b>not money, not crypto and not an investment</b>, and it gives no share in InRaf or in anyone else’s profits.</p>
      </Section>
      <Section n={3} title="How payments work">
        <p><b>InRaf does not take, hold or transfer money.</b> Makers pay rent and deposits directly to the store owner (by bank transfer or another method they agree) and tell the store on InRaf; the store owner confirms receipt and InRaf issues a receipt. Shoppers pay for products at the store’s till, the store records each sale on InRaf, and the store pays each maker its part every month, within the period set in the contract, and records that payment.</p>
        <p>While payments work this way, <b>InRaf charges no commission or service fee</b>. If InRaf introduces online payments or fees, it will tell you in advance and ask you to agree to the updated terms.</p>
        <p>Each side is responsible for the payments it owes and for keeping its own payment records and receipts. InRaf’s records show what each side has reported and confirmed; they are not a bank statement.</p>
      </Section>
      <Section n={4} title="Your account">
        <ul>
          <li>You must be at least 18 and, if you act for a business, allowed to act for it.</li>
          <li>Give accurate information and keep it up to date. You sign in with a one-time email link; keep your email account secure.</li>
          <li>We may ask for documents to confirm who you are or your business, and we screen accounts against sanctions lists before contracts start.</li>
        </ul>
      </Section>
      <Section n={5} title="Store owners">
        <ul>
          <li>You confirm your shop is properly licensed and that you are allowed to let shelf space to others, including any permission your landlord, mall or airport operator requires.</li>
          <li>Your listing (photos, size, location, foot traffic, rent) must be accurate. Every new store is reviewed by InRaf before it is shown, and we need your business registration number to approve it.</li>
          <li>You keep each rented shelf installed, safe, clean and accessible during opening hours, and you approve each product before it goes on sale.</li>
          <li>You may refuse products that break the law, your own rules or the contract.</li>
          <li>If you offer your own products or surplus stock, you confirm they are legal to sell, safe, correctly labelled and stored as their label requires. Expired products are never accepted; products with a date need at least 7 days of shelf life left, and food and beauty products need their expiry or best-before date. Applications are reviewed by InRaf before anything is offered for sale.</li>
          <li>Earnings shown while you apply are estimates from your own prices, not a promise.</li>
        </ul>
      </Section>
      <Section n={6} title="Makers">
        <ul>
          <li>You are responsible for your products: that they are legal where they are sold, safe, correctly labelled (including ingredients, origin and expiry dates) and that you hold any licence they need.</li>
          <li>You remove expired, recalled or rejected goods within 48 hours, and collect unsold stock when a contract ends.</li>
          <li>You are responsible for the taxes on your own sales.</li>
        </ul>
      </Section>
      <Section n={7} title="Shelf rental contracts">
        <p>Each rental is a contract between the store owner and the maker, built from InRaf’s template and frozen as a version both sides approve. By default it includes:</p>
        <ul>
          <li>A security deposit of one month’s rent, unless the store owner sets another amount.</li>
          <li><b>Notice to end early:</b> either side gives the notice set in the contract (30 days by default). A maker who ends a running contract early pays the rent for the notice period.</li>
          <li>Late payment fees and a grace period as shown in the contract.</li>
          <li><b>Governing law:</b> the law of the country where the store is located, with disputes first raised through InRaf, then mediation, then the courts of the store’s city.</li>
        </ul>
        <p><b>Two models.</b> In a <b>shelf rental</b> (model A) the maker pays rent for the space and manages their own products. In <b>consignment</b> (model B) there is no rent: the store sells the maker’s products and keeps the agreed commission on each sale, and the maker owns the stock until it sells. Each model has its own terms in the contract.</p>
        <p><b>Offers.</b> Before anyone signs, the maker and the store owner may propose different rent, commission or length. Each new offer replaces the unsigned draft; only the version both sides sign counts.</p>
        <p><b>Tokens and shelves.</b> Holding an InRaf token or account does not by itself give you ownership of, or a right to, any physical shelf. Your rights to a shelf come only from the contract you sign and these Terms.</p>
        <p>Typed names record each side’s agreement on InRaf. In some countries a certified electronic signature or a signed paper copy may be needed for the contract to be enforceable; you can download the contract as a PDF.</p>
      </Section>
      <Section n={8} title="Not allowed">
        <ul>
          <li>Illegal, counterfeit, stolen, dangerous or age-restricted goods (such as tobacco, alcohol where restricted, weapons, medicines without the required licence).</li>
          <li>False listings, fake reviews, or using InRaf to avoid a contract, fee or law.</li>
          <li>Anything that breaks sanctions, anti-money-laundering or consumer protection rules.</li>
        </ul>
        <p>We may remove content, suspend a store, product or account, or end a contract on the platform when these rules are broken.</p>
      </Section>
      <Section n={9} title="Photos and content">
        <p>You keep the rights to the photos and text you upload, and allow InRaf to show them on inraf.com to run and promote the marketplace while your listing is active.</p>
      </Section>
      <Section n={10} title="Liability">
        <p>InRaf provides the platform with reasonable care but is not a party to sales between makers and shoppers, and is not responsible for a product’s quality or safety, or for a store owner’s or maker’s own obligations. Nothing in these terms limits rights you have under consumer protection law that cannot be limited.</p>
      </Section>
      <Section n={11} title="Changes and contact">
        <p>We may update these terms; we will show the new date here and ask you to agree again at your next sign-in when the change matters. Questions or complaints: <Mailto />.</p>
      </Section>
    </LegalPage>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Privacy policy" sub="What we collect, why, who sees it and your rights.">
      <Section n={1} title="Who is responsible">
        <p>{operator} operates InRaf and is responsible for your personal data on inraf.com. Contact: <Mailto />.</p>
      </Section>
      <Section n={2} title="What we collect">
        <ul>
          <li><b>Account:</b> your email address and name.</li>
          <li><b>Store owners and makers:</b> business name, address, contact person, phone or WhatsApp number, registration number, shop, product and stock details, and photos.</li>
          <li><b>Activity:</b> contracts, signatures (typed names with time), invoices, orders, refunds, notifications and a record of actions taken.</li>
          <li><b>Technical:</b> two cookies that are needed for the site to work — one keeps you signed in, one links an anonymous shopper to their own orders — and the IP address used to request a sign-in link (to stop abuse). No advertising or tracking cookies.</li>
        </ul>
      </Section>
      <Section n={3} title="Why we use it">
        <ul>
          <li>To run your account and the contracts and orders you make (performing our agreement with you).</li>
          <li>To review stores before they are shown, keep the marketplace safe and screen store owners and makers against sanctions lists (legal obligations and legitimate interest).</li>
          <li>To send sign-in links and service messages. We do not send marketing without your consent.</li>
        </ul>
      </Section>
      <Section n={4} title="Who sees it">
        <ul>
          <li>The people you deal with see your name and the details needed for the contract or order. Registration numbers are only seen by you and InRaf.</li>
          <li>Service providers who host and run InRaf for us: Vercel (hosting), Neon (database) and Resend (email). They process data only on our instructions.</li>
          <li>Authorities, when the law requires it.</li>
        </ul>
        <p>Our providers may store data outside your country (for example in the United States or the EU). Where the law requires, we use safeguards such as standard contractual clauses.</p>
      </Section>
      <Section n={5} title="How long we keep it">
        <p>Account data while your account is open. Contracts, invoices and order records for as long as tax and commercial law require in the relevant country. Sign-in links expire after 15 minutes; sessions after 30 days.</p>
      </Section>
      <Section n={6} title="Your rights">
        <p>You can ask to access, correct or delete your data, to receive a copy, or to object to or restrict how we use it. Use the <Link href="/privacy/data-rights" className="text-primary underline">data rights form</Link> (you get a reference and the date we will answer by) or write to <Mailto />. We answer within one month; if a request is complex we may extend this once and will tell you why. Some records we must keep by law.</p>
        <p>You can also complain to your data protection authority: in the UAE the UAE Data Office, in Egypt the Personal Data Protection Center, in Türkiye the Personal Data Protection Authority (KVKK), in Hungary the NAIH, and in Portugal the CNPD.</p>
      </Section>
      <Section n={7} title="Children">
        <p>InRaf accounts are for adults (18+). Shoppers don’t need an account.</p>
      </Section>
      <Section n={8} title="Changes">
        <p>We will show the date of any change here and ask you to agree again at your next sign-in when the change matters.</p>
      </Section>
    </LegalPage>
  );
}

export function About() {
  return (
    <Shell title="About InRaf" back="/">
      <PageTitle title="About InRaf" sub="A little shelf, anywhere: neighbourhood shops share space, small makers fill it." />
      <div className="mx-auto mt-6 grid max-w-3xl gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <p className="font-display text-xl font-bold">Why we started</p>
          <p className="mt-2 text-sm text-muted-foreground">Many neighbourhood shops have a shelf they don’t use, and many small makers can’t afford a shop of their own. InRaf brings them together: the shop earns rent from space it already has, the maker gets a place in the neighbourhood, and neighbours find local products.</p>
        </Card>
        <Card>
          <Store className="h-6 w-6 text-primary" />
          <p className="font-display mt-2 font-bold">For store owners</p>
          <p className="mt-1 text-sm text-muted-foreground">List your shop, set your rent or share of sales, approve every product. A contract with a deposit, a notice period and your country’s law protects you.</p>
          <Link href="/start?as=owner" className="mt-3 inline-block text-sm font-semibold text-primary underline">List your shop</Link>
        </Card>
        <Card>
          <Users className="h-6 w-6 text-primary" />
          <p className="font-display mt-2 font-bold">For makers</p>
          <p className="mt-1 text-sm text-muted-foreground">Rent a shelf near your customers and stock it. Shoppers pay at the store’s till and the store pays you for every sale; InRaf charges no commission while payments are made directly.</p>
          <Link href="/start?as=holder" className="mt-3 inline-block text-sm font-semibold text-primary underline">Find a shelf</Link>
        </Card>
        <Card>
          <MapPin className="h-6 w-6 text-primary" />
          <p className="font-display mt-2 font-bold">Where we are</p>
          <p className="mt-1 text-sm text-muted-foreground">Open to shops and makers in Egypt, Portugal, Hungary, Türkiye and the UAE. InRaf is operated by {operator}.</p>
        </Card>
        <Card>
          <ShieldCheck className="h-6 w-6 text-primary" />
          <p className="font-display mt-2 font-bold">How we keep it safe</p>
          <p className="mt-1 text-sm text-muted-foreground">Every store is reviewed before it’s shown, accounts are screened against sanctions lists, and contracts, orders and earnings are only visible to the people involved.</p>
        </Card>
        <Card className="md:col-span-2">
          <p className="font-display text-xl font-bold">Talk to us</p>
          <p className="mt-2 flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-primary" /><Mailto /></p>
          <p className="mt-3 text-xs text-muted-foreground">Accounts, stores, contracts and records on InRaf are real. Money is paid directly between makers, stores and shoppers; InRaf records it but never holds it. Read the <Link href="/terms" className="underline">Terms</Link> and the <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
        </Card>
      </div>
    </Shell>
  );
}
