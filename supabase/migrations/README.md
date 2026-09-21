# MamaHQ — Database Migrations

## How migrations work here (read this first)

**Migrations are applied by hand, not by the Supabase CLI.** There is no
`supabase/config.toml` and no `supabase_migrations.schema_migrations` tracking
table in the database (verified 2026-09-14 — only the `auth` and `realtime` system
schemas have such tables). Each `.sql` file has been run manually against the
project via the Supabase **Management API** `/database/query` endpoint.

Consequences:

- The numeric filename prefix (`0001_`, `0002_`, …) is an **ordering convention
  only**. Apply files in ascending order when provisioning a clean environment.
- Editing/renaming/deleting a file here does **not** touch the live database. The
  folder is documentation of intended schema, plus the script of record.
- Every migration should be written **idempotent and non-destructive** where
  possible (`create table if not exists`, `create or replace`, `drop policy if
  exists`) so re-running against the live DB is a safe no-op.

## The authoritative schema

**`0001_baseline.sql` is the single source of truth for the current schema.** It
reproduces the ACTUAL live production schema exactly (verified directly against the
database). Running it on a clean Supabase project provisions the correct current
schema; running it against production is a no-op.

Apply order for a clean environment:

1. `0001_baseline.sql` — all core tables, RLS, `is_family_member()`, `ensure_family()`.
2. `0002_household_people.sql` — the Household Person foundation (Step 1).

(Later grocery/meals/etc. migrations continue from `0003_…`.)

## Why there is a baseline instead of the original history

The folder previously contained **two overlapping, conflicting migration
lineages**, now moved to [`_archive/`](./_archive/):

- **Baby-scoped lineage** (`0001_init`, `0002_memories`, `0003_family_members`,
  `0004_onboarding`, `0005_mom_checkins`, `0006_plan_scope`): keyed data on
  `baby_id`, used an `owns_baby()` helper, and included a `plan_items` table with a
  `kind = 'shopping'` value. The app never adopted this data model.
- **Family-scoped lineage** (`0001_foundation`, `0002_data`, `0003_ensure_family`,
  `0007_task_assignee`): keyed data on `family_id` via `is_family_member()`. This is
  the direction the app actually uses.

Both lineages **collided on the same table names** (`families`, `family_members`,
`babies`, `logs`) with **different shapes**, and were partially/selectively applied
by hand. The result: the live database is a **hybrid** that matches *neither* file
set as written. For example, live `families` has `owner_id + updated_at` (from the
baby lineage's `0001_init`) while live `family_members` has the *old* shape
(PK `(family_id,user_id)`, role check `('owner','member')`, `display_name`) from
`0001_foundation` — meaning `0003_family_members.sql` was **never fully applied**
(its `id`/`invited_by`/`updated_at` columns and `owner/partner/caregiver` roles are
absent live, as are its `is_family_owner`/`family_role` helpers).

Because no CLI history exists, the safest way to get "one obvious authoritative
path" without risking the live database was to **snapshot reality into a baseline**
rather than try to reconcile or replay the old files (which could corrupt a clean
provision). The archived files are retained for historical reference only — **do
not run them.**

## `_archive/` — do not run

Historical, superseded, and never-cleanly-appliable. Kept for provenance and to
explain design intent (some archived files contain useful reasoning in comments,
e.g. the partner-mode/roles design in `0003_family_members.sql`). They must not be
executed against any environment.

## Supabase CLI adoption (Step 5C)

As of Step 5C the repository is a standard Supabase CLI project (`supabase/config.toml`
is tracked). This does **not** change how production is managed — it makes clean
provisioning reproducible **locally and in CI**, and enables read-only drift
inspection against the linked project.

- **Local/CI:** `supabase db reset` destroys and rebuilds the **local, disposable**
  Docker database, applying every file in this folder in ascending filename order
  (`0001` → `0007`). This is how the clean-provision test and the DB/security test
  suites get a database. It never touches production.
- **Production:** migrations continue to be applied by hand via the Management API,
  exactly as before. The CLI is not used to push SQL to production in this step.

The numeric prefixes (`0001_`…) are still an ordering convention. The CLI applies
files lexicographically, so the existing names sort correctly with no rename needed.

### Migration history reconciliation (production) — how, and the guardrail

Production has **no** `supabase_migrations.schema_migrations` table today (the seven
migrations were hand-applied via the Management API, not the CLI). To bring
production into the normal tracked workflow **without re-running any SQL**, use the
CLI's history-repair mechanism, which only writes history rows — it does not execute
migration bodies:

```bash
# Requires SUPABASE_ACCESS_TOKEN in the environment (a secret; never stored in repo).
supabase link --project-ref sccrnjhnfmtusvyzmngs
supabase migration list --linked          # shows local files vs remote history
# Only AFTER verifying each migration's schema effect is genuinely present in prod:
supabase migration repair 0001 0002 0003 0004 0005 0006 0007 --status applied --linked
```

**Guardrail (from Step 5C §6):** *do not assume "not tracked" means "not applied".*
A migration must be marked `applied` **only when its intended schema effect is truly
present** in production. Because every authoritative migration is idempotent and
non-destructive, the safe verification path is:

1. `supabase migration list --linked` to see what the CLI thinks is applied.
2. Read-only inspect production for each migration's key objects (tables, columns,
   policies, functions) — see the drift analysis in `docs/DATABASE_WORKFLOW.md`.
3. `migration repair … --status applied` for the versions confirmed present.

This reconciliation is a **human-run, one-time** operation that needs a Management
access token and touches production history — it is intentionally **not** automated
in CI (CI must never hold production god-credentials). It is documented as a required
human action in `docs/HUMAN_ACTIONS.md`. Step 5C does **not** perform it, because the
CLI-format verification and the repair both require the linked production project and
a token that is a human-held secret.

## Step 6 — 0008_household_memory.sql

`0008_household_memory.sql` (additive, after `0007`) introduces **Household Grocery
Memory**:

- Expands the `purchase_events` snapshot with the structured grocery identity
  (`canonical_item_id`, `resolved_attributes`, `package_size`, `package_type`,
  `unmatched_modifiers`) so household learning has a faithful, immutable record.
- Adds `household_items` (per-family variants of a concept — CURRENT knowledge) and
  `household_item_observations` (the auditable, idempotent EVIDENCE ledger).
- Rewrites `complete_grocery_item` / `restore_grocery_item` so completion atomically
  writes the snapshot, upserts the matching variant, records one observation, and
  recomputes derived evidence/default — and restore reverses all of it. Completion
  idempotency and restore semantics are preserved exactly.
- Adds `set_household_usual` / `clear_household_usual` (explicit preference),
  `recompute_household_default`, `upsert_household_variant`, `household_evidence_state`.
- RLS on both new tables via `is_family_member`.

The full authoritative apply order for a clean environment is now
`0001 → 0002 → 0003 → 0004 → 0005 → 0006 → 0007 → 0008`. See
`docs/HOUSEHOLD_GROCERY_MEMORY.md` for the design.

## Step 7 — 0009_household_membership.sql

`0009_household_membership.sql` (additive, after `0008`) adds the authenticated
multi-adult household foundation:

- `family_members` gains `status` / `invited_at` / `joined_at` (role stays
  `owner`|`member`).
- **Hardens** the two privilege-escalation paths: `family_members` client INSERT is
  blocked (`with check (false)` — membership is created only by SECURITY DEFINER
  RPCs), and `household_people.user_id` mutation is blocked by guard triggers unless
  inside the invitation-acceptance flow.
- Adds `household_invitations` (hashed one-time tokens, expiry, explicit states) +
  RLS (a family's members may view its invitations; no broad enumerate; no client
  writes).
- Adds SECURITY DEFINER RPCs `create_household_invitation`,
  `accept_household_invitation` (transactional, idempotent), and
  `revoke_household_invitation`.

Authoritative apply order for a clean environment is now `0001 → … → 0009`. See
`docs/HOUSEHOLD_MEMBERSHIP.md` and the Step 7 addendum in
`docs/SECURITY_DEFINER_AUDIT.md`.

## Step 8 — 0010_tasks.sql

`0010_tasks.sql` (additive, after `0009`) introduces the household **Tasks /
Ownership** system — the first durable responsibility layer:

- `tasks` — the current responsibility row: `title`, minimal `status`
  (`open`|`completed`), `assigned_to_person_id` (OWNERSHIP → `household_people`,
  `on delete set null`), `created_by_user_id` (CREATOR → `auth.users`),
  `completed_by_user_id` (COMPLETER, distinct from owner), optional `due_at`,
  `source` provenance (`manual` used; others reserved).
- `task_events` — a lean append-only history (`created`/`assigned`/`reassigned`/
  `completed`/`reopened`; CHECK is extensible for a future `acknowledged`).
- RLS: family members may **read** tasks/events and **delete** their family's rows;
  direct client **INSERT/UPDATE are blocked** — all writes go through atomic
  SECURITY DEFINER RPCs so a state change + its history event are one transaction.
- RPCs: `create_task`, `assign_task`, `complete_task`, `reopen_task` (each atomic,
  authorized from the row's own family, idempotent on retry, row-locked for
  concurrency) + `assert_task_assignee` (DB-enforced assignment integrity: an
  assignee must belong to the task's family; cross-family/nonexistent are rejected).

Authoritative apply order for a clean environment is now `0001 → … → 0010`. See
`docs/TASKS.md` and the Step 8 addendum in `docs/SECURITY_DEFINER_AUDIT.md`.

## Step 9 — 0011_responsibility_handoff.sql

`0011_responsibility_handoff.sql` (additive, after `0010`) adds **responsibility
acceptance** and a minimal **care handoff** domain:

- **Task acceptance:** adds `acknowledged_at` / `acknowledged_by_user_id` /
  `acknowledged_by_household_person_id` to `tasks` (current acceptance), widens the
  `task_events` CHECK to include `accepted` / `relinquished`, and adds
  `accept_task` / `relinquish_task` RPCs. **Redefines** `assign_task` and
  `reopen_task` (create-or-replace) so reassignment and reopen clear current
  acceptance. Only the assigned connected account may accept; acceptance ≠ completion.
- **Care handoff:** adds `care_responsibility` (current holder, one row per
  family/subject) and `care_handoffs` (propose/accept/decline/cancel state machine,
  one pending per family/subject). RLS blocks all client writes (RPC-only, no delete
  policy — least privilege). RPCs: `ensure_care_responsibility`,
  `propose_care_handoff`, `accept_care_handoff` (atomic holder move),
  `decline_care_handoff`, `cancel_care_handoff`, plus the `my_person_in_family`
  helper. Recipients must be connected accounts; stale/duplicate transitions are safe.

Authoritative apply order for a clean environment is now `0001 → … → 0011`. See
`docs/CARE_HANDOFF.md` and the Step 9 addendum in `docs/SECURITY_DEFINER_AUDIT.md`.

## Step 10 — 0012_calendar_commitments.sql

`0012_calendar_commitments.sql` (additive, after `0011`) adds the **Shared Calendar
& Household Commitments** domain (a NEW domain alongside the existing narrow
`appointments` feature, which is unchanged):

- `calendar_events` — the core event: `title`, `notes`, `location`, `all_day`, a
  timed pair (`starts_at`/`ends_at timestamptz`) OR an all-day pair
  (`start_date`/`end_date date`) enforced coherent by a CHECK, an optional
  `responsible_person_id` (→ household_people, a designation not an acceptance) and
  `created_by_user_id`.
- `calendar_event_participants` — who an event is about (M:N → household_people,
  unique per event/person).
- RLS: members read events + participants and may DELETE their family's events
  (events are not immutable history); insert/update are RPC-only (client writes
  blocked). Cross-family reads/writes blocked.
- RPCs: `create_calendar_event`, `update_calendar_event`, `delete_calendar_event`
  (transactional event + participants), plus `assert_calendar_person` (cross-family
  integrity) and `set_calendar_participants` (atomic validated replace). All
  SECURITY DEFINER, `search_path=public`, family-authorized.
- Timezone strategy: timed events store an unambiguous UTC instant; all-day events
  store plain dates so they never tz-shift.

Authoritative apply order for a clean environment is now `0001 → … → 0012`. See
`docs/CALENDAR.md` and the Step 10 addendum in `docs/SECURITY_DEFINER_AUDIT.md`.
## Step 11 — 0013_realtime_notifications.sql

`0013_realtime_notifications.sql` (additive, after `0012`) adds the **Realtime &
Notifications** foundation. It does NOT modify `0001`–`0012`.

- `notifications` — a durable, **recipient-scoped** attention record: `family_id`,
  `recipient_user_id` (→ `auth.users`, the privacy boundary — an auth account, not a
  HouseholdPerson), `actor_user_id`, a closed `type` vocabulary
  (`task_assigned`/`task_accepted`/`care_handoff_proposed`/`care_handoff_accepted`/
  `calendar_responsibility_assigned`), `domain` (`task`/`care`/`calendar`),
  `entity_id` (not an FK), a server-computed human `title`, structured `metadata`, a
  UNIQUE `dedupe_key`, authoritative `created_at`, and `read_at`.
- RLS is **recipient-scoped** (stricter than family-scoped): select/update require
  `recipient_user_id = auth.uid()`; client INSERT is blocked (`with check (false)`);
  no client DELETE policy. A same-family member cannot read another member's
  notifications.
- **Trusted generation:** an internal SECURITY DEFINER helper `emit_notification`
  (NOT granted to any client role) is called from inside the domain RPCs, in the SAME
  transaction as the state change. It self-suppresses (actor == recipient), re-verifies
  the recipient is an active family member, and dedupes on the UNIQUE key. A companion
  helper `notif_account_for_person` resolves a HouseholdPerson's account only if the
  person is in the expected family (cross-family / account-less → null → no
  notification).
- **Read-state RPCs:** `mark_notification_read` (one, recipient-scoped, idempotent)
  and `mark_all_notifications_read` (all mine).
- **Redefined domain RPCs (idempotent create-or-replace; semantics unchanged, emit
  added):** `create_task`, `assign_task`, `accept_task`, `propose_care_handoff`,
  `accept_care_handoff`, `create_calendar_event`, `update_calendar_event`. GRANT
  argument-type lists exactly match each signature (clean-provision requirement).
- **Realtime publication:** idempotently ensures `supabase_realtime` exists and adds
  ONLY `grocery_items`, `tasks`, `task_events`, `care_responsibility`, `care_handoffs`,
  `calendar_events`, `calendar_event_participants`, and `notifications`. DEFAULT
  replica identity is sufficient (providers refetch canonical state; RLS uses the new
  row). Since production migrations are applied by hand (see `docs/DATABASE_WORKFLOW.md`),
  the publication change must be applied to prod alongside this file.

Authoritative apply order for a clean environment is now `0001 → … → 0013`. See
`docs/REALTIME.md`, `docs/NOTIFICATIONS.md`, and the Step 11 addendum in
`docs/SECURITY_DEFINER_AUDIT.md`.
## Beta Phase 1 — 0014_owner_identity.sql

`0014_owner_identity.sql` (additive, after `0013`) fixes the household-identity P0
from the closed-beta audit: the name entered during onboarding never reliably became
the authenticated user's canonical HouseholdPerson display name (the owner person is
bootstrapped as "Me" in `0009`), so People / task ownership / calendar responsibility /
care / notifications could show a placeholder.

- Adds ONE SECURITY DEFINER function: `set_my_display_name(p_family_id, p_display_name)`.
  It sets the CALLER'S OWN canonical HouseholdPerson name (resolved from the
  authenticated account via `my_person_in_family`, never a caller-supplied id), so it
  can only ever rename the caller's own person and only within a family they're a
  member of. It bootstraps a missing linked person safely (owner → `ensure_owner_person`;
  member → the authorized link flag from `0009`), validates + normalizes the name
  (trim, collapse internal whitespace, 1..80 chars; Unicode/apostrophes/hyphens
  allowed), and is idempotent. Granted to `authenticated`.
- No schema/table change, no new RLS policy (client `display_name` edits were already
  permitted by `0009`; this RPC is the trusted, account-derived writer the app uses).

Authoritative apply order for a clean environment is now `0001 → … → 0014`. See
`docs/IDENTITY_AND_CAPTURE.md` and `docs/SECURITY_DEFINER_AUDIT.md` (Beta Phase 1
addendum).
