-- Mama HQ — migration 0005: Mom check-in (the "For you" prompts on Today).
-- Stores whether Mom ticked a gentle self-care prompt on a given day. This is Mom SUPPORT, not
-- health tracking: it records only that she marked "drink water / eat / take ten" today. No
-- scores, no judgment, no clinical interpretation (SAFETY.md). Scoped to the family via
-- owns_baby(). Forward-only, idempotent. Run AFTER 0004.

begin;

create table if not exists public.mom_checkins (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  on_date date not null default current_date,
  item text not null check (item in ('water','eat','rest')),
  done boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- one row per (baby, day, item): ticking is idempotent, un-ticking deletes.
  unique (baby_id, on_date, item)
);
create index if not exists mom_checkins_baby_date_idx on public.mom_checkins (baby_id, on_date desc);

drop trigger if exists trg_mom_checkins_updated on public.mom_checkins;
create trigger trg_mom_checkins_updated before update on public.mom_checkins
  for each row execute function public.set_updated_at();

alter table public.mom_checkins enable row level security;

drop policy if exists mom_checkins_all on public.mom_checkins;
create policy mom_checkins_all on public.mom_checkins for all to authenticated
  using (public.owns_baby(baby_id)) with check (public.owns_baby(baby_id));

commit;
