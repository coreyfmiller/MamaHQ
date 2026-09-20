# MamaHQ — Tasks, Responsibilities & Ownership (Step 8)

MamaHQ's first durable household **responsibility** system. This is not a
to-do/project app. The product thesis is **mental load**: a household task quietly
requires someone to notice it, remember it, decide when it's due, decide who does
it, follow up, and confirm it's done — and Mom usually performs most of those jobs
even when someone else physically does the task. Explicit ownership is the first
step to removing those invisible coordination jobs.

Two principles frame everything below:

- **If Mom is the only person who knows, Mom is still carrying it.**
- **A task being written down is not the same as responsibility being transferred.**

Step 8 establishes *who currently owns* a responsibility. It deliberately does
**not** yet model *acknowledgement* ("James has got it") — that is a later step.

---

## The identity/ownership model (do not conflate)

| Concept | Question | Where it lives |
|---|---|---|
| **Auth User** | How does someone authenticate? | `auth.users` |
| **Family Membership** | What household may they access? (authorization) | `family_members` |
| **Household Person** | Who is this human in the household? | `household_people` (`user_id` null = no account) |
| **Ownership** | Who is responsible for a task? | `tasks.assigned_to_person_id → household_people` |
| **Creator** | Who entered the task? | `tasks.created_by_user_id → auth.users` |
| **Completer** | Who actually completed it? | `tasks.completed_by_user_id → auth.users` |

**Ownership references a `household_people` id, never an auth user id, and never a
display string like `"partner"`.** Assignment is attribution/responsibility — it
**never** grants application access. Access is gated solely by
`is_family_member(family_id)` (the same boundary as every table). A person may own a
task with **no account at all** (e.g. Grandma).

**Creator ≠ Owner ≠ Completer.** Mom can create "Call pediatrician" and assign it to
James; Dad can complete it. All three facts are recorded and independent. Completing
a task **never** rewrites its ownership.

---

## Data model

### `tasks` — current truth

| Column | Meaning |
|---|---|
| `id` | uuid PK (client-supplied for idempotent create) |
| `family_id` | household (FK `families`, cascade) |
| `title` | what needs doing (1–500 chars, trimmed) |
| `notes` | optional detail |
| `status` | **`open` \| `completed`** — minimal by design (see below) |
| `assigned_to_person_id` | **ownership** → `household_people`, `on delete set null` |
| `created_by_user_id` | **creator** → `auth.users`, `on delete set null`, default `auth.uid()` |
| `source` | provenance: `manual` (used) \| `tell_mamahq` \| `household_member` \| `care_handoff` \| `calendar` \| `system` |
| `due_at` | optional due date/time |
| `completed_at`, `completed_by_user_id` | **completion facts** (distinct from owner); cleared on reopen |
| `created_at`, `updated_at` | provenance (`updated_at` via shared trigger) |

`on delete set null` on the person FKs is deliberate: removing a person (or later
disconnecting an account) must **never** delete a task or its history — the task
simply becomes unassigned, and the history keeps the person reference until/unless
the row is removed.

### `task_events` — historical truth (lean, append-only; **not** event sourcing)

`id`, `family_id`, `task_id` (FK cascade), `event_type`, `actor_user_id`,
`prev_person_id`, `new_person_id`, `metadata jsonb`, `created_at`.

`event_type ∈ {created, assigned, reassigned, completed, reopened}`. The CHECK is
extensible additively — a future step can add `acknowledged` / `declined` /
`handed_off` without a destructive migration.

We never reconstruct a task from its events (the `tasks` row is current truth), and
we never rewrite events to make the present look tidy. This mirrors the Grocery
distinction: **PurchaseEvent = historical truth; Household Memory = current derived
knowledge.** Here: **task_events = historical truth; the task row = current truth.**

---

## Status model — intentionally minimal

Only `open` and `completed`. **No** backlog / blocked / in-progress / waiting /
cancelled / deferred / review. Complex task states increase mental load and make
MamaHQ feel like work-management software. A third state would need explicit
justification; none was required for Step 8.

## Priority — intentionally absent

No P0/P1/P2 levels. Natural ordering is **open-before-done, then due date (undated
last), then newest** — expressed both in the SQL fetch order and the client sort.
Due date + ownership carry the weight priority levels would.

---

## Mutations are atomic (the Grocery reliability lesson)

Direct client `INSERT`/`UPDATE` on `tasks` and `task_events` is **blocked by RLS**
(`with check (false)` / `using (false)`). Every mutation goes through a
`SECURITY DEFINER` RPC that performs the state change **and** writes its history
event in **one transaction**. This avoids the "client updates the row, then
separately inserts a history event" failure class we already corrected in Grocery.

| RPC | Does (atomically) | Idempotency | Concurrency |
|---|---|---|---|
| `create_task(family, title, assignee?, due?, notes?, source?, client_task_id?)` | insert task + `created` event (+ `assigned` if created owned) | client-supplied `client_task_id` is the PK → retry returns the same task, no dup event | row-locked on the id |
| `assign_task(task, person?)` | update owner + `assigned`/`reassigned` event | assigning the same owner is a **no-op** (no event) | `for update` lock serializes concurrent reassignments |
| `complete_task(task)` | status→completed + completer/timestamp + `completed` event | already-completed → no-op, **no duplicate event** | `for update` lock → two racing completers yield one completion + one event |
| `reopen_task(task)` | status→open + clear completion metadata + `reopened` event | already-open → no-op, no event | `for update` lock → complete/reopen collisions resolve coherently |

Every RPC: pins `search_path = public`, requires `auth.uid()`, and authorizes from
the **row's own `family_id`** (or, for `create_task`, the passed `family_id` checked
via `is_family_member`) — **never** a caller-supplied identity used for trust.

### Assignment integrity (enforced in the database)

`assert_task_assignee(family, person)` validates that an assignee **exists and
belongs to the task's family**, raising otherwise. Both `create_task` and
`assign_task` call it. Consequences, all covered by tests:

- Family A task → Family A person = **allowed**.
- Family A task → unconnected (account-less) Family A person = **allowed**.
- Family A task → Family B person = **rejected** (`assignee person is not in this family`).
- Family A task → nonexistent person = **rejected** (`assignee person not found`).
- A browser bypassing the UI cannot escape this — it's server-side, not UI filtering.

---

## RLS

Family-scoped, identical `is_family_member(family_id)` boundary as every table.
Members may **read** their family's `tasks` and `task_events`. **All writes —
insert, update, AND delete — are blocked at the client** (RLS default-deny + explicit
`with check (false)` guards); every mutation goes through the SECURITY DEFINER RPCs.
This is both the atomic-history requirement and least privilege:

- **`task_events` is historical truth** — a normal client can never directly insert,
  update, or delete an event. Only the RPCs write events.
- **`tasks` has no "delete task" workflow in Step 8**, so direct client DELETE is not
  granted either — no unnecessary destructive path. The lifecycle is complete/reopen
  via RPC, not deletion.

Verified with real authenticated JWT users in `scripts/test-tasks.ts`:

- Owner A / Partner A can read, create, complete, and reassign Family A tasks.
- User B cannot read, create into, complete, reassign, or read the history of Family A.
- Direct client insert/update/**delete** is blocked on both `tasks` and
  `task_events` (no silent status flip; history cannot be erased or altered);
  cross-family insert/delete of events is blocked; the trusted RPCs still write the
  full legitimate lifecycle.

("Start over" / `clearFamilyData` runs as the user and issues client DELETEs; for
these two tables the delete is RLS-filtered to zero rows and does not error — exactly
how `household_invitations` already behaves. A hard reset, if ever needed, would be a
dedicated trusted RPC, not a client delete. Step 8 adds no such destructive path.)

## SECURITY DEFINER

Five new definer functions (`assert_task_assignee`, `create_task`, `assign_task`,
`complete_task`, `reopen_task`) are audited in `docs/SECURITY_DEFINER_AUDIT.md`
(Step 8 addendum) against the same five criteria used for Steps 5C/7.

---

## "Mine" semantics

**Mine = tasks whose `assigned_to_person_id` is the HouseholdPerson linked to the
currently authenticated account.** It is **not** tasks the current user *created*.
If the account isn't linked to a person, Mine is empty. The picker shows "Me" for
the current user's person, but the value **persisted is always the real
HouseholdPerson id**, never the literal "Me".

---

## Shared household behavior

The task belongs to the **household**; ownership points to a person within it. There
is no per-user duplicate task store and no copying tasks between accounts. Both
authorized adults see the same task state (proved end-to-end in the test suite:
Mom creates + assigns to James; James, as a member, sees it; James completes it; the
owner sees it completed; history shows created-by-Mom, owned-by-James,
completed-by-James).

---

## Acknowledgement — built in Step 9

Step 8 established assignment; **Step 9 added explicit acceptance** ("I've got it"),
so MamaHQ now distinguishes "Mom assigned this to James" from "James has taken it
✓". Current acceptance lives on the task row (`acknowledged_at`,
`acknowledged_by_user_id`, `acknowledged_by_household_person_id`); historical
acceptance is in `task_events` (`accepted` / `relinquished`). Only the assigned,
connected account may accept; reassignment, reopen, and relinquish all invalidate
current acceptance; acceptance is distinct from completion. Full design in
`docs/CARE_HANDOFF.md`. This is what turns assignment into real mental-load transfer:
assignment records *who owns* it; acceptance records that they've *taken* it.

---

## Domain boundaries (kept clean)

- **Not Grocery.** "Milk" is Grocery; "Go grocery shopping" *could* be a Task. Tasks
  do not turn grocery items into tasks.
- **Not Calendar.** "Dentist appointment Tuesday 3 PM" is Calendar; "Call dentist to
  book" is a Task.
- **Not Care Handoff.** "James has baby ✓" is active transfer of care responsibility,
  not merely a completed task. Care Handoff is a later dedicated step that will *use*
  these identity/ownership concepts.

---

## UI

A single Tasks surface (overlay), reachable from **Me → Tasks**. It answers three
questions at a glance — **what needs doing, who owns it, when it's due** — and looks
like `Take garbage out · James · Tonight`, not `Task #483 / P2 / USER-2831`.

- **Fast capture:** type a title, press Enter or tap +. Assigning an owner and a due
  date are optional and progressively disclosed.
- **Assignee picker:** chips over real HouseholdPeople (+ "Unassigned" + "Me").
- **Views:** Open / Mine / Done (segmented). "Household" is represented by the shared
  Open list. No Kanban, projects, or nested folders.
- **Actions:** complete (checkbox), reopen, reassign (inline picker).
- History timeline is available via `useTasks().history(taskId)`; surfacing it in the
  UI is deferred to keep the surface uncluttered.

Signed out, Tasks shows a gentle sign-in prompt — tasks are shared household state
and intentionally have no private per-device store.

---

## Current limitations (deferred deliberately — see PRODUCT_LIMITATIONS.md)

Acknowledgement / "I've got it"; Care Handoff; realtime (partner refetches to see
changes); push/email/SMS notifications; recurring tasks; subtasks/projects/Kanban/
dependencies; task comments/attachments; AI task parsing; Tell-MamaHQ task creation;
automatic assignment/prioritization; complex priority levels. None are built in
Step 8.

---

## Legacy responsibility audit (concept → current usage → target)

| Legacy concept | Current usage | Eventual target |
|---|---|---|
| `mom_items.assignee` (`'partner'` string) | Mom's own to-dos/questions in `mom.tsx`; `addTaskAssigned('partner')` sets a string + best-effort notify | Converge onto `tasks` with `assigned_to_person_id → household_people`. Not migrated in Step 8 (advisory in TECHNICAL_DEBT). |
| `household_people` "task ownership foundation" (0002 header) | account-less people + grocery `assigned_to_person_id` | **Now realized** for tasks: `tasks.assigned_to_person_id` is the intended ownership FK. |
| `partner_contacts` + `partner.tsx` + `lib/notify` | notify-only partner helper; delivery is a no-op stub | Fold into `household_people`; task/Care-Handoff notifications later. |
| "handoff" (`handoffMessage`, care handoff) | mom.tsx notify stub; conceptual | Care Handoff step (uses this ownership model; distinct semantics). |
| captures / Inbox | proposed-items queue that commits into concrete items | A future producer of Tasks (`source='tell_mamahq'`/`household_member`) — the same Task object, not a second task system. |

Step 8 does **not** migrate these; it establishes the destination architecture so
they can converge later without reinventing tasks.

---

## Manual QA

See `docs/MANUAL_QA.md` (Step 8 section). The two-adult proof (Mom creates + assigns
to James → James signs in, sees it under Mine, completes → Mom refetches, sees it
completed → reopen → reassign) must be performed by a human; it is **not** claimed as
passed here.
