# Mama HQ — Supabase / Persistence Standard

How Mama HQ stores family data. Persistence is the moat: a family's logs, plans, and captures
must be durable, private, and never lost. This file governs the database layer. The
data-and-ai-standard.md still outranks it (immutable original input, no derived clinical scores).

## Sequencing

- Phase A (current): Supabase database + schema + Row-Level Security, single implicit family
  (no login wall yet), so the loop stays instant. The app persists to Supabase instead of
  localStorage.
- Phase B (later): add email/Google auth; tie each family row to auth.uid(). The schema is
  designed now so adding auth is additive, not a rewrite.

## Rules

- **RLS is ALWAYS on.** Every table has Row-Level Security enabled with an explicit policy. No
  table is ever readable/writable without a policy. A product holding a newborn's data does not
  ship an open table, ever.
- **The service_role key is SERVER-ONLY.** It is read from the environment on the server, never
  imported into a client component, never sent to the browser, never NEXT_PUBLIC_. The anon key
  may be public (it is safe only because RLS restricts it).
- **Writes go through the server** (API routes / server actions) using the appropriate client,
  so we control what is written and can enforce provenance and validation.
- **Provenance is immutable** (data-and-ai-standard Rule 2): inbox_captures.original_input is
  written once and never updated. Approved actions are separate columns/rows; editing an
  approved plan item never rewrites the original capture.
- **No derived clinical columns.** No health/quality/adequacy/development score column exists,
  now or ever. Tables store recorded facts (counts/times/durations) only.
- Persistence must fail safe: a write error surfaces gently and never corrupts local state or
  crashes the parent's app.

## Schema shape (V1)

- `babies` — id, name, birth_date, (later) owner auth id.
- `logs` — id, baby_id, kind ('feed'|'sleep'|'diaper'|'pump'), created_at, ended_at (sleep),
  and a jsonb `data` column for kind-specific fields (method/side/amount/etc.) to stay flexible.
- `plan_items` — id, baby_id, kind ('task'|'appointment'|'question'|'shopping'), created_at,
  done/answered, and a jsonb `data` column for kind-specific fields.
- `inbox_captures` — id, baby_id, created_at, original_input (text, immutable), interpretation,
  proposed (jsonb), approved (jsonb), status.

Timestamps are timestamptz. Ids are uuid default gen_random_uuid(). Keep it simple and typed on
the app side (lib/types.ts remains the source of truth for shapes).

## Keys / env

- NEXT_PUBLIC_SUPABASE_URL — project URL (safe to expose).
- NEXT_PUBLIC_SUPABASE_ANON_KEY — anon key (safe to expose; RLS protects data).
- SUPABASE_SERVICE_ROLE_KEY — server-only secret. Never client, never committed.
All in .env.local (gitignored) with placeholders in .env.example.
