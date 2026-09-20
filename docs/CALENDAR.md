# MamaHQ — Shared Calendar & Household Commitments (Step 10)

A durable, family-scoped shared calendar that understands not only **time**, but
also **who an event is about** and **who is responsible for handling it**.

Two principles frame everything below:

- **An event says what is happening. A commitment says who is responsible for making
  it happen.**
- **Being part of an event is not the same as being responsible for handling it.**

The value is structured household commitments, not calendar visualization. MamaHQ
can answer: *what's happening today, who's it for, and whose plate is it on?*

---

## Event vs Participant vs Responsibility (three distinct concepts)

| Concept | Question | Where |
|---|---|---|
| **Event** | What is happening, and when? | `calendar_events` (title + time) |
| **Participant** | Who is the event about? | `calendar_event_participants → household_people` |
| **Responsible person** | Who is designated to handle it? | `calendar_events.responsible_person_id → household_people` |
| **Creator** | Who entered it? | `calendar_events.created_by_user_id → auth.users` |

"Madelyn has the dentist" (participant) and "Corey is taking her" (responsible) are
**different structured facts** — one is never inferred from the other. People are
always `household_people` ids, never strings like `"mom"`/`"partner"`.

**Responsibility is optional.** An event may have zero/one/many participants and
zero or one responsible person (Step 10 keeps it to at most one primary responsible
person — no co-responsibility yet). Thanksgiving, a birthday, or "school closed" may
be pure shared events with no responsible person.

### Responsibility ≠ Acceptance (Step 9 principle preserved)

Calendar responsibility is a **designation** ("Corey is expected to handle this"),
**not** an explicit acceptance. **Step 10 deliberately does NOT build a calendar
acceptance workflow** — that would duplicate the Tasks/Care acceptance system built
in Step 9. Storing the responsible person is enough for Step 10; commitment
acceptance (an "I've got it" on an event) is a documented future extension that can
reuse the Step 9 pattern if the product needs it. The UI never implies the
responsible person has *accepted* — it says "Corey is handling this", a designation.

---

## Data model

### `calendar_events`
`id, family_id, title (1–300), notes, location, all_day, starts_at, ends_at,
start_date, end_date, responsible_person_id (→ household_people, SET NULL),
created_by_user_id (→ auth.users, SET NULL), created_at, updated_at`.

A CHECK (`calendar_events_time_model`) enforces a coherent time model:
- **timed** (`all_day=false`): `starts_at` required, `ends_at ≥ starts_at` if present,
  and both date columns null;
- **all-day** (`all_day=true`): `start_date` required, `end_date ≥ start_date` if
  present, and both timestamp columns null.

`responsible_person_id`/`created_by_user_id` use `ON DELETE SET NULL` so an event
survives a person/account removal.

### `calendar_event_participants`
`id, event_id (→ calendar_events, CASCADE), family_id, person_id (→ household_people,
CASCADE), created_at`; unique on `(event_id, person_id)`. A participant is a
HouseholdPerson (may be account-less).

---

## Timezone strategy

Calendar data must never be ambiguous. Two models, selected by `all_day`:

- **Timed events** store an unambiguous instant in `starts_at`/`ends_at`
  (`timestamptz` — UTC internally), displayed in the viewer's local timezone.
- **All-day events** store `start_date`/`end_date` as plain `date` (no time, no
  zone). This is the key decision: an all-day event **never shifts to the
  previous/next day** under timezone conversion (the classic off-by-one bug), and
  external-calendar sync later stays clean.

The client formats timed events with `toLocaleTimeString`/`toLocaleDateString`
(device-local); all-day events render from the plain date string with no `Date`
timezone math applied to the day itself.

## All-day & multi-day

All-day events display as all-day and keep their exact date (tested). Multi-day is
supported by both models: an all-day range (`start_date`..`end_date`, e.g. vacation
Jul 4–10) and, if ever needed, a timed span crossing midnight. Overlapping events are
permitted (no conflict detection in Step 10).

## Account-less HouseholdPeople

Participants and the responsible person may be account-less people (e.g. Madelyn,
Grandma). MamaHQ never claims an account-less person "accepted" anything — Step 10
has no acceptance workflow at all, so there is nothing to falsely claim.

---

## Mutation boundary (transactional, RPC-only)

One logical event mutation touches two tables (event + participants), so all writes
go through transactional `SECURITY DEFINER` RPCs — never separate client writes that
could leave a partially-created event. Direct client `INSERT`/`UPDATE` on both tables
is blocked by RLS.

| RPC | Does (atomically) | Notes |
|---|---|---|
| `create_calendar_event(family, title, all_day, starts_at, ends_at, start_date, end_date, location, notes, responsible, participant_ids[], client_event_id)` | insert event + all participants | idempotent on `client_event_id`; validates responsible + every participant against the family |
| `update_calendar_event(event, …, clear_responsible, participant_ids[], replace_participants)` | edit fields + (optionally) replace participants | participant set replaced atomically only when `replace_participants=true`; `clear_responsible=true` clears it (null id = leave unchanged); timed↔all-day switch recomputes the two time pairs coherently |
| `delete_calendar_event(event)` | delete event (participants cascade) | idempotent no-op on unknown id |

Helpers: `assert_calendar_person(family, person)` (family-integrity gate — cross-family
person rejected) and `set_calendar_participants(event, family, ids[])` (validated,
de-duped replace).

### Deletion

Unlike `task_events` (immutable history), a calendar event is **deletable** (Step 10
§13) — but deletion is centralized in the `delete_calendar_event` RPC as a **single
trusted mutation boundary**. There is **no direct-DELETE RLS policy** (a member's
direct `DELETE` is RLS-filtered to zero rows); the RPC authorizes from the event's
own family so no one can delete another family's event. No soft-delete was added —
it wasn't justified by a current need. (The "Start over" wipe therefore no-ops on
calendar tables, exactly like tasks/care/handoff; a hard reset would use a dedicated
trusted path.)

---

## Authorization / RLS

Family-scoped, same `is_family_member(family_id)` boundary as every table. Members
may **read** their household's events + participants and **delete** their own
family's events; **insert/update go through the RPCs** (client insert/update blocked
with `with check (false)`). Every RPC pins `search_path=public`, checks `auth.uid()`,
authorizes via `is_family_member`, and validates all HouseholdPerson references
against the event's family. Enforced in PostgreSQL and proven in
`scripts/test-calendar.ts` (cross-family participant/responsible injection rejected;
outsider read/update/delete rejected; direct-write bypass blocked). See the Step 10
addendum in `docs/SECURITY_DEFINER_AUDIT.md`.

---

## "Mine" / relevance semantics

An event is relevant to me if I am **a participant** OR **the responsible person** —
resolved through the HouseholdPerson linked to my account (`person.userId ===
user.id`), never through `created_by`. The two reasons are distinct and shown
differently in the UI ("You're handling this" vs simply appearing under Mine).

---

## Deterministic event summary

The UI builds every summary line from structured data — no AI, nothing fabricated:

```
Dentist
Thu · 2:00–3:00 PM
Madelyn
Corey is handling this
Dr. Smith Dental
```

Timed → `relDay · start–end`; all-day → `relDay · All day` or `Jul 4–10 · All day`.
Participants and the "handling this" line come straight from the stored rows.

---

## UI & Today integration

- A **Calendar** overlay (`screens/calendar.tsx`): Upcoming / Mine / Day agenda, with
  the event-summary cards; a compose/edit screen (`screens/calendar-compose.tsx`)
  with structured fields, an all-day toggle, a participant multi-select and a
  responsible-person single-select, plus delete.
- **Today** shows an "On the calendar today" card (or a quiet entry point when
  empty) listing today's commitments with time / participants / who's handling it —
  added in the existing design language, not a redesign.

The existing narrow `appointments` feature (doctor questions) is left as-is; the new
`calendar_events` domain is additive and keyed to `household_people`.

---

## Out of scope (deferred — see PRODUCT_LIMITATIONS.md)

Recurrence (RRULE, recurring series/exceptions); external calendar sync (Google/
Apple/Outlook/ICS); notifications/reminders (push/email/SMS); realtime (a refetch
shows a partner's changes — no polling hacks); Tell-MamaHQ / AI event parsing;
conflict detection & scheduling recommendations; automatic task creation or
task/event linking; care-handoff/calendar linking; custody scheduling; a
commitment-acceptance workflow. The schema avoids obvious dead ends for these (e.g. a
clean timed/all-day split for external sync) without implementing them.

---

## Manual QA

See `docs/MANUAL_QA.md` (Step 10 section): timed event, all-day date correctness,
multiple participants, edit + second-account refetch, delete, cross-family isolation.
Not claimed passed until a human performs it.
