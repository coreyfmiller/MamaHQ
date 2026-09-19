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
