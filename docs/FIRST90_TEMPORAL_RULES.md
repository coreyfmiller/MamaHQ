# First 90 Days — Temporal Content Rules

How to write First90 editorial content (daily reads + affirmations) so it is never
temporally false. Enforced by `scripts/test-first90-temporal.ts` and summarized in the
header comments of `lib/affirmations.ts` and `lib/daily-reads.ts`.

## Day N semantics (source of truth: `lib/first90.ts`)

- **Day 1 = the local calendar day the baby was born.** Each later *local calendar
  date* adds one. It is calendar-day arithmetic, not elapsed 24-hour periods.
- MamaHQ displays **"Day N" for the entire in-progress local calendar day N**
  (00:00–23:59 local). The user is *living through* Day N while it is shown.
- Therefore, at any moment on Day N, **at most N − 1 days are complete.** By the time
  Day N is actually over, the app already shows Day N+1.

**The invariant:** content shown on Day N may reference at most **N − 1** completed
days/nights, and must **never state that Day N itself (or its current week/month) is
finished.**

## Time-of-day slots (affirmations only)

`slotForHour` uses the **local hour**: `morning` < 12:00, `noon` 12:00–19:59,
`night` ≥ 20:00. Re-evaluated live (`useNow`).

- **morning** must not assume today's events have happened yet.
- **noon** may acknowledge part of the day has passed, but not that specific events
  occurred. (This slot now covers the 18:00–20:00 early-evening window, so noon lines
  must stay time-neutral enough to read at 7pm — they are.)
- **night** begins at 20:00 — up to ~4 hours before midnight. It may
  acknowledge lateness but must **not** declare Day N over.
- **Daily reads have NO slot guarantee** — a read can be opened at any hour of Day N.
  A read must not assert a time of day or that the user's clock-day went a certain way.

## The three-way taxonomy

- **SAFE** — present-tense framing: "You're on Day N", "Two weeks in", "Day 1",
  "Two months.", "N days in", "You've made it through N − 1 days", back-references to
  "Day 1", and accumulated-experience phrasing ("already", "so far", "by now") about
  the whole journey.
- **CONTEXT-DEPENDENT** — a quantity bound to the *current* unit ("Fourteen days of…"
  on Day 14, "spent sixty days" on Day 60). Prefer the "N days in" / present-tense
  form. Human editorial call.
- **TEMPORALLY INCORRECT** — a completion verb bound to the current-or-future unit:
  "made it through Day N", "your first week is complete", "N days down", "behind you"
  for a span that isn't finished yet. Not allowed.

## Milestones

- Week labels must match the day count: Day 21 = three weeks, Day 42 = six weeks,
  Day 84 = twelve weeks (present-tense "you're in week N", never "N weeks complete").
- "Month" is editorial shorthand for 30/60 days (Day 30 / Day 60). The day count must
  stay honest ("thirty days", not a literal calendar month claim).
- **Day 90 night is the one deliberate exception**: at the last displayed day the
  journey really is complete, and the copy points forward to Day 91 / Beyond-90. This
  is the only place a "made it through your First 90 Days" style line is correct.

## Authoring hygiene

- `body[]` and `prompt` on a daily read render **verbatim** in the Read overlay. They
  are user-facing prose only — never put authoring/editorial notes, product guidance,
  or review checklists in them. (A set of such notes had leaked into the Day 90 body;
  the guard now blocks that.)

## The guard (`scripts/test-first90-temporal.ts`)

Keys on **completion-verb + current-day-unit**, not on individual banned words, so it
catches the dangerous forms (e.g. Day N "made it through N days") without rejecting
legitimate warm prose or present-tense labels. It also blocks authoring notes in read
bodies, factual time-of-day assertions in reads, and includes a negative self-test so
the detector can't silently become a no-op. Run via `pnpm run test:first90-temporal`
(part of `verify` and CI).
