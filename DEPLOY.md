# MamaHQ — Deploy to Vercel

Getting MamaHQ live on a real URL for the closed beta. The app is deploy-ready: the
production build is clean, secrets are gitignored, and it reads a small set of
environment variables.

> Deploying changes only **where** the app runs, not **who can see what** — Supabase
> Row-Level Security (RLS) isolates every family regardless of deployment.

---

## 0. What MamaHQ actually is (current reality)

- **Framework:** Next.js (App Router) + React + Tailwind v4, deployed on Vercel.
- **Auth:** **email OTP (6-digit code)** — no passwords, no Google/Apple OAuth, no
  magic-link redirect. Sign-up and sign-in are the same flow (first-time emails are
  auto-created). There is nothing to configure in Google Cloud.
- **Data:** Supabase (Postgres + RLS). The browser uses the anon key; a server route
  (`/api/tell`) uses a cookie-session server client. RLS is the security boundary.
- **AI:** Tell MamaHQ interprets natural-language brain-dumps **server-side** via
  OpenAI (`/api/tell`). AI only proposes; the user confirms; trusted domain RPCs
  execute. The `OPENAI_API_KEY` is server-only and never reaches the browser.
- **Migrations:** `supabase/migrations/0001` … `0014` are the authoritative schema.

---

## 1. Environment variables

Set these in Vercel (Production + Preview). Copy the exact values from your local
`.env.local` (which is gitignored and must never be committed).

| Name | Required | Exposure | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | public (safe) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | public (safe; RLS protects data) | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | **secret — server only** | used by scripts/CI + any server-only admin path; never sent to the client |
| `OPENAI_API_KEY` | yes | **secret — server only** | powers `/api/tell` interpretation |
| `TELL_MAMAHQ_MODEL` | optional | server only | override the interpreter model (default `gpt-4o-mini`) |
| `NEXT_PUBLIC_SENTRY_DSN` | optional | public DSN | error monitoring; leave blank to disable |

The production build must succeed with the two secrets absent at build time — any
`NEXT_PUBLIC_*` reads resolve to placeholders (CI passes harmless placeholder Supabase
values). Real values are only needed at runtime.

---

## 2. Provision the database (migrations)

The `supabase/migrations/` folder is the script-of-record. On a fresh Supabase project
apply `0001` → `0014` in order (either via the Supabase CLI `supabase db push`/`reset`
against the linked project, or by running each file in the SQL editor in order).

> Production migration history is currently applied by hand (there is no CLI-tracked
> `schema_migrations` on prod yet — see `docs/HUMAN_ACTIONS.md`). Apply new migrations
> (like `0014_owner_identity.sql`) to prod at deploy time. CI proves a clean provision
> `0001 → 0014` from an empty database on every run.

---

## 3. Create the Vercel project

1. vercel.com → **Add New… → Project** → import the GitHub repo.
2. Framework preset: **Next.js** (auto-detected). Build/output defaults are correct.
3. Add the Environment Variables from §1 before the first deploy.
4. **Deploy.** Vercel builds and gives you a URL (or your custom domain).

---

## 4. Point Supabase auth at the prod URL

**Supabase → Authentication → URL Configuration:**
- **Site URL:** your production domain.
- **Redirect URLs:** add `https://<your-domain>/auth/callback` (keep
  `http://localhost:3000/auth/callback` for local dev).

Email OTP itself needs no OAuth provider config. The `/auth/callback` route only
matters for any magic-link-shaped flow; the shipped UX is code entry.

---

## 5. Optional: error monitoring

For the closed beta you may enable privacy-first error monitoring:
1. `npm install @sentry/nextjs` (optional dependency).
2. Set `NEXT_PUBLIC_SENTRY_DSN` in Vercel.

MamaHQ reports only uncaught error type/message/stack + release/env. It never sends
household content, prompts, tokens, emails, or phone numbers (see `lib/monitoring.ts`).
With the DSN blank or the package absent, monitoring is a safe no-op and the app is
unaffected.

---

## 6. Post-deploy smoke test (on a phone)

1. Open `https://<your-domain>` → the marketing landing loads.
2. **Get started** → enter email → enter the 6-digit code → land in the app at `/app`.
3. Finish onboarding (enter your name) → open **Me → Household (People)** → your name
   is shown correctly (canonical identity).
4. **Tell MamaHQ** (bottom nav "Tell" or the center Capture button) → type
   "add milk and remind me to call the pediatrician tomorrow" → review → confirm →
   verify Grocery + Tasks updated.
5. Log a feed → hard-refresh → it persists (prod → Supabase → RLS round-trip).
6. Sign out → returns to the landing / sign-in.

---

## Notes

- `images.unoptimized: true` remains — fine for launch.
- Vercel Analytics renders only in production (wired in `app/layout.tsx`).
- To deploy updates: `git push` — Vercel auto-deploys `main` (apply any new migration
  to prod as part of the release).
- The closed beta is **free and invite-only** — there is no billing.
