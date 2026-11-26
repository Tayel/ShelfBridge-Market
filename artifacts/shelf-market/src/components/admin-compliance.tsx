/**
 * Admin console panels for the two controls kept outside the shared marketplace data (server/compliance.ts):
 * data rights requests with their response deadlines, and the MLRO's silent account freeze.
 */
import { useEffect, useState } from "react";
import { RefreshCw, Snowflake } from "lucide-react";
import { Card, Empty, ErrorNote, Notice, Pill, SmallButton, inputCls } from "@/components/kit";
import { apiRequest } from "@/lib/store";
import { daysUntil, downloadBlob, fmtDate, fmtTime, toCsv } from "@/lib/util";

interface DataReq { id: string; ref: string; email: string; name: string; kind: string; details: string; status: string; createdAt: string; dueAt: string; extended: boolean; closedAt: string | null; note: string; updatedBy: string | null; userId: string | null }
interface Account { id: string; email: string; name: string; createdAt: string; lastLoginAt: string | null; frozen: { reason: string; by: string; at: string } | null }

const KIND: Record<string, string> = { access: "Access", rectification: "Correction", erasure: "Erasure", portability: "Copy (portability)", objection: "Objection / restriction" };
const STATUSES = ["received", "verifying", "in-progress", "completed", "refused"];

function useLoad<T>(path: string, key: string) {
  const [data, setData] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => { setError(null); void apiRequest<Record<string, T[]>>(path).then((r) => { if (r.ok) setData(r[key] ?? []); else setError(r.error ?? "Couldn't load."); }).catch(() => setError("Couldn't reach the server.")); };
  useEffect(load, [path]);
  return { data, error, setError, load };
}

export function DataRequestsPanel() {
  const { data, error, setError, load } = useLoad<DataReq>("/admin/data-requests", "requests");
  const [busy, setBusy] = useState(false);
  const save = async (r: DataReq, body: { status?: string; note?: string; extend?: boolean }) => {
    setBusy(true);
    try { const x = await apiRequest(`/admin/data-requests/${r.id}`, body); if (!x.ok) setError(x.error ?? "Couldn't save."); else load(); } finally { setBusy(false); }
  };
  if (!data) return error ? <ErrorNote error={error} /> : <p className="text-sm text-muted-foreground">Loading requests…</p>;
  const open = data.filter((r) => !r.closedAt);
  const overdue = open.filter((r) => daysUntil(r.dueAt) < 0).length;
  return (
    <div className="space-y-3" data-testid="admin-data-requests">
      <Notice tone="mute">Requests from /privacy/data-rights. Confirm the person's identity before sending any data (reply from the account's email, or ask for proof). Deadline: one month from receipt, extendable once by two months with a reason the person is told. Deadlines and exemptions to be confirmed by counsel.</Notice>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Pill>{open.length} open</Pill>{overdue > 0 && <Pill tone="bad">{overdue} overdue</Pill>}
        <span className="ml-auto flex gap-2">
          <SmallButton onClick={load} testId="button-dsr-reload"><RefreshCw className="h-4 w-4" />Reload</SmallButton>
          <SmallButton onClick={() => downloadBlob(`inraf-data-requests-${Date.now()}.csv`, toCsv(data.map((r) => ({ ref: r.ref, kind: r.kind, name: r.name, email: r.email, signedIn: r.userId ? "yes" : "no", status: r.status, received: r.createdAt, due: r.dueAt, extended: r.extended ? "yes" : "no", closed: r.closedAt ?? "", note: r.note, details: r.details }))), "text/csv")} testId="button-dsr-export">Export CSV</SmallButton>
        </span>
      </div>
      <ErrorNote error={error} />
      {data.length === 0 ? <Empty title="No data rights requests yet" /> : data.map((r) => {
        const d = daysUntil(r.dueAt);
        return (
          <Card key={r.id} testId={`row-dsr-${r.ref}`}>
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.ref} · {KIND[r.kind] ?? r.kind} · {r.name}</p>
                <p className="text-xs text-muted-foreground">{r.email}{r.userId ? " · signed in with this account" : " · not signed in: confirm identity"} · received {fmtTime(r.createdAt)}</p>
                {r.details && <p className="mt-1 whitespace-pre-wrap text-sm">{r.details}</p>}
                {r.note && <p className="mt-1 text-xs text-muted-foreground">Note{r.updatedBy ? ` (${r.updatedBy})` : ""}: {r.note}</p>}
              </div>
              <div className="text-right text-xs">
                <Pill tone={r.closedAt ? "good" : d < 0 ? "bad" : d <= 7 ? "warn" : "mute"} testId={`status-dsr-${r.ref}`}>{r.status}</Pill>
                <p className="mt-1 text-muted-foreground">{r.closedAt ? `closed ${fmtDate(r.closedAt)}` : d < 0 ? `${-d} days overdue` : `due ${fmtDate(r.dueAt)} (${d} days)`}{r.extended ? " · extended" : ""}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {STATUSES.filter((s) => s !== r.status).map((s) => (
                <SmallButton key={s} tone={s === "completed" ? "solid" : s === "refused" ? "danger" : "outline"} disabled={busy} testId={`button-dsr-${r.ref}-${s}`}
                  onClick={() => { const note = s === "refused" || s === "completed" ? window.prompt(s === "refused" ? "Reason for refusing (the person must be told)" : "What was sent or done (optional)", r.note) : r.note; if (note !== null) void save(r, { status: s, note: note ?? "" }); }}>
                  {s}
                </SmallButton>
              ))}
              {!r.extended && !r.closedAt && <SmallButton disabled={busy} testId={`button-dsr-${r.ref}-extend`} onClick={() => { const note = window.prompt("Why more time is needed (tell the person)"); if (note) void save(r, { extend: true, note }); }}>Extend 2 months</SmallButton>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function FreezePanel() {
  const { data, error, setError, load } = useLoad<Account>("/admin/accounts", "accounts");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const toggle = async (a: Account) => {
    const on = !a.frozen;
    const reason = window.prompt(on ? `Freeze ${a.email}? Internal reason (never shown to the account):` : `Lift the freeze on ${a.email}? Reason:`);
    if (!reason) return;
    setBusy(true);
    try { const r = await apiRequest("/admin/freeze", { userId: a.id, on, reason }); if (!r.ok) setError(r.error ?? "Couldn't save."); else load(); } finally { setBusy(false); }
  };
  if (!data) return error ? <ErrorNote error={error} /> : <p className="text-sm text-muted-foreground">Loading accounts…</p>;
  const shown = data.filter((a) => !q || `${a.email} ${a.name}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3" data-testid="admin-freezes">
      <Notice tone="mute">MLRO freeze, without tipping off. A frozen account can still sign in and sees its pages as before, but every action it tries fails with the same neutral message as any error, its products stop showing to shoppers, and payouts to it are held. No notice or email is sent. The freeze and its reason go to the audit log, which only the InRaf team sees. Report to the FIU (goAML) from the FinCrime OS.</Notice>
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${inputCls} max-w-xs`} placeholder="Search email or name" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-freeze-search" />
        <Pill tone={data.some((a) => a.frozen) ? "warn" : "mute"}>{data.filter((a) => a.frozen).length} frozen</Pill>
        <SmallButton onClick={load} testId="button-freeze-reload"><RefreshCw className="h-4 w-4" />Reload</SmallButton>
      </div>
      <ErrorNote error={error} />
      {shown.length === 0 ? <Empty title="No accounts match" /> : shown.slice(0, 200).map((a) => (
        <Card key={a.id} className="flex flex-wrap items-center gap-3" testId={`row-account-${a.email}`}>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{a.name || a.email} <span className="text-xs font-normal text-muted-foreground">{a.email}</span></p>
            <p className="text-xs text-muted-foreground">joined {fmtDate(a.createdAt)}{a.lastLoginAt ? ` · last sign-in ${fmtTime(a.lastLoginAt)}` : ""}</p>
            {a.frozen && <p className="mt-1 text-xs text-[hsl(0_70%_45%)]">Frozen {fmtTime(a.frozen.at)} by {a.frozen.by}: {a.frozen.reason}</p>}
          </div>
          {a.frozen && <Pill tone="bad" testId={`status-freeze-${a.email}`}><Snowflake className="mr-1 inline h-3 w-3" />frozen</Pill>}
          <SmallButton tone={a.frozen ? "outline" : "danger"} disabled={busy} onClick={() => void toggle(a)} testId={`button-freeze-${a.email}`}>{a.frozen ? "Lift freeze" : "Freeze"}</SmallButton>
        </Card>
      ))}
    </div>
  );
}
