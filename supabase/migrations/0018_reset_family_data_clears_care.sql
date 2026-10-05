-- ============================================================================
-- MamaHQ — 0018_reset_family_data_clears_care (Start Over duplicate-key fix)
-- ============================================================================
-- BUG: owner Start Over failed on production with
--   23505 duplicate key value violates unique constraint
--   "care_responsibility_family_subject"
-- and NOTHING was cleared (the whole transaction aborted).
--
-- CAUSE: reset_family_data (0017) deleted public.babies but left the DORMANT care
-- tables untouched. care_responsibility.subject_baby_id references babies with
-- `on delete set null`, so deleting the baby flipped an existing responsibility
-- row's subject to NULL. That NULL subject collides with the family's
-- coalesce(NULL) slot in the unique index
--   care_responsibility (family_id, coalesce(subject_baby_id, '000…'::uuid))
-- → 23505 → transaction rolls back → Start Over does nothing.
--
-- FIX: clear the family's care_handoffs + care_responsibility rows INSIDE the reset
-- transaction, BEFORE deleting babies, so the set-null collision can never happen.
-- The care BACKEND stays dormant/intact (schema, RLS, RPCs unchanged) — we only make
-- Start Over clean up the family-scoped care rows it already owns, exactly like it
-- clears logs/grocery/etc. care_handoffs is deleted first (it also set-nulls on baby
-- delete and has its own one-pending uniqueness domain), then care_responsibility.
--
-- Everything else about reset_family_data is UNCHANGED: owner-only authorization,
-- single transaction, the same table set, and the owner-name reset to 'Me'.
--
-- Additive + idempotent (create or replace). Apply AFTER 0017.
-- ============================================================================

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
  -- Dormant care tables (0011): clear BEFORE babies so the baby delete's
  -- `on delete set null` on subject_baby_id can't collide with the family's
  -- coalesce(NULL) uniqueness slot (the 23505 that aborted the reset).
  delete from public.care_handoffs               where family_id = p_family_id;
  delete from public.care_responsibility         where family_id = p_family_id;
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
