/**
 * The formal Rental Offer and Shelf Rental Agreement, built from a contract version's frozen snapshot.
 *
 * One source for every place the agreement appears: the contract page, the PDF and the server's acceptance check.
 * Its fingerprint (a hash of the exact text) is recorded when the Shop Owner issues the offer and again when the
 * Token Holder accepts, so both sides can show that the text accepted is the text offered. The wording is a
 * balanced commercial template written to be read by non-lawyers; it is not legal advice and should be reviewed
 * by counsel in each country before InRaf relies on it.
 */
import type { Contract, ContractModel, ContractVersion } from "./types";
import { categoryLabel, countryName } from "./data";

export interface Clause { n: number; title: string; paras: string[] }
export interface Agreement {
  title: string;
  offerNo: string;
  letter: string[];
  summary: [string, string][];
  clauses: Clause[];
  fingerprint: string;
}

/** Days a formal offer stays open unless the Shop Owner picks another period. */
export const OFFER_VALID_DAYS = 7;
export const OFFER_VALIDITY_CHOICES = [3, 7, 14] as const;
/** Working periods the agreement promises; kept here so the text and the system can't drift apart. */
export const DEPOSIT_RETURN_DAYS = 14;
export const CURE_DAYS = 14;
export const REMOVAL_DAYS = 7;
export const INCIDENT_REPORT_HOURS = 24;
export const RECORD_DISPUTE_DAYS = 14;
export const SERIOUS_ARREARS_DAYS = 30;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** Same text on every device and server, so the fingerprint never depends on locale. */
export const longDate = (iso?: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
const money = (n: number) => `USD ${n.toFixed(2)}`;

/** Short, stable hash of the agreement text (cyrb53). Evidence that two copies match, not a security seal. */
export function fingerprintOf(text: string) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return n.toString(16).toUpperCase().padStart(14, "0").replace(/(.{4})(?=.)/g, "$1-");
}

export const offerNoOf = (c: Pick<Contract, "ref">, v: Pick<ContractVersion, "v">) => `OFR-${c.ref.replace(/^CTR-/, "")}-${v.v}`;

export function buildAgreement(c: Pick<Contract, "ref" | "model">, v: ContractVersion): Agreement {
  const s = v.snapshot; const t = s.terms;
  const model: ContractModel = c.model ?? "rental";
  const consign = model === "consignment";
  const owner = s.store.ownerName || "the Shop Owner";
  const holder = s.holder.name;
  const country = countryName(s.store.country);
  const notice = t.noticeDays ?? 30;
  const pct = t.salesSharePct ?? 0;
  const fees = consign
    ? `a commission of ${pct}% of the price of each sale of the Token Holder's products (before tax), with no fixed rent`
    : t.pricing === "share" ? `a share of ${pct}% of each sale (before tax), with no fixed rent`
    : t.pricing === "hybrid" ? `a monthly fee of ${money(t.monthlyRent)} plus ${pct}% of each sale (before tax)`
    : `a monthly fee of ${money(t.monthlyRent)}`;
  const offerNo = offerNoOf(c, v);
  const premises = `${s.shelf.label} at ${s.store.name}, ${s.store.address}, ${country}`;

  const summary: [string, string][] = [
    ["Offer number", offerNo],
    ["Agreement", `${c.ref}, version ${v.v} (${v.kind})`],
    ["Shop Owner", `${owner}, for ${s.store.name}${s.store.registration ? ` (registration ${s.store.registration})` : ""}`],
    ["Token Holder", `${holder}${s.holder.registration && s.holder.registration !== "—" ? ` (registration ${s.holder.registration})` : ""}`],
    ["Model", consign ? "B · Consignment: the store sells the Token Holder's products for a commission" : "A · Shelf rental: the Token Holder rents the shelf and runs its own products"],
    ["Premises", premises],
    ["Shelf size", `${s.shelf.spec.widthCm} × ${s.shelf.spec.heightCm} × ${s.shelf.spec.depthCm} cm (W × H × D), up to ${s.shelf.spec.capacity} units`],
    ["Term", `${longDate(t.start)} to ${longDate(t.end)} (${t.months} months)`],
    ["Fees", fees.charAt(0).toUpperCase() + fees.slice(1)],
    ["Tax", `${t.taxRate}% (illustrative; the rate in force applies)`],
    ["Security deposit", t.deposit > 0 ? money(t.deposit) : "None"],
    ["Late payment", `${t.lateFeePct}% of the overdue amount after ${t.graceDays} days' grace`],
    ["Notice to end early", `${notice} days`],
    ["Governing law", t.governingLaw ?? `The laws of ${country}`],
  ];

  const letter = [
    `Dear ${holder},`,
    `${owner}, on behalf of ${s.store.name}, offers to grant you the right to use ${s.shelf.label} at ${s.store.address}, ${country}, from ${longDate(t.start)} to ${longDate(t.end)}, for ${fees}, on the terms of the Shelf Rental Agreement below.`,
    `The key terms are summarised in the table. The full Agreement follows and forms part of this offer. Please read it carefully. You may ask questions or propose changes through InRaf before you accept; any change produces a new offer.`,
    `To accept, sign this offer on InRaf before it expires. When you accept, InRaf records your acceptance, both of us receive a written confirmation, and the Agreement takes effect on the terms below.`,
  ];

  const L: Clause[] = [];
  const add = (title: string, ...paras: (string | false | undefined)[]) => L.push({ n: L.length + 1, title, paras: paras.filter(Boolean) as string[] });

  add("Parties and definitions",
    `This Agreement is between ${owner}, acting for ${s.store.name} (the "Shop Owner"), and ${holder} (the "Token Holder"), together the "Parties".`,
    `"Premises" means the display shelf described in clause 2. "Term" means the period in clause 3. "InRaf" means the inraf.com platform through which this Agreement is offered, accepted, recorded and administered. "Token" means InRaf's record of the Token Holder's right to use the Premises under this Agreement; it is not money, a crypto asset or an investment and gives no share in the Shop Owner's business or in InRaf.`,
    `"Business day" means a day other than a weekend or public holiday in ${country}.`);
  add("The Premises",
    `The Shop Owner grants the Token Holder a non-exclusive right to use ${s.shelf.label} (the "Premises") at ${s.store.name}, ${s.store.address}, ${country}: ${s.shelf.spec.widthCm} × ${s.shelf.spec.heightCm} × ${s.shelf.spec.depthCm} cm, for up to ${s.shelf.spec.capacity} units. ${s.shelf.floorNote}`,
    `Permitted product categories: ${s.shelf.categories.map(categoryLabel).join(", ") || "as agreed in writing"}.${s.shelf.restrictions.length ? ` Not permitted: ${s.shelf.restrictions.join(", ")}.` : ""}`,
    `This is a right to use display space only. It does not create a lease or tenancy of the shop or any interest in the property, and the Shop Owner keeps possession and control of the shop.`,
    `The Shop Owner may move the Premises to an equivalent position in the same shop, of the same size and visibility or better, after giving at least 7 days' notice through InRaf. Any other move needs the Token Holder's written agreement.`);
  add("Term and renewal",
    `This Agreement starts on ${longDate(t.start)} and ends on ${longDate(t.end)}, unless ended earlier under clause 13.`,
    t.renewal === "auto-offer" ? `Before the Term ends, InRaf will invite both Parties to renew. A renewal takes effect only if both Parties accept a new version.`
      : t.renewal === "none" ? `This Agreement is not renewable. The Parties may agree a new agreement through InRaf.`
      : `Renewal is not automatic. Either Party may propose a renewal through InRaf, which takes effect only when both Parties accept it.`);
  add("Fees and payment",
    `In return for the right in clause 2, the Token Holder pays ${fees}.`,
    !consign && t.monthlyRent > 0 && `The monthly fee is invoiced through InRaf for each month of the Term and is due within 5 days after the start of that month. Tax at the rate in force is added where it applies (currently shown as ${t.taxRate}%, for illustration).`,
    pct > 0 && `The ${consign ? "commission" : "share of sales"} is calculated on each sale recorded on InRaf and deducted before the Token Holder's payout. Each Party can see every sale and deduction in its InRaf account.`,
    `All payments are made through InRaf only. Neither Party may ask for or accept payment outside InRaf for anything covered by this Agreement. No other fee, charge or deduction applies unless both Parties agree it in writing through InRaf.`,
    `If an amount is not paid within ${t.graceDays} days of its due date, a late fee of ${t.lateFeePct}% of the overdue amount applies, once per invoice. The late fee is a fair estimate of the Shop Owner's administrative cost and is not a penalty or interest.`,
    `If the Token Holder disputes an invoice in good faith, it must say so through InRaf before the due date and pay any undisputed part. No late fee applies to the disputed part while it is being resolved.`);
  add("Security deposit",
    t.deposit > 0 ? `The Token Holder pays a security deposit of ${money(t.deposit)} on or before the start date. It is held against unpaid amounts due under this Agreement and the cost of repairing damage to the Premises caused by the Token Holder, beyond fair wear and tear.`
      : `No security deposit is payable under this Agreement.`,
    t.deposit > 0 && `Within ${DEPOSIT_RETURN_DAYS} days after this Agreement ends and the Premises are cleared, the deposit is returned in full, less any deductions allowed by this clause. Every deduction must be itemised, explained and supported by evidence (such as photos or invoices) on InRaf. The Token Holder may dispute a deduction under clause 17.`,
    t.deposit > 0 && `The deposit is not a payment of fees and cannot be used by the Token Holder to pay the last month's fee unless the Shop Owner agrees.`);
  add("Shop Owner's obligations",
    `The Shop Owner will: (a) make the Premises available in the agreed condition on the start date; (b) give the Token Holder and its staff reasonable access to stock and arrange the Premises during the shop's opening hours, by arrangement through InRaf; (c) keep the Premises installed, safe, clean and properly lit; (d) take reasonable care of the Token Holder's goods while they are in the shop; (e) not sell, move or remove the Token Holder's goods except as allowed by this Agreement or with its consent; (f) confirm deliveries, record sales and handle store requests accurately through InRaf; (g) report any loss, theft, damage or incident affecting the goods or the Premises through InRaf within ${INCIDENT_REPORT_HOURS} hours of becoming aware of it; and (h) hold the business registrations and permits needed to run the shop.`,
    consign && `For consignment, the Shop Owner will also display and offer the goods for sale at the prices set by the Token Holder, collect payment through InRaf only, and keep the goods separate and identifiable as the Token Holder's.`);
  add("Token Holder's obligations",
    `The Token Holder will: (a) supply only goods within the permitted categories that are lawful, safe, genuine and correctly labelled for sale in ${country}, with any required licences, certificates and expiry dates; (b) keep its goods within the Premises; (c) set its prices and keep stock, prices and product details up to date on InRaf; (d) remove expired, damaged, recalled or prohibited goods within 48 hours of becoming aware of the problem; (e) follow the shop's reasonable rules on access, safety and conduct notified in advance; (f) pay the amounts due under this Agreement on time; and (g) be responsible for its own taxes, product compliance and obligations to its customers.`,
    `Every product must be approved by the Shop Owner on InRaf before it goes on sale. The Shop Owner will not refuse or withdraw approval unreasonably and will give its reason on InRaf.`);
  add("Maintenance and condition",
    t.maintenance,
    `The Parties record the condition of the Premises with photos on InRaf at the start and the end of the Term. Fair wear and tear is not damage.`);
  add("Risk, liability and insurance",
    t.liability,
    `Each Party is responsible for loss or damage caused by its own negligence, breach of this Agreement or breach of law, and for the acts of its own staff and contractors.`,
    `Neither Party is liable to the other for indirect or consequential loss, or for loss of profit, revenue or goodwill. Apart from amounts payable under clause 4 and liability that cannot be limited by law (including for fraud, wilful misconduct, death or personal injury), each Party's total liability under this Agreement is limited to the total fees paid or payable under it in the 12 months before the claim.`,
    `Each Party is encouraged to carry insurance suitable for its role: the Shop Owner for the premises and public liability, the Token Holder for its goods and product liability.`);
  add(consign ? "Goods, sales, stock and records" : "Sales, stock and records",
    `Ownership of the goods stays with the Token Holder at all times until they are sold to a customer. ${consign ? "The Shop Owner holds them as custodian and has no right to keep them against any claim." : "The Shop Owner has no right to keep the goods against any claim."}`,
    `Deliveries, stock counts, sales, refunds, invoices, payments, requests and incidents relating to the Premises are recorded on InRaf and shown to both Parties as they happen. The Parties agree that these records are the shared record of their dealings under this Agreement.`,
    `A Party who believes a record is wrong must say so through InRaf within ${RECORD_DISPUTE_DAYS} days of the record appearing, with its evidence. Records not disputed within that time are treated as accepted, unless there is fraud or obvious error.`,
    `Either Party may ask for a stock count on InRaf. Differences are investigated in good faith; a loss caused by one Party is borne by that Party under clause 9.`);
  add("Confidentiality and personal data",
    `Each Party will use the other's commercial information (prices, sales, stock and terms) and any personal data it receives only to perform this Agreement, will keep it confidential, and will not share it except with its advisers or as the law requires.`,
    `InRaf processes personal data as described in its Privacy Policy. Each Party remains responsible for its own customers' personal data.`);
  add("Changes to this Agreement",
    `This Agreement can be changed only by a renewal or amendment issued and accepted by both Parties through InRaf. Each accepted version is kept with its date, and earlier versions remain on record.`);
  add("Ending this Agreement",
    `Either Party may end this Agreement early by giving at least ${notice} days' written notice through InRaf. If the Token Holder ends it early, it pays the fees for the notice period${t.monthlyRent > 0 ? ` (pro rata at ${money(t.monthlyRent)} a month)` : ""}; if the Shop Owner ends it early without cause, it refunds any fees paid for the period after the end date and returns the deposit under clause 5.`,
    `Either Party may end this Agreement by written notice through InRaf if the other commits a material breach and does not remedy it within ${CURE_DAYS} days after receiving a notice describing the breach and what is needed to remedy it.`,
    `Either Party may end this Agreement immediately by written notice if the other: sells prohibited, unsafe or counterfeit goods; acts fraudulently; becomes insolvent or stops trading; or becomes subject to sanctions or a legal prohibition that makes performance unlawful.`,
    `InRaf may suspend sales on the Premises, or end this Agreement, where required by law, by a regulator, or to prevent fraud or harm. InRaf will tell both Parties unless the law prevents it.`);
  add("Consequences of ending",
    `When this Agreement ends for any reason: (a) sales on the Premises stop; (b) the Token Holder removes its goods within ${REMOVAL_DAYS} days, by arrangement with the Shop Owner, who will give reasonable access for that purpose; (c) each Party pays what it owes up to the end date, and unpaid future fees are cancelled; (d) the deposit is dealt with under clause 5; and (e) clauses 9, 10, 11, 14, 17, 18 and 19 continue to apply.`,
    `Goods not collected within ${REMOVAL_DAYS} days after a written reminder through InRaf may be stored at the Token Holder's reasonable cost. They will not be sold or destroyed without a further 14 days' written notice, unless they are perishable or unsafe.`);
  add("Breach and remedies",
    `If a Party does not perform an obligation, the other Party will first notify it through InRaf and allow a reasonable time to put it right (at least ${CURE_DAYS} days, unless the matter is urgent or affects safety).`,
    `If an amount due to the Shop Owner is more than ${SERIOUS_ARREARS_DAYS} days overdue and not disputed in good faith, the Shop Owner may, after 7 days' further notice, ask InRaf to suspend sales on the Premises until it is paid, or end this Agreement under clause 13.`,
    `The remedies in this Agreement do not remove any right a Party has under the law, but no Party may recover the same loss twice.`);
  add("Events beyond control",
    `Neither Party is in breach if it is prevented from performing by an event beyond its reasonable control (such as natural disaster, epidemic, fire, flood, war, government action or a prolonged closure of the shop or the area). The affected Party must tell the other promptly through InRaf. Fees for any period in which the Premises cannot be used are suspended. If the event lasts more than 30 days, either Party may end this Agreement by written notice, with no fee for the notice period.`);
  add("Dispute resolution",
    t.dispute,
    `The Parties will first try to settle any dispute in good faith through InRaf within 14 days of one Party notifying the other. InRaf may help the Parties communicate but does not decide disputes. If the dispute is not settled, either Party may refer it to mediation by a mediator both agree, and then to the courts in clause 18. This does not stop a Party seeking urgent relief from a court.`);
  add("Governing law and jurisdiction",
    t.governingLaw ?? `This Agreement is governed by the laws of ${country}, and the competent courts of the city where the shop is located decide disputes not settled under clause 17.`,
    `Nothing in this Agreement limits any right that a Party has under the law and that cannot be limited by agreement.`);
  add("Notices and communication",
    `Notices under this Agreement are given in writing through InRaf, which also sends them to the registered email of the receiving Party. A notice is treated as received on the next business day after it is sent. Each Party will keep its contact details up to date.`);
  add("InRaf's role",
    `InRaf provides the platform on which this Agreement is offered, accepted and recorded, reviews it before it takes effect, and administers invoices, records and notices. InRaf is not a party to this Agreement and does not guarantee either Party's performance. InRaf's Terms of Use apply to each Party's use of the platform. While InRaf's payments are simulated, invoices and receipts are records only and no money moves through InRaf.`);
  add("General",
    `This Agreement, with the offer and the records referred to in it, is the entire agreement between the Parties about the Premises and replaces any earlier discussions. Neither Party may transfer its rights or obligations without the other's written consent, which will not be unreasonably refused. If any part of this Agreement is invalid, the rest continues in force, and the Parties will replace the invalid part with a valid one as close as possible to its purpose. A Party's delay in using a right does not waive it.`,
    `The Parties agree to make and accept this Agreement electronically. Acceptance by typing a full name on InRaf, recorded with the time and the document fingerprint, is intended to be each Party's signature. Whether an electronic signature is enforceable is decided by the applicable law; the Parties should take their own legal advice.`);

  const title = consign ? "Shelf Consignment Agreement" : "Shelf Rental Agreement";
  const text = [title, offerNo, ...letter, ...summary.map(([k, x]) => `${k}: ${x}`), ...L.flatMap((c) => [`${c.n}. ${c.title}`, ...c.paras])].join("\n");
  return { title, offerNo, letter, summary, clauses: L, fingerprint: fingerprintOf(text) };
}
