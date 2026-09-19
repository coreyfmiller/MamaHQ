-- ============================================================================
-- MamaHQ — 0001_baseline (AUTHORITATIVE)
-- ============================================================================
-- This single file reproduces the ACTUAL LIVE production schema of the MamaHQ
-- Supabase project (ref sccrnjhnfmtusvyzmngs) as verified directly against the
-- database on 2026-09-14. It supersedes the earlier, conflicting migration
-- history now in supabase/migrations/_archive/ (see README.md for the full story).
--
-- WHY A BASELINE: the old folder contained TWO overlapping lineages (a baby-scoped
-- set and a family-scoped set) that were never applied as written — the live DB
-- was assembled piecemeal via the Supabase Management API and is a HYBRID of both.
-- Running the old files in filename order on a clean database would NOT reproduce
-- production. This baseline does, and is the one obvious authoritative path.
--
-- IDEMPOTENT + NON-DESTRUCTIVE: every statement uses `if not exists` /
-- `create or replace` / `drop policy if exists`. Running it against the existing
-- production database is a no-op (nothing is dropped, no data touched); running it
-- against a fresh database provisions the correct current schema. It NEVER drops a
-- table or column.
--
-- Migrations are NOT managed by the Supabase CLI (there is no
-- supabase_migrations.schema_migrations table). They are applied by hand via the
-- Management API `/database/query` endpoint. Treat numeric prefixes as an ordering
-- convention only. Apply files in ascending order to a clean environment.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current on tables that have it.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- families — owner-rooted at auth.users. (Live shape: owner_id + updated_at.)
-- ---------------------------------------------------------------------------
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists families_owner_idx on public.families (owner_id);

drop trigger if exists trg_families_updated on public.families;
create trigger trg_families_updated before update on public.families
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- family_members — AUTHORIZATION membership (auth user <-> family + role).
-- Live shape: PK(family_id,user_id), role check ('owner','member'), display_name.
-- This is the SECURITY boundary. A Household Person (Step 1) is NOT this table.
-- ---------------------------------------------------------------------------
create table if not exists public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  display_name text,
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- ---------------------------------------------------------------------------
-- babies
-- ---------------------------------------------------------------------------
create table if not exists public.babies (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  birth_date date not null,
  feeding text check (feeding is null or feeding in ('breast', 'bottle', 'both')),
  photo text,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists babies_family_idx on public.babies (family_id);

drop trigger if exists trg_babies_updated on public.babies;
create trigger trg_babies_updated before update on public.babies
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- partner_contacts — a NOTIFY-ONLY helper (name + phone/email + notify toggles),
-- NOT an account. (Step 1 documents the future path to unify this into a
-- Household Person; this baseline preserves it as-is.)
-- ---------------------------------------------------------------------------
create table if not exists public.partner_contacts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  notify_sms boolean not null default false,
  notify_email boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- logs — feed / sleep / diaper / pumping / medication
-- ---------------------------------------------------------------------------
create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  kind text not null check (kind in ('feed','sleep','diaper','pumping','medication')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  amount text,
  side text,
  diaper_type text,
  note text
);
create index if not exists logs_family_created on public.logs (family_id, created_at desc);

-- ---------------------------------------------------------------------------
-- appointments (+ their questions)
-- ---------------------------------------------------------------------------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  when_at timestamptz not null,
  location text,
  reminders_on boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists appointments_family_when on public.appointments (family_id, when_at);

create table if not exists public.appointment_questions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  text text not null,
  asked boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- mom_moods — one mood per (family, day)
-- ---------------------------------------------------------------------------
create table if not exists public.mom_moods (
  family_id uuid not null references public.families(id) on delete cascade,
  day date not null,
  mood text not null check (mood in ('tired','okay','good','great')),
  updated_at timestamptz not null default now(),
  primary key (family_id, day)
);

-- ---------------------------------------------------------------------------
-- mom_items — mom's tasks + doctor questions. `assignee` (nullable, currently
-- only 'partner') is the CURRENT string-based hand-off. Step 1 documents the
-- future migration to a person-based assignee_person_id.
-- ---------------------------------------------------------------------------
create table if not exists public.mom_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  kind text not null check (kind in ('task','question')),
  text text not null,
  done boolean not null default false,
  assignee text check (assignee is null or assignee in ('partner')),
  created_at timestamptz not null default now()
);
create index if not exists mom_items_family_kind on public.mom_items (family_id, kind);
create index if not exists mom_items_family_assignee on public.mom_items (family_id, assignee) where assignee is not null;

-- ---------------------------------------------------------------------------
-- memories — photo + caption
-- ---------------------------------------------------------------------------
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  photo text not null,
  caption text,
  created_at timestamptz not null default now()
);
create index if not exists memories_family_created on public.memories (family_id, created_at desc);

-- ---------------------------------------------------------------------------
-- captures — the Inbox queue (raw text + proposed items jsonb + status)
-- ---------------------------------------------------------------------------
create table if not exists public.captures (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  source text not null check (source in ('type','voice','photo','gmail')),
  raw_text text not null,
  status text not null default 'proposed' check (status in ('proposed','committed','dismissed')),
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists captures_family_created on public.captures (family_id, created_at desc);

-- ============================================================================
-- Authorization helper + bootstrap RPC
-- ============================================================================

-- is_family_member(fid): does the CURRENT authenticated user belong to family fid?
-- SECURITY DEFINER so RLS policies can call it without recursion. This is the
-- single source of household isolation.
create or replace function public.is_family_member(fid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.family_members m
    where m.family_id = fid and m.user_id = auth.uid()
  );
$$;

-- ensure_family(): idempotently give the calling user a family + owner membership,
-- returning the family id. SECURITY DEFINER to run past families RLS on insert.
create or replace function public.ensure_family()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  fid uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Already a member? return that family.
  select m.family_id into fid from public.family_members m where m.user_id = uid limit 1;
  if fid is not null then return fid; end if;

  -- Owns a family but missing membership? adopt it.
  select f.id into fid from public.families f where f.owner_id = uid limit 1;

  -- Otherwise create one.
  if fid is null then
    insert into public.families (owner_id) values (uid) returning id into fid;
  end if;

  -- Ensure owner membership exists.
  insert into public.family_members (family_id, user_id, role)
  values (fid, uid, 'owner')
  on conflict (family_id, user_id) do nothing;

  return fid;
end $$;

grant execute on function public.ensure_family() to authenticated;

-- ============================================================================
-- Row-level security — exactly the LIVE policy set.
-- ============================================================================
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.babies enable row level security;
alter table public.partner_contacts enable row level security;
alter table public.logs enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_questions enable row level security;
alter table public.mom_moods enable row level security;
alter table public.mom_items enable row level security;
alter table public.memories enable row level security;
alter table public.captures enable row level security;

-- families: members see/update; any authenticated user may create; owner deletes.
drop policy if exists families_select on public.families;
create policy families_select on public.families
  for select using (public.is_family_member(id));
drop policy if exists families_insert on public.families;
create policy families_insert on public.families
  for insert with check (auth.uid() is not null);
drop policy if exists families_update on public.families;
create policy families_update on public.families
  for update using (public.is_family_member(id));
drop policy if exists families_delete on public.families;
create policy families_delete on public.families
  for delete to authenticated using (owner_id = auth.uid());

-- family_members: a user sees their own row or rows of a family they belong to;
-- may insert themselves (owner bootstrap) or rows in a family they're in; delete
-- scoped to family membership.
drop policy if exists members_select on public.family_members;
create policy members_select on public.family_members
  for select using (user_id = auth.uid() or public.is_family_member(family_id));
drop policy if exists members_insert on public.family_members;
create policy members_insert on public.family_members
  for insert with check (user_id = auth.uid() or public.is_family_member(family_id));
drop policy if exists members_delete on public.family_members;
create policy members_delete on public.family_members
  for delete using (public.is_family_member(family_id));

-- All family-scoped data tables: full access to family members only.
drop policy if exists babies_all on public.babies;
create policy babies_all on public.babies
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

drop policy if exists partner_contacts_all on public.partner_contacts;
create policy partner_contacts_all on public.partner_contacts
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

drop policy if exists logs_all on public.logs;
create policy logs_all on public.logs
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

drop policy if exists appointments_all on public.appointments;
create policy appointments_all on public.appointments
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

drop policy if exists appointment_questions_all on public.appointment_questions;
create policy appointment_questions_all on public.appointment_questions
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

drop policy if exists mom_moods_all on public.mom_moods;
create policy mom_moods_all on public.mom_moods
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

drop policy if exists mom_items_all on public.mom_items;
create policy mom_items_all on public.mom_items
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

drop policy if exists memories_all on public.memories;
create policy memories_all on public.memories
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

drop policy if exists captures_all on public.captures;
create policy captures_all on public.captures
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

commit;
