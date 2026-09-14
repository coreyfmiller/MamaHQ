# Mama HQ — First 90 Days

**This is the canonical product document for Mama HQ.** It is the primary human-readable
constitution for what the product is and is not. When any instinct — convenience, speed, a
tempting feature — conflicts with this document, this document wins. Only `SAFETY.md` outranks it.

The `.kiro/steering/` files defer to this document; they exist for operational guidance and point
back here rather than restating product logic.

---

## Product promise

> **Your first 90 days. All in one place.**

## Core problem

**Mental load.** The first 90 days with a newborn scatter a mother's attention across a dozen
tools and her own exhausted memory: one app for feeds, another for sleep, a calendar for
appointments, notes for questions, texts to coordinate with a partner, and her head for
everything else. Mama HQ exists to reduce how much a mother has to hold in her head.

## Primary user

**Mom.** Possibly sleep-deprived, recovering, feeding in any of several ways, operating a phone
one-handed while holding a baby. The product is built for her first.

## Secondary users

**Partner / co-parent / trusted caregiver.** They help Mom. Their experience must never create
more management work for Mom (see Partner, below). Partner Mode is a V1 goal but requires an
authorization-model change before it can be built safely — see `ROADMAP.md` Step 5 / Step 11.

## Core strategic position

Existing apps (Huckleberry, Nara Baby, Onoco, Baby Tracker/Nighp) have already proven demand for
newborn tracking. Mama HQ does **not** compete by tracking more baby metrics. It wins through:

1. **Extremely fast logging** — routine events in ~3 seconds or less.
2. **Mental-load reduction** — it remembers tasks, shopping, appointments, questions, supplies,
   partner responsibilities, and stray thoughts so Mom doesn't have to.
3. **Intelligent Inbox / brain dump** — messy free text becomes proposed, structured actions.
4. **Appointment preparation** — what Mom records all week becomes useful at the visit.
5. **Partner coordination** — real work handed off without Mom becoming a project manager.
6. **A clear Day 1 → Day 90 experience** — the product has a beginning and an emotional end.
7. **Memories and emotional retrospective** — the small moments preserved and given back.

> **Mama HQ does not need to beat established baby trackers on the number of things they track.
> It must beat them on how little effort tracking requires and how useful that information
> becomes afterward.**

### Competitive ownership (see `COMPETITIVE.md`)

- Huckleberry can own: *What should baby do next?*
- **Mama HQ owns: *What does Mom need to know, remember, or do right now?***

## The UX north star (non-negotiable)

Assume the user is **holding a newborn in one arm, operating the app with one thumb, at 3:17 AM.**
Large touch targets. Very few taps (1–3 for common actions). No dense dashboards, no clinical
tone, no judgment. **The product should feel calmer after opening it than before.**

## The product loop

**CAPTURE → ORGANIZE → REMIND → SHARE → REMEMBER.**
Capture fast, organize automatically, surface at the right time, let others help, preserve what
matters.

## Core experiences

1. **Today** — the calm home screen. When did baby last eat? Is baby sleeping? Last diaper?
   What's on today? What must I remember? What can someone else handle? Plus an optional, gentle
   Mom check-in. Not an analytics dashboard.
2. **Baby / Logging** — fast Feed, Sleep, Diaper, Pump. Sensible defaults, big targets, ~3s.
3. **Inbox** — one input: *What's on your mind?* Mom dumps messy information; AI proposes
   structured actions; Mom approves/edits before anything is saved.
4. **Plan** — tasks, shopping, lists, appointments, questions. Everything works manually before
   AI touches it.
5. **Partner** — assigned tasks, shared baby status, upcoming appointments, shared lists. Framed
   as *"Here's how you can help today,"* not a clone of Mom's dashboard.
6. **Visits** — appointment questions, notes, and factual summaries of recorded data for Mom to
   bring to a provider. No medical interpretation.
7. **Memories** — a photo, a sentence, a date. Quick.
8. **Day-90 retrospective — "Your First 90 Days"** — an emotional, beautiful retrospective built
   only from genuine recorded memories and moments. No invented milestones.

## Logging target

Routine events should ideally be recordable in **approximately 3 seconds or less**. Logging speed
is a first-class product metric, not a nice-to-have.

## V1 scope

**Strictly the first 90 days after a baby comes home.** Primary navigation is exactly five
destinations: **Today, Baby, Inbox, Plan, Memories.** Partner and Visits are V1 experiences that
may live adjacent to (not inside) the five-tab primary nav. Account/family/settings live outside
primary nav. Build the smallest slice that proves the loop, then broaden.

## Explicit exclusions (not in V1; some never under current strategy)

- Pregnancy
- First foods / solids
- Toddler functionality
- School years
- General "family OS"
- Community / social feed
- Sleep coaching
- Medical diagnosis
- Symptom checker
- Developmental scoring
- Medication recommendations
- Marketplace
- Advertising

Architect reasonably for future expansion; do not implement any of the above now. "Grows with the
child" is a **different product** (MindfulMama), not Mama HQ.

## Canadian-first strategy

Launch market is **Canada**. The architecture must support future international localization
(United States, United Kingdom, Australia, others): no Canada-specific content hard-coded into
components; country/region is data, not brand. **Canada is the launch market, not a permanent part
of the brand identity.**

## Success criteria

A Mama HQ feature is only "done" when:

- It works one-handed, one-thumb, fast — 1–3 taps for common actions.
- Opening it feels calmer, not busier.
- It honors `SAFETY.md` absolutely (describe recorded data, never interpret the baby; AI proposes,
  never silently commits; provenance preserved).
- It never loses or corrupts a family's logged data.
- Nothing feels clinical, judgmental, or like a dashboard.
- It assumes no single family structure, feeding method, or birth experience.

Product-level success (measured, not vibes): onboarding completion, time-to-log a routine event,
daily logging, Inbox usage and AI acceptance/edit rate, partner invitation + activity, appointment
usage, memories saved, and retention through Day 1 / 7 / 30 / 60 / Day-90 completion.
