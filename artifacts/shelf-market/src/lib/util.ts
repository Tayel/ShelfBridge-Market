export const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
export const nowIso = () => new Date().toISOString();
export const today = () => new Date().toISOString().slice(0, 10);
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function addDays(dateIso: string, n: number): string {
  const d = new Date(dateIso.length === 10 ? `${dateIso}T12:00:00Z` : dateIso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function addMonths(dateIso: string, n: number): string {
  const d = new Date(`${dateIso.slice(0, 10)}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}
export const daysUntil = (dateIso: string) =>
  Math.round((new Date(`${dateIso.slice(0, 10)}T12:00:00Z`).getTime() - new Date(`${today()}T12:00:00Z`).getTime()) / 864e5);

export const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
export const fmtDate = (iso?: string) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
export const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

export function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(rows: Record<string, string | number | undefined>[]): string {
  if (rows.length === 0) return "";
  const heads = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === undefined || v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [heads.join(","), ...rows.map((r) => heads.map((h) => esc(r[h])).join(","))].join("\n");
}
