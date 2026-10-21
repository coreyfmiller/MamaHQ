# MamaHQ — Roadmap & Deferred Work

**Status as of October 2026.** Beta Phases 1–6 + the Beta Launch Fixes and PR6
closed-beta hardening are merged; `main` is the live beta. Migrations run `0001 → 0018`.

> **Keeping this file honest is part of the work.** This document previously described a
> localStorage prototype with "Grocery: not built" long after the grocery stack, the
> shared calendar, tasks, ownership, care handoff, realtime, and Tell MamaHQ had all
> shipped. A roadmap that understates the product is as misleading as one that overstates
> it — it hides what's finished and invites rebuilding it. When a phase merges, update the
> table below in the same pass.

---

## 🎯 THE CORE — what we're driving toward

MamaHQ is the family's operating system, with **Mom kept visible**. It is not a baby
tracker; the baby is one area of a shared household brain. The **Contextual Assistant** is
the connective tissue that makes the separate areas behave like one system.

| Area | Primary job | Status |
| --- | --- | --- |
| **Tell MamaHQ** | Get things out of Mom's head instantly | 🟢 **Shipped (Step 12).** Real AI interpretation server-side → strict Zod-validated proposals → deterministic reference/time resolution → user confirms → execution through the existing trusted domain RPCs. Routes to Grocery, Tasks, Calendar and Care propose. In-app **text only**; no voice, photo, or purchasing. Provider is **OpenAI** (`gpt-4o-mini`) — see the provider note below. |
| **Shared Calendar** | Know what's happening and who owns it | 🟢 **Shipped (Step 10, consolidated in Phase 6).** Family-scoped `calendar_events` + participants keyed to household people, timed/all-day/multi-day, timezone-safe, an optional *responsible* person kept distinct from participants, transactional RPCs, RLS, a Calendar surface and Today integration. The legacy Appointments UI is retired — one scheduling source of truth. No recurrence, no external sync, no conflict detection. |
| **Tasks & Ownership** | Move responsibility to the right person | 🟢 **Shipped (Steps 8–9).** Durable `tasks` + `task_events`, ownership by a household person (account optional), creator/owner/completer kept distinct, atomic RPCs with idempotency, and explicit acceptance ("I've got it") that is distinct from completion. No recurring responsibilities yet. |
| **Grocery** | Maintain one intelligent shared shopping list | 🟢 **Shipped (Steps 1–6).** Catalog (417 canonical food concepts) → search index → free-text resolver (quantity/unit/attribute parsing) → action resolution → domain execution → completion → purchase event, plus household grocery memory (variants, observation ledger, conservative learning, "make this my usual"). Deterministic and test-covered. Not yet surfaced: "Usually Buy", Shopping Mode, store ordering, barcode. |
| **Meals** | Remove the "what are we eating?" decision | 🔴 **Not built.** No tables, no domain, no UI. The largest remaining surface, and it chains into Grocery (meal → ingredients → list). |
| **Baby / Care** | Keep essential baby info + caregiver context | 🟢 **Shipped (core + Phase 5 polish).** Logs (feed/sleep/diaper/pump/med), baby profile, memories, a 14-day History tab, and Care Handoff — a real holder + propose/accept/decline state machine where responsibility moves only on explicit acceptance. Deliberately shallow: no prediction, no wake windows, no percentiles, nothing clinical. |
| **Mom / First 90 Days** | Keep Mom visible | 🟢 **Shipped (Phase 4).** 90 audited human-written daily reads, timezone-safe day calc (`lib/first90.ts`), an honest Day 90+ transition, content→action through Tell and doctor questions, mood check-in and her own to-dos. **Not private** — see the open question below. |
| **Contextual Assistant** | Connect everything | 🔴 **Not built.** Today (Phase 3) is its deterministic ancestor: a pure projection over tasks, calendar, care and grocery with transparent rule-based ordering and no LLM. The assistant proper — grounded retrieval over that structured state — is still ahead. |

Legend: 🟢 shipped · 🟡 partial · 🔴 not built.

**What's actually left of the original vision:** Meals, the Contextual Assistant, and
notification *delivery*. Everything else in the table is real.

### ⚠️ Provider note — this needs a decision
Tell MamaHQ runs on **OpenAI** (`lib/tell/openai-adapter.ts`, `gpt-4o-mini`, overridable
via `TELL_MAMAHQ_MODEL`). The workspace steering standard says `gemini-flash-latest` is
canonical for every project, and earlier versions of this file claimed Tell was "powered
by gemini-flash-latest". **It isn't.** Either the standard gets an explicit MamaHQ
exception or the adapter gets swapped. The `Interpreter` interface means swapping is one
new adapter plus the factory — the contract, resolver, route and UI don't move. This is a
cost and vendor call, not a technical blocker.

### Product philosophy (the spine — protect these)
- **"Tell MamaHQ" is the front door, not a feature.** Mom never has to know which module
  something belongs to. One sentence fans out across domains and MamaHQ replies "I've got
  it." This multi-domain routing is the SIGNATURE experience, and it is now real.
- **Ownership moves mental load; it doesn't digitize a to-do list.** The win is "James owns
  groceries" (he gets the reminders, handles exceptions, Mom is NOT notified without a good
  reason), not "☐ groceries — James". Three distinct concepts: **Task** (do once),
  **Recurring responsibility** (repeats), **Ownership** (accountable for an area). Only the
  first is built.
- **The home sentence: "Nothing else needs your attention tonight."** Almost every family
  organizer tells Mom what to DO. MamaHQ should increasingly tell her what she can STOP
  thinking about. Earn it with **confidence-tiered language** — high: "You're clear for
  tonight"; medium: "Nothing else *in MamaHQ* needs your attention"; low: "Here's what
  MamaHQ has for tomorrow." **MamaHQ must never claim certainty it doesn't possess.**
- **Baby/Care stays lightweight on purpose — do NOT become Huckleberry.** The gem is Care
  Handoff, not tracking depth.
- **Meals + Grocery are basically ONE system; don't overbuild recipes.** Meals answers
  "what are we eating this week?" Tap a meal → add its ingredients to the one shared list.
  **Start deterministic:** a static ingredient template per meal, and "intelligence" means a
  *saved preference* ("use this list next time? ✓"), not ML.
- **The Contextual Assistant is NOT "ChatGPT inside MamaHQ."** It reads the STRUCTURED
  state of the household and **ends in action** ("add these 4 dinners to the plan"), not
  chat. Grounded retrieval, not an autonomous agent.

### Frozen scope
- **NOW:** Meals, Contextual Assistant, notification delivery. (The rest of the original
  "NOW" list has shipped.)
- **NEXT:** recurring responsibilities, voice into Tell, widgets/live activities, external
  calendar sync, documents, photo intelligence (school notice→event, recipe→meal+ingredients).
- **LATER:** budgeting, photo memories, location tracking, school management, advanced sleep
  analytics, family messaging.

---

## 🏗️ Architecture — the three systems, and how real each one is

Screens sit over three foundational systems. These were a design lens; two are now
substantially built.

- **Household Graph** — 🟢 **real.** `household_people` (identity, relationship, nullable
  account), `family_members` (authorization), secure hashed-token invitations with
  transactional acceptance, and the canonical-identity RPC. Scales to grandparent, teen,
  sitter. Member *removal* is the notable gap.
- **Action Engine** — 🟡 **partly real.** Tasks, calendar events, grocery items, care
  handoffs and notifications each have an owner, a when, and a state. Missing: recurrence,
  and Meals as an action type.
- **Context Engine** — 🟡 **partly real.** `lib/today/model.ts` is a working deterministic
  context read over tasks/calendar/care/grocery. The Contextual Assistant would read from a
  broadened version of exactly this.

**Invariants to preserve** (these are enforced, not aspirational):
**Assigned Person ≠ Authorized User** · **Person ≠ Account ≠ Membership ≠ Responsibility** ·
**Assigned ≠ Accepted ≠ Completed** · **Participant ≠ Responsible**. Identity is the
canonical household person linked to the auth account — never device-local inference.

---

## 🧭 Build sequence — where we actually are

1. ~~Person/Household model + schema shape~~ → **done** (Step 2, hardened in Step 7).
2. ~~Real "Tell MamaHQ" AI extraction~~ → **done** (Step 12).
3. ~~Connect extraction to Calendar + Tasks + Grocery~~ → **done.** Meals is the one
   missing target.
4. ~~Full partner account / invite~~ → **done** (Step 7 + Phase 2 journeys).
5. **Ownership (assigned → connected)** → *partly done.* Tasks carry a real owner and
   explicit acceptance. What's missing is **recurring responsibility** and **area
   ownership** — the "James owns groceries" concept, as opposed to one assigned task.
6. ~~Care Handoff~~ → **done in-app** (Step 9). External delivery still absent.
7. **Contextual Assistant** → next big one, after Meals gives it something more to read.
8. **Confidence / reassurance layer** → last, once context is reliable.

**Recommended next build: Meals.** It's the largest 🔴, it's deterministic (no new
intelligence infrastructure), it completes the Tell routing surface, and it feeds Grocery
which is already strong. The Contextual Assistant gets meaningfully better with it and
meaningfully thinner without it.

---

## 🔑 Blocked on external accounts

The only genuinely blocked work. Everything else is buildable today.

**Notification delivery** — in-app notifications are real and durable (Step 11). There is
no push, email, or SMS. `lib/notify.ts` is the outbound seam and the model deliberately
separates the notification *record* from *delivery*, so adapters slot in without touching
domain logic.

- **Resend** (email): resend.com → API Keys. Quick sender: `onboarding@resend.dev` (only
  mails your own address). Real sending needs a DNS-verified domain.
- **Twilio** (SMS): account SID + auth token + an SMS-capable number. Trial can only text
  verified numbers.
- ⚠️ **A Resend key was previously exposed and must be revoked before a new one is minted**
  — see `docs/HUMAN_ACTIONS.md` #2. Do not re-provision until delivery is actually being
  built.

Note what delivery does **not** mean: Beta Phase 1 **removed** the partner SMS/email
toggles because they implied a channel that didn't exist, and MamaHQ never claims to send
an invitation — it generates a link for the human to share.

---

## 🛡️ Ownership & permissions

**Mama owns everything. A partner is a revocable helper — his presence only ADDS help; his
absence never SUBTRACTS anything of hers.** Ownership is non-transferable.

Shipped: a single-owner family (`0015_owner_family_uniqueness`), owner-privilege hardening
(`0017`), identity reset (`0016`), and family-scoped RLS throughout with DB-level
enforcement rather than hidden UI.

Still to build: the **member removal workflow** (`family_members.status` already includes
`removed`, so authorization can be revoked while the person row — and all historical
ownership references — survives). No workflow or UI exists.

**Two open questions** (your call):
1. Should the Me tab (mood, her questions, check-ins) be **private** from a partner? →
   Recommend **yes**. It is currently family-scoped and therefore household-visible; the UI
   says so honestly rather than implying privacy. Making it private needs a schema + RLS
   change.
2. Partner writes: **append-only**, or edit/delete their own additions? → Recommend
   **append-only** — simplest, safest, no quiet alterations.

---

## Deferred by design — do not add opportunistically

- **Analytics and crash monitoring (Sentry).** `lib/monitoring.ts` is a privacy-first seam
  that is a **no-op today** — the package isn't installed and no DSN is set. Error
  boundaries work and never show raw errors; out-of-app crash *reporting* does not exist.
  Enabling it under Next 16 + Turbopack needs real instrumentation wiring. **Never claim
  monitoring exists.**
- **Prediction of any kind** — no next-feed, wake windows, percentiles, or normal/abnormal.
- **Medical or clinical interpretation** — no symptom ranking, no screening instruments, no
  urgency scoring. Mood is reflection only.
- **LLM-assigned urgency or priority.** Today's ordering is deterministic and auditable.
- **Autonomous execution.** Tell proposes; a human confirms; trusted RPCs execute.
- **Self-service account deletion** — operator-managed for the closed beta, per
  `docs/BETA_DATA_DELETION.md`. The app never claims self-delete exists.

## Retired

- **The legacy rule-based Inbox** (capture → review → commit with a local extractor,
  on-device voice, and Tesseract OCR) was the signature feature before Tell. Beta Phase 1
  made Tell the single capture path; the Inbox code and `captures` data remain in the tree
  but are **unreachable from navigation**. Deleting it is tracked in `docs/TECHNICAL_DEBT.md`.
  Its architectural lesson survives in Tell: sources normalize to raw text, a swappable
  provider interprets, and commit is the only place proposals meet real stores.
- **The legacy Appointments UI** (Phase 6). Tables and rows are preserved but dormant; the
  canonical Calendar is the one scheduling surface.
- **Gmail as a capture source** — was scoped out when MamaHQ had no backend. That premise
  is gone (Supabase + RPCs + API routes all exist), so the real remaining costs are a Google
  Cloud project, OAuth verification for Gmail read scopes, and a Pub/Sub webhook. It would
  now enter as another source feeding Tell, not the retired Inbox.

---

## Where to look

- `docs/PRODUCT_LIMITATIONS.md` — the authoritative "this does NOT exist yet" record
- `docs/TECHNICAL_DEBT.md` — known debt and deferred architecture
- `docs/HUMAN_ACTIONS.md` — things only you can do (two credential rotations outstanding)
- `docs/MANUAL_QA.md` — human device QA, all of it still outstanding
- `lib/today/model.ts` — the Today projection, and the seed of the Context Engine
- `lib/first90.ts` — journey day calculation
- `docs/TELL_MAMAHQ.md` — the Tell trust model

Live at https://mamahq.vercel.app/app — auto-deploys on push to `main`.
