# Mama HQ — Database Standard (DBA constitution)

> **Canonical source:** the root **`SAFETY.md`** (privacy/RLS/provenance/no-clinical-scores) and
> **`ROADMAP.md`** (Step 5 authorization-model migration for Partner Mode) are authoritative. This
> steering file is the detailed DBA operational standard and agrees with them. `SAFETY.md` wins on
> any conflict. It supersedes the older `supabase-standard.md`.

How the Mama HQ database is designed and changed. This governs all schema and data-access work.
The data-and-ai-standard.md still outranks it (immutable provenance, no derived clinical scores).
Supersedes the looser Phase-A approach in the earlier supabase-standard.md where they conflict.

This is a longitudinal health-adjacent record a parent may one day show a doctor. The database
is treated as a system of record, not a scratchpad.

## 1. Security — deny by default, owner-scoped

- RLS is ON for every table, ALWAYS. There is no table without an explicit policy.
- **Deny by default.** Policies grant access ONLY to rows the requesting user owns. No policy
  ever grants the `anon` role access to real family data. The publishable/anon key ships to the
  browser; it must be useless without an authenticated session.
- Ownership is rooted in `auth.users`. Every family-scoped row traces to a `families.owner_id`
  that equals `auth.uid()`. Policies are written in terms of `auth.uid()`, never "true".
- The `service_role` key is server-only and bypasses RLS; it is used sparingly and never shipped
  to the client. Prefer the user's authed session (RLS-enforced) for normal reads/writes.

## 2. Integrity — real columns and constraints for core facts

- Core, queried, or invariant fields get REAL typed columns with constraints — not jsonb.
  - Enums via CHECK constraints (feed method, diaper kind, plan kind, capture status, side...).
  - Numeric guards: amounts `>= 0`; a sleep's `ended_at` (if set) `>= started_at`.
  - NOT NULL wherever a value is always required.
- jsonb is allowed ONLY for genuinely open/variable extra fields, never as a dumping ground that
  hides invariants the database should enforce.
- Foreign keys everywhere, with sensible ON DELETE (cascade child logs when a baby is removed).

## 3. Every table carries

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()` maintained by a trigger on UPDATE
- Owner lineage (directly or via parent FK) back to `families.owner_id`.

## 4. Provenance & immutability (from data-and-ai-standard)

- `inbox_captures.original_input` is written once and can never be updated (enforced by trigger).
- Editing a committed plan item never rewrites the capture it came from.
- No column ever stores a derived clinical score/rating/adequacy/development judgment. Rejected on
  sight.

## 5. Migrations — versioned, forward-only, reviewed

- All schema lives in `supabase/migrations/NNNN_name.sql`, numbered and ordered. The database is
  reproducible from migrations alone.
- Migrations are forward-only and idempotent where practical (`if not exists`, `drop policy if
  exists` before create). No editing an already-applied migration in place; add a new one.
- A migration is a deliberate, reviewed act. Destructive changes (drop column/table) call it out
  explicitly and are avoided once real data exists.

## 6. Fail safe

- A write failure surfaces to the user gently and never corrupts client state or crashes the app.
- Reads scope to the current user; a missing/expired session yields "signed out," never another
  family's data.

## The review test (every DB change must pass)

1. RLS on, deny-by-default, scoped to `auth.uid()` — no `anon` access to real data.
2. Core facts have typed columns + constraints; jsonb only for truly variable extras.
3. `created_at` + `updated_at` present; `updated_at` trigger wired.
4. Provenance immutable; no clinical-score columns.
5. Delivered as a numbered, forward-only migration in `supabase/migrations/`.

If a change can fail any of these, it does not ship.
