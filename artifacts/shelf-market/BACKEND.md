# InRaf live backend

The site has two modes, chosen at build time by `VITE_BACKEND`:

- **unset**: the browser-only demo. Each browser keeps its own copy in localStorage and nothing is shared.
- **`api`**: live. Data is shared on the server, people sign in with an emailed link, and the server checks every action.

## How it fits together

| Part | Where |
|---|---|
| API (one Vercel function for every `/api/*` request) | `server/handler.ts`, bundled to `server-dist/` by `node server/build.mjs` and loaded by `api/handler.js` |
| Who may do what | `server/policy.ts`. It uses the same business rules as the demo (`src/lib/ops.ts`), but takes identity from the session, never from the browser |
| What each person may see | `server/view.ts` |
| Sign-in (email magic link, 30-day HttpOnly session cookie) | `server/auth.ts` |
| Database (Postgres; tables are created automatically on first request) | `server/db.ts` |
| Browser side | `src/lib/store.ts` (`call`, `refresh`, `useSession`, `auth`) and `src/pages/signin.tsx` |

Locally, `pnpm dev` serves the API from the Vite dev server. Put these in `.env.development.local`, which git ignores:

```
DATABASE_URL=postgres://inraf:inraf@localhost:5440/shelf_market
ADMIN_EMAILS=admin@inraf.test
VITE_BACKEND=api
```

Without `RESEND_API_KEY`, local sign-in shows the link on screen. In production it refuses to sign anyone in instead.

## Production settings (Vercel → shelf-market → Settings → Environment Variables)

| Variable | Value |
|---|---|
| `DATABASE_URL` | Set automatically when Neon Postgres is connected from the Storage tab |
| `APP_URL` | `https://inraf.com`. Sign-in links are built from this, never from the request |
| `ADMIN_EMAILS` | Comma-separated emails of the InRaf team. They get the admin console and approvals |
| `RESEND_API_KEY` | From resend.com, after verifying the inraf.com domain |
| `EMAIL_FROM` | e.g. `InRaf <login@inraf.com>` (a verified sender) |
| `VITE_BACKEND` | `api` |

## Still simulated or limited

- Payments, e-signatures and payouts are recorded but no money moves. The site says so.
- Shop photos are stored as compressed images inside the database. Move them to Vercel Blob before uploads grow.
- The marketplace is one shared JSON document, changed under a row lock. That suits launch volumes (thousands of
  stores and orders); split it into tables before it grows past a few MB.
- Sample stores stay visible as examples but can't be rented on the live site.
- The In-Raf FinCrime OS link is hidden in production unless `VITE_FINCRIME_OS_URL` points to a deployed instance.
