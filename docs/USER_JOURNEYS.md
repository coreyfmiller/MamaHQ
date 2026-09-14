# Mama HQ — User Journey Specification (Step 2)

Documentation only. No code is changed by this step. These journeys are the mandatory UX
benchmark that drives Step 3 (IA review) and Step 4 (UX prototype/refactor). They are written
against `PRODUCT.md` (the ~3s logging target, the 3:17 AM north star) and `SAFETY.md` (describe,
don't interpret; AI proposes, user approves).

Every flow below states what is **CURRENT** (built today) versus **TARGET** (the bar we must
hit), so Step 4 knows what to refine versus what to build/mock.

---

## Conventions

**Tap counting.** A "tap" = one deliberate touch that advances the task (button, chip, toggle,
list row). Typing a value counts as 1 interaction to *focus+enter* regardless of characters.
Opening the app is **not** counted (assume already open) unless the flow is explicitly "cold."
"Taps to done" = taps from the relevant home surface to the event being persisted.

**Target bars (from PRODUCT.md):**
- Routine event (bottle, diaper) ≈ **3 seconds / 1–3 taps**.
- Common actions never exceed 1–3 taps from Today.
- The screen must feel **calmer after**, never busier.

**Status markers:** `CURRENT` = works now · `PARTIAL` = partly built · `TARGET` = required, not
yet met · `NO BACKEND` = UI can be prototyped but persistence/authorization is a later step.

**Accessibility baseline (applies to all flows):** large touch targets (≥44px), visible focus,
`aria-label` on icon-only controls, `aria-pressed`/`aria-current` for toggles/active tabs,
adequate contrast on the warm palette, no color-only state, one-handed reach (primary actions in
the lower two-thirds), respects reduced-motion, dynamic-type friendly. Screen-reader order follows
visual order.

---

## FLOW A — 3 AM Feed (breastfeeding: start → switch side → stop → check diaper)

The hardest, most important flow. Mom is half-asleep, one thumb.

**Screens:** Today → Feed sheet (bottom sheet) → Today.

**CURRENT behavior:**
- Today shows Feed/Sleep/Diaper/Pump quick actions and the "Last feed / Last diaper / Sleeping"
  status cards.
- Tapping **Feed** opens the log sheet defaulting to **Breast**, side **Left**. Tapping **Log it**
  records a breast feed with the chosen side.
- There is **no live breastfeeding timer and no in-feed side-switch**; a feed is recorded as a
  single event with a side, not a running session with left/right durations.

**CURRENT taps to a logged breast feed:** Feed → (Left already selected) → Log it = **2 taps**.

**TARGET behavior (Step 7 hardening):**
- One-tap "start feed" from Today that begins a **running feed session** with a visible timer.
- **Switch side** is a single toggle during the session (records per-side elapsed time).
- **Stop** ends and persists the session (total duration + per-side).
- After stopping, Today surfaces "Last feed: just now" and a one-tap path to the diaper check.
- Target sequence: **Start (1) → Switch (1) → Stop (1)**, diaper check is Flow C.

**Data:** `feed` log — method=breast, side(s), start time, end time, per-side duration. (Today's
model stores method+side but not start/stop/duration; Step 7 extends it.)

**Error states:** write failure → gentle inline toast, event kept in local state and retried;
never lose the session. If the app is killed mid-session, the running feed must be recoverable
(see edge cases).

**Undo/edit:** immediately after logging, an **Undo** affordance (target). Editing time/side from
history (target — not built yet).

**Accessibility:** the timer must be readable at a glance and announce state changes ("feeding,
left side"); start/switch/stop are large, reachable one-thumb; no reliance on precise dragging.

**Edge cases:** feed crossing midnight; app backgrounded/reloaded mid-feed (session must survive —
same requirement as Sleep, Flow D); Mom forgets to stop (allow later time-correction); both-sides;
switching sides more than once; starting a feed while a sleep timer is active (both may run).

---

## FLOW B — Bottle (log 120 mL formula). Target ≈ 3 seconds.

**Screens:** Today → Feed sheet → Today.

**CURRENT behavior:** Feed sheet → switch **Bottle** → choose contents (defaults **Breast milk**;
Formula is one tap) → type amount → Log it.

**CURRENT taps:** Feed → Bottle → Formula → (type 120) → Log it = **4 taps + typing**. This is
over the ~3s bar for the headline "120 mL formula" case.

**TARGET behavior:**
- Faster path to the common case. Options to hit ~3s: remember last-used contents/amount as
  defaults; quick-amount chips (e.g. 60/90/120/150) so amount is 1 tap not typed; or a "repeat
  last bottle" one-tap on Today.
- Target: **Feed → (contents preset) → amount chip → done ≈ 2–3 taps, no typing** for common
  amounts.

**Data:** `feed` log — method=bottle, contents (breast-milk|formula|unspecified), amountMl (≥0,
optional), time.

**Error states / undo / edit:** same as Flow A (gentle failure, retry, Undo, later edit).

**Accessibility:** numeric input has `inputMode="numeric"`; amount chips are large, labeled;
contents is a segmented control with clear selected state (not color-only).

**Edge cases:** unknown/partial amount (amount is optional); very large number (guard/validate);
contents "either"; back-to-back bottles.

---

## FLOW C — Diaper (Wet / Dirty / Both). 1–2 interactions.

**Screens:** Today → Diaper sheet → Today.

**CURRENT behavior:** Diaper opens a sheet with three big buttons; tapping one logs immediately
and closes. **Taps:** Diaper → Wet/Dirty/Both = **2 taps**. Meets the 1–2 bar.

**TARGET:** consider one-tap diaper directly from Today (skip the sheet) to reach 1 tap, if it
doesn't crowd Today. Keep the current 2-tap sheet as the floor.

**Data:** `diaper` log — kind (wet|dirty|both), time.

**Error states / undo:** gentle failure + retry; Undo immediately after (target). Wrong choice is
cheap to re-log.

**Accessibility:** three equal large targets; labels are text, not just icons.

**Edge cases:** rapid multiple diapers; mis-tap (undo/edit); diaper at midnight boundary.

---

## FLOW D — Sleep (start → leave app → return → stop). Timer must survive.

**Screens:** Today (toggle) → (leave) → Today (toggle).

**CURRENT behavior:**
- Sleep is a **one-tap toggle** on Today. Start creates a `sleep` log with `endedAt = null`; the
  status card shows "Sleeping" with elapsed time; the quick action relabels to **End sleep**.
- Because active sleep is a persisted row (`endedAt null`), returning later (even after reload or
  from another device) correctly shows the still-running session and lets Mom end it. **This
  already survives navigation/reload** via the server state — a real strength.

**CURRENT taps:** Start = **1 tap**; End = **1 tap**. Meets target.

**TARGET (Step 7):** editable start time (Mom starts late), correcting an accidental start
(cancel without a 0-length session), and clarity when a sleep spans a very long time. Elapsed
display should stay accurate after long backgrounding.

**Data:** `sleep` log — createdAt (start), endedAt (null while active), note optional. Constraint
(DB): `ended_at >= started_at`.

**Error states:** if "start" write fails, do not show a false "Sleeping" state; reconcile with the
server. If "end" fails, keep showing active and retry.

**Undo/edit:** cancel a just-started sleep; edit start/end from history (target).

**Accessibility:** the toggle announces state ("start sleep" vs "end sleep, sleeping 42 minutes");
active state not conveyed by color alone (label changes too).

**Edge cases:** two sleeps started by accident; sleep crossing midnight; app closed for hours then
reopened (elapsed must be correct); starting sleep while a feed session runs; multiple caregivers
ending the same sleep (last-write reconciliation — becomes relevant with Partner Mode).

---

## FLOW E — Brain Dump (mixed thoughts → proposed structured actions → approve/edit)

The Inbox. Governed absolutely by `SAFETY.md`: **AI proposes, user approves, DB commits;** the
original input is preserved immutably.

**Screens:** Inbox → (typing) → proposal review → commit → Plan (items appear).

**CURRENT behavior:**
- Inbox has one textarea ("What's on your mind?"), a "Try an example" filler, and "Sort this out."
- On submit, `/api/inbox` calls OpenAI (server-side) and returns an **interpretation** + a list of
  **proposed actions** (appointment / question / shopping / task). Nothing is saved yet.
- Each proposed row can be **removed** (X). "Discard" cancels; "Add everything" commits.
- On commit: plan items are created **and** an `inbox_capture` is stored with original input
  (verbatim/immutable), interpretation, proposed, approved, status. Committed items then appear in
  Plan and relevant ones on Today.

**CURRENT taps (example input):** type → Sort this out (1) → [optionally remove rows] → Add
everything (1) = **2 taps + typing** (plus optional per-row removals).

**TARGET (Step 10):** per-item **edit** (not just remove) before commit; per-item **add** (accept
some, not all); provider abstraction (`AIService`/`OpenAIProvider`); strict structured-output
validation; measure AI acceptance/edit rate. Voice-to-text is a natural later affordance for 3 AM.

**Data / provenance (must persist, never overwrite):** original_input, interpretation, proposed[],
user edits, approved[], status. This is already implemented and is a core `SAFETY.md` requirement.

**Error states:** model/network failure → gentle "Couldn't read that," input preserved so nothing
is lost; empty extraction → "I didn't find anything to add" (no invented actions); 401 (signed
out) → route to sign-in without losing typed text (target).

**Undo/edit:** discard whole proposal; remove/edit rows pre-commit; post-commit, items are editable
in Plan (editing a committed item must never rewrite the stored capture).

**Accessibility:** textarea labeled; proposed rows are a list with clear type labels ("Appointment",
"Question"); remove buttons have `aria-label`; busy state announced ("Reading…").

**Edge cases:** very long dump; nothing extractable; ambiguous dates ("Thursday" stored as
`whenText` phrase, not resolved to a date in V1); a name → assignee (e.g. "Matt") with no Partner
yet (assignee is free text until Partner Mode); medical-emergency language → per `SAFETY.md`, may
gently surface "seek care," never diagnoses.

---

## FLOW F — Appointment (questions accumulate over days → ready as a visit sheet)

**Screens:** (capture over days via Inbox or Plan) → Plan → Visit sheet.

**CURRENT behavior:**
- Appointments, questions, and shopping/tasks live in **Plan**, grouped. Questions can be linked
  to an appointment (data model supports `appointmentId`; questions nest under their appointment in
  Plan). Questions mark **answered**; the model exists.
- Questions can be created via Inbox (proposed → approved). **Manual add/edit of Plan items and
  manually attaching a question to an appointment are not built yet** (Step 9).
- **There is no Visit Mode / visit sheet yet** (Step 12).

**CURRENT taps:** view Plan = 1 tap; check a question answered = 1 tap. Building up questions today
happens through Inbox (Flow E).

**TARGET (Steps 9 + 12):**
- Manually add an appointment; add questions directly to it over several days (each ≤ 2–3 taps).
- Before the visit: a **describe-only Visit sheet** listing the appointment, the accumulated
  questions, notes, and factual recorded-data summaries (counts/durations only — **no
  interpretation**, per `SAFETY.md`), suitable to show a provider.

**Data:** `appointment` (title, whenText, who, location, note, questionIds), `question` (text,
appointmentId, answered), plus read-only recorded-data summaries.

**Error states / undo / edit:** standard gentle failure; edit/reorder questions; mark answered/
unanswered.

**Accessibility:** visit sheet is readable/scannable, large type, works when handed to a provider;
questions are a checkable list.

**Edge cases:** appointment with no questions; many questions; question not tied to any
appointment (stands alone in Plan); appointment time as a phrase vs. an actual date (V1 stores
phrases); rescheduled appointment.

---

## FLOW G — Partner (Mom assigns → partner sees → partner completes → Mom sees completion)

**NO BACKEND YET.** This flow can be **prototyped/mocked** in Step 4 but cannot be truly built
until the **Step 5 authorization-model migration** (family_members/roles) lands. **Do not patch
partner access onto the current single-owner model** (`families.owner_id = auth.uid()`).

**Screens (target):** Plan/Today (assign) → Partner's app ("Here's how you can help today") →
partner completes → Mom sees updated status.

**CURRENT behavior:** tasks have a free-text `assignee` (e.g. "Matt") but there is **no second
authenticated user, no invitation, no shared family, no partner view.**

**TARGET (Step 11, after Step 5):**
- Mom invites a partner; partner authenticates into the **same family**.
- Mom assigns tasks/shopping; partner sees **only what their role permits**, framed as help — not a
  mirror of Mom's full dashboard.
- Partner can log baby events and complete tasks; Mom sees completion reflected.
- **Family isolation is absolute:** Family A can never see Family B (RLS, `SAFETY.md`).

**Data (target):** family_members (user↔family, role), permissions, assignments referencing a
member, shared lists, shared baby status.

**Error states:** invite pending/expired; permission denied is silent-safe (partner simply doesn't
see restricted data); completion race (two people complete the same item).

**Accessibility:** partner's "how to help" list is simple, large, low-cognitive-load.

**Edge cases:** partner declines/never joins; multiple caregivers; revoking access; a caregiver in
two families; offline completion sync.

---

## FLOW H — Memory (save a meaningful moment rapidly)

**Screens:** Memories → Add composer → list.

**CURRENT behavior:**
- Memories tab → **Add** → type a title ("First real smile"), optional note, pick a date
  (defaults to today, capped at today) → **Save this moment.** Saved memory appears newest-first;
  each has a delete with confirm.
- **Text only.** Photos are **not** built. Persistence depends on the **`0002_memories.sql`
  migration, which is NOT verified live** — until it's confirmed, saving errors (the app degrades
  gracefully and still loads the rest).

**CURRENT taps:** Memories → Add (1) → type title → Save (1) = **2 taps + typing** (date/note
optional).

**TARGET (Step 13):**
- **Photo** capture/attach (Supabase Storage, RLS/storage policies).
- AI "Save this as a memory?" **suggestion** from Inbox/free text — **requires explicit
  confirmation** (never auto-saves), per `SAFETY.md`.
- Fast capture optimized so a one-line memory is near-instant.

**Data:** `memory` (occurredOn date, title, note, createdAt) + future photo reference. Owner-scoped
RLS via `owns_baby`.

**Error states:** save failure → gentle, text preserved; missing table (pre-migration) → graceful
degrade (memories simply absent), documented as not production-ready.

**Undo/edit:** delete with confirm (current); edit a memory (target).

**Accessibility:** date picker labeled; title input autofocused; delete is a two-step confirm to
prevent accidental loss of an irreplaceable moment.

**Edge cases:** backdated memory; very long note; deleting the wrong memory (confirm step);
memory with no note; (future) large photo/upload failure/offline.

---

## FLOW I — Day 90 (emotional retrospective from genuine recorded memories)

**NO BACKEND YET.** Can be **mocked** in Step 4; built in **Step 14**. Depends on Memories
(incl. photos, Step 13) and recorded data.

**Screens (target):** an entry point (e.g. surfaced near Day 90) → "Your First 90 Days"
retrospective → optional share/export.

**CURRENT behavior:** none. Day number is computed on Today, but there is no retrospective.

**TARGET (Step 14):**
- A beautiful, emotional retrospective assembled from **genuine** memories, photos, parent-written
  notes, and selected recorded moments. **No invented milestones**, no clinical interpretation
  (`SAFETY.md`).
- Feels like a gift, not a report.

**Data:** reads memories + selected recorded highlights (describe-only). No new derived judgments.

**Error states:** sparse data (few memories) → still graceful and warm, never empty/clinical.

**Accessibility:** large imagery + text; readable; shareable/exportable in an accessible format.

**Edge cases:** almost no memories logged; only text (no photos); baby younger than 90 days
(retrospective is a Day-90 arc — define behavior before day 90); very many memories (curate).

---

## Summary — current tap counts vs. target

| Flow | Current taps | Target | Status |
|---|---|---|---|
| A — 3 AM breast feed | 2 (single event, no timer) | Start/Switch/Stop running session | PARTIAL — Step 7 |
| B — Bottle 120 mL formula | 4 + typing | 2–3, no typing (chips/presets) | TARGET — Step 7 |
| C — Diaper | 2 | 1–2 (maybe 1 from Today) | CURRENT meets bar |
| D — Sleep start/stop w/ survival | 1 + 1 | + editable times/cancel | CURRENT meets core bar |
| E — Brain dump → actions | 2 + typing | + per-item edit/add, provider abstraction | CURRENT (core) |
| F — Appointment → visit sheet | view 1 / answer 1 | manual add + Visit sheet | PARTIAL — Steps 9/12 |
| G — Partner | n/a | full delegation | NO BACKEND — Steps 5/11 |
| H — Memory | 2 + typing | + photos, AI suggestion (confirmed) | PARTIAL — Step 13 (migration unverified) |
| I — Day 90 | n/a | emotional retrospective | NO BACKEND — Step 14 |

**Biggest UX gaps to resolve in Step 4:** Flow B (get the bottle case to ~3s without typing) and
Flow A (a real, reload-surviving feed session with side-switch). Flows G and I are mock-only until
their backends (Steps 5/11 and 14). Flow H depends on verifying the memories migration.
