# MamaHQ — Next Session Handoff

If you open a fresh window, read this file first. Everything needed is in the repo —
nothing lives only in chat memory.

**This file IS tracked in git.** Earlier versions declared themselves "intentionally
UNTRACKED (never committed); keep it that way", but it was committed in `277c5a4`
("misc project files") and has been tracked ever since — so that instruction was simply
false. Tracking it is the better outcome anyway: an untracked handoff exists on one
machine only, which is part of how the previous version went unnoticed while being
badly wrong. Keep it committed, and keep it honest.

**Rewritten October 2026.** The previous version claimed Beta Phase 4 / PR #12 was open
and unmerged with `origin/main` at `300b175` and migrations ending at `0014`. All of that
was long out of date — Phase 4 merged, and 14 more PRs landed on top of it. If this file
and `git` ever disagree again, **trust `git`** and fix the file.

---

## Current state

- `main` == `origin/main` == `9fc66bd` ("fix(tell): pin output envelope to proposals so
  model output passes validation")
- **No open PRs.** Nothing in flight.
- Migrations `0001 → 0018` (newest `0018_reset_family_data_clears_care.sql`).
  `_archive/` is non-authoritative and is never run.
- CI green on `main` — run `37395428893`, both jobs.
- Live: https://mamahq.vercel.app/app
- Working tree should be clean except the two intentionally-untracked files:
  - `docs/NEXT_SESSION.md` (this file)
  - `public/MamaHQ_First_90_Days_Editorial_Collection.docx`

**There is no current next action.** The last session verified the build rather than
changing it. Pick work from `ROADMAP.md`.

### Last verified locally (October 2026)
`npm run verify` → exit 0: catalog · grocery search/resolver/actions · Tell deterministic ·
Today · First 90 · first90-temporal · baby-history · log-dedupe · reset-confirm ·
onboarding · pr6 · `tsc` clean · lint 0 errors (25 accepted `set-state-in-effect`
warnings). Production build passes with placeholder Supabase env.

---

## What's shipped

Steps 1–12 and Beta Phases 1–6, plus Beta Launch Fixes and PR6 hardening:

- **Grocery** (Steps 1–6) — catalog → search → resolver → action resolution → execution →
  completion → purchase event, plus household grocery memory.
- **Household people + membership** (Steps 2, 7) — hashed-token invitations, transactional
  acceptance, hardened RLS.
- **Tasks + acceptance** (Steps 8–9) — ownership by household person, "I've got it"
  distinct from completion.
- **Care handoff** (Step 9) — holder + propose/accept/decline; responsibility moves only on
  explicit acceptance.
- **Shared calendar** (Step 10, consolidated Phase 6) — the one scheduling surface; legacy
  Appointments UI retired, its tables dormant.
- **Realtime + in-app notifications** (Step 11) — grocery/tasks/care/calendar sync live.
  **Baby logs are deliberately NOT in the publication.**
- **Tell MamaHQ** (Step 12) — OpenAI interpreter → validate → resolve → confirm → trusted
  execute.
- **Beta Phase 1** — canonical identity, Tell as the single capture path, error boundaries.
- **Beta Phase 2** — authoritative first-run routing, creator and partner journeys, honest
  invite sharing.
- **Beta Phase 3** — Today as a deterministic projection (`lib/today/model.ts`).
- **Beta Phase 4** — First 90 Days honesty, timezone-safe day calc (`lib/first90.ts`).
- **Beta Phase 5** — Baby and care polish, truthful log-save failures, duplicate-tap guard.
- **Beta Phase 6** — calendar/appointments consolidation.
- **PR #15–26** — beta launch trust and data exit, product-exposure pass, duplicate-family
  bootstrap fix (`0015`), first-run baby setup, Today quiet-day line, care-handoff UX
  retirement, Start Over fixes, onboarding simplification, night affirmation slot, Baby
  History tab.

---

## Pick up from here

See `ROADMAP.md` for the full picture. The short version:

1. **Meals** — the largest remaining surface and the recommended next build. Deterministic:
   static ingredient template per meal, "use this list next time?" as a saved preference, no
   ML. Completes Tell's routing targets and feeds the already-strong Grocery domain.
2. **Notification delivery** — blocked on you creating Resend/Twilio accounts. Revoke the
   previously-exposed Resend key first (`docs/HUMAN_ACTIONS.md` #2).
3. **Contextual Assistant** — better after Meals. Grounded retrieval over a broadened
   `lib/today/model.ts`, not an agent.
4. **Recurring responsibility / area ownership** — the "James owns groceries" concept, as
   opposed to a single assigned task.
5. **Member removal workflow** — `family_members.status` already has `removed`; no UI.

### Needs a human decision
- **Tell runs on OpenAI, not Gemini**, which conflicts with the workspace
  `gemini-flash-latest` standard. Either grant MamaHQ an exception or write a Gemini
  adapter (the `Interpreter` seam makes it cheap). See `ROADMAP.md`.
- **Is the Me tab private from a partner?** Currently family-scoped and
  household-visible, labeled honestly. Making it private needs a migration + RLS.

---

## Build rhythm

> ⚠️ **Workspace rule overrides the old convention.** `.kiro/steering/mamahq-git-workflow.md`
> says: push MamaHQ work **straight to `main`**; do not leave finished work on a branch or
> an unmerged PR. The older "dedicated branch → PR → wait for the adversarial-review
> prompt" rhythm in previous versions of this file no longer applies unless you say so.

Before pushing: the relevant `test:*` scripts, `npm run typecheck`, `npm run lint`, and
`npm run build` when the change touches the app. `npm run verify` does all of the
deterministic ones in one go. Pushing to `main` deploys to production — confirm CI and the
deploy both finished.

**Revert `next-env.d.ts` if the build modifies it. Never commit it.**

### Standing rules
- Additive migrations only; never edit `0001–0018`. Strongly prefer **no** migration.
- Preserve the invariants: **Assigned Person ≠ Authorized User** (authz lives in
  `family_members`) · **Person ≠ Account ≠ Membership ≠ Responsibility** · **Assigned ≠
  Accepted ≠ Completed** · **Participant ≠ Responsible**. Identity is the canonical
  household person linked to the auth account — never device-local inference.
- Tell stays: interpret → propose → validate → user confirms → trusted execute.
- No LLM urgency or priority; deterministic rules only. No production writes from tests.
- Analytics and real crash monitoring (Sentry) remain intentionally **deferred** — do not
  add opportunistically, and never claim monitoring exists.
- Never commit secrets, `.env*`, logs, or temp files. Clean up `*-out.txt` / scratch files.

---

## Environment / tooling gotchas

- PowerShell on Windows. Run tools directly if the pnpm/npm shim misbehaves:
  - `node node_modules/typescript/bin/tsc --noEmit`
  - `node node_modules/eslint/bin/eslint.js .` (slow — redirect to a file)
  - `node node_modules/next/dist/bin/next build` needs placeholder env:
    `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key`
  - pure tests run directly: `node scripts/test-today.ts`, `test-tell.ts`, `test-first90.ts`
- **DB tests do not run locally** (no Docker on this machine — accepted and permanent).
  They run in the CI "Database & Security" job against a disposable local Supabase.
- The terminal shows `^C` on long or idle commands but the child process usually finishes —
  poll a result file rather than trusting inline output.
- `git push` and `gh` write to stderr and can look like failures on success — verify with
  `git rev-parse` or re-query `gh`.
- The CI Docker job is slow and variable (sometimes 15–20 min). Aim for one CI cycle per push.

---

## Outstanding, not urgent

- **`docs/HUMAN_ACTIONS.md` — two credential rotations are still required:** the exposed
  Supabase **management token** (account-level control; the app does not need it, so
  revoking is free) and the exposed **Resend key** (nothing sends mail, so deleting is
  free). These have been outstanding a while.
- **All manual device QA is `[HUMAN]` and OUTSTANDING** (`docs/MANUAL_QA.md`) — never claim
  it was executed. Websocket realtime and real-model Tell quality in particular can only be
  checked by a person.
- Production-vs-clean schema drift is **NOT VERIFIED** (needs a linked read-only token).
- Known gaps: baby-care logs not realtime; inline load-error retry missing on some list
  overlays; expired-invite status stays `pending` (cosmetic — rejection is correct);
  a pre-named invited partner skips the join welcome; no private-to-Mom space; Mom's
  personal to-dos not converged with canonical Tasks; appointment "Remind me" saves a
  preference only.

## Key docs

- `ROADMAP.md` — what's shipped, what's left, and why (start here)
- `docs/PRODUCT_LIMITATIONS.md` — authoritative "does NOT exist yet"
- `docs/TECHNICAL_DEBT.md` — debt and deferred architecture
- `docs/IDENTITY_AND_CAPTURE.md` — identity, capture, first-run routing
- `docs/HOUSEHOLD_MEMBERSHIP.md` — invitations, RLS, token model
- `docs/TELL_MAMAHQ.md` — the Tell trust model
- `docs/DATABASE_WORKFLOW.md` — how migrations and tests run
- `docs/SECURITY_DEFINER_AUDIT.md` — every SECURITY DEFINER function reviewed
- `lib/today/model.ts` — the Today projection
- `lib/first90.ts` — journey day calculation
