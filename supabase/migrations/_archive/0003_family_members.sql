-- Mama HQ — migration 0003: family membership + roles (authorization-model upgrade).
-- Moves authorization from sole ownership (families.owner_id) to family membership, the hard
-- prerequisite for Partner Mode (Step 11). Preserves deny-by-default, auth.uid()-rooted RLS and
-- absolute family isolation (SAFETY.md). Forward-only; idempotent where practical.
--
-- KEY IDEA: owns_baby() is REDEFINED to "current user is a MEMBER of the baby's family". The
-- child-table policies (logs/plan_items/inbox_captures/memories) already call owns_baby(), so they
-- need no change — only the helper's definition changes. The family owner is backfilled as an
-- 'owner'-role member, so existing single-owner users keep identical access.
--
-- Run AFTER 0001 and 0002. See docs/DATA_MODEL.md for the design + isolation test plan.

begin;

-- ---------- localization (data-only, nullable; not read by V1 code yet) ----------
alter table public.families add column if not exists country text;   -- ISO 3166-1 alpha-2, e.g. 'CA'
alter table public.families add column if not exists region text;    -- province/state

-- ---------- family_members (user <-> family, role) ----------
create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'partner' check (role in ('owner','partner','caregiver')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, user_id)
);
create index if not exists family_members_family_idx on public.family_members (family_id);
create index if not exists family_members_user_idx on public.family_members (user_id);

drop trigger if exists trg_family_members_updated on public.family_members;
create trigger trg_family_members_updated before update on public.family_members
  for each row execute function public.set_updated_at();

-- ---------- backfill: every family's owner becomes an 'owner' member ----------
insert into public.family_members (family_id, user_id, role)
select f.id, f.owner_id, 'owner'
from public.families f
on conflict (family_id, user_id) do nothing;

-- ---------- auto-enroll the creator as an owner member on family INSERT ----------
-- This makes membership atomic with family creation and sidesteps the RLS bootstrap gap
-- (the first member cannot satisfy an "owner-only insert" policy on family_members otherwise).
-- SECURITY DEFINER so the insert isn't blocked by family_members RLS. Existing app code
-- (getOrCreateBaby) creates the family with owner_id = auth.uid() and needs NO change.
create or replace function public.enroll_owner_on_family_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.family_members (family_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (family_id, user_id) do nothing;
  return new;
end $$;

drop trigger if exists trg_family_enroll_owner on public.families;
create trigger trg_family_enroll_owner after insert on public.families
  for each row execute function public.enroll_owner_on_family_insert();

-- ---------- authorization helpers (SECURITY DEFINER: bypass RLS internally, avoid recursion) ----------

-- Is the current user a member of family f?
create or replace function public.is_family_member(f uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.family_members m
    where m.family_id = f and m.user_id = auth.uid()
  );
$$;

-- The current user's role in family f (or null if not a member).
create or replace function public.family_role(f uuid)
returns text language sql security definer set search_path = public as $$
  select m.role from public.family_members m
  where m.family_id = f and m.user_id = auth.uid()
  limit 1;
$$;

-- Is the current user an OWNER of family f? (used for invite/remove/delete authority)
create or replace function public.is_family_owner(f uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.family_members m
    where m.family_id = f and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- REDEFINE owns_baby: now "current user is a member of the baby's family" (was: is the owner).
-- Child-table policies that call owns_baby() automatically pick up membership semantics.
create or replace function public.owns_baby(b uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.babies bb
    join public.family_members m on m.family_id = bb.family_id
    where bb.id = b and m.user_id = auth.uid()
  );
$$;

-- ---------- RLS ----------
alter table public.family_members enable row level security;

-- families: members can see/update; only an owner can delete; creator inserts self as owner.
drop policy if exists families_select on public.families;
drop policy if exists families_insert on public.families;
drop policy if exists families_update on public.families;
drop policy if exists families_delete on public.families;

create policy families_select on public.families for select to authenticated
  using (public.is_family_member(id));
create policy families_insert on public.families for insert to authenticated
  with check (owner_id = auth.uid());
create policy families_update on public.families for update to authenticated
  using (public.is_family_member(id)) with check (public.is_family_member(id));
create policy families_delete on public.families for delete to authenticated
  using (public.is_family_owner(id));

-- babies: any member of the family may see/edit/insert babies in that family.
drop policy if exists babies_all on public.babies;
create policy babies_all on public.babies for all to authenticated
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

-- family_members policies. Written to AVOID recursion:
--   * SELECT: a user may always read their own membership row, OR rows of a family they own
--     (owner check uses is_family_owner, a SECURITY DEFINER helper that bypasses RLS).
--   * INSERT/DELETE: only an owner of that family (invite / remove).
--   * UPDATE: only an owner (e.g. change a role).
drop policy if exists family_members_select on public.family_members;
drop policy if exists family_members_insert on public.family_members;
drop policy if exists family_members_update on public.family_members;
drop policy if exists family_members_delete on public.family_members;

create policy family_members_select on public.family_members for select to authenticated
  using (user_id = auth.uid() or public.is_family_owner(family_id));
create policy family_members_insert on public.family_members for insert to authenticated
  with check (public.is_family_owner(family_id));
create policy family_members_update on public.family_members for update to authenticated
  using (public.is_family_owner(family_id)) with check (public.is_family_owner(family_id));
create policy family_members_delete on public.family_members for delete to authenticated
  using (public.is_family_owner(family_id));

-- logs / plan_items / inbox_captures / memories: policies UNCHANGED — they call owns_baby(),
-- which now resolves via membership. (No re-create needed; left intact from 0001/0002.)

commit;
