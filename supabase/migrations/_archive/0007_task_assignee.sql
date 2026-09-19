-- Partner hand-offs: a mom task can be assigned to a helper (e.g. the partner).
-- Nullable so existing rows (and all of mom's own tasks) stay untouched.
-- Only 'task' items are ever assigned; questions are never handed off.

alter table public.mom_items
  add column if not exists assignee text;

-- Guard the allowed values without breaking existing null rows.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'mom_items_assignee_check'
  ) then
    alter table public.mom_items
      add constraint mom_items_assignee_check
      check (assignee is null or assignee in ('partner'));
  end if;
end $$;

-- Handy for the Inbox "Handed off" view: find assigned tasks per family fast.
create index if not exists mom_items_family_assignee
  on public.mom_items(family_id, assignee)
  where assignee is not null;
