# MamaHQ — Responsibility Acceptance & Care Handoff (Step 9)

The next layer of MamaHQ's mental-load architecture. Step 8 established *who is
responsible* (assignment/ownership). Step 9 establishes whether someone has actually
**taken** that responsibility.

Two principles frame everything below:

- **Assignment is a request for responsibility. Acceptance is the explicit transfer
  of mental load.**
- **For care: a proposed handoff does not transfer responsibility. Responsibility
  transfers only when the receiving caregiver explicitly accepts.**

Assignment, viewing, opening the app, or a (future) notification are **never**
acceptance. Acceptance requires an explicit action by an authenticated account
linked to the assigned HouseholdPerson.

---

## Identity model (unchanged)

| Concept | Meaning | Where |
|---|---|---|
| Auth User | how someone authenticates | `auth.users` |
| Family Member | authorization to access a household | `family_members` |
| Household Person | who the human is | `household_people` |
| Task Owner | HouseholdPerson responsible for a task | `tasks.assigned_to_person_id` |
| Care Holder | HouseholdPerson currently holding active care | `care_responsibility.holder_person_id` |
| **Responsibility Actor** (Step 9) | the authenticated account explicitly accepting / relinquishing / handing off / receiving | `auth.uid()` linked to the person |

Ownership and care-holding are **always** a `household_people` id; the acting
account is **always** an `auth.uid()` linked to that person. Never a string like
`"partner"` or `"mom"`.

---

## Part A — Task acceptance ("I've got it")

### Data model (current acceptance on the row + history in events)

Current acceptance lives on `tasks` so it's a cheap read (no event replay):

| Column (added in 0011) | Meaning |
|---|---|
| `acknowledged_at` | when the current acceptance happened; `null` = assigned but not accepted |
| `acknowledged_by_user_id` | the responsibility actor (auth user) who accepted |
| `acknowledged_by_household_person_id` | the HouseholdPerson who accepted (== `assigned_to_person_id` at accept time); `SET NULL` on person removal so history survives |

Historical acceptance lives in `task_events`, whose `event_type` CHECK was widened
additively to include `accepted` and `relinquished` (now:
`created / assigned / reassigned / accepted / relinquished / completed / reopened`).

**Invariants** (all tested):
- Current acceptance is queryable without reconstructing history.
- Historical acceptance remains in `task_events` and is never rewritten.
- **Reassignment invalidates current acceptance** — the new owner has not accepted.
- **Reopen invalidates current acceptance** — re-acceptance is required.
- **Relinquish invalidates current acceptance** — but keeps assignment.
- **Only the assigned, connected HouseholdPerson can accept.**

### Authorization model

`accept_task(p_task_id)` (SECURITY DEFINER, `search_path=public`) resolves the
assigned person's linked `user_id` and requires it equals `auth.uid()`. This blocks:
- another family member accepting on someone's behalf (no proxy acceptance in Step 9);
- accepting for an account-less person (their `user_id` is null, never equals the
  caller). Acceptance sets the columns + appends an `accepted` event, atomically.
  Idempotent. Does **not** complete the task.

`relinquish_task(p_task_id)` requires `acknowledged_by_user_id == auth.uid()` (only
the accepter may release). Clears the columns + appends a `relinquished` event. Does
**not** change assignment and does **not** reassign — "James is still assigned, but
has explicitly said he doesn't currently have it."

`assign_task` and `reopen_task` were **redefined** in 0011 (create-or-replace) to
clear the acknowledgement columns as part of their transaction. Historical `accepted`
events are untouched.

### Acceptance ≠ completion

Separate lifecycle facts. A task may be completed without ever being accepted (valid
history). Completion never fabricates an acceptance event; acceptance never completes
the task. `created / assigned / accepted / completed` can all be true and distinct.

### UI

For an open task, the Tasks surface shows exactly one acceptance state:
- assigned to me, not accepted → **"I've got it"** (button)
- accepted by me → **"You have this ✓"** + "I can't take this" (relinquish)
- accepted by someone else → **"{name} has it ✓"**
- assigned to someone else, not accepted → **"Waiting for {name} to accept"**

We never show "{name} has it" until they actually accept.

---

## Part B — Care handoff

Care responsibility is an **active period**, not a to-do. It is a separate domain —
we do **not** model "watching the baby" as a Task.

### Data model

`care_responsibility` — CURRENT truth (one row per family/subject):
`id, family_id, subject_baby_id (→ babies, SET NULL), holder_person_id (→
household_people, SET NULL), updated_at, created_at`. A unique index on
`(family_id, coalesce(subject_baby_id, ...))` guarantees a single current-holder row.

`care_handoffs` — HISTORICAL truth + the pending state machine:
`id, family_id, subject_baby_id, from_person_id, to_person_id (→ household_people,
required), proposed_by_user_id, status, context jsonb, created_at, resolved_at,
resolved_by_user_id`. A partial unique index enforces **at most one `pending`
handoff per family/subject**.

### State machine

```
                 propose
   (holder=Mom) ─────────▶ pending ──── accept ───▶ accepted   (holder=James)
                             │  ├──── decline ──▶ declined   (holder=Mom)
                             │  └──── cancel  ──▶ cancelled  (holder=Mom)
```

- **Propose** (current holder → recipient): creates a `pending` handoff. Holder does
  **not** change.
- **Accept** (recipient only): marks `accepted` **and** moves the holder to the
  recipient, in one transaction — never an intermediate state where care disappears
  or two people are both "the holder".
- **Decline** (recipient only): `declined`; holder unchanged.
- **Cancel** (proposer or current holder): `cancelled`; holder unchanged; the stale
  request can no longer be accepted.

### Current care-holder model

The holder is a HouseholdPerson. Acceptance is performed by the authenticated account
linked to that person (same doctrine as Tasks), so future caregivers (Dad, Grandma,
babysitter) fit without corrupting identity. `ensure_care_responsibility` bootstraps
the family's row and makes the first authenticated caller the initial holder
(deterministic, idempotent — mirrors `ensure_owner_person`).

### Unconnected household people — decision

**Option B chosen:** an in-app handoff requiring acknowledgement can be proposed
**only to a connected account.** `propose_care_handoff` rejects a recipient whose
`household_people.user_id` is null (`recipient has no connected account and cannot
accept a handoff`). Rationale: a person who can never accept would leave the handoff
permanently pending and imply a transfer that can't complete — the opposite of the
mental-load goal. Proxy/offline handoff would be a separate future feature. We never
auto-accept.

### Deterministic care context (never fabricated)

The handoff summary (`care_handoffs.context`, and the live preview) is built **only**
from persisted `logs` using the same selectors the Baby/Today screens trust
(`lastOfKind`, `activeSleep`, `clockTime`, `elapsed`):

- **Last feed** — most recent `logs` row `kind='feed'` → time (+ amount/side if present).
- **Last diaper** — most recent `kind='diaper'` → time (+ `diaper_type`).
- **Last nap** — most recent `kind='sleep'`: start always; **end only when
  `ended_at` is set**. An in-progress nap shows "sleeping since {time}" and no end —
  we never invent a wake time.

**Fields deliberately omitted:**
- **Next feed / next bottle** — MamaHQ has **no** schedule or prediction anywhere;
  computing one would be fabricated data. Omitted by design (§12).
- Any interpretation of hunger/tiredness/health — this is household coordination, not
  medical interpretation (§31).

### Authorization

All care mutations are SECURITY DEFINER (`search_path=public`), authorize
`auth.uid()`, verify family membership, and derive family/identity from the row —
never caller-supplied. Enforced in the DB (tested):
- recipient must belong to the same family (cross-family rejected);
- only the recipient's linked account may accept/decline;
- only the proposer or current holder may cancel;
- stale accept (after cancel/decline) rejected — status must be `pending`;
- duplicate accept is safe; the holder transition is atomic;
- direct client insert/update is blocked by RLS (accepted state / holder cannot be
  forged); no delete policy (least privilege, matching the Step 8 correction).

---

## Concurrency & idempotency

Every mutation is a single transactional RPC with a `for update` row lock, so a
propose/cancel/accept race resolves to exactly one winner. Accept/decline/cancel are
idempotent on their terminal state; a stale accept after a terminal transition is
rejected rather than corrupting the holder. Task accept/relinquish are likewise
idempotent and row-locked.

---

## Out of scope (deferred — see PRODUCT_LIMITATIONS.md)

Realtime (a refetch shows the result — no polling hacks); push/email/SMS
notifications; "hasn't accepted yet" nagging; Tell-MamaHQ / AI parsing or care
interpretation; proxy acceptance for account-less people; care scheduling / custody;
medication management. Step 9 establishes trustworthy state; delivery and intelligence
come later.

---

## Manual QA

See `docs/MANUAL_QA.md` (Step 9 section) for the human-run task-acceptance,
reassignment, care accept/decline/cancel scripts. Not claimed passed until a human
performs them.
