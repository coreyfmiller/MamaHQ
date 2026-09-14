# Mama HQ — Deploy to Vercel

Getting Mama HQ live on a real URL (and your phone). The app is deploy-ready: production build is
clean, secrets are gitignored, and it reads exactly four environment variables.

> Deploying changes only **where** the app runs, not **who can see what** — RLS still isolates
> every family. It does not activate Partner sharing (that still needs the two-user isolation test
> before Step 11).

---

## 0. Prerequisites

- The repo is committed locally on `main`. It has **no git remote yet** — step 1 fixes that.
- Migrations run in Supabase so prod behaves like dev: `0001`–`0003` (auth/membership) are run.
  Run `0004_onboarding.sql` and `0005_mom_checkins.sql` too so onboarding + Mom check-in work in
  prod (they graceful-degrade if not, but you want them on).

## 1. Push the code to GitHub

Create an empty **private** repo on GitHub named `mama-hq` (no README/license), then locally:

```bash
git remote add origin https://github.com/<your-username>/mama-hq.git
git push -u origin main
```

(If you use the GitHub CLI: `gh repo create mama-hq --private --source=. --push`.)

Confirm `.env.local` did NOT get pushed — it's gitignored, so it won't, but verify on GitHub that
no `.env*` file is present.

## 2. Create the Vercel project

1. vercel.com → **Add New… → Project** → import the `mama-hq` GitHub repo.
2. Framework preset: **Next.js** (auto-detected). Build command / output: defaults are correct.
3. Before the first deploy, add the **Environment Variables** (Production + Preview):

| Name | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://sccrnjhnfmtusvyzmngs.supabase.co` | safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase **publishable/anon** key | safe to expose (RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | your Supabase **service_role** secret | **secret** — server only |
| `OPENAI_API_KEY` | your OpenAI key (`sk-...`) | **secret** — server only |

   (Copy the exact values from your local `.env.local`.)
4. Click **Deploy**. Vercel builds and gives you a URL like `https://mama-hq-xxxx.vercel.app`
   (or your custom domain if you add one).

## 3. Point Google OAuth at the prod URL

Google must allow the new origin, and Supabase must accept the prod redirect.

**Google Cloud Console → APIs & Services → Credentials → your OAuth Web client:**
- **Authorized JavaScript origins:** add `https://<your-vercel-domain>`
- **Authorized redirect URIs:** the redirect target is still Supabase's callback (unchanged):
  `https://sccrnjhnfmtusvyzmngs.supabase.co/auth/v1/callback`
  (This should already be there from local setup — no change needed unless you rotated the client.)

## 4. Point Supabase URL config at the prod URL

**Supabase → Authentication → URL Configuration:**
- **Site URL:** set to `https://<your-vercel-domain>` (or keep localhost and add prod as a
  redirect — but Site URL should be the prod domain for prod).
- **Redirect URLs:** add `https://<your-vercel-domain>/auth/callback`
  (keep `http://localhost:3000/auth/callback` too so local dev still works).

Save. Without this, prod sign-in bounces with `OAuth state parameter missing` (same symptom we saw
locally before the redirect URL was allow-listed).

## 5. Post-deploy smoke test (on your phone)

1. Open `https://<your-vercel-domain>` → the marketing landing loads.
2. Tap **Get started / Continue with Google** → sign in → you land in the app at `/app`.
3. Log a feed → hard-refresh → it persists (proves prod → Supabase → RLS round-trip).
4. Inbox: brain-dump a line → proposals appear → commit → shows in Plan.
5. Sign out → returns to the landing.

If sign-in fails with a redirect error, re-check steps 3–4 (exact domain, no trailing slash).

## Notes

- `images.unoptimized: true` remains (ROADMAP Step 16 revisit) — fine for launch.
- Vercel Analytics renders only in production (already wired in `app/layout.tsx`).
- Future custom domain: add it in Vercel, then repeat steps 3–4 with the custom domain.
- To deploy updates later: just `git push` — Vercel auto-deploys `main`.
