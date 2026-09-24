# MamaHQ — Next Session Handoff

If you open a fresh window, read this file first. Everything needed is in the repo —
nothing lives only in chat memory. This file is intentionally UNTRACKED (never
committed); keep it that way.

---

## Current next action

**Beta Phase 4 is BUILT and awaiting its FINAL ADVERSARIAL REVIEW & MERGE. It is NOT
merged.** PR **#12** (`beta-phase-4-first-90-days-mom`) is OPEN/CLEAN, head
`1c42654f118ec06439be177584b62de78740a4e4`, PR-head CI `35639020971` green on both
jobs. `origin/main` is still Phase 3 (`300b175`).

The expected next thing is the user pasting the **"Beta Phase 4 Final Adversarial
Review & Merge"** prompt. When they do, run that review rhythm:
1. Verify state (below): branch `beta-phase-4-first-90-days-mom`, PR #12 open, exact
   head, latest PR-head CI green on that exact SHA. Do NOT trust the completion report.
2. Independently review the complete diff (`git diff 300b17504de684a8e4653f96d53b4ba9e94ec756...HEAD`),
   the First 90/Mom behavior, day-calc/timezone, content→action, safety (no medical
   interpretation), personal-vs-household visibility honesty, no fake controls.
3. Fix any real defect minimally on the SAME branch → strengthen tests → push → wait
   for a NEW PR-head CI → verify CI headSha == new head → re-review. (The old green run
   can't be reused after a change.)
4. Merge PR #12 only when all gates pass (`gh pr merge 12 --merge` — merge commit, not
   squash) → checkout/pull main → verify local == origin → wait for resulting-main CI
   and verify its headSha == resulting-main SHA and both jobs green. GitHub accepting
   the merge is NOT sufficient.
5. Then STOP (do not begin Phase 5).

If the user instead pastes a **new phase spec** (e.g. Phase 5), Phase 4 should be
finalized first — offer to run its final review/merge before starting anything new.

The general build rhythm (for any NEW phase, from `main`):
1. Verify starting state → dedicated branch off `main`.
2. Small coherent commits; no migration unless genuinely required (justify it); reuse
   existing trusted domains — don't build parallel systems.
3. Deterministic tests; local verify; push; open PR; do **NOT** merge.
4. Completion report → stop for the adversarial review prompt.

---

## Verify starting state first (every session)

```
git fetch origin
```
- **If reviewing/merging Phase 4 (the current in-flight work):** stay on branch
  `beta-phase-4-first-90-days-mom` (`git checkout` it if needed). Expected: local ==
  `origin/beta-phase-4-first-90-days-mom` == `1c42654f118ec06439be177584b62de78740a4e4`;
  PR #12 OPEN/CLEAN; latest PR-head CI `35639020971` green on that exact SHA;
  `origin/main` == `300b17504de684a8e4653f96d53b4ba9e94ec756`.
- **If starting fresh work AFTER Phase 4 is merged:** `git checkout main && git pull`,
  and local `main` should equal `origin/main` (will be the Phase 4 merge commit, not
  `300b175`, once merged).
- **Working tree:** clean except the two intentionally-untracked files:
  - `docs/NEXT_SESSION.md` (this file)
  - `public/MamaHQ_First_90_Days_Editorial_Collection.docx`
- **Migrations:** authoritative lineage `0001 → 0014` (newest `0014_owner_identity.sql`).
  Phase 4 added NO migration. `_archive/` is non-authoritative (never run).

If anything doesn't match, stop and reconcile before building/merging.

---

## Where things stand (what's built)

Repo: `github.com/coreyfmiller/MamaHQ`. `gh` CLI + `git` work.

- **Steps 1–12:** grocery stack (catalog→search→resolver→actions→completion), household
  people, membership/invitations (Step 7), tasks/ownership (Step 8), responsibility +
  care handoff (Step 9), shared calendar (Step 10), realtime + notifications (Step 11),
  Tell MamaHQ (Step 12, OpenAI provider-agnostic interpreter → confirm → trusted execute).
- **Beta Phase 1** (PR #9, merged): canonical household identity — `set_my_display_name`
  RPC (migration `0014`), single capture path (Tell), error boundaries. Removed unsafe
  auto identity reconciliation.
- **Beta Phase 2** (PR #10, merged): onboarding & partner experience — authoritative
  first-run routing (`useHousehold().firstRun`: creator/partner/done), creator + partner
  join journeys, honest invite share/copy (never "sent"), first-Tell handoff.
- **Beta Phase 3** (PR #11, merged, `300b175`): Today = deterministic PROJECTION of
  trusted domains. `lib/today/model.ts` (`buildTodayModel`, pure) + `scripts/test-today.ts`
  (70 tests). TodayScreen shows attention / today's plan / you're-handling / others-handling
  / care / grocery / Tell CTA, with distinct loading/empty/partial-failure. Added
  `loadError` (race-guarded via `reloadSeq`/`loadSeq`) to tasks/care/calendar providers.
  Removed the legacy Appointments card from Today (Appointments domain itself untouched).
- **Beta Phase 4** (PR #12, OPEN — NOT merged, head `1c42654`): First 90 Days & Mom made
  honest/coherent, no new architecture, no migration. `lib/first90.ts` (`journeyDay`,
  `firstNinetyState`) — timezone-safe day calc (Day 1 = local birth day); `dayNumber`
  (profile.tsx) now delegates to it (fixed a real UTC off-by-one). Honest Day 90+
  transition (no "today's read" after Day 90; honest read/beyond-90 screens — removed the
  fake "Newborn→Teen" roadmap). Editorial → action via existing Tell + doctor-questions
  (never auto-executes). Removed the fake hardcoded reminder preview (`screens/reminder.tsx`,
  `mama-data reminders`, the `reminder` overlay, the Me entry). Honest personal-visibility
  label in Me (mood/to-dos/questions are family-scoped = household-visible, NOT private).
  Honest appointment "Remind me" copy (saves a preference; no delivery). `scripts/test-first90.ts`
  (23 tests). Awaiting final adversarial review & merge.

## CI (GitHub Actions)
Two jobs on `pull_request` + push to `main`:
- **Verify (deterministic):** catalog, grocery search/resolver/actions, Tell, **Today
  projection**, **First 90 Days** (`test:first90`), tsc, lint, production build — pure, fast.
- **Database & Security (local Supabase):** disposable local Supabase via Docker on the
  runner → clean-provision `0001→0014` → all JWT/RLS DB suites (security, membership,
  tasks, handoff, calendar, notifications, tell-security, identity, onboarding-partner).
- **DB tests run in CI, not locally** (no Docker on this Windows machine — accepted and
  permanent). Pure tests (`test:today`, `test:tell`, grocery) DO run locally.

## Verified state at last checkpoint (PR #12 head CI `35639020971` on `1c42654`)
Clean-provision `0001→0014` · Catalog · Grocery Search/Resolver/Actions · Household
Memory · Completion/Restore · Security/RLS (30) · Membership · Tasks · Care Handoff ·
Calendar · Realtime/Notifications · Tell deterministic (40) · Tell exec/security ·
Household Identity (11) · Onboarding & Partner (16) · Today/Core Loop (70) ·
**First 90 Days (23)** · tsc clean · lint 0 errors (28 accepted store-pattern warnings)
· production build passes. (Last MERGED-main CI was `35636176405` on `300b175`.)

## Standing rules (apply every phase)
- Work on a **dedicated branch**, open a **PR**, do **NOT** merge until the user's
  adversarial-review prompt says so; then verify resulting-main CI on the exact SHA.
- Repo merge convention is a **merge commit** (`gh pr merge <n> --merge`), NOT squash.
- Never commit: secrets, `.env*`, logs, temp files, or the two intentional untracked
  files above. Clean up any temp files (`*.json`, `*-out.txt`) before finishing.
- Additive migrations only (never edit `0001–0014`). Strongly prefer NO migration.
- Preserve invariants: **Assigned Person ≠ Authorized User** (authz = `family_members`);
  **Person ≠ Account ≠ Membership ≠ Responsibility**; **Assigned ≠ Accepted ≠ Completed**;
  **Participant ≠ Responsible**. Identity is the canonical HouseholdPerson linked to the
  auth account — never device-local `momName` inference or reconciliation.
- Tell must stay: interpret → propose → validate → user confirms → trusted execute.
- No LLM urgency/priority; deterministic rules only. No production writes.
- Analytics + real crash monitoring (Sentry) remain intentionally DEFERRED — do not add
  opportunistically; do not claim monitoring exists.

## Environment / tooling gotchas
- PowerShell on Windows. Run tools directly (pnpm shim is unreliable):
  - `node node_modules/typescript/bin/tsc --noEmit`
  - `node node_modules/eslint/bin/eslint.js .`  (redirect to a file; it's slow)
  - `node node_modules/next/dist/bin/next build` (needs placeholder env:
    `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key`)
  - pure tests: `node scripts/test-today.ts`, `node scripts/test-tell.ts`,
    `node scripts/test-first90.ts`
- The terminal interrupts long/idle commands (`^C` on the display) but the child
  process usually finishes — poll a result file rather than relying on inline output.
  Use `ping -n <sec> 127.0.0.1 > $null` as a delay; avoid long `Start-Sleep`.
- `git push` / `gh` write to stderr and may show a PowerShell error even on success —
  verify with `git rev-parse` / re-query `gh`.
- CI cost: the local-Supabase job's Docker start is slow and variable (sometimes
  15–20 min). Prefer **fewer, longer waits**; aim for one CI cycle per push.

## Outstanding items (not urgent; from earlier steps)
- All manual browser/device QA is `[HUMAN]` and OUTSTANDING (see `docs/MANUAL_QA.md`) —
  never claim it was executed.
- `docs/HUMAN_ACTIONS.md`: rotate exposed Supabase management token + Resend key;
  optional production migration-history reconciliation + drift check.
- Known gaps (see `docs/TECHNICAL_DEBT.md`): baby-care logs not wired to realtime;
  inline load-error retry not on every list overlay; expired-invite status stays
  `pending` (cosmetic; rejection is correct); pre-named partner skips the join welcome;
  **no private-to-Mom space** (mood/to-dos/questions are family-scoped = household-visible —
  now labeled honestly, a real private space would need a migration + RLS); mom personal
  to-dos not converged with canonical Tasks; appointment "Remind me" saves a preference
  only (no push/SMS/email delivery exists).

## Key docs to orient fast
- `docs/IDENTITY_AND_CAPTURE.md` — Beta Phase 1/2 identity + capture + first-run routing.
- `docs/HOUSEHOLD_MEMBERSHIP.md` — Step 7 invitations/RLS/token model.
- `docs/TELL_MAMAHQ.md` — Step 12 Tell trust model.
- `docs/DATABASE_WORKFLOW.md` — how migrations/tests run (local + CI).
- `docs/SECURITY_DEFINER_AUDIT.md` — every SECURITY DEFINER function reviewed.
- `docs/TECHNICAL_DEBT.md` + `docs/PRODUCT_LIMITATIONS.md` — what's deferred / not built.
- `docs/MANUAL_QA.md` — outstanding human QA (incl. Beta Phase 2 & 3 sections).
- `lib/today/model.ts` — the Today projection (start here for Today work).
- `lib/first90.ts` — First 90 Days journey/day calc (start here for First 90 work).
