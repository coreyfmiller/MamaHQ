-- Mama HQ — migration 0002: memories (the tiny moments).
-- Follows database-standard.md: typed columns + CHECK, created_at/updated_at,
-- deny-by-default owner-scoped RLS via the existing owns_baby() helper.
-- Forward-only. Safe to re-run.

begin;

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  occurred_on date not null default current_date,
  title text not null check (length(title) between 1 and 200),
  note text check (note is null or length(note) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists memories_baby_occurred_idx
  on public.memories (baby_id, occurred_on desc);

drop trigger if exists trg_memories_updated on public.memories;
create trigger trg_memories_updated before update on public.memories
  for each row execute function public.set_updated_at();

alter table public.memories enable row level security;

drop policy if exists memories_all on public.memories;
create policy memories_all on public.memories for all to authenticated
  using (public.owns_baby(baby_id)) with check (public.owns_baby(baby_id));

commit;
