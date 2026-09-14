-- Mama HQ — migration 0004: onboarding flag.
-- Adds babies.onboarded so the app can show a short guided setup once (real name + birth date),
-- instead of the silent auto-provision. Existing babies are treated as already onboarded so
-- current users are not sent back through setup. Forward-only, idempotent.
-- Run AFTER 0003. Governed by database-standard.md (typed column + default) and SAFETY.md.

begin;

-- New babies start un-onboarded; existing rows are backfilled to true just below.
alter table public.babies add column if not exists onboarded boolean not null default false;

-- Backfill: any baby that already exists predates onboarding — mark it onboarded so current
-- users keep going straight into the app.
update public.babies set onboarded = true where onboarded = false;

commit;
