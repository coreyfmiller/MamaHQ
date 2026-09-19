# MamaHQ — Human Actions Required

Actions that only a human with the right account access can perform. Step 5C
prepared everything around these but cannot execute them, because they require
privileged credentials/authorization that must never live in the repo or CI.

**No secret values appear in this document. Never paste a real key here.**

---

## 1. Rotate the exposed Supabase Management token — REQUIRED

**Why:** the Situation Report and Step 5C confirmed the Supabase **management token**
(`sbp_…`) was exposed outside its intended boundary (it appeared in prior working
sessions/terminal history). Treat it as compromised. A management token grants
full account-level control, so this is the highest-priority rotation.

**Does MamaHQ's runtime need it?** **No.** The running Next.js app authenticates to
Supabase with the public `anon` key only (under RLS). The management token was used
only for ad-hoc, hand-applied migrations via the Management API. Revoking it does
**not** affect the deployed app.

**Steps:**
1. Sign in to the Supabase dashboard → account **Access Tokens**
   (https://supabase.com/dashboard/account/tokens).
2. **Revoke** the exposed token.
3. Only create a replacement **if/when** you next need to hand-apply a migration or
   run `supabase link` for drift inspection. Per least privilege (Step 5C §32), do
   **not** mint a replacement just because you revoked one.
4. If you do create one, keep it **only** in your local shell environment
   (`SUPABASE_ACCESS_TOKEN`) at the moment you run the CLI. Do **not** put it in
   `.env.local`, the repo, or GitHub Actions secrets.
5. **Verify the app still works** after revocation: load the deployed site, sign in
   (email OTP), confirm the grocery list loads and an item can be added/completed.
   None of that path uses the management token, so it should be unaffected.

---

## 2. Rotate the exposed Resend API key — REQUIRED (then decide if one is needed)

**Why:** a Resend API key was exposed in prior session/terminal history (it appeared
in a `vercel env add RESEND_API_KEY` command). Treat it as compromised.

**Does MamaHQ currently use Resend?** **Effectively no.** Care Handoff / partner
delivery is **not implemented** (the notifier is a no-op seam). So no runtime code
path currently sends mail through Resend. A Resend credential is therefore **not
required** by the app today.

**Steps:**
1. Sign in to the Resend dashboard → **API Keys** (https://resend.com/api-keys).
2. **Revoke/delete** the exposed key.
3. **Do not create a replacement** unless/until email delivery is actually built
   (a future step). If it was set as a Vercel Production env var, remove it there so
   a compromised value isn't sitting in the deployment:
   - Vercel → Project → Settings → Environment Variables → remove `RESEND_API_KEY`.
   (Removing it is safe precisely because nothing sends mail yet.)
4. **Verify:** the app has no mail-dependent path, so removal changes no user-facing
   behavior. Confirm the site still builds/deploys.

---

## 3. (Optional, human-run) Reconcile production migration history

**Why:** production has no `supabase_migrations.schema_migrations` tracking table
(migrations were hand-applied). Bringing it into the CLI's tracked workflow makes
future migrations cleaner. This is optional and non-urgent.

**Guardrail:** *do not assume "not tracked" means "not applied".* Mark a migration
`applied` only after confirming its schema effect is genuinely present in production.
**Do not re-run migration SQL to create history** — use the repair command, which
writes only history rows.

**Steps (requires a fresh `SUPABASE_ACCESS_TOKEN` from action #1, held only in your
shell):**
```bash
export SUPABASE_ACCESS_TOKEN=...   # your shell only; never commit / never in CI
supabase link --project-ref sccrnjhnfmtusvyzmngs
supabase migration list --linked   # compare local files vs remote history (read-only)
# After verifying each migration's effect is present in production:
supabase migration repair 0001 0002 0003 0004 0005 0006 0007 --status applied --linked
```
Then `unset SUPABASE_ACCESS_TOKEN`. See `supabase/migrations/README.md` for the full
rationale and the drift-verification approach.

---

## 4. (Human-run) Production schema drift verification

Step 5C proves a **clean** database provisions correctly from the migrations (in CI).
Comparing that clean schema against **live production** requires reading production,
which needs the linked project + token (action #3). Until performed by a human, the
clean-vs-production drift comparison is **NOT VERIFIED**. Once linked (read-only):

```bash
supabase db diff --linked --schema public
```
Review any differences and classify them EXPECTED / HARMLESS / ACTION REQUIRED per
Step 5C §10. Do **not** auto-apply changes to production to force a match; if an
additive repair migration is warranted, write it, test it locally, and apply it
deliberately.

---

## 5. (Human-run) Execute the Manual QA checklist

`docs/MANUAL_QA.md` is created but its human-verification items are **not** performed
by automation. A human must run them on a real device and record results. Nothing in
Step 5C marks those as passed.
