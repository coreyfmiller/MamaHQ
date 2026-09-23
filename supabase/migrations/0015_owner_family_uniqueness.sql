-- ============================================================================
-- MamaHQ — 0015_owner_family_uniqueness (P1 fix: duplicate owner-family bootstrap)
-- ============================================================================
-- DEFECT (found during Human-QA prep): a single authenticated user could end up
-- OWNING TWO families, created ~1ms apart, from normal first-load bootstrap.
--
-- ROOT CAUSE: public.ensure_family() (0001) is a check-then-insert with NO locking
-- and NO uniqueness guard:
--     select ... from family_members where user_id = uid  -- (A) miss
--     select ... from families where owner_id = uid        -- (B) miss
--     insert into families (owner_id) values (uid)          -- (C) both callers insert
-- families.owner_id had only a NON-unique index (families_owner_idx), so two
-- concurrent calls both pass (A)/(B) and both run (C), producing two owner
-- families. The client makes this easy to hit: AuthProvider calls resolveHousehold()
-- from BOTH getSession().then(...) AND onAuthStateChange(...), so a fresh sign-in
-- fires two near-simultaneous ensure_family() RPCs (React StrictMode/dev and
-- multi-tab compound it, but the double-trigger alone is sufficient in production).
--
-- FIX (database-side, concurrency-safe — NOT client debouncing):
--   1. A PARTIAL UNIQUE INDEX on families.owner_id guarantees at most ONE owner
--      family per user at the storage layer, so two concurrent inserts can never
--      both succeed regardless of timing (the loser gets a unique violation).
--   2. ensure_family() is rewritten to be concurrency-safe + idempotent:
--        * takes a transaction-level advisory lock keyed to the user so concurrent
--          bootstraps for the SAME user serialize (the second waits, then observes
--          the family the first created and returns it — no error, no duplicate),
--        * inserts with ON CONFLICT (owner_id) DO NOTHING and re-selects, so even if
--          the advisory lock were somehow bypassed, the unique index still prevents
--          a duplicate and the function still returns the existing family.
--
-- INVARIANT ENFORCED: "one authenticated user cannot accidentally create two OWNER
-- families because of concurrent/repeated initialization."
--
-- PRESERVES the identity architecture (Person ≠ Account ≠ Membership):
--   * This constrains only public.families.owner_id — who OWNS a household.
--   * It does NOT constrain family_members (AUTHORIZATION), so a user MAY still be a
--     MEMBER of more than one family in the future (multi-household membership stays
--     possible: the invitation-acceptance path in 0009 creates a `member` row, never
--     a second owned family). The one documented product rule "one active household
--     per user" lives in accept_household_invitation, unchanged here.
--   * It does NOT touch household_people (WHO someone is in a household).
--
-- Idempotent + non-destructive. Adds one index + a create-or-replace function.
-- NEVER drops a table/column and deletes NO data. Apply AFTER 0014_owner_identity.sql.
--
-- NOTE: this migration assumes no pre-existing duplicate owner families. Production
-- was reconciled to 0 families before this migration; fresh/CI databases never have
-- duplicates. If a future environment somehow has duplicates, the index creation
-- will fail loudly (by design) rather than silently pick a winner — resolve the
-- duplicates first (operator task), then apply.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) One owner family per user — the storage-layer guarantee.
--    Partial + unique: at most one families row per owner_id. owner_id is NOT NULL
--    in practice (default auth.uid(), not null constraint in 0001), but the WHERE
--    guard is harmless and keeps the index intent explicit.
-- ---------------------------------------------------------------------------
create unique index if not exists families_owner_unique
  on public.families (owner_id)
  where owner_id is not null;

commit;

-- ---------------------------------------------------------------------------
-- 2) ensure_family() — concurrency-safe, idempotent bootstrap.
--    create-or-replace = idempotent. Same contract/return as 0001 (returns the
--    caller's family id), but two concurrent calls for the same user can no longer
--    create two owner families.
-- ---------------------------------------------------------------------------
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

  -- Serialize concurrent bootstraps for the SAME user within this transaction.
  -- Two near-simultaneous ensure_family() calls (e.g. getSession + onAuthStateChange
  -- both firing on a fresh sign-in) now run one-at-a-time for this uid: the first
  -- creates the family, the rest block until it commits, then fall through and
  -- observe/return the SAME family. Different users hash to different lock keys and
  -- never contend. The lock auto-releases at transaction end.
  -- Single-arg advisory lock takes one bigint; hashtextextended(text,int8) → bigint
  -- gives a stable per-user key namespaced to this function.
  perform pg_advisory_xact_lock(hashtextextended('mamahq.ensure_family:' || uid::text, 0));

  -- Already a member of a family? adopt it. Otherwise resolve/create the owned family.
  -- NOTE: we do NOT early-return here — the owner-person invariant (0002) must hold
  -- on EVERY bootstrap (existing families included), so ensure_owner_person(fid) runs
  -- unconditionally below before returning, exactly like the 0002 definition.
  select m.family_id into fid from public.family_members m where m.user_id = uid limit 1;

  if fid is null then
    -- Owns a family but is somehow missing membership? adopt it.
    select f.id into fid from public.families f where f.owner_id = uid limit 1;

    -- Otherwise create one. ON CONFLICT (owner_id) is belt-and-suspenders: even if the
    -- advisory lock were bypassed, the unique index prevents a duplicate insert, and we
    -- re-select the existing row so the function still returns the one true family.
    if fid is null then
      insert into public.families (owner_id) values (uid)
        on conflict (owner_id) where owner_id is not null do nothing
        returning id into fid;
      if fid is null then
        select f.id into fid from public.families f where f.owner_id = uid limit 1;
      end if;
    end if;

    -- Ensure owner membership exists (idempotent).
    insert into public.family_members (family_id, user_id, role)
    values (fid, uid, 'owner')
    on conflict (family_id, user_id) do nothing;
  end if;

  -- Guarantee the owner has exactly one connected Household Person (0002 invariant).
  -- Unconditional + idempotent: holds for both newly created and pre-existing
  -- families on every sign-in bootstrap. This was dropped in an earlier draft of
  -- 0015 and MUST remain, or the owner-person never gets created.
  perform public.ensure_owner_person(fid);

  return fid;
end $$;

grant execute on function public.ensure_family() to authenticated;
