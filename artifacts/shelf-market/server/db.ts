/**
 * Postgres access for the live backend. One shared marketplace document (the same State the browser demo
 * used) is stored in `app_state` and changed only inside a transaction that locks its row, so two people
 * acting at once can never overwrite each other. Accounts, sign-in links, sessions and saved stores have
 * their own tables.
 */
import pg from "pg";
import type { State } from "../src/lib/types";
import { seedState } from "../src/lib/seed";
import { normalize } from "../src/lib/state";
import { nowIso } from "../src/lib/util";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

let pool: pg.Pool | null = null;
let migrated: Promise<void> | null = null;

export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

function getPool() {
  const url = databaseUrl();
  if (!url) throw new HttpError(503, "The server has no database configured yet.");
  pool ??= new pg.Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10_000 });
  return pool;
}

const SCHEMA = `
create table if not exists users (
  id text primary key, email text unique not null, name text not null default '',
  created_at timestamptz not null default now(), last_login_at timestamptz
);
create table if not exists login_tokens (
  token_hash text primary key, email text not null, name text, next text, ip text,
  created_at timestamptz not null default now(), expires_at timestamptz not null, used_at timestamptz
);
create index if not exists login_tokens_email_idx on login_tokens (email, created_at);
create index if not exists login_tokens_ip_idx on login_tokens (ip, created_at);
create table if not exists sessions (
  id_hash text primary key, user_id text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(), expires_at timestamptz not null
);
create table if not exists saved_shops (
  user_id text not null references users(id) on delete cascade, shop_id text not null,
  created_at timestamptz not null default now(), primary key (user_id, shop_id)
);
create table if not exists app_state (
  id int primary key, data jsonb not null, version bigint not null default 1, updated_at timestamptz not null default now()
);
create table if not exists action_log (
  id bigserial primary key, at timestamptz not null default now(), actor text not null, action text not null,
  ok boolean not null, error text
);
`;

/** Create the tables once per server process (an advisory lock keeps two cold starts from racing). */
export function ready() {
  migrated ??= (async () => {
    const c = await getPool().connect();
    try {
      await c.query("select pg_advisory_lock(7310)");
      await c.query(SCHEMA);
    } finally {
      await c.query("select pg_advisory_unlock(7310)").catch(() => {});
      c.release();
    }
  })().catch((e) => { migrated = null; throw e; });
  return migrated;
}

export async function q<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values: unknown[] = []) {
  await ready();
  return getPool().query<T>(text, values);
}

function freshState(): State {
  const s = seedState();
  s.offersSeeded = s.airportsSeeded = nowIso();
  return s;
}

/** The marketplace as it is now (seeded with the sample stores the first time). */
export async function readState(): Promise<State> {
  const r = await q<{ data: State }>("select data from app_state where id = 1");
  if (r.rows[0]) return normalize(r.rows[0].data);
  await q("insert into app_state (id, data) values (1, $1) on conflict (id) do nothing", [JSON.stringify(freshState())]);
  return readState();
}

/** Change the marketplace under a row lock. `fn` mutates the draft; throwing rolls everything back. */
export async function changeState<T>(fn: (draft: State) => T): Promise<{ result: T; state: State }> {
  await readState(); // make sure the row exists
  const c = await getPool().connect();
  try {
    await c.query("begin");
    const r = await c.query<{ data: State }>("select data from app_state where id = 1 for update");
    const draft = normalize(r.rows[0].data);
    const result = fn(draft);
    await c.query("update app_state set data = $1, version = version + 1, updated_at = now() where id = 1", [JSON.stringify(draft)]);
    await c.query("commit");
    return { result, state: draft };
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

export async function logAction(actor: string, action: string, ok: boolean, error?: string) {
  await q("insert into action_log (actor, action, ok, error) values ($1, $2, $3, $4)", [actor, action, ok, error ?? null]).catch(() => {});
}
