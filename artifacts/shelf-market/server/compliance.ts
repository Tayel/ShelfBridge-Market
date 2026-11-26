/**
 * Two compliance controls that live outside the shared marketplace document, so no account can ever see them
 * through /api/state:
 *
 *  - Data rights requests (ADGM DPR 2021 and the other privacy laws in the Privacy Policy): anyone can ask for
 *    access, correction, erasure, a copy or an objection at /privacy/data-rights. Each request gets a reference and
 *    a response deadline (one month from receipt; counsel to confirm), which the InRaf team tracks in the admin console.
 *
 *  - Account freezes for the MLRO: a frozen account can still sign in and look around, but every action it tries
 *    fails with the same neutral message any failure gets, its products stop selling to others, and payouts to it
 *    are held. Nothing is sent to the account and its own view doesn't change, so it isn't tipped off.
 */
import type { IncomingMessage } from "node:http";
import { HttpError, q } from "./db";
import type { Me } from "./auth";

const SCHEMA = `
create table if not exists data_requests (
  id bigserial primary key, ref text unique, user_id text, email text not null, name text not null default '',
  kind text not null, details text not null default '', status text not null default 'received', ip text,
  created_at timestamptz not null default now(), due_at timestamptz not null, extended boolean not null default false,
  closed_at timestamptz, note text not null default '', updated_by text
);
create index if not exists data_requests_ip_idx on data_requests (ip, created_at);
create table if not exists account_freezes (
  user_id text primary key references users(id) on delete cascade, reason text not null, frozen_by text not null,
  frozen_at timestamptz not null default now()
);
`;
let made: Promise<unknown> | null = null;
const ready = () => (made ??= q(SCHEMA).catch((e) => { made = null; throw e; }));

// ---------------------------------------------------------------- data rights

export const DATA_REQUEST_KINDS = ["access", "rectification", "erasure", "portability", "objection"] as const;
export type DataRequestKind = (typeof DATA_REQUEST_KINDS)[number];
export const DATA_REQUEST_STATUSES = ["received", "verifying", "in-progress", "completed", "refused"] as const;
/** One month to answer (ADGM DPR 2021; to be confirmed by counsel), extendable once by two months with a reason. */
const RESPONSE_DAYS = 30;
const EXTENSION_DAYS = 60;

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const ipOf = (req: IncomingMessage) => String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").split(",")[0].trim().slice(0, 64);

interface Row { id: string; ref: string; user_id: string | null; email: string; name: string; kind: string; details: string; status: string; created_at: string; due_at: string; extended: boolean; closed_at: string | null; note: string; updated_by: string | null }
const pub = (r: Row) => ({ id: String(r.id), ref: r.ref, email: r.email, name: r.name, kind: r.kind, details: r.details, status: r.status, createdAt: r.created_at, dueAt: r.due_at, extended: r.extended, closedAt: r.closed_at, note: r.note, updatedBy: r.updated_by, userId: r.user_id });

export async function submitDataRequest(req: IncomingMessage, me: Me | null, body: Record<string, unknown>) {
  await ready();
  const kind = String(body.kind ?? "") as DataRequestKind;
  if (!DATA_REQUEST_KINDS.includes(kind)) throw new HttpError(400, "Choose what you'd like us to do.");
  const email = (me?.email ?? String(body.email ?? "")).trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "Enter a valid email address so we can reply.");
  const name = String(body.name ?? me?.name ?? "").trim().slice(0, 120);
  if (!name) throw new HttpError(400, "Enter your name.");
  const details = String(body.details ?? "").trim().slice(0, 4000);
  if (kind === "rectification" && !details) throw new HttpError(400, "Tell us what should be corrected.");
  if (body.confirm !== true) throw new HttpError(400, "Please confirm the request is about your own data.");
  const ip = ipOf(req);
  const recent = await q<{ n: string }>("select count(*) as n from data_requests where ip = $1 and created_at > now() - interval '1 hour'", [ip]);
  if (Number(recent.rows[0].n) >= 5) throw new HttpError(429, "Too many requests from here. Please try again later or email us.");
  const r = await q<Row>(
    `insert into data_requests (user_id, email, name, kind, details, ip, due_at) values ($1, $2, $3, $4, $5, $6, now() + interval '${RESPONSE_DAYS} days') returning *`,
    [me?.id ?? null, email, name, kind, details, ip]);
  const ref = `DSR-${String(r.rows[0].id).padStart(5, "0")}`;
  await q("update data_requests set ref = $1 where id = $2", [ref, r.rows[0].id]);
  return { ok: true as const, request: { ...pub(r.rows[0]), ref } };
}

/** The signed-in person's own requests, so they can follow them. */
export async function myDataRequests(me: Me) {
  await ready();
  const r = await q<Row>("select * from data_requests where user_id = $1 or email = $2 order by created_at desc limit 50", [me.id, me.email.toLowerCase()]);
  return r.rows.map((x) => { const p = pub(x); return { ref: p.ref, kind: p.kind, status: p.status, createdAt: p.createdAt, dueAt: p.dueAt, closedAt: p.closedAt }; });
}

export async function listDataRequests() {
  await ready();
  const r = await q<Row>("select * from data_requests order by (closed_at is null) desc, due_at asc limit 500");
  return r.rows.map(pub);
}

export async function updateDataRequest(me: Me, id: string, body: Record<string, unknown>) {
  await ready();
  const cur = (await q<Row>("select * from data_requests where id = $1", [id])).rows[0];
  if (!cur) throw new HttpError(404, "Request not found.");
  const status = body.status === undefined ? cur.status : String(body.status);
  if (!(DATA_REQUEST_STATUSES as readonly string[]).includes(status)) throw new HttpError(400, "Invalid status.");
  const note = body.note === undefined ? cur.note : String(body.note).trim().slice(0, 2000);
  const closing = status === "completed" || status === "refused";
  if (status === "refused" && !note) throw new HttpError(400, "Record why the request is refused.");
  const extend = body.extend === true;
  if (extend && cur.extended) throw new HttpError(400, "This request has already been extended once.");
  if (extend && !note) throw new HttpError(400, "Record why more time is needed (the person must be told).");
  const r = await q<Row>(
    `update data_requests set status = $2, note = $3, updated_by = $4,
       closed_at = case when $5 then coalesce(closed_at, now()) else null end,
       extended = extended or $6, due_at = case when $6 then due_at + interval '${EXTENSION_DAYS} days' else due_at end
     where id = $1 returning *`, [id, status, note, me.email, closing, extend]);
  return pub(r.rows[0]);
}

// ---------------------------------------------------------------- MLRO account freeze

/** Same words as any other failure, so a frozen account can't tell it has been frozen. */
export const NEUTRAL_REFUSAL = "We couldn't complete that just now. Please try again later or contact support.";
/** Actions a frozen account may still take: they change nothing that matters to anyone else. */
export const ALLOWED_WHILE_FROZEN = new Set(["markRead", "toggleSaved"]);

export async function frozenUserIds(): Promise<Set<string>> {
  await ready();
  const r = await q<{ user_id: string }>("select user_id from account_freezes");
  return new Set(r.rows.map((x) => x.user_id));
}

export async function listAccounts() {
  await ready();
  const r = await q<{ id: string; email: string; name: string; created_at: string; last_login_at: string | null; reason: string | null; frozen_by: string | null; frozen_at: string | null }>(
    `select u.id, u.email, u.name, u.created_at, u.last_login_at, f.reason, f.frozen_by, f.frozen_at
       from users u left join account_freezes f on f.user_id = u.id order by (f.user_id is null), u.created_at desc limit 1000`);
  return r.rows.map((x) => ({ id: x.id, email: x.email, name: x.name, createdAt: x.created_at, lastLoginAt: x.last_login_at, frozen: x.frozen_at ? { reason: x.reason!, by: x.frozen_by!, at: x.frozen_at } : null }));
}

export async function setFreeze(me: Me, userId: string, on: boolean, reason: string) {
  await ready();
  const u = (await q<{ id: string; email: string }>("select id, email from users where id = $1", [userId])).rows[0];
  if (!u) throw new HttpError(404, "Account not found.");
  if (u.id === me.id) throw new HttpError(400, "You can't freeze your own account.");
  const why = reason.trim().slice(0, 500);
  if (!why) throw new HttpError(400, on ? "Record the reason for the freeze (kept internal)." : "Record why the freeze is lifted.");
  if (on) await q("insert into account_freezes (user_id, reason, frozen_by) values ($1, $2, $3) on conflict (user_id) do update set reason = excluded.reason, frozen_by = excluded.frozen_by, frozen_at = now()", [u.id, why, me.email]);
  else await q("delete from account_freezes where user_id = $1", [u.id]);
  return { email: u.email, reason: why };
}
