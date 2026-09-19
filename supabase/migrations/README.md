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
