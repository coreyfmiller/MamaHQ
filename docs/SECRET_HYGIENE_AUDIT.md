# MamaHQ — Secret Hygiene & Credential Status (Step 5C)

Read-only audit. **No secret values appear here or anywhere in the repo.** Rotation
instructions (human) live in `docs/HUMAN_ACTIONS.md`.

## Secret hygiene checklist (verified)

- **`.env*` ignored:** ✓ `.gitignore` ignores `.env*` and `.env*.local`.
  `git check-ignore` confirms both `.env` and `.env.local` are ignored.
- **Only a template is tracked:** ✓ the sole tracked env file is `.env.example`, and
  it contains **no non-empty values** (empty `KEY=` templates only).
- **No privileged secret behind `NEXT_PUBLIC_`:** ✓ the only `NEXT_PUBLIC_*` values
  used in MamaHQ source are `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (in `lib/supabase/client.ts`, `lib/supabase/server.ts`,
  `proxy.ts`). Both are safe-to-expose by design (RLS protects data). No service-role
  key, management token, or Resend key is exposed to the browser.
- **Browser uses only the public credential:** ✓ the browser/SSR clients use the anon
  key under RLS. The **service-role key** appears only in `scripts/seed-catalog.ts`
  (a server/CLI script), read from `.env.local`/env, never shipped to the client.
- **Service/admin credentials stay server/admin-only:** ✓ service role → seed script
  only; management token → hand-run CLI only (not in app, not in CI); Resend → not
  used by any runtime path.
- **No secrets tracked in git:** ✓ no key material is committed. CI does not receive
  any production secret (the database job uses only the local stack's generated keys).
- **CI credential posture:** ✓ `.github/workflows/ci.yml` contains no production
  token/service-role/management credential. The `verify` build step uses harmless
  placeholder `NEXT_PUBLIC_*` values; the `database` job uses local-stack keys only.

## Credential status

| Credential | present/absent | client/server | tracked/untracked | exposure | rotation recommended |
|---|---|---|---|---|---|
| Supabase browser/anon (public) | present | client | untracked (`.env.local`) | public by design (not a secret) | no |
| Supabase service role | present | server (seed script only) | untracked | not observed exposed | prudent only if ever shared; not required by Step 5C |
| Supabase **management token** (`sbp_…`) | present (human/CLI) | server/admin | untracked | **exposed** in prior session/terminal history | **YES — revoke** (see HUMAN_ACTIONS #1) |
| **Resend** API key | present (Vercel env) | server | untracked | **exposed** in prior session/terminal history | **YES — revoke; do not replace** (delivery unimplemented) (HUMAN_ACTIONS #2) |
| OpenAI | dependency present, **key not used** | n/a | untracked | not observed exposed | n/a (unused) |
| Vapi | absent (not a MamaHQ dependency) | n/a | n/a | n/a | n/a |

### Notes
- **Exposure basis:** the management token and Resend key were observed in earlier
  working-session command history (not in tracked repository files). That is outside
  their intended secret boundary, so both are treated as **compromised**.
- **CI never holds these:** ordinary CI verification requires neither the management
  token nor the service-role key; it provisions its own disposable local stack.
- Values are intentionally omitted everywhere. Rotation is a human action (see
  `docs/HUMAN_ACTIONS.md`) and was **not** performed in Step 5C (Step 5C does not
  hold the account credentials required to rotate safely without exposing new values).
