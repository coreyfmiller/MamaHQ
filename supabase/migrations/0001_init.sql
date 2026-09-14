-- Mama HQ — 0001_init: proper hardened baseline (replaces the Phase-A open schema).
-- Governed by database-standard.md: deny-by-default owner-scoped RLS, typed columns +
-- constraints, created_at/updated_at, immutable provenance. Forward-only.
--
-- SAFE TO RUN on the current project: the Phase-A tables held only throwaway test rows.
-- This drops and recreates them correctly. Do NOT re-run destructively once real data exists;
-- future changes come as 0002_, 0003_, ...

begin;

-- ---------- clean slate from the Phase-A prototype ----------
drop table if exists public.inbox_captures cascade;
drop table if exists public.plan_items cascade;
drop table if exists public.logs cascade;
drop table if exists public.babies cascade;

-- ---------- shared updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- families (owner-rooted at auth.users) ----------
create table public.families (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index families_owner_idx on public.families (owner_id);
create trigger trg_families_updated before update on public.families
  for each row execute function public.set_updated_at();

-- ---------- babies ----------
create table public.babies (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  birth_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index babies_family_idx on public.babies (family_id);
create trigger trg_babies_updated before update on public.babies
  for each row execute function public.set_updated_at();

-- ---------- logs (feed | sleep | diaper | pump) — typed core columns ----------
create table public.logs (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  kind text not null check (kind in ('feed','sleep','diaper','pump')),
  occurred_at timestamptz not null default now(),   -- when it happened (start, for sleep)
  ended_at timestamptz,                             -- sleep only; null while ongoing
  -- feed
  feed_method text check (feed_method in ('breast','bottle')),
  feed_side text check (feed_side in ('left','right','both')),
  bottle_contents text check (bottle_contents in ('breast-milk','formula','unspecified')),
  amount_ml integer check (amount_ml is null or amount_ml >= 0),  -- feed(bottle) or pump
  -- diaper
  diaper_kind text check (diaper_kind in ('wet','dirty','both')),
  -- pump
  pump_side text check (pump_side in ('left','right','both')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- sleep end must not precede its start
  constraint sleep_end_after_start check (ended_at is null or ended_at >= occurred_at)
);
create index logs_baby_occurred_idx on public.logs (baby_id, occurred_at desc);
create index logs_baby_kind_idx on public.logs (baby_id, kind);
create trigger trg_logs_updated before update on public.logs
  for each row execute function public.set_updated_at();

-- ---------- plan_items (task | appointment | question | shopping) ----------
create table public.plan_items (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  kind text not null check (kind in ('task','appointment','question','shopping')),
  -- common-ish typed fields; the ones that don't apply stay null
  title text,           -- task/appointment title, shopping item, question text
  when_text text,       -- appointment time phrase
  due_text text,        -- task due phrase
  assignee text,        -- task assignee
  location text,        -- appointment
  who text,             -- appointment provider/person
  list text check (list is null or list in ('shopping','supplies','general')), -- shopping
  done boolean not null default false,   -- task/shopping completion
  answered boolean not null default false, -- question
  appointment_id uuid references public.plan_items(id) on delete set null, -- question -> appt
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_has_text check (title is not null and length(title) between 1 and 500)
);
create index plan_baby_created_idx on public.plan_items (baby_id, created_at desc);
create index plan_baby_kind_idx on public.plan_items (baby_id, kind);
create trigger trg_plan_updated before update on public.plan_items
  for each row execute function public.set_updated_at();

-- ---------- inbox_captures (immutable original_input) ----------
create table public.inbox_captures (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  original_input text not null check (length(original_input) between 1 and 8000),
  interpretation text,
  proposed jsonb not null default '[]'::jsonb,  -- variable AI output — jsonb is correct here
  approved jsonb not null default '[]'::jsonb,
  status text not null default 'committed' check (status in ('proposed','committed','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index captures_baby_created_idx on public.inbox_captures (baby_id, created_at desc);
create trigger trg_captures_updated before update on public.inbox_captures
  for each row execute function public.set_updated_at();

-- original_input is write-once
create or replace function public.prevent_original_input_change()
returns trigger language plpgsql as $$
begin
  if new.original_input is distinct from old.original_input then
    raise exception 'original_input is immutable';
  end if;
  return new;
end $$;
create trigger lock_original_input before update on public.inbox_captures
  for each row execute function public.prevent_original_input_change();

-- ---------- RLS: ON everywhere, deny-by-default, scoped to auth.uid() ----------
alter table public.families enable row level security;
alter table public.babies enable row level security;
alter table public.logs enable row level security;
alter table public.plan_items enable row level security;
alter table public.inbox_captures enable row level security;

-- helper: does a baby belong to the current user's family?
create or replace function public.owns_baby(b uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.babies bb
    join public.families f on f.id = bb.family_id
    where bb.id = b and f.owner_id = auth.uid()
  );
$$;

-- families: user sees/edits only their own
create policy families_select on public.families for select to authenticated
  using (owner_id = auth.uid());
create policy families_insert on public.families for insert to authenticated
  with check (owner_id = auth.uid());
create policy families_update on public.families for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy families_delete on public.families for delete to authenticated
  using (owner_id = auth.uid());

-- babies: only in the user's family
create policy babies_all on public.babies for all to authenticated
  using (family_id in (select id from public.families where owner_id = auth.uid()))
  with check (family_id in (select id from public.families where owner_id = auth.uid()));

-- logs / plan_items / inbox_captures: only for babies the user owns
create policy logs_all on public.logs for all to authenticated
  using (public.owns_baby(baby_id)) with check (public.owns_baby(baby_id));
create policy plan_all on public.plan_items for all to authenticated
  using (public.owns_baby(baby_id)) with check (public.owns_baby(baby_id));
create policy captures_all on public.inbox_captures for all to authenticated
  using (public.owns_baby(baby_id)) with check (public.owns_baby(baby_id));

commit;
