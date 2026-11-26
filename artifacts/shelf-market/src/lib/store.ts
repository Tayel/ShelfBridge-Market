/**
 * The marketplace store, in one of two modes (chosen at build time by VITE_BACKEND):
 * - "api" (live): the shared marketplace lives on the server (server/handler.ts). The page loads the part
 *   this person may see, refreshes it every 20 s and on focus, and sends each action to the server, which
 *   checks permissions and applies it.
 * - otherwise, the browser-only demo (localStorage): every phone or browser has its own copy, nothing is shared.
 */
import { useSyncExternalStore } from "react";
import type { Result, Role, State } from "./types";
import { emptyState } from "./seed";
import { DemoError, YOU_HOLDER } from "./ops";
import { seedOffers, seedState } from "./seed";
import { normalize, migrateV1 } from "./state";
import { nowIso, today } from "./util";

export type { Shop, Token, State } from "./types";
export { usd } from "./util";
export { slotsOf, takenSlots } from "./selectors";

const KEY = "inraf-demo-v2";
const V1_KEY = "shelf-demo-v1"; // read for migration; never deleted

/** Saves from before the special offers existed get their sample stock once, without new unread notices. */
function withOffers(s: State): State {
  if (s.offersSeeded && s.airportsSeeded) return s;
  const known = new Set(s.notifications.map((n) => n.id));
  seedOffers(s);
  s.notifications.forEach((n) => { if (!known.has(n.id)) n.read = true; });
  s.offersSeeded = s.offersSeeded ?? nowIso();
  s.airportsSeeded = nowIso();
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return withOffers(normalize(JSON.parse(raw)));
    const old = localStorage.getItem(V1_KEY);
    if (old) {
      const s = migrateV1(JSON.parse(old));
      localStorage.setItem(KEY, JSON.stringify(s));
      return s;
    }
  } catch { /* fall through to seed */ }
  const s = seedState();
  s.offersSeeded = s.airportsSeeded = nowIso();
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
  return s;
}

export const LIVE = import.meta.env.VITE_BACKEND === "api";

let state: State = LIVE ? emptyState() : load();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try { state = normalize(JSON.parse(e.newValue)); emit(); } catch { /* ignore malformed */ }
  });
}

function readLatest(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return withOffers(normalize(JSON.parse(raw)));
  } catch { /* use memory */ }
  return state;
}

let busy = false;
/** Apply a guarded mutation against the latest saved state. Errors are returned, never thrown. */
export function run(fn: (draft: State) => string | void): Result {
  if (busy) return { ok: false, error: "Another action is still being applied. Try again." };
  busy = true;
  try {
    const draft: State = JSON.parse(JSON.stringify(readLatest()));
    const id = fn(draft);
    try { localStorage.setItem(KEY, JSON.stringify(draft)); }
    catch { return { ok: false, error: "Browser storage is full or blocked — the change was not saved." }; }
    state = draft; emit();
    return { ok: true, id: id || undefined };
  } catch (e) {
    return { ok: false, error: e instanceof DemoError ? e.message : `Unexpected error: ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    busy = false;
  }
}

// ---------------------------------------------------------------- live mode (shared server)

export interface Me { id: string; email: string; name: string; isAdmin: boolean; holderId: string }
export type ApiResult = Result & { code?: string };

const ROLE_KEY = "inraf-view-role";
const roles: Role[] = ["owner", "holder", "customer", "admin"];
const storedRole = (): Role => { try { const r = localStorage.getItem(ROLE_KEY) as Role; return roles.includes(r) ? r : "holder"; } catch { return "holder"; } };
let me: Me | null = null;
let loaded = !LIVE;
let loadError: string | null = null;
let everLoaded = false; // after the first good load, a failed refresh keeps showing the last copy
const base = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Plain JSON call to the InRaf API (for endpoints outside the shared marketplace data). */
export async function apiRequest<T>(path: string, body?: unknown): Promise<T & { ok?: boolean; error?: string; code?: string }> {
  return api<T>(path, body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) });
}

async function api<T>(path: string, init?: RequestInit): Promise<T & { ok?: boolean; error?: string; code?: string }> {
  const r = await fetch(`${base}/api${path}`, { credentials: "same-origin", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await r.json().catch(() => ({ ok: false, error: `The server answered ${r.status}.` }));
  return body;
}

function adopt(next: State, nextMe?: Me | null) {
  if (nextMe !== undefined) me = nextMe;
  let role = storedRole();
  if (role === "admin" && !me?.isAdmin) role = "holder";
  state = normalizeView({ ...next, role });
  loaded = true; loadError = null; everLoaded = true;
  emit();
}
/** The server sends only what this person may see; fill any gaps so pages never crash. */
const normalizeView = (s: State): State => ({ ...emptyState(), ...s });

/** Fetch the latest view of the marketplace from the server. */
export async function refresh() {
  if (!LIVE) return;
  try {
    const r = await api<{ me: Me | null; state: State }>("/state");
    if (r.state) adopt(r.state, r.me);
    else if (!everLoaded) { loadError = r.error ?? "Couldn't load the marketplace."; loaded = true; emit(); }
  } catch {
    if (!everLoaded) { loadError = "You're offline or the server can't be reached."; loaded = true; emit(); }
  }
}

if (LIVE && typeof window !== "undefined") {
  void refresh();
  window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 20_000);
  window.addEventListener("focus", () => void refresh());
}

/** Live mode: send one action to the server. Browser-only mode: apply it here. */
export async function call(name: string, args: unknown[], local: (d: State) => string | void): Promise<ApiResult> {
  if (!LIVE) return run(local);
  if (busy) return { ok: false, error: "Another action is still being applied. Try again." };
  busy = true;
  try {
    const r = await api<{ id?: string; state?: State }>(`/actions/${name}`, { method: "POST", body: JSON.stringify({ args }) });
    if (r.state) adopt(r.state);
    if (r.ok) return { ok: true, id: r.id };
    return { ok: false, error: r.error ?? "That didn't work.", code: r.code };
  } catch {
    return { ok: false, error: "You're offline or the server can't be reached. Nothing was changed." };
  } finally {
    busy = false;
  }
}

/** The view selector is a lens on the page, kept in this browser; the server decides what you may do. */
export function setViewRole(role: Role) {
  if (!LIVE) return run((d) => { d.role = role; });
  try { localStorage.setItem(ROLE_KEY, role); } catch { /* ignore */ }
  state = { ...state, role }; emit();
  return { ok: true } as Result;
}

export const auth = {
  async requestLink(email: string, name: string, next: string, acceptTerms: boolean) {
    return api<{ devLink?: string }>("/auth/request", { method: "POST", body: JSON.stringify({ email, name, next, acceptTerms }) });
  },
  async logout() {
    await api("/auth/logout", { method: "POST", body: "{}" });
    me = null; await refresh();
  },
  async setName(name: string) {
    const r = await api<{ me?: Me }>("/me/name", { method: "POST", body: JSON.stringify({ name }) });
    if (r.me) { me = r.me; await refresh(); }
    return r;
  },
};

export interface Session { live: boolean; loaded: boolean; error: string | null; me: Me | null; holderId: string }
let session: Session = { live: LIVE, loaded, error: loadError, me, holderId: YOU_HOLDER };
const getSession = () => {
  const holderId = LIVE ? (me?.holderId ?? "\u0000") : YOU_HOLDER;
  if (session.loaded !== loaded || session.error !== loadError || session.me !== me || session.holderId !== holderId) session = { live: LIVE, loaded, error: loadError, me, holderId };
  return session;
};
/** Who is using the site: in live mode the signed-in account (or null); in the demo, the sample "you". */
export function useSession(): Session {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, getSession);
}
/** Is this store yours? Live: you own the account that listed it. Demo: any store that isn't a sample. */
export const isMine = (shop: { seeded: boolean; ownerUserId?: string }, s: Session) => (s.live ? !!s.me && shop.ownerUserId === s.me.id : !shop.seeded);

export function useStore(): State {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}
export const getState = () => state;

/** Explicit, user-confirmed reset of the v2 demo data. The original v1 key is left untouched. */
export function resetDemo(): Result {
  if (LIVE) return { ok: false, error: "Resetting isn't available on the live site." };
  return run((d) => { const fresh = seedState(); Object.assign(d, fresh); });
}

export const todayIso = today;
