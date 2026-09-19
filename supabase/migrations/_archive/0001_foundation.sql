-- MamaHQ backend foundation: families, members, babies, partner contacts.
-- Multi-tenant by family; row-level security so a user only ever sees their
-- own family's data. Designed so "Dad as full user" (family_members) and
-- "Dad as SMS/email contact" (partner_contacts) both fit without reshaping.

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_at timestamptz not null default now()
);

-- Links an auth user to a family. This is how a second person (Dad) becomes a
-- full user later: insert a member row for their user id.
create table if not exists public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  display_name text,
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create table if not exists public.babies (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  birth_date date not null,
  feeding text check (feeding in ('breast', 'bottle', 'both')),
  photo text, -- small data URL or storage path
  created_at timestamptz not null default now()
);

-- Dad (or any helper) as a NOTIFY-ONLY contact — no login required. Used by the
-- Tier-1 SMS/email reminders before/without them being a full user.
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

-- ============================================================
-- Helper: is the current user a member of this family?
-- SECURITY DEFINER avoids RLS recursion when policies call it.
-- ============================================================

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

-- ============================================================
-- Row-level security
-- ============================================================

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.babies enable row level security;
alter table public.partner_contacts enable row level security;

-- families: visible/editable to members; any authenticated user may create one.
drop policy if exists families_select on public.families;
create policy families_select on public.families
  for select using (public.is_family_member(id));

drop policy if exists families_insert on public.families;
create policy families_insert on public.families
  for insert with check (auth.uid() is not null);

drop policy if exists families_update on public.families;
create policy families_update on public.families
  for update using (public.is_family_member(id));

-- family_members: a user can see rows for families they belong to, and can add
-- themselves (the app creates the owner row right after creating the family).
drop policy if exists members_select on public.family_members;
create policy members_select on public.family_members
  for select using (user_id = auth.uid() or public.is_family_member(family_id));

drop policy if exists members_insert on public.family_members;
create policy members_insert on public.family_members
  for insert with check (user_id = auth.uid() or public.is_family_member(family_id));

drop policy if exists members_delete on public.family_members;
create policy members_delete on public.family_members
  for delete using (public.is_family_member(family_id));

-- babies / partner_contacts: full access scoped to family membership.
drop policy if exists babies_all on public.babies;
create policy babies_all on public.babies
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

drop policy if exists partner_contacts_all on public.partner_contacts;
create policy partner_contacts_all on public.partner_contacts
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));
