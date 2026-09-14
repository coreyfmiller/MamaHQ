-- Mama HQ — database schema (Phase A: single implicit family, no auth yet).
-- Run this in the Supabase SQL editor. RLS is ON for every table (supabase-standard.md).
--
-- Phase A note: with no auth yet, policies allow the anon role to read/write. This is
-- acceptable ONLY for the single-family pre-auth build. Phase B replaces these policies with
-- auth.uid()-scoped ones (owner_id column already reserved below) — additive, not a rewrite.

-- ---------- babies ----------
create table if not exists public.babies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,                       -- reserved for Phase B auth; null in Phase A
  name text not null,
  birth_date date not null,
  created_at timestamptz not null default now()
);

-- ---------- logs (feed | sleep | diaper | pump) ----------
create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  kind text not null check (kind in ('feed','sleep','diaper','pump')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,                -- sleep only; null while still sleeping
  data jsonb not null default '{}'::jsonb   -- kind-specific fields (method/side/amount/etc.)
);
create index if not exists logs_baby_created_idx on public.logs (baby_id, created_at desc);

-- ---------- plan_items (task | appointment | question | shopping) ----------
create table if not exists public.plan_items (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  kind text not null check (kind in ('task','appointment','question','shopping')),
  created_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb   -- kind-specific fields (done/answered live here)
);
create index if not exists plan_baby_created_idx on public.plan_items (baby_id, created_at desc);

-- ---------- inbox_captures (provenance; original_input is IMMUTABLE) ----------
create table if not exists public.inbox_captures (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  created_at timestamptz not null default now(),
  original_input text not null,        -- write once, never update (data-and-ai-standard Rule 2)
  interpretation text,
  proposed jsonb not null default '[]'::jsonb,
  approved jsonb not null default '[]'::jsonb,
  status text not null default 'committed' check (status in ('proposed','committed','dismissed'))
);
create index if not exists captures_baby_created_idx on public.inbox_captures (baby_id, created_at desc);

-- Enforce immutability of original_input at the DB level.
create or replace function public.prevent_original_input_change()
returns trigger language plpgsql as $$
begin
  if new.original_input is distinct from old.original_input then
    raise exception 'original_input is immutable';
  end if;
  return new;
end $$;

drop trigger if exists lock_original_input on public.inbox_captures;
create trigger lock_original_input
  before update on public.inbox_captures
  for each row execute function public.prevent_original_input_change();

-- ---------- Row-Level Security (ALWAYS ON) ----------
alter table public.babies enable row level security;
alter table public.logs enable row level security;
alter table public.plan_items enable row level security;
alter table public.inbox_captures enable row level security;

-- Phase A policies: allow the anon role full access (single-family, pre-auth). Replace in
-- Phase B with auth.uid() = owner_id scoping. Named so they are easy to drop later.
do $$
begin
  -- babies
  drop policy if exists phasea_babies on public.babies;
  create policy phasea_babies on public.babies for all to anon using (true) with check (true);
  -- logs
  drop policy if exists phasea_logs on public.logs;
  create policy phasea_logs on public.logs for all to anon using (true) with check (true);
  -- plan_items
  drop policy if exists phasea_plan on public.plan_items;
  create policy phasea_plan on public.plan_items for all to anon using (true) with check (true);
  -- inbox_captures
  drop policy if exists phasea_captures on public.inbox_captures;
  create policy phasea_captures on public.inbox_captures for all to anon using (true) with check (true);
end $$;
