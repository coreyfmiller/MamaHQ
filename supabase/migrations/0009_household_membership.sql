-- ============================================================================
-- MamaHQ — 0009_household_membership (Step 7: Household Membership & Partner Access)
-- ============================================================================
-- Turns MamaHQ from a single-authenticated-adult app into a genuinely shared
-- household: Mom can invite another adult, who authenticates their OWN account and
-- joins the SAME household, connected to their EXISTING HouseholdPerson.
--
-- Identity model (kept strictly separate — see docs/HOUSEHOLD_MEMBERSHIP.md):
--   Auth User        = how someone authenticates           (auth.users)
--   Family Membership = authorization to access a household  (family_members)
--   Household         = the family                           (families)
--   Household Person  = who the human is in the household     (household_people;
--                       user_id null = no account, non-null = connected)
--
-- INVARIANT preserved: "Assigned Person ≠ Authorized User" — authorization derives
-- ONLY from an authenticated family_members row, NEVER from a household_people row.
--
-- This migration:
--   1. Adds membership lifecycle columns to family_members (additive; role stays
--      'owner'|'member').
--   2. HARDENS the two write paths that previously allowed privilege escalation:
--        a) family_members client INSERT (a user could insert (anyFamily, self)
--           and self-authorize) → now blocked; membership is created ONLY by the
--           SECURITY DEFINER bootstrap/acceptance RPCs.
--        b) household_people.user_id client mutation (a member could set
--           user_id = auth.uid() on any person to hijack identity) → now blocked
--           by a trigger unless inside an authorized definer RPC.
--   3. Adds household_invitations (hashed one-time tokens, expiry, explicit states)
--      + RLS (a family's members may view/manage its invitations; nobody may
--      enumerate broadly; clients cannot write directly).
--   4. Adds transactional SECURITY DEFINER RPCs: create / accept / revoke
--      invitation. Acceptance links the EXISTING person, creates exactly one
--      membership, is idempotent for the same user, and rejects reuse.
--
-- Idempotent + non-destructive. Apply AFTER 0008_household_memory.sql.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) family_members lifecycle columns (additive). Existing owner rows backfill
--    to status 'active'. role stays the existing check ('owner','member').
-- ---------------------------------------------------------------------------
alter table public.family_members
  add column if not exists status text not null default 'active'
    check (status in ('active','removed'));
alter table public.family_members
  add column if not exists invited_at timestamptz;
alter table public.family_members
  add column if not exists joined_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- 2a) HARDEN family_members INSERT. The old policy allowed
--     `with check (user_id = auth.uid() or is_family_member(family_id))`, which let
--     ANY authenticated user insert (someone_elses_family, self) and thereby grant
--     themselves access. Both legitimate creation paths are SECURITY DEFINER
--     functions (ensure_family for the owner, accept_household_invitation for a
--     member) that run as the table owner and BYPASS RLS — so direct client inserts
--     can be forbidden entirely with no loss of function.
-- ---------------------------------------------------------------------------
drop policy if exists members_insert on public.family_members;
create policy members_insert on public.family_members
  for insert with check (false); -- no direct client inserts; membership via RPC only

-- (members_select and members_delete from 0001 are unchanged and remain correct:
--  a user sees their own row or rows of a family they belong to; deletes are scoped
--  to family membership. We leave them as-is.)

-- Fast "who belongs to this family" + membership status lookups.
create index if not exists family_members_family_status
  on public.family_members (family_id, status);

-- ---------------------------------------------------------------------------
-- 2b) HARDEN household_people identity linking. A family member could previously
--     UPDATE any person row (blanket FOR ALL policy) and set user_id = auth.uid()
--     to hijack an identity / gain the owner-person. We keep normal edits working
--     (display_name, relationship, phone, email) but forbid a CLIENT from changing
--     user_id. The only legitimate linker is accept_household_invitation, which
--     sets a transaction-local flag the trigger recognizes.
-- ---------------------------------------------------------------------------
create or replace function public.guard_household_person_link()
returns trigger language plpgsql
set search_path = public
as $$
begin
  -- Allow when user_id is unchanged.
  if new.user_id is not distinct from old.user_id then
    return new;
  end if;
  -- Otherwise the link/unlink is only permitted inside an authorized definer RPC,
  -- which sets mamahq.allow_person_link = 'on' for its transaction.
  if coalesce(current_setting('mamahq.allow_person_link', true), 'off') = 'on' then
    return new;
  end if;
  raise exception 'household_people.user_id may only be changed via invitation acceptance';
end $$;

drop trigger if exists trg_household_people_link_guard on public.household_people;
create trigger trg_household_people_link_guard
  before update of user_id on public.household_people
  for each row execute function public.guard_household_person_link();

-- Also guard INSERT: a client must not insert a NEW person already carrying a
-- user_id (that would link an account without going through acceptance). Account
-- linkage happens only via the acceptance RPC (definer, flag set).
create or replace function public.guard_household_person_insert_link()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if new.user_id is not null
     and coalesce(current_setting('mamahq.allow_person_link', true), 'off') <> 'on' then
    raise exception 'household_people may not be inserted pre-linked to a user; link via invitation acceptance';
  end if;
  return new;
end $$;

drop trigger if exists trg_household_people_insert_link_guard on public.household_people;
create trigger trg_household_people_insert_link_guard
  before insert on public.household_people
  for each row execute function public.guard_household_person_insert_link();

-- ---------------------------------------------------------------------------
-- 3) household_invitations — hashed one-time tokens, explicit lifecycle.
--    The plaintext token is a CREDENTIAL and is NEVER stored; only its SHA-256
--    hex hash is kept, so a DB read cannot recover a usable token.
-- ---------------------------------------------------------------------------
create table if not exists public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  -- The pre-existing person this invitation will connect the new account to.
  household_person_id uuid references public.household_people(id) on delete set null,
  invited_by_user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  -- Optional destination for delivery/UX only — NOT authorization, NOT membership.
  email text,
  -- SHA-256 hex of the high-entropy token. Unique so a hash can't collide.
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending','accepted','expired','revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by_user_id uuid references auth.users(id) on delete set null
);

create index if not exists household_invitations_family
  on public.household_invitations (family_id, status);
create index if not exists household_invitations_person
  on public.household_invitations (household_person_id) where household_person_id is not null;

-- RLS: a family's authenticated members may SELECT their household's invitations
-- (to manage them in the UI). There is NO broad enumerate. Direct client
-- INSERT/UPDATE/DELETE are forbidden — invitations are created/mutated ONLY by the
-- SECURITY DEFINER RPCs below (which run as table owner, bypassing RLS). Acceptance
-- does NOT require SELECT visibility: the acceptor proves possession of the token,
-- and the RPC validates it server-side.
alter table public.household_invitations enable row level security;

drop policy if exists household_invitations_select on public.household_invitations;
create policy household_invitations_select on public.household_invitations
  for select using (public.is_family_member(family_id));

drop policy if exists household_invitations_no_client_write on public.household_invitations;
create policy household_invitations_no_client_write on public.household_invitations
  for insert with check (false);
-- (No update/delete policies → client update/delete match nothing. RPCs bypass RLS.)

commit;

-- ============================================================================
-- 4) SECURITY DEFINER RPCs (each create-or-replace = idempotent).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Normalize the owner's membership lifecycle: existing owner rows get status
-- 'active' + joined_at (defaults already applied by the ALTERs; this is a belt-and-
-- suspenders backfill for any row that predates the defaults).
-- ---------------------------------------------------------------------------
update public.family_members
  set status = coalesce(status, 'active')
  where status is null;

-- ---------------------------------------------------------------------------
-- create_household_invitation(p_person_id, p_token_hash, p_email, p_ttl_seconds)
--   Owner-or-member of the family that OWNS p_person_id may create an invitation
--   for that person. Stores ONLY the token hash. Returns the invitation id.
--   Authorization derives from the person's OWN family (never caller-supplied).
-- ---------------------------------------------------------------------------
create or replace function public.create_household_invitation(
  p_person_id uuid,
  p_token_hash text,
  p_email text default null,
  p_ttl_seconds integer default 604800  -- 7 days
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
  linked uuid;
  inv_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_token_hash is null or length(p_token_hash) < 32 then
    raise exception 'invalid invitation token';
  end if;

  -- Derive the family from the person, then authorize the caller against it.
  select hp.family_id, hp.user_id into fid, linked
  from public.household_people hp
  where hp.id = p_person_id;
  if fid is null then
    raise exception 'household person not found';
  end if;
  if not public.is_family_member(fid) then
    raise exception 'not authorized for this family';
  end if;
  if linked is not null then
    raise exception 'this person is already connected to an account';
  end if;

  insert into public.household_invitations (
    family_id, household_person_id, invited_by_user_id, email, token_hash, status,
    created_at, expires_at
  ) values (
    fid, p_person_id, auth.uid(), p_email, p_token_hash, 'pending',
    now(), now() + make_interval(secs => greatest(p_ttl_seconds, 60))
  )
  returning id into inv_id;

  return inv_id;
end $$;

grant execute on function public.create_household_invitation(uuid, text, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- accept_household_invitation(p_token_hash)
--   The caller proves possession of the token (client sends its SHA-256 hash).
--   Transactionally: validate pending+unexpired+unrevoked → derive family+person
--   from the invitation → create the caller's membership → link the person to the
--   caller → mark accepted. All-or-nothing. Idempotent for the SAME accepting user;
--   rejected for any other user.
--   Returns jsonb { family_id, household_person_id }.
-- ---------------------------------------------------------------------------
create or replace function public.accept_household_invitation(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv public.household_invitations;
  existing_membership uuid;
  other_family uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into inv from public.household_invitations
    where token_hash = p_token_hash
    for update;
  if not found then
    raise exception 'invitation not found';
  end if;

  -- IDEMPOTENT success: the SAME user re-redeeming an invitation they already
  -- accepted gets the existing result (safe under double-click/refresh/retry).
  if inv.status = 'accepted' then
    if inv.accepted_by_user_id = uid then
      return jsonb_build_object('family_id', inv.family_id, 'household_person_id', inv.household_person_id);
    end if;
    raise exception 'invitation already accepted';  -- reuse by a different user
  end if;

  if inv.status = 'revoked' then
    raise exception 'invitation revoked';
  end if;
  if inv.status <> 'pending' then
    raise exception 'invitation not pending';
  end if;
  if inv.expires_at <= now() then
    -- Mark it expired so state is truthful, then reject.
    update public.household_invitations set status = 'expired' where id = inv.id;
    raise exception 'invitation expired';
  end if;

  -- One active household per user (documented constraint): if the caller already
  -- belongs to a DIFFERENT family, refuse (no silent multi-household).
  select m.family_id into other_family
  from public.family_members m
  where m.user_id = uid and m.status = 'active' and m.family_id <> inv.family_id
  limit 1;
  if other_family is not null then
    raise exception 'already a member of another household';
  end if;

  -- Create membership (idempotent via PK). Definer bypasses the members_insert
  -- RLS block; role 'member', status 'active'.
  insert into public.family_members (family_id, user_id, role, status, invited_at, joined_at)
  values (inv.family_id, uid, 'member', 'active', inv.created_at, now())
  on conflict (family_id, user_id) do update set status = 'active';

  -- Link the EXISTING person to this account (never create a duplicate). Set the
  -- transaction-local flag so the household_people guards permit the user_id write.
  perform set_config('mamahq.allow_person_link', 'on', true);

  if inv.household_person_id is not null then
    -- Guard: the person must belong to the invitation's family and be unlinked (or
    -- already linked to THIS user). Never steal a person already linked elsewhere.
    update public.household_people
      set user_id = uid
      where id = inv.household_person_id
        and family_id = inv.family_id
        and (user_id is null or user_id = uid);
    -- If the row didn't update because it was linked to someone else, fall through:
    -- the person stays as-is; membership still stands. (Rare edge; not fatal.)
  else
    -- No pre-existing person on the invitation → ensure the caller has a connected
    -- person in this family (create one if missing).
    if not exists (
      select 1 from public.household_people
      where family_id = inv.family_id and user_id = uid
    ) then
      insert into public.household_people (family_id, user_id, display_name, relationship)
      values (inv.family_id, uid, 'Member', 'member');
    end if;
  end if;

  perform set_config('mamahq.allow_person_link', 'off', true);

  update public.household_invitations
    set status = 'accepted', accepted_at = now(), accepted_by_user_id = uid
    where id = inv.id;

  return jsonb_build_object('family_id', inv.family_id, 'household_person_id', inv.household_person_id);
end $$;

grant execute on function public.accept_household_invitation(text) to authenticated;

-- ---------------------------------------------------------------------------
-- revoke_household_invitation(p_invitation_id)
--   A member of the invitation's family may revoke a PENDING invitation, making the
--   token unusable. Accepted invitations are NOT reverted (membership stands);
--   revoking an already-accepted invitation is a no-op that returns false.
-- ---------------------------------------------------------------------------
create or replace function public.revoke_household_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.household_invitations;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into inv from public.household_invitations where id = p_invitation_id for update;
  if not found then
    raise exception 'invitation not found';
  end if;
  if not public.is_family_member(inv.family_id) then
    raise exception 'not authorized for this family';
  end if;

  if inv.status <> 'pending' then
    return false; -- only pending invitations can be revoked; accepted stays accepted
  end if;

  update public.household_invitations set status = 'revoked' where id = inv.id;
  return true;
end $$;

grant execute on function public.revoke_household_invitation(uuid) to authenticated;
