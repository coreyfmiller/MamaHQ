# MamaHQ — Database Workflow

How to work with the MamaHQ database locally, in CI, and (carefully) in production.
Adopted in Step 5C. Read `supabase/migrations/README.md` first for the history of
why migrations look the way they do.

## Mental model

- **Authoritative schema** lives in `supabase/migrations/0001_baseline.sql` …
  `0007_grocery_action_detail.sql`. Numeric prefixes are an ordering convention;
  files apply in ascending order.
- **`supabase/migrations/_archive/`** is historical and superseded — **never run it.**
- **Local/CI database** is a disposable Docker Postgres started by the Supabase CLI.
  Rebuilding it is free and safe.
- **Production** is a hosted Supabase project (`sccrnjhnfmtusvyzmngs`). Migrations
  there are still applied **by hand** via the Management API. The CLI is used for
  reproducible local/CI provisioning and read-only drift inspection — not to push
  SQL to production in the current workflow.

## Prerequisites

- **Docker Desktop** (or another container runtime). The local stack cannot start
  without it. On Windows this also requires WSL2.
- **Supabase CLI** (`supabase --version`; developed against 2.116.x).
- **Node 24+** (runs the `.ts` scripts natively).
- **pnpm** via Corepack (`corepack enable`), matching `packageManager` in
  `package.json`.

> If you don't have Docker locally, you don't need it: CI (GitHub Actions) runs the
> full clean-provision + database/security suite on every push/PR. See
> `.github/workflows/ci.yml`.

## Start local Supabase

```bash
supabase start
```

Starts Postgres, Auth (GoTrue), PostgREST, Storage, Studio, and a local mail sink.
It prints the local API URL and the `anon` / `service_role` keys for the throwaway
stack. Studio is at http://127.0.0.1:54323.

## Inspect migration status

```bash
# Local database's applied-migration history:
supabase migration list --local

# Remote (linked) project's history — requires SUPABASE_ACCESS_TOKEN in the env
# and `supabase link` (see "Production" below). READ-ONLY.
supabase migration list --linked
```

## Create a migration

```bash
supabase migration new <short_description>
```

This creates `supabase/migrations/<timestamp>_<short_description>.sql`. Write
**idempotent, non-destructive** SQL (`create table if not exists`,
`create or replace`, `drop policy if exists`) to match the existing lineage.

> Note the existing seven files use a `000N_` prefix, not the CLI's timestamp
> prefix. Both sort correctly; new files may use either, but a monotonic prefix
> that sorts AFTER `0007_` is required so ordering stays correct.

## Apply migrations locally / rebuild the local database

```bash
# Rebuild the LOCAL database from scratch: drop it and replay every migration in
# order. This is the "clean provision" and it only ever touches the local DB.
supabase db reset
# or, via package script:
pnpm run db:reset
```

## Test clean provisioning

Clean provisioning is proven by `supabase db reset` succeeding from an empty
database (it fails loudly if any migration can't apply from scratch), followed by
the database/security suites. Locally:

```bash
supabase start
supabase db reset          # clean provision 0001 -> 0007
pnpm run db:verify         # completion/restore/increment + RLS/security suites
```

In CI this is exactly the `database` job in `.github/workflows/ci.yml`. **A green CI
`database` job is the authoritative proof of clean provisioning + isolation.**

## Run the database + security test suites

```bash
# Auto-discovers local stack keys from `supabase status`, then runs both suites:
pnpm run db:verify

# Or individually (needs SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
# in the environment — the local stack's keys, never production):
pnpm run test:db          # completion / restore / increment
pnpm run test:security    # RLS isolation, catalog authz, RPC authorization
```

The suites include a hard safety rail: they refuse to run if `SUPABASE_URL` points
at a non-local host, so they can never be aimed at production.

## The full local verification

```bash
pnpm run verify       # deterministic: catalog, search, resolver, actions, tsc, lint
pnpm run verify:all   # verify + db:verify (needs a running local Supabase)
```

## Production

Production migrations are applied by hand via the Management API (unchanged by
Step 5C). To bring production into a tracked CLI history **without re-running SQL**,
see the "Migration history reconciliation" section of
`supabase/migrations/README.md`. That is a **human action** requiring a Management
access token; it is documented in `docs/HUMAN_ACTIONS.md` and is intentionally not
automated (CI must never hold production credentials).

**Never** run `supabase db reset`, `supabase db push`, or any destructive command
against the linked production project. `db reset` is for the local disposable DB
only.

## How archived migrations are treated

`supabase/migrations/_archive/` is documentation of superseded, conflicting history.
It is excluded from linting and must never be executed against any environment. It
exists only to explain how the current baseline came to be.
