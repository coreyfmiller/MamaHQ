# Mama HQ — Data Model & Authorization Design (Step 5)

Design document for the pivotal authorization-model upgrade: **single-owner → family membership.**
This is the hard prerequisite for Partner Mode (Step 11). Governed absolutely by `SAFETY.md`
(deny-by-default RLS, family isolation, immutable provenance, no clinical scores) and the DBA
constitution in `.kiro/steering/database-standard.md`.

**Nothing in this step changes application code.** It delivers a design + a forward-only migration
(`0003_family_members.sql`) for you to run, plus the isolation test plan to verify before any
Partner work begins.

---

## 1. Current model (as shipped in 0001/0002)

Authorization is by **sole ownership**:
- `families.owner_id → auth.users(id)`.
- Every family-scoped table (`babies`, `logs`, `plan_items`, `inbox_captures`, `memories`) is
  reachable only if the row's baby belongs to a family whose `owner_id = auth.uid()`
  (via the `owns_baby()` SECURITY DEFINER helper and the `families_*` policies).
- One authenticated user = one family = (currently) one auto-provisioned baby.

**Limitation:** there is no way for a second authenticated user (a partner) to access the same
family. Partner Mode cannot be layered onto this without a real membership concept. Patching it in
(e.g. a second nullable `partner_id` on families) would be a fragile, privilege-leaking hack — we
do not do that.

## 2. Target model — family membership with roles

Introduce a join table making **many users ↔ one family**, each with a role:

```
auth.users ──< family_members >── families ──< babies ──< logs / plan_items / inbox_captures / memories
                    │
                    └─ role: 'owner' | 'partner' | 'caregiver'
```

- **`families`** keeps `owner_id` (the creator / billing + delete authority) — unchanged, so 0001
  data and existing policies degrade safely during migration.
- **`family_members`** = `(user_id, family_id, role, invited_by, created_at, updated_at)`, unique
  on `(user_id, family_id)`. The owner is **also** a member row with role `owner` (backfilled).
- **Roles (V1 semantics):**
  - `owner` — full access; can invite/remove members; can delete the family. (The creator.)
  - `partner` — can read baby status/appointments/shared lists, log baby events, complete assigned
    tasks. Framed as "help," not full management. (Step 11 defines exact surfaces.)
  - `caregiver` — same as partner for V1 (reserved so we can diverge later without a migration).
- **Children:** `babies` already belong to `families`; no change needed. "children" in the spec =
  `babies` here (first-90-days scope keeps it singular in practice, plural-capable in schema).

### Why a join table (not columns on families)
- Scales to N caregivers without schema churn.
- Roles/permissions live in one place; RLS reads membership uniformly.
- Invitation/removal is row insert/delete, not column mutation.
- Future per-role permission refinement is additive.

## 3. RLS strategy — membership-based, still deny-by-default

Replace ownership checks with **membership checks**, keeping deny-by-default and `auth.uid()`-rooted
scoping. Two SECURITY DEFINER helpers (schema-qualified, `search_path = public`):

- `is_family_member(f uuid) → boolean` — is the current user any member of family `f`?
- `family_role(f uuid) → text` — the current user's role in family `f` (or null).
- `owns_baby(b uuid)` is **redefined** to mean "is the current user a MEMBER of the baby's
  family" (previously "is the owner"). All existing `logs/plan/captures/memories` policies keep
  using `owns_baby()` unchanged in wording, but now resolve via membership — so the child-table
  policies do not need to be rewritten, only the helper does. Clean and low-risk.

Policy shape after migration:
- `families`: SELECT/UPDATE if `is_family_member(id)`; **DELETE only if role = 'owner'**; INSERT
  with `owner_id = auth.uid()` (creator).
- `family_members`: a user can SELECT rows of families they belong to; **only an `owner` can
  INSERT/DELETE** members (invite/remove); a user may always see their own membership row.
- `babies`: SELECT/UPDATE/INSERT if `is_family_member(family_id)`. (Insert of a baby into a family
  you're a member of.)
- `logs / plan_items / inbox_captures / memories`: unchanged wording — `using/​with check
  (owns_baby(baby_id))` — now membership-resolved.

**Isolation guarantee preserved:** a user with no membership row for family B gets zero rows from
B. `anon` still gets nothing (all policies target `authenticated`). The publishable key stays
useless without a session.

### Recursion caution
`family_members` policies must not query `family_members` in a way that recurses through RLS.
The helpers are `SECURITY DEFINER` (bypass RLS internally) and are used by the *other* tables'
policies. `family_members`'s own policies are written directly against `auth.uid()` and a
non-recursive `owner`-check helper to avoid policy recursion.

## 4. Migration approach for existing data (forward-only, safe)

`0003_family_members.sql`:
1. Create `family_members` (+ indexes, `updated_at` trigger, role CHECK).
2. **Backfill:** for every existing `families` row, insert a member `(owner_id, family.id,
   'owner')` if absent. This makes current single-owner users full members — **no data access
   changes for them.**
3. Redefine `owns_baby()` to membership. Add `is_family_member()` and `family_role()`.
4. Rewrite `families` and add `family_members` policies (deny-by-default, role-gated).
5. Leave `logs/plan_items/inbox_captures/memories` policies as-is (they call the redefined helper).

Idempotent where practical (`if not exists`, `drop policy if exists`, `create or replace`). No
destructive changes to existing tables. `families.owner_id` is retained (billing/delete authority).

### Bootstrap without app changes (important)
A first member cannot satisfy an "owner-only insert" policy on `family_members` (chicken-and-egg).
Solved with a **SECURITY DEFINER trigger** `enroll_owner_on_family_insert` that fires AFTER INSERT
on `families` and enrolls `new.owner_id` as an `owner` member. Because the existing app
(`getOrCreateBaby`) already creates the family with `owner_id = auth.uid()` and looks families up by
`owner_id`, **no application code changes are needed**: new users get enrolled by the trigger;
existing users are enrolled by the backfill. The membership row exists before any baby/log access
is attempted, so `owns_baby()` (now membership-based) succeeds for the user's own data.

## 5. Localization (architecture only — do not build now)

Add nullable, data-only fields so localization is possible without a later migration crunch:
- `families.country text` (ISO 3166-1 alpha-2, e.g. 'CA'), `families.region text` (province/state).
Populated at onboarding (Step 6). No Canada-specific content is hard-coded; country/region is data
that future content (Step 15) can key on. Kept nullable now; not read by any V1 code yet.

## 6. Deletion & export (architecture)

- **Deletion:** cascade is already correct — deleting a `families` row cascades to babies → logs/
  plan/captures/memories (all `on delete cascade`), and `family_members` cascades on both
  `auth.users` and `families`. Account deletion authority = role `owner`. (UI is a later step.)
- **Export:** the authed user can already read their whole family via `/api/state`; a formal export
  endpoint is Step 16. No schema change needed for export.

## 7. RLS isolation test plan (MUST pass before Partner Mode)

Run in the Supabase SQL editor / as two real test users. The goal: **Family A can never see
Family B.**

1. **Backfill sanity:** every `families` row has exactly one `owner` member.
   `select f.id, count(m.*) from families f left join family_members m on m.family_id=f.id and
   m.role='owner' group by 1;` → every count = 1.
2. **Self access:** signed in as user A, `select` on families/babies/logs returns only A's rows.
3. **Cross-family denial:** signed in as user A, attempting to select B's family/baby/logs by id
   returns **0 rows** (not an error — RLS filters silently).
4. **Insert guard:** user A cannot insert a `family_members` row into family B (policy denies).
5. **Role guard:** a `partner`-role member cannot delete the family (only `owner` can).
6. **anon denial:** with the anon key and no session, every table returns 0 rows / permission
   denied.
7. **Child tables:** logs/plan/captures/memories for B are invisible to A (they resolve through the
   redefined `owns_baby`).

Only when 1–7 pass do we proceed to Step 11 (Partner Mode) and add invitation UI + partner
surfaces.

## 8. What this step does NOT do
- No app code changes (the current single-owner UI keeps working because the owner is now a member).
- No invitation UI, no partner screens (Step 11).
- No reading of `country/region` yet (Step 6/15).
- No new clinical fields, no derived scores (SAFETY.md).
