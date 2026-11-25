import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { MailCheck } from "lucide-react";
import { Shell, PrimaryButton, GhostButton } from "@/components/shell";
import { Card, ErrorNote, Field, inputCls } from "@/components/kit";
import { auth, useSession } from "@/lib/store";

/** Email magic-link sign-in: no passwords. We email a one-time link; opening it signs you in and brings you back. */
export default function SignIn() {
  const search = new URLSearchParams(useSearch());
  const next = search.get("next") ?? "/";
  const expired = search.get("expired") === "1";
  const session = useSession();
  const [, go] = useLocation();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(expired ? "That sign-in link has expired or was already used. Ask for a new one." : null);
  const [busy, setBusy] = useState(false);
  const [agree, setAgree] = useState(false);

  if (!session.live) {
    return (
      <Shell title="Sign in" back="/">
        <Card className="mx-auto mt-10 max-w-md p-8 text-center">
          <p className="text-muted-foreground">This copy of InRaf is the browser-only demo, so there are no accounts. Use the “View as” switch to try each side.</p>
        </Card>
      </Shell>
    );
  }

  if (session.me) {
    return (
      <Shell title="Signed in" back="/">
        <Card className="mx-auto mt-10 max-w-md p-8 text-center">
          <p>You're signed in as <b>{session.me.email}</b>.</p>
          <div className="mt-6 flex justify-center gap-2">
            <PrimaryButton onClick={() => go(next)} data-testid="button-continue">Continue</PrimaryButton>
            <GhostButton onClick={() => void auth.logout()} data-testid="button-signout">Sign out</GhostButton>
          </div>
        </Card>
      </Shell>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await auth.requestLink(email, name, next, agree);
      if (r.ok) { setSent(true); setDevLink(r.devLink ?? null); } else setError(r.error ?? "Couldn't send the link.");
    } finally { setBusy(false); }
  };

  return (
    <Shell title="Sign in" back="/">
      <Card className="mx-auto mt-10 max-w-md p-8">
        {sent ? (
          <div className="text-center" data-testid="signin-sent">
            <MailCheck className="mx-auto h-10 w-10 text-primary" />
            <h1 className="font-display mt-3 text-2xl font-bold">Check your email</h1>
            <p className="mt-2 text-muted-foreground">We sent a sign-in link to <b className="text-foreground">{email}</b>. It works once and expires in 15 minutes.</p>
            {devLink && <p className="mt-4 break-all rounded-2xl bg-muted p-3 text-left text-xs">Local development (no email service): <a href={devLink} className="text-primary underline" data-testid="link-dev-signin">open the sign-in link</a></p>}
            <GhostButton className="mt-4" onClick={() => setSent(false)}>Use a different email</GhostButton>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <h1 className="font-display text-2xl font-bold">Sign in to InRaf</h1>
              <p className="mt-1 text-sm text-muted-foreground">No password needed. We'll email you a link. New here? The same link creates your account.</p>
            </div>
            <Field label="Email"><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} data-testid="input-email" /></Field>
            <Field label="Your name" hint="Shown to store owners and makers you deal with. Optional if you already have an account."><input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} data-testid="input-name" /></Field>
            <label className="flex items-start gap-2 text-sm" data-testid="label-agree">
              <input type="checkbox" required checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" data-testid="checkbox-agree" />
              <span>I agree to the <Link href="/terms" className="text-primary underline">Terms</Link> and the <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>.</span>
            </label>
            <ErrorNote error={error} />
            <PrimaryButton type="submit" className="w-full" disabled={busy || !email || !agree} data-testid="button-send-link">{busy ? "Sending…" : "Email me a sign-in link"}</PrimaryButton>
            <p className="text-center text-xs text-muted-foreground">Payments on InRaf are still simulated: no money moves yet. <Link href="/about" className="underline">Who runs InRaf</Link></p>
          </form>
        )}
      </Card>
    </Shell>
  );
}
