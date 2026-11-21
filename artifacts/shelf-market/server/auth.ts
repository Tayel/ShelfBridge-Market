/**
 * Email magic-link sign-in. No passwords: we email a one-time link (valid 15 minutes, usable once); opening it
 * creates the account if needed and starts a 30-day session held in an HttpOnly cookie. Only hashes of
 * links and sessions are stored, so a database leak can't be used to sign in.
 */
import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { HttpError, q } from "./db";

export interface Me { id: string; email: string; name: string; isAdmin: boolean; holderId: string }

const SESSION_COOKIE = "inraf_session";
const VISITOR_COOKIE = "inraf_vid";
const SESSION_DAYS = 30;
const LINK_MINUTES = 15;

const isProd = () => process.env.NODE_ENV === "production" || !!process.env.VERCEL_ENV;
const token = () => crypto.randomBytes(32).toString("base64url");
const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
export const holderIdOf = (userId: string) => `h-u-${userId}`;
export const userIdOfHolder = (holderId: string) => (holderId.startsWith("h-u-") ? holderId.slice(4) : null);

function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

/** The site's own address. In production it must come from APP_URL, never from the request's Host header. */
export function appOrigin(req: IncomingMessage) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  if (isProd()) throw new HttpError(503, "APP_URL is not configured on the server.");
  const proto = (req.headers["x-forwarded-proto"] as string) || "http";
  return `${proto}://${req.headers.host}`;
}

export function cookies(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function setCookie(res: ServerResponse, req: IncomingMessage, name: string, value: string, maxAgeSec: number) {
  const secure = isProd() || req.headers["x-forwarded-proto"] === "https";
  const c = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure ? "; Secure" : ""}`;
  const prev = res.getHeader("Set-Cookie");
  res.setHeader("Set-Cookie", [...(Array.isArray(prev) ? prev : prev ? [String(prev)] : []), c]);
}

/** A stable anonymous id for shoppers who aren't signed in, so they can see and refund their own orders. */
export function visitorId(req: IncomingMessage, res: ServerResponse) {
  const existing = cookies(req)[VISITOR_COOKIE];
  if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;
  const v = crypto.randomBytes(16).toString("base64url");
  setCookie(res, req, VISITOR_COOKIE, v, 365 * 86400);
  return v;
}

export async function currentUser(req: IncomingMessage): Promise<Me | null> {
  const raw = cookies(req)[SESSION_COOKIE];
  if (!raw) return null;
  const r = await q<{ id: string; email: string; name: string }>(
    "select u.id, u.email, u.name from sessions s join users u on u.id = s.user_id where s.id_hash = $1 and s.expires_at > now()",
    [hash(raw)],
  );
  const u = r.rows[0];
  if (!u) return null;
  return { ...u, isAdmin: adminEmails().includes(u.email.toLowerCase()), holderId: holderIdOf(u.id) };
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const safeNext = (n: unknown) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") && n.length < 300 ? n : "/");

async function sendEmail(to: string, link: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.EMAIL_FROM || "InRaf <login@inraf.com>";
  const text = `Sign in to InRaf:\n\n${link}\n\nThis link works once and expires in ${LINK_MINUTES} minutes. If you didn't ask for it, ignore this email.`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#1f1a17">
    <p>Tap the button to sign in to InRaf.</p>
    <p><a href="${link}" style="display:inline-block;background:#d0532f;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600">Sign in to InRaf</a></p>
    <p style="color:#6b625c;font-size:14px">This link works once and expires in ${LINK_MINUTES} minutes. If you didn't ask for it, you can ignore this email.</p></div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: "Your InRaf sign-in link", text, html }),
  });
  if (!r.ok) throw new HttpError(502, "We couldn't send the email just now. Try again in a minute.");
  return true;
}

/** Email a sign-in link. In local development without an email key, the link is returned for testing. */
export async function requestLink(req: IncomingMessage, body: { email?: unknown; name?: unknown; next?: unknown }) {
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "Enter a valid email address.");
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const ip = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").split(",")[0].trim().slice(0, 64);
  const recent = await q<{ by_email: string; by_ip: string }>(
    `select count(*) filter (where email = $1) as by_email, count(*) filter (where ip = $2) as by_ip
       from login_tokens where created_at > now() - interval '1 hour'`, [email, ip]);
  if (Number(recent.rows[0].by_email) >= 5 || Number(recent.rows[0].by_ip) >= 20) {
    throw new HttpError(429, "Too many sign-in emails. Wait a little and try again.");
  }
  const t = token();
  await q(
    `insert into login_tokens (token_hash, email, name, next, ip, expires_at) values ($1, $2, $3, $4, $5, now() + interval '${LINK_MINUTES} minutes')`,
    [hash(t), email, name || null, safeNext(body.next), ip],
  );
  const link = `${appOrigin(req)}/api/auth/verify?token=${t}`;
  const sent = await sendEmail(email, link);
  if (sent) return { ok: true as const };
  if (isProd()) throw new HttpError(503, "Sign-in email isn't set up on the server yet (RESEND_API_KEY).");
  console.log(`[auth] sign-in link for ${email}: ${link}`);
  return { ok: true as const, devLink: link };
}

/** Open a sign-in link: one use only, then a session cookie and a redirect to where the person was going. */
export async function verifyLink(req: IncomingMessage, res: ServerResponse, raw: string) {
  const r = await q<{ email: string; name: string | null; next: string }>(
    `update login_tokens set used_at = now()
      where token_hash = $1 and used_at is null and expires_at > now()
      returning email, name, next`, [hash(raw)]);
  const row = r.rows[0];
  if (!row) return { ok: false as const };
  const u = await q<{ id: string }>(
    `insert into users (id, email, name, last_login_at) values ($1, $2, coalesce($3, ''), now())
     on conflict (email) do update set last_login_at = now(),
       name = case when users.name = '' and excluded.name <> '' then excluded.name else users.name end
     returning id`, [crypto.randomUUID(), row.email, row.name]);
  const s = token();
  await q(`insert into sessions (id_hash, user_id, expires_at) values ($1, $2, now() + interval '${SESSION_DAYS} days')`, [hash(s), u.rows[0].id]);
  setCookie(res, req, SESSION_COOKIE, s, SESSION_DAYS * 86400);
  return { ok: true as const, next: safeNext(row.next) };
}

export async function logout(req: IncomingMessage, res: ServerResponse) {
  const raw = cookies(req)[SESSION_COOKIE];
  if (raw) await q("delete from sessions where id_hash = $1", [hash(raw)]);
  setCookie(res, req, SESSION_COOKIE, "", 0);
}

export async function updateName(me: Me, name: string) {
  const n = name.trim().slice(0, 80);
  if (!n) throw new HttpError(400, "Enter your name.");
  await q("update users set name = $1 where id = $2", [n, me.id]);
  return n;
}
