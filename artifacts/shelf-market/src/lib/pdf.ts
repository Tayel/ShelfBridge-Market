import { jsPDF } from "jspdf";
import type { AuditEntry, Contract, ContractVersion } from "./types";
import { countryName } from "./data";
import { buildAgreement, longDate } from "./agreement";

const LIVE = import.meta.env.VITE_BACKEND === "api";

/** The Rental Offer and Agreement as a PDF, from the same text the parties see on InRaf (demo copies are watermarked). */
export function downloadContractPdf(c: Contract, v: ContractVersion, audit: AuditEntry[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = 0;
  const stamp = () => {
    if (LIVE) { doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(120, 110, 105); doc.text(`InRaf · ${c.ref} v${v.v} · page ${doc.getNumberOfPages()}`, W / 2, H - 24, { align: "center" }); doc.setTextColor(40, 30, 25); return; }
    doc.setTextColor(214, 90, 60); doc.setFontSize(54); doc.setFont("helvetica", "bold");
    doc.text(LIVE ? "TEMPLATE — NOT A LEGAL CONTRACT" : "DEMO — NOT A LEGAL CONTRACT", W / 2, H / 2, { align: "center", angle: 35 });
    doc.setFontSize(9); doc.text(LIVE ? "TEMPLATE — NOT A LEGAL CONTRACT · no legal effect · typed signatures" : "DEMO — NOT A LEGAL CONTRACT · no legal effect · simulated signatures", W / 2, H - 24, { align: "center" });
    doc.setTextColor(40, 30, 25);
  };
  const newPage = () => { doc.addPage(); stamp(); y = 56; };
  const line = (txt: string, size = 10, bold = false, gap = 4) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size);
    const rows = doc.splitTextToSize(txt, W - 112) as string[];
    rows.forEach((r) => { if (y > H - 60) newPage(); doc.text(r, 56, y); y += size + gap; });
  };
  const head = (t: string) => { y += 8; line(t, 12, true, 6); };

  stamp(); y = 56;
  const ag = buildAgreement(c, v);
  const s = v.snapshot;
  line(`${LIVE ? "" : "DEMO · "}Rental Offer ${ag.offerNo}`, 18, true, 8);
  line(`${ag.title} · ${c.ref} version ${v.v} (${v.kind}) · status: ${v.status}`, 10);
  line(`From: ${s.store.ownerName}, for ${s.store.name}, ${s.store.address}, ${countryName(s.store.country)}`, 10);
  line(`To: ${s.holder.name}`, 10, true);
  line(`Date of offer: ${v.offer ? longDate(v.offer.issuedAt) : "not yet issued"} · Open for acceptance until: ${v.offer ? longDate(v.offer.validUntil) : "—"}`, 10);
  y += 6;
  ag.letter.forEach((p) => line(p, 10, false, 5));
  line(`Yours faithfully, ${s.store.ownerName}, for ${s.store.name}`, 10);
  head("Key terms");
  ag.summary.forEach(([k, x]) => line(`${k}: ${x}`, 9, false, 3));
  head(ag.title);
  ag.clauses.forEach((cl) => { y += 4; line(`${cl.n}. ${cl.title}`, 10, true, 4); cl.paras.forEach((p, i) => line(`${cl.n}.${i + 1}  ${p}`, 9, false, 3)); });
  if (v.note) { head("Note on this version"); line(v.note); }
  head("Execution");
  const sig = (label: string, x?: { name: string; at: string; via: string }) => line(`${label}: ${x ? `${x.name} — ${new Date(x.at).toLocaleString()} (${x.via === "ui" ? "typed name on InRaf" : x.via})` : "not recorded"}`);
  sig("Offer issued by the Shop Owner", v.ownerSig); sig("Reviewed by InRaf", v.adminApproval); sig("Accepted by the Token Holder", v.holderSig);
  line(`Document fingerprint: ${ag.fingerprint}${v.offer ? ` · as offered: ${v.offer.fingerprint}` : ""}${v.acceptance ? ` · as accepted: ${v.acceptance.fingerprint}` : ""}`, 9);
  if (v.acceptance?.confirmedAt) line(`Confirmation of acceptance sent to both parties on ${new Date(v.acceptance.confirmedAt).toLocaleString()}.`, 9);
  if (c.terminatedAt) line(`Ended ${new Date(c.terminatedAt).toLocaleString()}: ${c.terminationReason ?? ""}`);
  head("Record of events");
  audit.slice(-25).forEach((a) => line(`${new Date(a.at).toLocaleString()} · ${a.actor} · ${a.action} · ${a.detail}`, 8, false, 3));
  y += 10;
  line(LIVE ? "Produced on InRaf from its standard agreement template. This is not legal advice; the enforceability of electronic acceptance depends on the applicable law. Payments on InRaf are currently simulated." : "Produced by a browser demo. Typed names are not signatures and nothing here is legally binding.", 8);
  doc.save(`${c.ref}-v${v.v}${LIVE ? "" : "-DEMO"}.pdf`);
}
