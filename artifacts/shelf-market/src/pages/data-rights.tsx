/**
 * /privacy/data-rights — ask InRaf for access to, correction, erasure or a copy of your personal data, or object to
 * how it is used. Each request gets a reference and a response date (one month), tracked by the InRaf team in the
 * admin console. Works signed in or out; signed-in people also see their earlier requests here.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CheckCircle2 } from "lucide-react";
import { Shell, PageTitle, PrimaryButton } from "@/components/shell";
import { Card, ErrorNote, Notice, Pill, inputCls } from "@/components/kit";
import { LIVE, apiRequest, useSession } from "@/lib/store";
import { COMPANY } from "@/lib/legal";
import { fmtDate } from "@/lib/util";

const KINDS = [
  { id: "access", label: "See my data", text: "A copy of the personal data InRaf holds about you and how it is used." },
  { id: "rectification", label: "Correct my data", text: "Fix something that is wrong or incomplete." },
  { id: "erasure", label: "Delete my data", text: "Erase your data. Records the law makes us keep (contracts, invoices, orders) stay until that period ends." },
  { id: "portability", label: "Get a copy to take elsewhere", text: "Your data in a common machine-readable file." },
  { id: "objection", label: "Object or restrict", text: "Stop or limit a particular use of your data." },
] as const;
const STATUS: Record<string, string> = { received: "Received", verifying: "Checking it's you", "in-progress": "In progress", completed: "Answered", refused: "Refused (reason sent)" };

interface Mine { ref: string; kind: string; status: string; createdAt: string; dueAt: string; closedAt: string | null }

export default function DataRights() {
  const { me } = useSession();
  const [kind, setKind] = useState<string>("access");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [details, setDetails] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ref: string; dueAt: string } | null>(null);
  const [mine, setMine] = useState<Mine[]>([]);

  useEffect(() => { if (me?.name) setName((n) => n || me.name); }, [me?.name]);
  const loadMine = () => { if (LIVE && me) void apiRequest<{ requests: Mine[] }>("/privacy/requests").then((r) => setMine(r.requests ?? [])).catch(() => {}); };
  useEffect(loadMine, [me?.id]);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const r = await apiRequest<{ request?: { ref: string; dueAt: string } }>("/privacy/requests", { kind, name, email: me ? undefined : email, details, confirm });
      if (r.ok && r.request) { setDone(r.request); setDetails(""); setConfirm(false); loadMine(); }
      else setError(r.error ?? "Couldn't send the request.");
    } catch { setError("Couldn't reach InRaf. Please try again or email us."); } finally { setBusy(false); }
  };

  return (
    <Shell title="Your data rights" back="/privacy">
      <PageTitle title="Your data rights" sub="Ask to see, correct, delete or take a copy of your personal data, or object to how we use it." />
      <div className="mx-auto mt-6 max-w-2xl space-y-4" data-testid="data-rights">
        {!LIVE && <Notice tone="mute">This demo keeps everything in your browser. On inraf.com this form sends your request to the InRaf team.</Notice>}
        {done ? (
          <Card testId="data-rights-done">
            <p className="flex items-center gap-2 font-display text-xl font-bold"><CheckCircle2 className="h-6 w-6 text-primary" />Request {done.ref} received</p>
            <p className="mt-2 text-sm text-muted-foreground">We will answer by <b className="text-foreground">{fmtDate(done.dueAt)}</b>. We may first ask you to confirm it's you, so we never give your data to someone else. We reply to {me?.email ?? email}.</p>
            <button className="mt-3 text-sm text-primary underline" onClick={() => setDone(null)} data-testid="button-data-rights-another">Make another request</button>
          </Card>
        ) : (
          <Card className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold">What would you like us to do?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {KINDS.map((k) => (
                  <button key={k.id} type="button" onClick={() => setKind(k.id)} aria-pressed={kind === k.id} data-testid={`kind-${k.id}`}
                    className={`rounded-2xl border-2 p-3 text-left transition ${kind === k.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                    <p className="text-sm font-semibold">{k.label}</p><p className="mt-0.5 text-xs text-muted-foreground">{k.text}</p>
                  </button>
                ))}
              </div>
            </div>
            <label className="block text-sm font-medium">Your name<input className={`${inputCls} mt-1`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} data-testid="input-dsr-name" /></label>
            {me ? <p className="text-sm text-muted-foreground">We'll reply to <b className="text-foreground">{me.email}</b>, the email of the account you're signed in with.</p>
              : <label className="block text-sm font-medium">Email we should reply to<input type="email" className={`${inputCls} mt-1`} value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} data-testid="input-dsr-email" />
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">Use the email of your InRaf account if you have one: it helps us find your data and confirm it's you.</span></label>}
            <label className="block text-sm font-medium">Details {kind === "rectification" ? "" : <span className="font-normal text-muted-foreground">(optional)</span>}
              <textarea className={`${inputCls} mt-1 min-h-[96px]`} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={4000} placeholder={kind === "rectification" ? "What is wrong and what it should say" : "Anything that helps us, e.g. which store or order"} data-testid="input-dsr-details" />
            </label>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} data-testid="check-dsr-confirm" />This request is about my own personal data. I understand InRaf may ask me to confirm my identity before answering.</label>
            <ErrorNote error={error} />
            <PrimaryButton disabled={!LIVE || busy || !confirm || !name.trim() || (!me && !email.trim())} onClick={() => void submit()} data-testid="button-dsr-submit">{busy ? "Sending…" : "Send request"}</PrimaryButton>
            <p className="text-xs text-muted-foreground">We answer within one month. If a request is complex we may extend this once by up to two months and will tell you why. You can also write to <a className="underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. See the <Link href="/privacy" className="underline">Privacy Policy</Link> for how we use your data.</p>
          </Card>
        )}
        {mine.length > 0 && (
          <Card testId="data-rights-mine">
            <p className="font-semibold">Your requests</p>
            <div className="mt-2 divide-y divide-border">
              {mine.map((r) => (
                <div key={r.ref} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span className="font-mono text-xs">{r.ref}</span>
                  <span>{KINDS.find((k) => k.id === r.kind)?.label ?? r.kind}</span>
                  <span className="text-xs text-muted-foreground">sent {fmtDate(r.createdAt)}{r.closedAt ? ` · closed ${fmtDate(r.closedAt)}` : ` · answer by ${fmtDate(r.dueAt)}`}</span>
                  <span className="ml-auto"><Pill tone={r.closedAt ? "good" : "mute"}>{STATUS[r.status] ?? r.status}</Pill></span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </Shell>
  );
}
