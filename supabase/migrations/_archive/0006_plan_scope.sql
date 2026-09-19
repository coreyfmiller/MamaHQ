-- Mama HQ — migration 0006: plan_items.scope (baby | mom).
-- Lets a task/appointment/question/note be tagged as being ABOUT the baby or ABOUT Mom, so the
-- app can split them across Today (baby-related) and Me (Mom-related) as VIEWS over the same
-- table — no duplicate systems. Existing rows are baby-scoped. Forward-only, idempotent.
-- Run AFTER 0005. Governed by database-standard.md (typed column + CHECK + default).

begin;

alter table public.plan_items
  add column if not exists scope text not null default 'baby'
  check (scope in ('baby','mom'));

-- Existing plan items predate the split — they are baby-scoped (the default already sets this
-- for new inserts; this makes the intent explicit for any pre-existing rows).
update public.plan_items set scope = 'baby' where scope is null;

create index if not exists plan_baby_scope_idx on public.plan_items (baby_id, scope);

commit;
