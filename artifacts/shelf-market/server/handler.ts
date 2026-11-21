/**
 * The InRaf API. Runs as one Vercel function in production (api/handler.js) and inside the Vite dev server
 * locally (vite.config.ts), so both use exactly the same code.
 *
 *   GET  /api/health                  database reachable?
 *   GET  /api/me                      the signed-in account, or null
 *   POST /api/auth/request            { email, name?, next? } → emails a sign-in link
 *   GET  /api/auth/verify?token=…     opens a sign-in link, sets the session cookie, redirects
 *   POST /api/auth/logout
 *   POST /api/me/name                 { name }
 *   GET  /api/state                   the marketplace as this person may see it
 *   POST /api/actions/:name           { args: [...] } → applies one action, returns the new view
 *   GET  /api/compliance/feed         the full compliance feed for the In-Raf FinCrime OS (server to server,
 *                                     Authorization: Bearer $COMPLIANCE_FEED_TOKEN)
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { buildComplianceFeed } from "../src/lib/feed";
import { DemoError } from "../src/lib/ops";
import { HttpError, changeState, databaseUrl, logAction, q, readState } from "./db";
import { type Me, appOrigin, currentUser, logout, requestLink, updateName, verifyLink, visitorId } from "./auth";
import { type Actor, applyAction, ensureHolder } from "./policy";
import { viewFor } from "./view";

type Req = IncomingMessage & { body?: unknown };

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

async function readBody(req: Req): Promise<Record<string, unknown>> {
  if (req.body !== undefined) return typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body as Record<string, unknown>) ?? {};
  const chunks: Buffer[] = []; let size = 0;
  for await (const c of req) { size += (c as Buffer).length; if (size > 3_500_000) throw new HttpError(413, "Request too large."); chunks.push(c as Buffer); }
  const text = Buffer.concat(chunks).toString("utf8");
  try { return text ? JSON.parse(text) : {}; } catch { throw new HttpError(400, "Invalid JSON."); }
}

/** Writes must come from our own pages: JSON only, and from our own origin when the browser says where it's from. */
function checkWrite(req: Req) {
  if (!String(req.headers["content-type"] ?? "").includes("application/json")) throw new HttpError(415, "Send JSON.");
  const origin = req.headers.origin;
  if (origin && origin !== appOrigin(req)) throw new HttpError(403, "Cross-site request blocked.");
}

async function savedOf(me: Me | null) {
  if (!me) return [];
  const r = await q<{ shop_id: string }>("select shop_id from saved_shops where user_id = $1 order by created_at", [me.id]);
  return r.rows.map((x) => x.shop_id);
}

/** The FinCrime OS reads the whole marketplace with a shared key, never with a browser session. */
function checkFeedKey(req: Req) {
  const want = process.env.COMPLIANCE_FEED_TOKEN ?? "";
  if (want.length < 24) throw new HttpError(503, "The compliance feed isn't set up on this server (COMPLIANCE_FEED_TOKEN).");
  const got = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  const h = (x: string) => createHash("sha256").update(x).digest();
  if (!got || !timingSafeEqual(h(got), h(want))) throw new HttpError(401, "Wrong or missing compliance feed key.");
}

const meJson = (me: Me | null) => (me ? { id: me.id, email: me.email, name: me.name, isAdmin: me.isAdmin, holderId: me.holderId } : null);

export default async function handler(req: Req, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://x");
  const path = (url.searchParams.get("route") ? `/api/${url.searchParams.get("route")}` : url.pathname).replace(/\/+$/, "");
  const method = req.method ?? "GET";
  try {
    if (path === "/api/health") {
      if (!databaseUrl()) return send(res, 200, { ok: true, database: false });
      await q("select 1");
      return send(res, 200, { ok: true, database: true });
    }
    if (path === "/api/compliance/feed" && method === "GET") {
      checkFeedKey(req);
      return send(res, 200, buildComplianceFeed(await readState(), { live: true }));
    }
    if (path === "/api/auth/verify" && method === "GET") {
      const r = await verifyLink(req, res, url.searchParams.get("token") ?? "");
      res.statusCode = 302;
      res.setHeader("Location", r.ok ? r.next : "/signin?expired=1");
      return res.end();
    }

    const principalVisitor = visitorId(req, res);
    const me = await currentUser(req);
    const actor: Actor = { me, principal: me ? `u:${me.id}` : `v:${principalVisitor}` };

    if (path === "/api/me" && method === "GET") return send(res, 200, { me: meJson(me) });
    if (path === "/api/auth/request" && method === "POST") { checkWrite(req); return send(res, 200, await requestLink(req, await readBody(req))); }
    if (path === "/api/auth/logout" && method === "POST") { checkWrite(req); await logout(req, res); return send(res, 200, { ok: true }); }
    if (path === "/api/me/name" && method === "POST") {
      checkWrite(req);
      if (!me) throw new HttpError(401, "Sign in to continue.", "auth");
      const name = await updateName(me, String((await readBody(req)).name ?? ""));
      await changeState((s) => { const h = s.holders.find((x) => x.id === me.holderId); if (h) h.name = name; });
      return send(res, 200, { me: meJson({ ...me, name }) });
    }
    if (path === "/api/state" && method === "GET") {
      const [s, saved] = await Promise.all([readState(), savedOf(me)]);
      return send(res, 200, { me: meJson(me), state: viewFor(s, me, actor.principal, saved) });
    }
    const m = path.match(/^\/api\/actions\/([A-Za-z]+)$/);
    if (m && method === "POST") {
      checkWrite(req);
      const name = m[1];
      const body = await readBody(req);
      if (name === "toggleSaved") {
        if (!me) throw new HttpError(401, "Sign in to save stores.", "auth");
        const shopId = String((body.args as unknown[])?.[0] ?? "");
        const del = await q("delete from saved_shops where user_id = $1 and shop_id = $2", [me.id, shopId]);
        if (!del.rowCount) await q("insert into saved_shops (user_id, shop_id) values ($1, $2) on conflict do nothing", [me.id, shopId]);
        const [s, saved] = await Promise.all([readState(), savedOf(me)]);
        return send(res, 200, { ok: true, state: viewFor(s, me, actor.principal, saved) });
      }
      try {
        const { result, state } = await changeState((s) => { if (me) ensureHolder(s, me); return applyAction(s, name, body.args, actor); });
        await logAction(me?.email ?? actor.principal, name, true);
        return send(res, 200, { ok: true, id: result, state: viewFor(state, me, actor.principal, await savedOf(me)) });
      } catch (e) {
        if (e instanceof DemoError) { await logAction(me?.email ?? actor.principal, name, false, e.message); return send(res, 200, { ok: false, error: e.message }); }
        throw e;
      }
    }
    throw new HttpError(404, "Not found.");
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { ok: false, error: e.message, code: e.code });
    console.error("[api]", e);
    return send(res, 500, { ok: false, error: "Something went wrong on our side. Please try again." });
  }
}
