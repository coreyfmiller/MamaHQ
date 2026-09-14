# Mama HQ — Competitive Specification

We are learning from **established category patterns**, not copying anything proprietary. This
document reverse-engineers the *shape* of the newborn-tracking category — what capabilities have
been validated by the market — and decides where Mama HQ matches, exceeds, differentiates, defers,
or refuses.

**Reference products** (studied as category patterns only): Huckleberry, Nara Baby, Onoco,
Baby Tracker / Nighp.

> **We do not reproduce proprietary branding, text, illustrations, screenshots, layouts, or code.**
> These products validate *demand for capabilities*. We build an original product.

---

## Competitive ownership

- **Huckleberry (and the category broadly) can own:** *What should baby do next?* — predictions,
  sleep windows, "next nap" guidance, developmental "what to expect."
- **Mama HQ owns:** ***What does Mom need to know, remember, or do right now?*** — mental-load
  reduction, capture-and-organize, appointment prep, partner handoff, the Day 1 → Day 90 arc.

We compete on **effort-to-log** and **usefulness-afterward**, not on the count of trackable metrics.

---

## Feature matrix

Legend: ✅ common across the category · ◐ present in some · ○ rare/absent

| Capability | Category presence | Mama HQ classification |
|---|---|---|
| Breastfeeding timer (side, duration) | ✅ | **BASELINE** |
| Bottle logging (amount, contents) | ✅ | **BASELINE** |
| Pumping logging | ✅ | **BASELINE** |
| Sleep tracking (incl. active timer) | ✅ | **BASELINE** |
| Diaper logging (wet/dirty/both) | ✅ | **BASELINE** |
| History / timeline of events | ✅ | **BASELINE** |
| Fast/one-tap logging | ◐ | **IMPROVE** (our headline advantage) |
| Caregiver synchronization | ◐ | **BASELINE** (via Partner Mode) |
| Reminders | ◐ | **BASELINE** |
| Reports / summaries | ✅ | **IMPROVE** (describe-only, for a provider visit) |
| Appointments | ○ | **IMPROVE** |
| Questions for clinicians | ○ | **IMPROVE / DIFFERENTIATE** |
| Mom's own support & recovery logistics | ○ | **IMPROVE / DIFFERENTIATE** |
| Partner/caregiver *delegation* (not just shared view) | ○ | **DIFFERENTIATE** |
| Brain-dump → structured proposed actions (AI) | ○ | **DIFFERENTIATE** |
| Tasks + shopping + lists integrated w/ newborn context | ○ | **DIFFERENTIATE** |
| Visit-prep screen from recorded data | ○ | **DIFFERENTIATE** |
| First-90-days framing (Day 1 → Day 90) | ○ | **DIFFERENTIATE** |
| Day-90 emotional retrospective | ○ | **DIFFERENTIATE** |
| Memories (photo/sentence/date) | ◐ | **IMPROVE** |
| Growth tracking (weight/length/percentile *display*) | ✅ | **LATER** |
| Medication logs | ◐ | **LATER** |
| Milestones checklists | ✅ | **LATER** |
| Rich analytics / charts / patterns | ✅ | **LATER** (guard against dashboard creep) |
| Sleep predictions / "next nap" | ◐ (Huckleberry-led) | **NOT V1** |
| Sleep coaching / programs | ◐ | **NEVER (current strategy)** |
| AI pediatrician / symptom checker | ○ | **NEVER** |
| Feeding-adequacy / "is baby ok" judgments | ○ | **NEVER** |
| Developmental scoring | ○ | **NEVER** |
| Automated medical/feeding recommendations | ○ | **NEVER** |

---

## BASELINE — proven functionality Mama HQ needs

Breastfeeding timer, bottle logging, pumping, sleep (with active timer), diapers, history, fast
logging, caregiver sync, reminders. These are table stakes. We must have them and they must be
fast. **Status today:** Feed/Sleep/Diaper/Pump logging + history exist; reminders and true
caregiver sync do not yet (see `ROADMAP.md`).

## IMPROVE — where Mama HQ should be substantially better

- **Logging speed** — ~3s for routine events; this is the flagship improvement.
- **Appointments & questions for clinicians** — first-class, not an afterthought.
- **Mom support** — the product remembers Mom, not only the baby.
- **Partner/caregiver experience** — help without adding management work for Mom.
- **Useful summaries** — describe-only recorded data, framed for a provider visit.
- **Memories** — quick to capture, emotionally returned later.

## DIFFERENTIATE — Mama HQ's unique value

- **Brain dump → structured actions** (Inbox + AI proposals).
- **Tasks + shopping + appointments integrated with newborn context.**
- **Partner delegation** (real handoff, not a mirrored dashboard).
- **Visit preparation** from recorded data.
- **First-90-days framing** with a real beginning and end.
- **Day-90 retrospective** — the emotional payoff.
- **Mental-load-first positioning** overall.

## LATER — plausible future functionality (not V1)

Growth tracking, medication logs, milestones, richer reporting. Architect so these *could* be
added; do not build them now, and keep reporting from ever becoming a dashboard.

## NOT V1 / NEVER under current strategy

AI pediatrician, symptom checker, sleep coaching, automated feeding recommendations, developmental
scoring, medical diagnosis. These conflict with `SAFETY.md` and/or the mental-load-first strategy.
NEVER items are permanent refusals under the current strategy, not deferrals.

---

## Strategic summary

The category has proven people will track a newborn. It has **not** solved the mother's mental
load, the partner handoff, appointment prep, or the emotional arc of the first 90 days. That gap —
plus being the fastest, calmest place to log — is Mama HQ's opening.
