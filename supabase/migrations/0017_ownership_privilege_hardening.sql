-- ============================================================================
-- MamaHQ — 0017_ownership_privilege_hardening (PR6 closed-beta hardening)
-- ============================================================================
-- Additive + idempotent. Apply AFTER 0016. Enforces, in the DATABASE (never by UI
-- hiding), the household ownership/membership invariants and locks down internal
-- SECURITY DEFINER helpers that were reachable through PostgREST.
--
--   1. families_insert  — a family can only be inserted with owner_id = the caller.
--   2. families_update  — only the OWNER may update a family row, and owner_id can
--                          never be reassigned through a client update (members can
--                          no longer take ownership).
--   3. members_delete   — nobody can delete the OWNER's membership; the owner may
--                          remove other members; a member may remove only themselves.
--   4. household_people — a person LINKED to an account (user_id not null) cannot be
--                          deleted by a client; only account-less people can.
--   5. babies           — only the owner may delete the Baby row.
--   6. reset_family_data — owner-only, single-transaction Start Over (replaces the
--                          client-side table-by-table wipe).
--   7. REVOKE EXECUTE on internal helpers from PUBLIC/anon/authenticated. Every one
--      is called ONLY from other SECURITY DEFINER functions (which run as the
--      function owner and keep working); none is called by the client app.
--
-- Legitimate creation paths (ensure_family, accept_household_invitation,
-- ensure_owner_person) are SECURITY DEFINER and bypass RLS, so they are unaffected.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers used by RLS (must stay executable by `authenticated`).
-- ---------------------------------------------------------------------------
create or replace function public.is_family_owner(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.families f
    where f.id = fid and f.owner_id = auth.uid()
  );
$$;

-- The owner's user id for a family — ONLY revealed to members of that family.
create or replace function public.family_owner_id(fid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select f.owner_id from public.families f
  where f.id = fid and public.is_family_member(fid);
$$;

revoke execute on function public.is_family_owner(uuid) from public, anon;
revoke execute on function public.family_owner_id(uuid) from public, anon;
grant execute on function public.is_family_owner(uuid) to authenticated;
grant execute on function public.family_owner_id(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 1–2. families
-- ---------------------------------------------------------------------------
drop policy if exists families_insert on public.families;
create policy families_insert on public.families
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists families_update on public.families;
create policy families_update on public.families
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. family_members delete
-- ---------------------------------------------------------------------------
drop policy if exists members_delete on public.family_members;
create policy members_delete on public.family_members
  for delete to authenticated
  using (
    -- Never the owner's own membership (owner self-protection + no lockout).
    user_id is distinct from public.family_owner_id(family_id)
    -- The owner may remove another member; a member may leave themselves.
    and (user_id = auth.uid() or public.is_family_owner(family_id))
  );

-- ---------------------------------------------------------------------------
-- 4. household_people: split FOR ALL so linked identities can't be deleted.
-- ---------------------------------------------------------------------------
drop policy if exists household_people_all on public.household_people;
drop policy if exists household_people_select on public.household_people;
drop policy if exists household_people_insert on public.household_people;
drop policy if exists household_people_update on public.household_people;
drop policy if exists household_people_delete on public.household_people;

create policy household_people_select on public.household_people
  for select using (public.is_family_member(family_id));
create policy household_people_insert on public.household_people
  for insert with check (public.is_family_member(family_id));
create policy household_people_update on public.household_people
  for update using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));
create policy household_people_delete on public.household_people
  for delete using (public.is_family_member(family_id) and user_id is null);

-- ---------------------------------------------------------------------------
-- 5. babies: owner-only delete (members keep read/insert/update).
-- ---------------------------------------------------------------------------
drop policy if exists babies_all on public.babies;
drop policy if exists babies_select on public.babies;
drop policy if exists babies_insert on public.babies;
drop policy if exists babies_update on public.babies;
drop policy if exists babies_delete on public.babies;

create policy babies_select on public.babies
  for select using (public.is_family_member(family_id));
create policy babies_insert on public.babies
  for insert with check (public.is_family_member(family_id));
create policy babies_update on public.babies
  for update using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));
create policy babies_delete on public.babies
  for delete using (public.is_family_owner(family_id));

-- ---------------------------------------------------------------------------
-- 6. reset_family_data(p_family_id) — owner-only Start Over, one transaction.
--   Clears the same family-scoped data the old client wipe effectively cleared:
--   Baby, logs, appointments/questions, Mom's mood/to-dos/questions, memories,
--   captures, partner contact, grocery + household memory, and ACCOUNT-LESS
--   household people. Linked identities (owner + joined members) are kept so a
--   partner's membership is never orphaned. RPC-only shared records (tasks,
--   calendar, care, invitations, notifications) are untouched, as before.
--   Finally resets the caller's OWN name to the 'Me' placeholder so first-run
--   routing returns to onboarding.
-- ---------------------------------------------------------------------------
create or replace function public.reset_family_data(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_family_member(p_family_id) then
    raise exception 'not authorized for this family';
  end if;
  if not exists (select 1 from public.families where id = p_family_id and owner_id = uid) then
    raise exception 'only the household owner can start over';
  end if;

  delete from public.appointment_questions       where family_id = p_family_id;
  delete from public.appointments                where family_id = p_family_id;
  delete from public.logs                        where family_id = p_family_id;
  delete from public.mom_items                   where family_id = p_family_id;
  delete from public.mom_moods                   where family_id = p_family_id;
  delete from public.memories                    where family_id = p_family_id;
  delete from public.captures                    where family_id = p_family_id;
  delete from public.partner_contacts            where family_id = p_family_id;
  delete from public.household_item_observations where family_id = p_family_id;
  delete from public.household_items             where family_id = p_family_id;
  delete from public.purchase_events             where family_id = p_family_id;
  delete from public.grocery_items               where family_id = p_family_id;
  delete from public.household_people            where family_id = p_family_id and user_id is null;
  delete from public.babies                      where family_id = p_family_id;

  -- Owner identity back to the bootstrap placeholder (creates it if missing).
  perform public.ensure_owner_person(p_family_id);
  update public.household_people
     set display_name = 'Me'
   where family_id = p_family_id and user_id = uid;
end $$;

revoke execute on function public.reset_family_data(uuid) from public, anon;
grant execute on function public.reset_family_data(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Lock down internal SECURITY DEFINER helpers. Resolved by name from pg_proc so
--    every overload/signature is covered. Callers are SECURITY DEFINER RPCs that
--    run as the function owner, so internal call paths keep working.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'emit_notification',
        'notif_account_for_person',
        'set_calendar_participants',
        'upsert_household_variant',
        'recompute_household_default',
        'assert_task_assignee',
        'assert_calendar_person'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;
