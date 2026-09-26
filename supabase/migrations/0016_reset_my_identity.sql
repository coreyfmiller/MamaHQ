-- ============================================================================
-- MamaHQ — 0016_reset_my_identity (Start Over → real onboarding, stay signed in)
-- ============================================================================
-- "Start over" clears the baby profile + logs (and, for owners, the family data via
-- clearFamilyData), but historically it kept the caller's canonical identity intact,
-- so the app treated them as an established user ('done') and dropped them back into
-- the app greeting them by name instead of routing to onboarding.
--
-- first-run routing (client `useHousehold().firstRun`) is derived from AUTHORITATIVE
-- household truth: an owner whose canonical HouseholdPerson name is still the 'Me'
-- bootstrap placeholder (0009 `ensure_owner_person`) is 'creator' → onboarding; any
-- real name is 'done'. So the honest, in-place way to send the caller back to a true
-- first-run WITHOUT signing them out is to reset THEIR OWN person's display_name back
-- to the 'Me' placeholder.
--
-- We deliberately do NOT do this through set_my_display_name (0014): that RPC is the
-- writer of REAL names, so forging a placeholder through it would invert the identity
-- contract. This is a distinct, purpose-built operation.
--
-- Security model mirrors 0014: SECURITY DEFINER, caller must be an active family
-- member, and the row acted on is resolved from the authenticated account
-- (my_person_in_family), never caller-supplied — so it can only ever reset the
-- CALLER'S OWN identity, never another person's and never another family's.
--
-- Additive + idempotent + non-destructive. Apply AFTER 0015. Adds ONE function; no
-- schema/table change.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- reset_my_identity(p_family_id)
--   Reset the CALLER'S OWN canonical HouseholdPerson display name back to the 'Me'
--   bootstrap placeholder in p_family_id, so client first-run routing resolves to
--   'creator' and shows real onboarding again. Authorization: caller must be
--   authenticated AND an active member of the family. The person acted on is resolved
--   from the caller's account (user_id = auth.uid()), never a caller-supplied id.
--   If the caller has no linked person yet, it bootstraps the owner person via
--   ensure_owner_person (which itself sets 'Me'), so the post-condition holds either
--   way. Idempotent: resetting an already-placeholder identity changes nothing.
--   Returns the person id.
-- ---------------------------------------------------------------------------
create or replace function public.reset_my_identity(
  p_family_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pid uuid;
  fam_owner uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_family_member(p_family_id) then
    raise exception 'not authorized for this family';
  end if;

  -- Resolve the caller's OWN person in this family (derived from the account, never
  -- caller-supplied). This is the single row we may reset.
  pid := public.my_person_in_family(p_family_id);

  -- Edge case: no linked person yet. For the owner, ensure_owner_person creates it
  -- already named 'Me' — which is exactly the post-condition we want — so return it.
  -- For a connected member with no person (unusual), there is nothing owned to reset.
  if pid is null then
    select owner_id into fam_owner from public.families where id = p_family_id;
    if fam_owner = uid then
      return public.ensure_owner_person(p_family_id);
    end if;
    raise exception 'could not resolve your household person';
  end if;

  -- Reset ONLY the caller's own person back to the 'Me' bootstrap placeholder. The
  -- extra user_id = uid guard is defense in depth so this can never touch a row that
  -- isn't the caller's. Idempotent: a no-op when already 'Me'.
  update public.household_people
     set display_name = 'Me'
   where id = pid
     and family_id = p_family_id
     and user_id = uid;

  return pid;
end $$;

grant execute on function public.reset_my_identity(uuid) to authenticated;
