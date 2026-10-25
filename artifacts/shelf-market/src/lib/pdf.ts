import { jsPDF } from "jspdf";
import type { AuditEntry, Contract, ContractVersion } from "./types";
import { categoryLabel, countryName } from "./data";

/** Generates a real PDF file marked as a non-legal demo document. */
export function downloadContractPdf(c: Contract, v: ContractVersion, audit: AuditEntry[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = 0;
  const stamp = () => {
    doc.setTextColor(214, 90, 60); doc.setFontSize(54); doc.setFont("helvetica", "bold");
    doc.text("DEMO — NOT A LEGAL CONTRACT", W / 2, H / 2, { align: "center", angle: 35 });
    doc.setFontSize(9); doc.text("DEMO — NOT A LEGAL CONTRACT · no legal effect · simulated signatures", W / 2, H - 24, { align: "center" });
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
  line("InRaf — Shelf-use agreement (demo)", 18, true, 8);
  line(`${c.ref} · version ${v.v} (${v.kind}) · status: ${v.status}`, 10);
  line(`Generated ${new Date().toLocaleString()} — demo record only. Tokens are contractual shelf-use demo records, not crypto assets.`, 9);
  const s = v.snapshot;
  head("A. Store and shelf");
  line(`Store: ${s.store.name}, ${s.store.address} (${countryName(s.store.country)})`);
  line(`Registration (demo value): ${s.store.registration} · Owner: ${s.store.ownerName}`);
  line(`Shelf: ${s.shelf.label} · count ${s.shelf.count} · ${s.shelf.spec.widthCm} × ${s.shelf.spec.heightCm} × ${s.shelf.spec.depthCm} cm (W×H×D) · area ${s.shelf.areaCm2} cm² · capacity ${s.shelf.spec.capacity} units`);
  line(`Location: ${s.shelf.floorNote}`);
  line(`Permitted categories: ${s.shelf.categories.map(categoryLabel).join(", ") || "—"} · Restrictions: ${s.shelf.restrictions.join(", ") || "none"}`);
  head("B. Holder");
  line(`${s.holder.name} (${s.holder.kind}) · registration (demo value): ${s.holder.registration}`);
  head("C. Terms");
  const t = s.terms;
  line(`Term: ${t.start} to ${t.end} (${t.months} months) · renewal: ${t.renewal}`);
  line(`Rent: USD ${t.monthlyRent.toFixed(2)} per month, paid monthly, due 5 days after each period start · illustrative tax ${t.taxRate}% · deposit USD ${t.deposit.toFixed(2)}`);
  line(`Late payment: ${t.lateFeePct}% after ${t.graceDays} grace days (illustrative).`);
  line(`Maintenance: ${t.maintenance}`);
  line(`Display & stock: ${t.display}`);
  line(`Liability: ${t.liability}`);
  line(`Disputes: ${t.dispute}`);
  if (v.note) line(`Note: ${v.note}`);
  head("D. Execution record (simulated)");
  const sig = (label: string, x?: { name: string; at: string; via: string }) => line(`${label}: ${x ? `${x.name} — ${new Date(x.at).toLocaleString()} (${x.via})` : "not recorded"}`);
  sig("Platform approval", v.adminApproval); sig("Store owner signature", v.ownerSig); sig("Token holder signature", v.holderSig);
  if (c.terminatedAt) line(`Terminated ${new Date(c.terminatedAt).toLocaleString()}: ${c.terminationReason ?? ""}`);
  head("E. Audit trail");
  audit.slice(-25).forEach((a) => line(`${new Date(a.at).toLocaleString()} · ${a.actor} · ${a.action} · ${a.detail}`, 8, false, 3));
  y += 10;
  line("This document was produced by a browser demo. Typed names are not electronic signatures, nothing here is legally binding, and no tax or legal assurance is given for any jurisdiction.", 8);
  doc.save(`${c.ref}-v${v.v}-DEMO.pdf`);
}
