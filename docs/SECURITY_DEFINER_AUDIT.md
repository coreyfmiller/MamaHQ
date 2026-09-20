# MamaHQ — SECURITY DEFINER Function Audit (Step 5C)

A `SECURITY DEFINER` function runs with the privileges of its **owner** (here, the
`postgres`/service role), not the caller. That means RLS does **not** automatically
protect the tables it touches — the function itself must enforce authorization.
This audit reviews every authoritative `SECURITY DEFINER` function against five
criteria: **authorization checks**, **search_path safety**, **input validation**,
**family-identity handling**, and **EXECUTE privileges**.

Scope: `supabase/migrations/0001`–`0007` only. The functions in
`supabase/migrations/_archive/` (`owns_baby`, `family_role`, `is_family_owner`,
`enroll_owner_on_family_insert`, `prevent_original_input_change`) are **not**
authoritative, are **not** applied by the baseline, and are out of scope. This audit
is a static review of the migration SQL; the behavioral half (authorized vs.
cross-family callers) is proven by `scripts/test-security.ts` and
`scripts/test-db-completion.ts`, executed in CI.

## Inventory

| # | Function | Lang | search_path | Authorization model |
|---|----------|------|-------------|---------------------|
| 1 | `is_family_member(fid uuid)` | sql | `public` ✓ | reads `auth.uid()`; returns membership boolean |
| 2 | `ensure_family()` | plpgsql | `public` ✓ | raises if `auth.uid()` null; only ever acts on the caller's own uid |
| 3 | `ensure_owner_person(fid uuid)` | plpgsql | `public` ✓ | derives owner from `families.owner_id`; internal bootstrap only |
| 4 | `complete_grocery_item(p_item_id uuid)` | plpgsql | `public` ✓ | `is_family_member(item.family_id)` on the item's own family |
| 5 | `restore_grocery_item(p_item_id uuid)` | plpgsql | `public` ✓ | `is_family_member(item.family_id)` on the item's own family |
| 6 | `increment_grocery_item(p_item_id, p_delta, p_client_action_id)` | plpgsql | `public` ✓ | `is_family_member(item.family_id)` on the item's own family |

`set_updated_at()` (0001) is a trigger function and is **not** `SECURITY DEFINER`
(it runs as invoker) — correct; it only stamps `new.updated_at` and needs no elevated
rights.

## Criterion-by-criterion findings

### 1. Authorization checks — PASS
- **`is_family_member`** is the root of trust. It resolves the caller via
  `auth.uid()` inside the function and checks `family_members`. It takes a family id
  as an argument but never trusts a caller-supplied *identity* — the identity always
  comes from the JWT (`auth.uid()`). This is the correct shape for a definer helper.
- **`complete/restore/increment`** all follow the same safe pattern: they load the
  row **by primary key**, then authorize against **the row's own `family_id`**
  (`is_family_member(it.family_id)`) — never against a caller-supplied `family_id`.
  This is the single most important property: a caller cannot pass someone else's
  family id to gain access, because the family id is read from the target row, not
  from the caller. Verified in SQL and asserted behaviorally in CI (cross-family
  callers receive `not authorized for this family`).
- **`ensure_family`** raises `not authenticated` when `auth.uid()` is null and only
  ever creates/returns a family for the **caller's own** uid. It cannot be steered to
  another user's data.
- **`ensure_owner_person(fid)`** is the one function that takes a family id and acts
  without calling `is_family_member`. Analysis below (family-identity handling)
  concludes this is **safe by construction**, not a gap.

### 2. search_path safety — PASS
Every function pins `set search_path = public`. This closes the classic
`SECURITY DEFINER` search-path hijack (a malicious schema shadowing `family_members`,
`grocery_items`, etc.). All object references inside the bodies are unqualified but
resolve against `public` deterministically. Functions in `auth` (`auth.uid()`) are
schema-qualified. **No search_path vulnerability found.**

### 3. Input validation — PASS (with an intentional, documented behavior)
- `p_item_id` is typed `uuid`; a malformed value is rejected by Postgres before the
  body runs. A valid-but-unknown id yields `grocery item not found` (explicit raise).
- `increment_grocery_item`'s `p_delta numeric` is **not** range-checked, so a negative
  delta would decrement and a delta driving quantity ≤ 0 would violate the
  `grocery_items.quantity > 0` CHECK and raise. This is acceptable: the domain layer
  (`lib/grocery/actions`) only ever sends positive deltas, and the CHECK constraint is
  a hard backstop. **Not a security issue** (no cross-family or privilege effect); at
  most a caller can produce a constraint error on *their own* row. Noted for
  completeness, not flagged as a defect.
- `p_client_action_id text` is treated purely as an idempotency key compared with
  `is not distinct from`; it is never interpolated into SQL. No injection surface.

### 4. Family-identity handling — PASS
The doctrine "authorization derives from `family_members`, never from a
caller-supplied family id or from a person row" holds across all six functions:
- `complete/restore/increment` derive family identity from the **loaded row**.
- `is_family_member`/`ensure_family` derive identity from **`auth.uid()`**.
- **`ensure_owner_person(fid)`** takes a family id and inserts a `household_people`
  row for that family's owner *without* an `is_family_member` check. Why this is safe:
  1. It reads the owner from `families.owner_id` (server-side), not from the caller.
  2. It only ever creates the *owner's own* connected person ("Me"/"owner"), and is
     idempotent via the partial unique index — repeat calls insert nothing.
  3. It is invoked internally by `ensure_family()` (which is already
     `auth.uid()`-gated) during bootstrap. Although it is also `grant`ed to
     `authenticated`, the worst a hostile caller could do by guessing another
     family's id is **cause that family's owner-person row to be (idempotently)
     created** — a row that should exist anyway. It exposes no data (returns only a
     person id for a row the caller still cannot read under RLS), grants no access,
     and cannot create a `family_members` row. **Residual risk: negligible.**
  - *Optional future hardening (non-blocking, NOT done in Step 5C to avoid a
    behavior-changing migration): add `if not public.is_family_member(fid) then
    return null; end if;` to `ensure_owner_person`, or `revoke execute … from
    authenticated` and rely solely on the internal call from `ensure_family`. Either
    is a one-line additive migration. Deferred because there is no demonstrated
    vulnerability — see Technical Debt register.*

### 5. EXECUTE privileges — PASS
Explicit grants exist and are least-privilege-appropriate for an app where every
caller is an authenticated family member:
- `grant execute … to authenticated` on `ensure_family`, `ensure_owner_person`,
  `complete_grocery_item`, `restore_grocery_item`, `increment_grocery_item`.
- `is_family_member` is relied upon by RLS policies; it executes in the policy
  evaluation context. No broad `to public` grant is made on the mutating RPCs.
- The `anon` role is not granted execute on the mutating RPCs (only `authenticated`),
  so a signed-out client cannot invoke them; each also re-checks `auth.uid()`.

## Conclusion

**No real vulnerability was discovered.** All six authoritative `SECURITY DEFINER`
functions pin `search_path`, derive authorization from `auth.uid()` and/or the target
row's own `family_id` (never caller-supplied identity), validate/normalize their
typed inputs, and grant EXECUTE only to `authenticated`. Per Step 5C §18, no
corrective migration is created, because none is required. One **optional,
non-blocking** hardening (an explicit membership check or grant tightening on
`ensure_owner_person`) is recorded in `docs/TECHNICAL_DEBT.md` for future
consideration; it is intentionally not applied here to avoid an unnecessary
behavior-touching migration during a hardening step.


---

## Step 7 addendum — Household Membership & Partner Access

Migration `0009_household_membership.sql` adds membership/invitation RPCs and two
guard-trigger functions. All were audited against the same five criteria.

### New SECURITY DEFINER functions

| Function | search_path | Authorization | Notes |
|---|---|---|---|
| `create_household_invitation(person_id, token_hash, email, ttl)` | `public` ✓ | `auth.uid()` not null; derives family from the **person row**, then `is_family_member(fid)` | never trusts a caller-supplied family; refuses if the person is already connected; stores only the token hash (validates length ≥ 32) |
| `accept_household_invitation(token_hash)` | `public` ✓ | `auth.uid()` not null; family/person derived from the **validated invitation** | idempotent for the same user; rejects reuse/expired/revoked; one-active-household check; links the existing person under a scoped `set_config` flag |
| `revoke_household_invitation(invitation_id)` | `public` ✓ | `auth.uid()` not null; `is_family_member(inv.family_id)` | only pending → revoked; accepted membership untouched |

### Guard-trigger functions (not SECURITY DEFINER — run as invoker, correctly)

| Function | search_path | Purpose |
|---|---|---|
| `guard_household_person_link()` (BEFORE UPDATE OF user_id) | `public` ✓ | rejects any client-initiated `user_id` change unless `mamahq.allow_person_link='on'` (set only inside `accept_household_invitation`) |
| `guard_household_person_insert_link()` (BEFORE INSERT) | `public` ✓ | rejects inserting a person already pre-linked to a user_id outside the acceptance flow |

### Criterion findings (Step 7)
- **Authorization checks — PASS.** Invitation creation authorizes against the
  person's *own* family; acceptance derives family+person from the validated
  invitation (never caller input); revoke authorizes against the invitation's family.
  Membership can no longer be created from the client at all (`members_insert` →
  `with check (false)`); the only writers are these definer functions.
- **search_path safety — PASS.** All five pin `set search_path = public`.
- **Input validation — PASS.** `token_hash` length-checked; `p_ttl_seconds` clamped
  to a ≥60s floor; token compared by exact hash equality (no injection surface — the
  hash is a parameter, never interpolated).
- **Family-identity handling — PASS.** No function trusts a caller-supplied
  `family_id`. The `set_config('mamahq.allow_person_link', ...)` flag is
  transaction-local (`is_local = true`), so it cannot leak to other statements/
  sessions, and the person-link write is bounded to the invitation's own family +
  an unlinked (or same-user) person row.
- **EXECUTE privileges — PASS.** `grant execute … to authenticated` on the three
  RPCs; no `to public`. The guard triggers are invoked by the engine, not granted.

**Conclusion:** no vulnerability found; the two pre-existing escalation paths
(`family_members` self-insert, `household_people.user_id` hijack) are now closed.
Behaviorally verified by `scripts/test-security.ts` (fabrication/hijack/enumeration)
and `scripts/test-membership.ts` (lifecycle), executed in CI.


---

## Step 8 addendum — Tasks, Responsibilities & Ownership

Migration `0010_tasks.sql` adds five `SECURITY DEFINER` functions. **All** client
writes to `tasks` / `task_events` — insert, update, AND delete — are blocked by RLS,
so these functions are the only mutation path; each performs its state change and its
history event in one transaction. Least-privilege posture (hardened in the Step 8
finalization review):

- `tasks`: `select` (members) + explicit `insert`/`update` `with check (false)`
  guards; **no delete policy** (RLS default-deny → client DELETE refused). There is
  no product "delete task" workflow in Step 8, so no destructive client path is
  granted.
- `task_events`: `select` (members) + explicit `insert`/`update` `with check (false)`
  guards; **no delete policy**. Events are HISTORICAL TRUTH — a client can neither
  forge, alter, nor erase them; only the RPCs (which bypass RLS as table owner)
  write them.

An earlier draft of this migration granted members a `for delete using
(is_family_member(...))` on both tables (to let the "Start over" wipe delete rows).
That was removed as unnecessary destructive surface: the wipe's client DELETE is now
simply RLS-filtered to zero rows for these tables (no error), matching how
`household_invitations` (also RPC-only-write, no delete policy) already behaves.

### New SECURITY DEFINER functions

| Function | search_path | Authorization | Notes |
|---|---|---|---|
| `assert_task_assignee(family, person)` | `public` ✓ | internal helper; validates the person exists AND `household_people.family_id = family` | returns the person id or raises `assignee person not found` / `... not in this family`; `null` person = unassigned (allowed). Only called by the task RPCs, which have already authorized the caller against the family. |
| `create_task(family, title, assignee?, due?, notes?, source?, client_task_id?)` | `public` ✓ | `auth.uid()` not null; `is_family_member(family)` | idempotent on `client_task_id` (the PK): a retry returns the existing task, no duplicate `created` event; if a supplied id exists in another family the caller is refused; assignment integrity via `assert_task_assignee`; `source` is whitelisted (falls back to `manual`). |
| `assign_task(task, person?)` | `public` ✓ | `auth.uid()` not null; `is_family_member(task.family_id)` (row-derived) | `for update` lock; same-owner is a no-op (no event); assignment integrity via `assert_task_assignee` (cross-family/nonexistent rejected). |
| `complete_task(task)` | `public` ✓ | `auth.uid()` not null; `is_family_member(task.family_id)` (row-derived) | `for update` lock; already-completed is a no-op (no duplicate event); records `completed_by_user_id = auth.uid()` WITHOUT changing ownership. |
| `reopen_task(task)` | `public` ✓ | `auth.uid()` not null; `is_family_member(task.family_id)` (row-derived) | `for update` lock; already-open is a no-op; clears completion metadata, preserves ownership + identity. |

### Criterion findings (Step 8)
- **Authorization checks — PASS.** The mutating RPCs authorize against the target
  **row's own `family_id`** (`assign`/`complete`/`reopen`) or the passed `family_id`
  checked with `is_family_member` (`create`). No function trusts a caller-supplied
  identity for trust. `assert_task_assignee` prevents cross-family ownership (a
  Family A task can never be owned by a Family B person) — enforced in the DB, not
  the UI.
- **search_path safety — PASS.** All five pin `set search_path = public`.
- **Input validation — PASS.** `title` is trimmed and length-guarded (raises on
  empty); `source` is whitelisted; uuid params are type-checked by Postgres; a
  valid-but-unknown task id raises `task not found`; `client_task_id` is used only as
  a primary key (no interpolation, no injection surface).
- **Family-identity handling — PASS.** Ownership references `household_people.id`
  (never an auth user id), and is orthogonal to authorization (`family_members`).
  Assignment never grants access; an account-less person may own a task with zero
  ability to read anything.
- **EXECUTE privileges — PASS.** `grant execute … to authenticated` on all four RPCs;
  `assert_task_assignee` is granted implicitly for internal calls but performs no
  privileged data exposure (it returns only the echoed id or raises). No `to public`.
- **Idempotency / concurrency — PASS.** `create` is idempotent on the client id;
  `complete`/`reopen`/`assign` short-circuit on unchanged state and take a `for
  update` row lock, so concurrent completers/reassigners serialize to one coherent
  final state with exactly one event.

**Conclusion:** no vulnerability found. The Tasks mutation surface is closed to
direct client writes and mediated entirely by authorized, transactional definer
functions. Behaviorally verified by `scripts/test-tasks.ts` (cross-family rejection,
RLS read/write/mutate/history isolation, idempotent create/complete, ownership
retained through completion, account-less ownership), executed in CI.
