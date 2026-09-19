# MamaHQ — Household Person Foundation (Grocery Step 0 + Step 1)

Implementation report. Scope was strictly **Step 0 (migration lineage)** and
**Step 1 (Household Person foundation)**. No Grocery, Meals, catalog, search,
realtime, offline, or AI work was done.

## Step 0 — Migration lineage resolved

**Finding (verified against the live DB, not just the files):** migrations here are
**not managed by the Supabase CLI** — there is no `supabase/config.toml` and no
`supabase_migrations.schema_migrations` table (only the `auth`/`realtime` system
ones). Every migration was applied **by hand via the Management API**. The folder
is documentation + script-of-record, and the numeric prefixes are an ordering
convention only.

The folder held **two conflicting lineages** (baby-scoped vs family-scoped) that
collided on the same table names and were only partially/selectively applied. The
live database is a **hybrid matching neither file set** — e.g. live `families` has
`owner_id + updated_at` (from the baby lineage's `0001_init`) while live
`family_members` still has the *old* shape (PK `(family_id,user_id)`, role check
`('owner','member')`, `display_name`) from `0001_foundation`, proving
`0003_family_members.sql` was never fully applied.

**Action taken (safest path, chosen to protect the deployed DB):**
- Moved all 10 historical files into `supabase/migrations/_archive/` (with a
  do-not-run `README.md`). Nothing was deleted; git history preserved via `git mv`.
- Wrote **`supabase/migrations/0001_baseline.sql`** — a single, idempotent,
  non-destructive migration that reproduces the **actual live schema exactly**
  (all tables, constraints, indexes, RLS policies, `is_family_member()`,
  `ensure_family()`, `set_updated_at()`). It uses only `create … if not exists` /
  `create or replace` / `drop policy if exists`, so:
  - run against **production** → no-op (verified: applied live, HTTP 201, zero
    changes);
  - run against a **clean** project → provisions the correct current schema.
- Wrote `supabase/migrations/README.md` explaining the hand-applied model and the
  authoritative apply order (`0001_baseline` → `0002_household_people` → …).

Why a baseline instead of replaying/reconciling the old files: with no CLI history,
snapshotting reality is the only way to guarantee a clean environment reproduces
production without risking a broken or destructive replay. Deployed-environment
safety was prioritized over folder tidiness (per the brief).

## Step 1 — Household Person foundation

**Migration `supabase/migrations/0002_household_people.sql` (applied live, verified).**

### Table: `household_people`
Smallest durable representation:

| column | notes |
| --- | --- |
| `id` | uuid pk |
| `family_id` | FK → families, `on delete cascade`; family-scoped |
| `display_name` | not null, 1–100 chars |
| `relationship` | nullable free-text ("mom","partner","grandparent",…). Descriptive, **not** authorization. Kept as text (not enum) so new relationships never need a migration. |
| `user_id` | **nullable** FK → auth.users, `on delete set null`. NULL = account-less person; non-null = connected. This is the assigned-vs-connected distinction. |
| `phone`, `email` | optional contact (also the clean path to fold in `partner_contacts` later) |
| `created_at`, `updated_at` | provenance; `updated_at` maintained by `trg_household_people_updated` (reuses `set_updated_at()`) |

Indexes: `household_people_family_idx (family_id)`,
`household_people_user_idx (user_id) where user_id is not null`, and the invariant-
guarding partial unique **`household_people_family_user_uniq (family_id, user_id)
where user_id is not null`** (one person per connected user per family; many
account-less people allowed).

### Security — "assigned is NOT authorized" (enforced, not just documented)
RLS is enabled with a single policy `household_people_all` using
`is_family_member(family_id)` for **both** USING and WITH CHECK — the *same*
boundary as every other table. Access is granted only to **authenticated family
members**; the existence of a person row (even one with a real name, or later one
assigned a task) grants **zero** access. A person with `user_id = null` cannot
authenticate or read anything. Verified live: RLS on, policy present.

### Bootstrap invariant — every owner has exactly one connected person
- Added `ensure_owner_person(fid)` (SECURITY DEFINER, idempotent): upserts the
  family owner's connected person (`display_name='Me'`, `relationship='owner'`),
  relying on the partial unique index so repeat calls insert nothing.
- Extended `ensure_family()` to call `ensure_owner_person(fid)` before returning,
  so the invariant holds for **new and existing** families on every sign-in
  bootstrap — deterministic, idempotent, no duplicate people.
- Backfilled every existing family's owner-person in the migration.
- **Verified live:** the one existing family now has exactly one owner-person
  (`user_id` = owner), duplicate check returns empty.

### Client / data-access support (minimal, follows existing patterns)
- `lib/supabase/data.ts`: `DbHouseholdPerson` interface +
  `fetchHouseholdPeople` / `insertHouseholdPerson` / `updateHouseholdPerson` /
  `deleteHouseholdPerson` (family-scoped, same shape as the other sections).
- `components/mama/household.tsx`: `HouseholdProvider` + `useHousehold()` cloning
  the established store pattern (cloud when `familyId`, localStorage fallback when
  signed out, optimistic writes). Exposes `people`, `me` (the current user's
  connected person), `savePerson`, `removePerson`. No generic repository framework
  — just one entity, consistent with the rest of the app.
- Wired `HouseholdProvider` into the provider tree in `components/mama/prototype.tsx`
  (inside `AuthProvider`, alongside `PartnerProvider`).
- Added `household_people` to `clearFamilyData()`'s wipe list. Safe because
  `ensure_family()` re-creates the owner-person on the next sign-in bootstrap.

## Reconciliation decisions (no refactor performed this step)

1. **`partner_contacts` — retained as-is, documented future path.** A partner
   contact represents the same kind of human as an account-less `household_people`
   row. The chosen path (recorded in the migration footer) is to later migrate each
   `partner_contacts` row into `household_people` (user_id null, carrying
   name/phone/email + notify prefs) and retire `partner_contacts`. Not done now to
   avoid an unnecessary destructive migration.

2. **`mom_items.assignee` ('partner' string) — left untouched, future path
   documented.** Later add a nullable `mom_items.assignee_person_id` FK →
   `household_people`, backfill `assignee='partner'` rows to the family's partner
   person, then deprecate the string. `household_people` is designed so this
   migration needs **no** change to the Person model.

3. **`family_members` stays the authorization boundary.** Person identity
   (`household_people`) is deliberately separate from authentication (`auth.users`)
   and authorization (`family_members`). We did **not** replace or weaken
   `family_members` or `is_family_member()`.

## What was explicitly NOT built
Grocery tables/UI, catalog, aliases, units, search, realtime, offline, Meals, AI —
all out of scope for Steps 0–1 and untouched.
