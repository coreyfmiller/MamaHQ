-- ============================================================================
-- MamaHQ — 0014_owner_identity (Beta Phase 1: Household Identity)
-- ============================================================================
-- Fixes the P0 identity gap found in the closed-beta readiness audit: the name a
-- parent types during onboarding never reliably became the display name of THEIR
-- canonical HouseholdPerson (the person linked to their authenticated account). The
-- owner person is bootstrapped as "Me" (0009 `ensure_owner_person`) and the
-- onboarding name only landed on the local Profile / baby row — so People, task
-- ownership, calendar responsibility, care, and notifications could show a
-- placeholder ("Me") or a stale/inconsistent identity. That violates household truth.
--
-- CANONICAL IDENTITY RULE (enforced here):
--   For an authenticated member, the HouseholdPerson whose `user_id = auth.uid()`
--   in that family IS their canonical household identity. Setting a name updates
--   THAT row's display_name — never creating a duplicate person, never touching
--   another person or another family.
--
-- This is a security-sensitive identity operation, so it is a SECURITY DEFINER RPC
-- (not a client UPDATE): identity is derived from the authenticated account +
-- membership, never from a caller-supplied person/family/membership id.
--
-- Additive + idempotent + non-destructive. Apply AFTER 0013. Clean-provisions
-- 0001 → 0014. Does NOT modify 0001–0013. Adds ONE function; no schema/table change.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- set_my_display_name(p_family_id, p_display_name)
--   Set the CALLER'S OWN canonical HouseholdPerson display name in p_family_id.
--   Authorization: caller must be authenticated AND an active member of the family
--   (is_family_member). The person acted on is resolved from the caller's account
--   (`user_id = auth.uid()`), so a client can never rename another person or another
--   family's person by passing ids. If the caller somehow has no linked person yet
--   (edge case), it bootstraps the owner person via ensure_owner_person for the
--   owner, or creates the caller's connected member person under the same authorized
--   link flag used by the invite-accept path. Idempotent: setting the same name
--   twice changes nothing and never creates a second row. Returns the person id.
--
--   Validation: the name is trimmed, internal whitespace collapsed, length-bounded
--   (1..80 after trim). Unicode / apostrophes / hyphens are fine (no culturally
--   narrow rules). An empty/whitespace-only name is rejected.
-- ---------------------------------------------------------------------------
create or replace function public.set_my_display_name(
  p_family_id uuid,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_name text;
  pid uuid;
  fam_owner uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_family_member(p_family_id) then
    raise exception 'not authorized for this family';
  end if;

  -- Normalize: collapse internal whitespace, trim ends, bound length. Do NOT impose
  -- character rules beyond a sensible length so any real name is accepted.
  clean_name := btrim(regexp_replace(coalesce(p_display_name, ''), '\s+', ' ', 'g'));
  if length(clean_name) = 0 then
    raise exception 'name is required';
  end if;
  if length(clean_name) > 80 then
    raise exception 'name is too long';
  end if;

  -- Resolve the caller's OWN person in this family (derived from the account, never
  -- caller-supplied). This is the single row we may rename.
  pid := public.my_person_in_family(p_family_id);

  -- Edge case: no linked person yet. Establish the correct canonical person safely
  -- via the existing authorized bootstrap, then re-resolve. For the family owner
  -- this is ensure_owner_person; for a connected member the person is normally
  -- created at invite-accept, so a missing one here is unusual — we create the
  -- caller's connected person under the same transaction-local link flag the guard
  -- trigger recognizes (0009), never stealing an existing person.
  if pid is null then
    select owner_id into fam_owner from public.families where id = p_family_id;
    if fam_owner = uid then
      pid := public.ensure_owner_person(p_family_id);
    else
      perform set_config('mamahq.allow_person_link', 'on', true);
      insert into public.household_people (family_id, user_id, display_name, relationship)
      values (p_family_id, uid, clean_name, 'member')
      on conflict (family_id, user_id) where user_id is not null do nothing;
      perform set_config('mamahq.allow_person_link', 'off', true);
      pid := public.my_person_in_family(p_family_id);
    end if;
  end if;

  if pid is null then
    raise exception 'could not resolve your household person';
  end if;

  -- Rename ONLY the caller's own person. The extra user_id = uid guard is defense in
  -- depth so this can never touch a row that isn't the caller's, even if
  -- my_person_in_family were ever wrong. Idempotent: a no-op when the name matches.
  update public.household_people
     set display_name = clean_name
   where id = pid
     and family_id = p_family_id
     and user_id = uid;

  return pid;
end $$;

grant execute on function public.set_my_display_name(uuid, text) to authenticated;
