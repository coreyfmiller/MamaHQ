# Archived migrations — DO NOT RUN

These files are the **superseded, historical** migration attempts. They are kept
for provenance and design context only. They must **not** be executed against any
environment (local, staging, or production).

The current authoritative schema lives in `../0001_baseline.sql`. See
`../README.md` for the full explanation.

## Why archived

Two conflicting lineages that collided on the same table names and were only ever
partially/selectively applied by hand via the Management API. The live database is
a hybrid of both and matches neither file set as written, so replaying these on a
clean environment would NOT reproduce production (and could produce a broken or
inconsistent schema).

### Baby-scoped lineage (data keyed on `baby_id`, `owns_baby()` helper)
- `0001_init.sql`
- `0002_memories.sql`
- `0003_family_members.sql`  ← never fully applied live (its extra columns/roles/helpers are absent)
- `0004_onboarding.sql`
- `0005_mom_checkins.sql`
- `0006_plan_scope.sql`  ← contains the unused `plan_items` / `shopping` concept

### Family-scoped lineage (data keyed on `family_id`, `is_family_member()` helper)
- `0001_foundation.sql`
- `0002_data.sql`
- `0003_ensure_family.sql`
- `0007_task_assignee.sql`

All of the still-relevant content from these files has been consolidated,
corrected to match live reality, and captured in `../0001_baseline.sql`.
