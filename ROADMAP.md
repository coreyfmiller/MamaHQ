# Mama HQ — Roadmap (current-state-aware)

This roadmap reflects **what the repository actually is today**, not an empty project. It governs
sequencing. Read `SAFETY.md` (absolute) and `PRODUCT.md` (product law) before any step. Work only
within the current step; document — do not build — anything belonging to a later step.

**Controlled build rule:** at the end of every step, summarize, list file changes, explain
decisions, note open questions, run checks, state pass/fail, recommend next, and STOP until told
"Proceed to Step X."

---

## Classification of existing implemented capabilities

| Capability | Files | Classification | Note |
|---|---|---|---|
| Baby logging: Feed/Sleep/Diaper/Pump | `log-sheet.tsx`, `today-tab.tsx`, `lib/db.ts`, `/api/log` | **KEEP** | Works, persists, RLS-enforced. Needs UX hardening (Step 7): editing, undo, time correction. |
| Today screen | `today-tab.tsx` | **KEEP** | Real data. Mom check-in is static (INCOMPLETE, Step 8). |
| Inbox brain-dump + OpenAI proposals | `inbox-tab.tsx`, `lib/inbox-ai.ts`, `/api/inbox` | **KEEP** | Honors propose→approve→commit + provenance. Review structured-output rigor (Step 10). |
| Plan (tasks/appointments/questions/shopping) | `plan-tab.tsx`, `/api/plan` | **KEEP** | View + check-off works. Manual add/edit not built (INCOMPLETE, Step 9). |
| Memories (text moments) | `memories-tab.tsx`, `/api/memory`, `0002_memories.sql` | **INCOMPLETE** | Code done; migration NOT verified live. Photos not built (Step 13). |
| Google OAuth + session (SSR) | `sign-in.tsx`, `proxy.ts`, `auth/callback`, `supabase-*.ts` | **KEEP** | Verified live. Onboarding is auto-provision only (INCOMPLETE, Step 6). |
| Hardened DB + RLS (families/babies/logs/plan/captures) | `0001_init.sql`, `lib/db.ts` | **KEEP BUT REFACTOR LATER** | Single-owner model. Partner Mode requires an authorization migration (Step 5). |
| Public marketing landing | `components/mama-hq/*`, `app/page.tsx` | **KEEP** | Front door at `/`; app gated at `/app`. |
| `/api/state` full-state load | `/api/state`, `lib/db.ts` | **KEEP BUT REFACTOR LATER** | One big fetch is fine now; revisit as data grows. |
| `next.config.mjs` `ignoreBuildErrors` | `next.config.mjs` | **TECHNICAL DEBT** | tsc currently clean; safe to remove (Step 1 housekeeping). |
| `images.unoptimized: true` | `next.config.mjs` | **KEEP BUT REFACTOR LATER** | Revisit at deploy (Step 16) once real image usage is known. |
| `supabase-standard.md` (Phase-A) | `.kiro/steering` | **REMOVE LATER** | Superseded by `database-standard.md` + `SAFETY.md`; keep as historical note, reconciled. |
| `@base-ui/react` dependency | `package.json` | **REMOVE LATER** | Largely unused; audit before removal. |
| Root log/zip clutter | `_*.log`, `mama-hq.zip` | **N/A** | Already gitignored; not tracked. |

---

## Already implemented vs. still required (summary)

**Already implemented:** hardened single-owner DB + RLS; Google auth + session; Feed/Sleep/Diaper/
Pump logging with history; Today; Inbox + OpenAI proposals with provenance; Plan view + check-off;
text Memories (migration unverified); public landing + gated app.

**Still required to meet the approved spec:** short guided onboarding; logging UX hardening
(edit/undo/time-correction/robust active timer); manual Plan create/edit + assignments; Inbox AI
hardening review; **Partner Mode (needs authz migration first)**; Visit Mode; Memories photos +
Day-90 retrospective; Canadian content & safety system; beta-readiness (analytics, a11y,
performance, deletion/export).

---

## Steps

Each step: **Status · Existing · Gap · Work · Dependencies · Acceptance · Tests · Risks.**

### STEP 0 — Repository Audit
- **Status:** ✅ Completed.
- **Acceptance:** Audit + STEP 0 REPORT delivered, no app changes. Met.

### STEP 1 — Product Constitution
- **Status:** ⏳ In progress (this step).
- **Work:** Create `PRODUCT.md`, `SAFETY.md`, `ROADMAP.md`, `COMPETITIVE.md`; reconcile steering;
  limited housekeeping (db.ts commit, package name, build-safety review, gitignore).
- **Acceptance:** Four canonical docs exist and are non-contradictory with steering; tsc/build
  checks run and reported; safe housekeeping applied or documented.
- **Tests:** tsc, production build, git status.
- **Risks:** Doc drift over time — mitigated by steering deferring to root docs.

### STEP 2 — User Journey Specification
- **Status:** ❌ No implementation.
- **Work:** Design flows A–I (below) as documentation only: screens, taps, data, errors,
  undo/edit, accessibility, edge cases.
- **Dependencies:** Step 1.
- **Acceptance:** Every mandatory flow documented with tap counts and edge cases. No code.
- **Risks:** Designing past current data model — note constraints, don't build.

### STEP 3 — Information Architecture Review
- **Status:** ◐ Exists (5-tab nav + landing). Review, don't restart.
- **Work:** Validate nav (Today/Baby/Inbox/Plan/Memories), routes, screen/component hierarchy,
  shared primitives, state, responsive behavior. Decide where Partner/Visits/Settings live.
- **Acceptance:** IA documented; nav justified or simplified; no unjustified rebuilds.

### STEP 4 — UX Prototype / UX Refactor
- **Status:** ◐ Working app exists. Refactor, don't rebuild working interactions.
- **Work:** Bring all Step-2 flows to a testable interface (mock where backend is absent, e.g.
  Partner/Visits/Day-90). Design target: modern-motherhood × premium consumer × editorial — not
  babyish, medical, generic SaaS, or excessively pink/beige.
- **Acceptance:** Flows A–I walkable; interaction counts reported; friction identified.

### STEP 5 — Data & Security Architecture Upgrade  ⚠️ pivotal
- **Status:** ◐ Single-owner model exists (`families.owner_id = auth.uid()`).
- **Gap:** No multi-caregiver model. **Partner Mode cannot be built on the current owner-only
  authorization model.**
- **Work (design + migration, deliberate):** introduce `family_members` (user ↔ family with a
  role), roles/permissions, children belonging to family, and RLS rewritten around membership
  rather than sole ownership. Plan the migration path for existing single-owner rows. Consider
  future localization fields (country/region) as data. Keep provenance + no-clinical-score rules.
- **Dependencies:** Steps 1–4.
- **Acceptance:** New authorization model designed with a forward-only migration; RLS still
  deny-by-default and family-isolated; existing data migrates safely; no `anon` access.
- **Tests:** RLS isolation tests (Family A cannot read Family B), migration replay.
- **Risks:** **Highest-risk step.** A careless change breaks isolation. Must be reviewed and
  tested before Partner Mode. Do NOT casually patch partner access onto the owner-only model.

### STEP 6 — Authentication & Onboarding Upgrade
- **Status:** ◐ Google auth works; onboarding is silent auto-provision (baby defaults to "Baby",
  birth date = 16 days ago).
- **Work:** Short guided onboarding: Mom profile, family, baby name + birth date, country/region
  architecture, partner-invitation architecture (design; build in Step 11). End on
  *"Welcome to Day X."* Collect the minimum.
- **Dependencies:** Step 5 (family/member model).
- **Acceptance:** New user completes onboarding in a few taps; real baby name + birth date; no
  unnecessary fields.
- **Risks:** Over-collection — resist.

### STEP 7 — Baby Logging UX Hardening
- **Status:** ◐ Logging exists.
- **Work:** Editing, undo, time correction, robust active sleep timer that survives navigation/
  reload, offline/error tolerance. Hit **≤3s** for routine events.
- **Acceptance:** Flows A–D pass at target tap counts; timer survives reload; edits/undo persist.
- **Tests:** Timed logging; reload-during-sleep; edit/undo round-trip.
- **Risks:** Speed vs. flexibility — defaults must stay 1–3 taps.

### STEP 8 — Today UX Hardening
- **Status:** ◐ Real data; check-in static.
- **Work:** Day number, last feed, current sleep, last diaper, quick logging, today's
  appointments, important tasks, waiting questions, optional Mom check-in (wired). Not an
  analytics dashboard.
- **Dependencies:** Steps 7, 9.
- **Acceptance:** Today answers the core questions at a glance; check-in does something real.

### STEP 9 — Plan Expansion
- **Status:** ◐ View + check-off; no manual create/edit.
- **Work:** Manual tasks, shopping, lists, appointments, questions, and assignments — all working
  **before** AI. Link questions to appointments.
- **Acceptance:** Flow F (accumulating questions) works manually; items editable/assignable.

### STEP 10 — Inbox / AI Hardening
- **Status:** ◐ OpenAI extraction works, proposes-only, stores provenance.
- **Work:** Review against `SAFETY.md`: strict structured outputs, provider abstraction
  (`AIService` + `OpenAIProvider`), validation, and full provenance capture (input, interpretation,
  proposed, edits, approved). Measure AI acceptance/edit rate.
- **Acceptance:** Flow E robust; provenance complete; no silent commits; provider swappable.
- **Risks:** Model drift/shape — validate defensively (already partly done in `inbox-ai.ts`).

### STEP 11 — Partner Mode  🔒 blocked by Step 5
- **Status:** ❌ Not built.
- **Work:** Partner invitation, permissions/roles, assigned tasks, shared lists, shared baby
  status, partner logging + task completion. Experience = *"Here's how you can help today,"* not a
  mirrored Mom dashboard.
- **Dependencies:** **Step 5 authorization migration is a hard prerequisite.**
- **Acceptance:** Flow G end-to-end; partner sees only what their role allows; Family isolation
  intact; Mom sees completions.
- **Risks:** Authorization + privacy. Nothing ships until RLS isolation tests pass.

### STEP 12 — Visit Mode
- **Status:** ❌ Not built (questions/appointments partially exist in Plan).
- **Work:** Appointment questions, notes, recorded-data summary, simple provider-facing view.
  **Describe only — no interpretation.**
- **Acceptance:** Flow F produces a factual, describe-only visit sheet.
- **Risks:** Any interpretive wording violates `SAFETY.md`.

### STEP 13 — Memories Upgrade
- **Status:** ◐ Text memories built (migration unverified). No photos/timeline.
- **Work:** Verify `0002_memories.sql` live; add photo (Supabase Storage), text, date, timeline;
  AI "Save this as a memory?" suggestion with required confirmation.
- **Dependencies:** Storage buckets + policies (Step 5/16).
- **Acceptance:** Flow H fast; photos persist under RLS/storage policies; suggestions require
  confirmation.

### STEP 14 — Day-90 Retrospective
- **Status:** ❌ Not built.
- **Work:** *"Your First 90 Days"* built from genuine memories, photos, parent notes, selected
  recorded moments. Emotional and beautiful. **No invented milestones.**
- **Acceptance:** Flow I generates a retrospective from real data only.

### STEP 15 — Canadian Content & Safety
- **Status:** ❌ Not built.
- **Work:** Separate content system: country, region, source authority, source URL, content
  version, review status, reviewed date, effective dates. Safety-escalation architecture designed
  separately. **No LLM-invented clinical facts; no triage without approved clinical rules.**
- **Acceptance:** Content is stored, sourced, versioned, reviewable, region-aware.

### STEP 16 — Beta Readiness
- **Status:** ❌ Not started.
- **Work:** Review security/RLS/privacy/a11y/performance/mobile UX/error handling/logging/AI
  failures/timezone/partner permissions/deletion/export. Privacy-conscious analytics for
  onboarding completion, daily usage, logging frequency, time-to-log, Inbox + AI acceptance/edit
  rate, partner invites/activity, appointments, memories, and Day 1/7/30/60/90 retention.
- **Acceptance:** Beta checklist green; deletion + export work; analytics live.

---

## Mandatory UX benchmark flows (drive Steps 2 & 4)

- **A — 3 AM Feed:** start breastfeeding → switch side → stop → check last diaper. Lowest possible
  friction.
- **B — Bottle:** log 120 mL formula. Target ~3 seconds.
- **C — Diaper:** wet / dirty / both, in 1–2 interactions.
- **D — Sleep:** start → leave app → return later → stop. Timer survives navigation/reload.
- **E — Brain Dump:** mixed thoughts → proposed structured actions → approve/edit.
- **F — Appointment:** questions accumulate over days → ready as a visit sheet.
- **G — Partner:** Mom assigns → partner sees → partner completes → Mom sees completion.
- **H — Memory:** save a meaningful moment rapidly.
- **I — Day 90:** emotional retrospective from genuine recorded memories.

---

## Architectural note — Partner Mode requires an authorization-model migration

The current system authorizes by sole ownership: `families.owner_id = auth.uid()`. Partner Mode
requires a **deliberate authorization-model migration** to a membership model conceptually
supporting: `family`, `family_members`, roles, permissions, babies/children belonging to the
family, and multiple authenticated caregivers. **This migration is Step 5 and is a hard
prerequisite for Step 11. Do not patch partner access onto the owner-only model.**

## Database migration status

- `0001_init.sql` — **applied/verified live** (auth + logging + plan + captures working).
- `0002_memories.sql` — **written, NOT verified live.** Live logs showed `PGRST205` (table not
  found) until run. `lib/db.ts` degrades gracefully if it is absent. Memories is not
  production-ready until this migration is confirmed applied.
