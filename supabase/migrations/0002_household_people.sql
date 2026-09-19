-- ============================================================================
-- MamaHQ — 0002_household_people (Household Person foundation)
-- ============================================================================
-- Introduces `household_people`: the identity of a person who participates in a
-- household, WHETHER OR NOT they have a MamaHQ account. This is the durable
-- foundation for future task ownership, grocery assignment, added-by/purchased-by
-- attribution, chores, care handoff, and reminders.
--
-- CORE SEPARATION (do not conflate):
--   Household Person  = identity / household participation   (this table)
--          ↓ optional user_id
--   Auth User         = authentication                       (auth.users)
--          ↓ authorization membership
--   Family Member     = authorization                        (family_members)
--
-- SECURITY INVARIANT — "assigned is NOT authorized": the mere existence of a
-- household_people row (even one naming a real person, or one assigned a task)
-- NEVER grants application access. Authorization stays rooted in authenticated
-- family membership via is_family_member()/family_members. RLS below deliberately
-- keys on is_family_member(family_id) — the SAME boundary as every other table —
-- and NOT on the existence of a person row. A person with user_id = null has zero
-- ability to authenticate or read anything.
--
-- Idempotent + non-destructive. Apply AFTER 0001_baseline.sql.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- household_people
-- ---------------------------------------------------------------------------
-- Smallest durable representation. Rationale for each column:
--   family_id     — every person belongs to exactly one household (family-scoped).
--   display_name  — how the person is shown ("Corey", "Grandma", "James").
--   relationship  — free-text human relationship label ("mom","partner",
--                   "grandparent","babysitter","child","caregiver", …). Kept as
--                   nullable text (not an enum) on purpose: households vary wildly
--                   and we do not want a migration every time a new relationship
--                   appears. Meaning is descriptive, NOT authorization.
--   user_id       — NULLABLE link to an authenticated user. NULL = a person with
--                   no account (assigned/attributed but no access). Non-null =
--                   a "connected" person. This is the assigned-vs-connected split.
--   phone / email — optional contact, so an account-less person can still be
--                   reached (e.g. share-sheet handoff, future SMS/email). These
--                   also give a clean path to fold partner_contacts in later.
--   created_at / updated_at — standard provenance.
create table if not exists public.household_people (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 100),
  relationship text,
  user_id uuid references auth.users(id) on delete set null,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fast lookup of a family's people.
create index if not exists household_people_family_idx
  on public.household_people (family_id);

-- Look up a person by their connected auth user (e.g. "who am I in this family?").
create index if not exists household_people_user_idx
  on public.household_people (user_id) where user_id is not null;

-- At most ONE person per (family, connected user). Partial unique index so:
--   * a given auth user maps to a single person within a family (owner invariant), but
--   * MANY account-less people (user_id null) can coexist in the same family.
create unique index if not exists household_people_family_user_uniq
  on public.household_people (family_id, user_id) where user_id is not null;

-- Keep updated_at fresh (reuses the shared trigger fn from 0001_baseline).
drop trigger if exists trg_household_people_updated on public.household_people;
create trigger trg_household_people_updated before update on public.household_people
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — identical household-isolation boundary as every other table.
-- Assignment/identity is NOT authorization: access is granted ONLY to
-- authenticated members of the family (is_family_member), never by the presence
-- of a person row.
-- ---------------------------------------------------------------------------
alter table public.household_people enable row level security;

drop policy if exists household_people_all on public.household_people;
create policy household_people_all on public.household_people
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

-- ---------------------------------------------------------------------------
-- Bootstrap invariant: every authenticated family owner has EXACTLY ONE
-- connected household_people row representing them.
-- ---------------------------------------------------------------------------
-- ensure_owner_person(fid): idempotently create the owner's connected person.
-- SECURITY DEFINER so it can insert regardless of RLS during bootstrap. Uses the
-- family owner (families.owner_id) as the connected user. Idempotent via the
-- partial unique index (family_id, user_id) — repeat calls insert nothing new.
create or replace function public.ensure_owner_person(fid uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  oid uuid;
  pid uuid;
begin
  select f.owner_id into oid from public.families f where f.id = fid;
  if oid is null then
    return null; -- unknown family; nothing to do
  end if;

  -- Already have a connected person for this owner in this family?
  select p.id into pid
  from public.household_people p
  where p.family_id = fid and p.user_id = oid
  limit 1;
  if pid is not null then
    return pid;
  end if;

  insert into public.household_people (family_id, user_id, display_name, relationship)
  values (fid, oid, 'Me', 'owner')
  on conflict (family_id, user_id) where user_id is not null do nothing
  returning id into pid;

  -- If a concurrent call won the race, fetch the existing row.
  if pid is null then
    select p.id into pid
    from public.household_people p
    where p.family_id = fid and p.user_id = oid
    limit 1;
  end if;

  return pid;
end $$;

grant execute on function public.ensure_owner_person(uuid) to authenticated;

-- Extend ensure_family() so the owner-person invariant holds for BOTH existing
-- and newly created families, on every sign-in bootstrap — deterministic and
-- idempotent (no duplicate people on repeat calls). Same body as the baseline
-- plus a single ensure_owner_person(fid) call before returning.
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
  if fid is null then
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
  end if;

  -- Guarantee the owner has exactly one connected Household Person.
  perform public.ensure_owner_person(fid);

  return fid;
end $$;

grant execute on function public.ensure_family() to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: every EXISTING family gets its owner-person now (idempotent).
-- ---------------------------------------------------------------------------
insert into public.household_people (family_id, user_id, display_name, relationship)
select f.id, f.owner_id, 'Me', 'owner'
from public.families f
where not exists (
  select 1 from public.household_people p
  where p.family_id = f.id and p.user_id = f.owner_id
);

commit;

-- ============================================================================
-- FUTURE PATH (documented, NOT implemented here — no refactor in this step):
--
-- 1) partner_contacts → household_people
--    partner_contacts (notify-only helper) represents the SAME kind of human as an
--    account-less household_people row. Later: migrate each partner_contact into a
--    household_people row (user_id null, carrying name/phone/email) and move the
--    notify_sms/notify_email preferences alongside, then retire partner_contacts.
--    Kept separate for now to avoid a destructive migration.
--
-- 2) mom_items.assignee ('partner' string) → assignee_person_id (uuid → household_people)
--    Once people exist, add a nullable mom_items.assignee_person_id FK, backfill
--    rows where assignee='partner' to the family's partner person, then deprecate
--    the string column. household_people is designed so this later migration needs
--    NO change to the Person model itself.
-- ============================================================================
