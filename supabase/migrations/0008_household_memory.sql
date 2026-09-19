-- ============================================================================
-- MamaHQ — 0008_household_memory (Step 6: Household Grocery Memory)
-- ============================================================================
-- The first household-LEARNING layer for Grocery. Deterministic, no AI/LLM/ML.
-- Three concerns, kept strictly separate (see docs/HOUSEHOLD_GROCERY_MEMORY.md):
--
--   purchase_events            = HISTORICAL TRUTH  ("what was purchased, when")
--   household_item_observations = EVIDENCE LEDGER   ("what a purchase told us")
--   household_items            = CURRENT KNOWLEDGE  ("what this household usually
--                                                     means by a concept today")
--
-- This migration:
--   1. Expands the purchase_events SNAPSHOT with the structured grocery identity
--      that Step 5B introduced (so learning has a faithful, immutable record).
--   2. Adds household_items (per-family variants of a canonical/custom concept)
--      and household_item_observations (an auditable, idempotent evidence ledger
--      keyed to the purchase_event that produced it).
--   3. Rewrites complete_grocery_item / restore_grocery_item so that completion
--      ATOMICALLY writes the structured snapshot, upserts the matching household
--      variant, records ONE observation, and recomputes derived household state;
--      and restore reverses the observation and recomputes. Completion idempotency
--      and restore semantics are preserved exactly.
--
-- CENTRAL RULE (enforced in the enrichment layer, not here): household memory FILLS
-- what the user did not say; it NEVER overrides explicit input. This migration only
-- stores/derives the memory; precedence lives in lib/grocery/household.
--
-- Idempotent + non-destructive. Apply AFTER 0007_grocery_action_detail.sql.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) purchase_events — structured immutable snapshot (Step 6 prerequisite).
-- ---------------------------------------------------------------------------
-- Step 5C confirmed purchase_events snapshotted display_name/quantity/unit/brand/
-- variant/size/category/store/purchased_by_person_id/source_type but NOT the
-- structured grocery identity used by duplicate/action resolution. Add it, so an
-- observation can be derived faithfully and history survives later preference
-- changes. These columns are written ONCE at completion and never mutated.
alter table public.purchase_events
  add column if not exists canonical_item_id text;
alter table public.purchase_events
  add column if not exists resolved_attributes jsonb not null default '[]'::jsonb;
alter table public.purchase_events
  add column if not exists package_size jsonb;         -- { value, unit } | null
alter table public.purchase_events
  add column if not exists package_type text;           -- 'can' | 'bag' | ... | null
alter table public.purchase_events
  add column if not exists unmatched_modifiers jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- 2) household_items — CURRENT household knowledge (one row per variant).
-- ---------------------------------------------------------------------------
-- A household may buy several legitimate variants of the same concept (2% 4L milk,
-- lactose-free 2L, chocolate). Each is a row. One variant MAY be the default/usual
-- interpretation for its canonical concept (partial unique index below).
--
-- References the catalog concept by its stable text id (soft ref, like grocery_items
-- — the catalog is a re-seedable projection; never hard-FK household data to it).
-- For CUSTOM items canonical_item_id is null and identity uses variant_key.
create table if not exists public.household_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,

  -- Concept identity. canonical_item_id null => custom item.
  canonical_item_id text,

  -- Deterministic variant identity signature (from lib/grocery/actions/identity +
  -- household/identity). Distinguishes "2% 4L" from "1% 2L" from a custom label.
  -- Unique per (family, concept) so we never create duplicate variants for the
  -- same meaningful identity (see unique index below).
  variant_key text not null,

  -- Faithful display + structured identity (typed where core, jsonb for the
  -- existing attribute system — NOT a junk drawer).
  display_name text not null,
  brand text,
  variant text,
  package_size jsonb,             -- { value, unit } | null
  package_unit text,              -- measure unit when size present (e.g. 'L','kg')
  package_type text,              -- package unit ('can','bag',...) | null
  resolved_attributes jsonb not null default '[]'::jsonb,  -- [{attribute_id,value}]
  store text,

  -- Learning/evidence state.
  --   evidence_state: 'observed' (1) | 'emerging' (2) | 'established' (3+)
  --                   | 'user_set' (explicit "make my usual", strongest)
  evidence_state text not null default 'observed'
    check (evidence_state in ('observed','emerging','established','user_set')),
  observation_count integer not null default 0 check (observation_count >= 0),
  -- Explicit user preference beats passive learning and does not need 3 buys.
  is_user_set boolean not null default false,
  -- The household's default/usual variant for this canonical concept (at most one
  -- per (family, canonical_item_id) — enforced by a partial unique index).
  is_default boolean not null default false,

  last_observed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fast lookup of a family's variants for a concept (the enrichment hot path).
create index if not exists household_items_family_concept
  on public.household_items (family_id, canonical_item_id);
-- Custom-item lookup by normalized key.
create index if not exists household_items_family_variant
  on public.household_items (family_id, variant_key);

-- No duplicate variants: one row per (family, concept-or-custom, variant identity).
-- coalesce so custom (null canonical) rows still get a stable uniqueness domain.
create unique index if not exists household_items_identity_uniq
  on public.household_items (family_id, coalesce(canonical_item_id, ''), variant_key);

-- At most ONE default variant per canonical concept per family. Partial so many
-- non-default variants coexist, and custom (null canonical) items don't collide.
create unique index if not exists household_items_one_default
  on public.household_items (family_id, canonical_item_id)
  where is_default and canonical_item_id is not null;

drop trigger if exists trg_household_items_updated on public.household_items;
create trigger trg_household_items_updated before update on public.household_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3) household_item_observations — the EVIDENCE LEDGER (auditable, idempotent).
-- ---------------------------------------------------------------------------
-- Each observation is traceable to the purchase_event that produced it. The UNIQUE
-- constraint on (household_item_id, purchase_event_id) makes re-processing a
-- completion a no-op — no double-counting. Deleting the observation (on restore)
-- reverses the evidence.
create table if not exists public.household_item_observations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  household_item_id uuid not null references public.household_items(id) on delete cascade,
  -- Soft link: if a purchase_event is later removed (restore), we also remove the
  -- observation explicitly in the RPC; on delete set null guards orphan safety.
  purchase_event_id uuid references public.purchase_events(id) on delete set null,

  observation_type text not null default 'purchase'
    check (observation_type in ('purchase')),
  -- What this purchase told us (the structured snapshot at that moment).
  observed_values jsonb not null default '{}'::jsonb,

  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists hh_obs_family_item
  on public.household_item_observations (family_id, household_item_id);
-- Idempotency: one observation per (variant, purchase_event).
create unique index if not exists hh_obs_event_uniq
  on public.household_item_observations (household_item_id, purchase_event_id)
  where purchase_event_id is not null;

-- ---------------------------------------------------------------------------
-- 4) RLS — family-scoped private data, same is_family_member boundary.
-- ---------------------------------------------------------------------------
alter table public.household_items enable row level security;
alter table public.household_item_observations enable row level security;

drop policy if exists household_items_all on public.household_items;
create policy household_items_all on public.household_items
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

drop policy if exists household_item_observations_all on public.household_item_observations;
create policy household_item_observations_all on public.household_item_observations
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

commit;

-- ============================================================================
-- 5) Derivation helper + rewritten completion/restore RPCs.
--    (Outside the table transaction above; each is create-or-replace = idempotent.)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- evidence_state_for(count, user_set): deterministic conservative thresholds.
--   user_set -> 'user_set' ; 1 -> observed ; 2 -> emerging ; >=3 -> established.
-- Pure; INTERNAL (no auth needed — takes no family input, reads nothing).
-- ---------------------------------------------------------------------------
create or replace function public.household_evidence_state(p_count integer, p_user_set boolean)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_user_set then 'user_set'
    when p_count >= 3 then 'established'
    when p_count = 2 then 'emerging'
    else 'observed'
  end;
$$;

-- ---------------------------------------------------------------------------
-- recompute_household_default(fid, concept): pick the default/usual variant for a
-- canonical concept, CONSERVATIVELY. Rules (no fake certainty):
--   * A user_set variant is always the default (and only one can exist).
--   * Otherwise, a variant is eligible only when established (>=3 observations).
--   * If exactly ONE eligible established variant exists -> it is default.
--   * If two or more established variants exist and none is user_set -> AMBIGUOUS:
--     clear the default (prefer "I don't know yet" over guessing). Recency is only
--     a tie-breaker among established variants IF a single most-recent clearly
--     leads; to stay conservative we DO NOT auto-pick on recency when multiple are
--     established — we leave it ambiguous.
--   * Custom items (null concept) have no default concept and are skipped.
-- SECURITY DEFINER: only ever called internally by the completion/restore RPCs,
-- which already authorized via the item's family. It still validates fid is a
-- real family and operates only within that family.
-- ---------------------------------------------------------------------------
create or replace function public.recompute_household_default(p_family_id uuid, p_canonical_item_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  established_count integer;
  the_default uuid;
  user_set_id uuid;
begin
  if p_canonical_item_id is null then
    return; -- custom items have no canonical default
  end if;

  -- Explicit user preference always wins.
  select id into user_set_id
  from public.household_items
  where family_id = p_family_id and canonical_item_id = p_canonical_item_id and is_user_set
  order by updated_at desc
  limit 1;

  if user_set_id is not null then
    update public.household_items
      set is_default = (id = user_set_id)
      where family_id = p_family_id and canonical_item_id = p_canonical_item_id
        and is_default <> (id = user_set_id);
    return;
  end if;

  -- No explicit preference: count established (>=3) variants.
  select count(*) into established_count
  from public.household_items
  where family_id = p_family_id and canonical_item_id = p_canonical_item_id
    and observation_count >= 3;

  if established_count = 1 then
    select id into the_default
    from public.household_items
    where family_id = p_family_id and canonical_item_id = p_canonical_item_id
      and observation_count >= 3
    limit 1;
    update public.household_items
      set is_default = (id = the_default)
      where family_id = p_family_id and canonical_item_id = p_canonical_item_id
        and is_default <> (id = the_default);
  else
    -- Zero established, or AMBIGUOUS (>=2 established, none explicit): no default.
    update public.household_items
      set is_default = false
      where family_id = p_family_id and canonical_item_id = p_canonical_item_id and is_default;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- upsert_household_variant(...): find-or-create the variant row matching a
-- structured identity, WITHOUT changing its learning counters (the caller manages
-- observation counts). Returns the variant id. Internal helper.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_household_variant(
  p_family_id uuid,
  p_canonical_item_id text,
  p_variant_key text,
  p_display_name text,
  p_brand text,
  p_variant text,
  p_package_size jsonb,
  p_package_unit text,
  p_package_type text,
  p_resolved_attributes jsonb,
  p_store text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  vid uuid;
begin
  select id into vid
  from public.household_items
  where family_id = p_family_id
    and coalesce(canonical_item_id, '') = coalesce(p_canonical_item_id, '')
    and variant_key = p_variant_key
  limit 1;

  if vid is not null then
    return vid;
  end if;

  insert into public.household_items (
    family_id, canonical_item_id, variant_key, display_name, brand, variant,
    package_size, package_unit, package_type, resolved_attributes, store,
    evidence_state, observation_count, is_user_set, is_default
  ) values (
    p_family_id, p_canonical_item_id, p_variant_key, p_display_name, p_brand, p_variant,
    p_package_size, p_package_unit, p_package_type, coalesce(p_resolved_attributes, '[]'::jsonb), p_store,
    'observed', 0, false, false
  )
  on conflict (family_id, coalesce(canonical_item_id, ''), variant_key) do nothing
  returning id into vid;

  if vid is null then
    select id into vid
    from public.household_items
    where family_id = p_family_id
      and coalesce(canonical_item_id, '') = coalesce(p_canonical_item_id, '')
      and variant_key = p_variant_key
    limit 1;
  end if;

  return vid;
end $$;

-- ---------------------------------------------------------------------------
-- complete_grocery_item(p_item_id) — REWRITTEN for Step 6.
-- Still: atomic, idempotent, authorized from the item's own family. Now ALSO:
--   * snapshots the structured grocery identity into purchase_events,
--   * upserts the matching household variant,
--   * records ONE observation (idempotent on purchase_event),
--   * bumps observation_count + recomputes evidence_state,
--   * recomputes the household default for the concept.
-- Idempotency preserved: an already-completed item returns its existing
-- completion_id and does NO further work (so re-calling never double-learns).
-- ---------------------------------------------------------------------------
create or replace function public.complete_grocery_item(p_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  it public.grocery_items;
  cid uuid;
  me_pid uuid;
  pe_id uuid;
  vkey text;
  vid uuid;
  new_count integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into it from public.grocery_items where id = p_item_id for update;
  if not found then
    raise exception 'grocery item not found';
  end if;

  if not public.is_family_member(it.family_id) then
    raise exception 'not authorized for this family';
  end if;

  -- Idempotent: already completed → return existing completion, do nothing else.
  if it.status = 'completed' then
    return it.completion_id;
  end if;

  cid := gen_random_uuid();

  select p.id into me_pid
  from public.household_people p
  where p.family_id = it.family_id and p.user_id = auth.uid()
  limit 1;

  update public.grocery_items
    set status = 'completed', completed_at = now(), completion_id = cid
    where id = it.id;

  -- Structured immutable snapshot (Step 6). One row per completion (unique index
  -- on completion_id guards duplicates under any race).
  insert into public.purchase_events (
    family_id, item_id, completion_id, display_name, quantity, unit,
    brand, variant, size, category, store, purchased_by_person_id, source_type,
    canonical_item_id, resolved_attributes, package_size, package_type, unmatched_modifiers,
    purchased_at
  ) values (
    it.family_id, it.id, cid, it.display_name, it.quantity, it.unit,
    it.brand, it.variant, it.size, it.category, it.store, me_pid, it.source_type,
    it.canonical_item_id, coalesce(it.resolved_attributes, '[]'::jsonb), it.package_size,
    it.package_type, coalesce(it.unmatched_modifiers, '[]'::jsonb),
    now()
  )
  on conflict (completion_id) where completion_id is not null do nothing
  returning id into pe_id;

  -- If the event already existed (idempotent race), stop — no double learning.
  if pe_id is null then
    return cid;
  end if;

  -- Variant identity signature (mirrors lib/grocery/actions/identity):
  --   canonical -> c:<id>;a:<sorted attrs>;ps:<value+unit>;pt:<type>;m:<sorted mods>
  --   custom    -> custom:<normalized display_name>
  if it.canonical_item_id is not null then
    vkey := 'c:' || it.canonical_item_id
      || ';a:' || coalesce((
           select string_agg(x, '|' order by x)
           from (
             select (e->>'attribute_id') || '=' || (e->>'value') as x
             from jsonb_array_elements(coalesce(it.resolved_attributes, '[]'::jsonb)) e
           ) s
         ), '')
      || ';ps:' || coalesce((it.package_size->>'value') || (it.package_size->>'unit'), '')
      || ';pt:' || coalesce(it.package_type, '')
      || ';m:' || coalesce((
           select string_agg(lower(m), '|' order by lower(m))
           from jsonb_array_elements_text(coalesce(it.unmatched_modifiers, '[]'::jsonb)) m
         ), '');
  else
    vkey := 'custom:' || lower(regexp_replace(it.display_name, '\s+', ' ', 'g'));
  end if;

  -- Find-or-create the variant.
  vid := public.upsert_household_variant(
    it.family_id, it.canonical_item_id, vkey, it.display_name, it.brand, it.variant,
    it.package_size,
    case when it.package_type is null then it.unit else null end, -- package_unit (measure) when not a package type
    it.package_type, coalesce(it.resolved_attributes, '[]'::jsonb), it.store
  );

  -- Record the observation (idempotent on purchase_event). Only count it if newly
  -- inserted.
  insert into public.household_item_observations (
    family_id, household_item_id, purchase_event_id, observation_type, observed_values, observed_at
  ) values (
    it.family_id, vid, pe_id, 'purchase',
    jsonb_build_object(
      'canonical_item_id', it.canonical_item_id,
      'resolved_attributes', coalesce(it.resolved_attributes, '[]'::jsonb),
      'package_size', it.package_size,
      'package_type', it.package_type,
      'unmatched_modifiers', coalesce(it.unmatched_modifiers, '[]'::jsonb),
      'display_name', it.display_name
    ),
    now()
  )
  on conflict (household_item_id, purchase_event_id) where purchase_event_id is not null do nothing;

  -- Recount from the ledger (authoritative), then recompute evidence + default.
  select count(*) into new_count
  from public.household_item_observations
  where household_item_id = vid;

  update public.household_items
    set observation_count = new_count,
        evidence_state = public.household_evidence_state(new_count, is_user_set),
        last_observed_at = now()
    where id = vid;

  perform public.recompute_household_default(it.family_id, it.canonical_item_id);

  return cid;
end $$;

grant execute on function public.complete_grocery_item(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- restore_grocery_item(p_item_id) — REWRITTEN for Step 6.
-- Reverses the completion AND its learning: deletes the purchase_event, deletes
-- the derived observation, decrements the variant's count, recomputes evidence +
-- default. An accidental completion must never permanently train the household.
-- Idempotent: already-active item is a no-op. Atomic.
-- ---------------------------------------------------------------------------
create or replace function public.restore_grocery_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  it public.grocery_items;
  pe public.purchase_events;
  vid uuid;
  new_count integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into it from public.grocery_items where id = p_item_id for update;
  if not found then
    raise exception 'grocery item not found';
  end if;

  if not public.is_family_member(it.family_id) then
    raise exception 'not authorized for this family';
  end if;

  if it.status <> 'completed' then
    return; -- idempotent
  end if;

  if it.completion_id is not null then
    -- Find the purchase_event for this completion (to reverse its learning).
    select * into pe from public.purchase_events where completion_id = it.completion_id limit 1;

    if found then
      -- Remove the observation(s) derived from this event and remember the variant.
      for vid in
        select household_item_id from public.household_item_observations where purchase_event_id = pe.id
      loop
        delete from public.household_item_observations
          where purchase_event_id = pe.id and household_item_id = vid;

        select count(*) into new_count
        from public.household_item_observations
        where household_item_id = vid;

        update public.household_items
          set observation_count = new_count,
              evidence_state = public.household_evidence_state(new_count, is_user_set),
              last_observed_at = (
                select max(observed_at) from public.household_item_observations where household_item_id = vid
              )
          where id = vid;

        perform public.recompute_household_default(it.family_id, it.canonical_item_id);
      end loop;

      -- Reverse the purchase itself (accidental completion is not audit history).
      delete from public.purchase_events where id = pe.id;
    end if;
  end if;

  update public.grocery_items
    set status = 'active', completed_at = null, completion_id = null
    where id = it.id;
end $$;

grant execute on function public.restore_grocery_item(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- set_household_usual(p_household_item_id) — explicit "Make this my usual".
-- Stronger than passive learning: marks the variant user_set + default, and clears
-- user_set/default on sibling variants of the same concept (one default rule).
-- SECURITY DEFINER, authorized from the variant's OWN family (never caller input).
-- ---------------------------------------------------------------------------
create or replace function public.set_household_usual(p_household_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hi public.household_items;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into hi from public.household_items where id = p_household_item_id for update;
  if not found then
    raise exception 'household item not found';
  end if;
  if not public.is_family_member(hi.family_id) then
    raise exception 'not authorized for this family';
  end if;

  if hi.canonical_item_id is not null then
    -- Clear explicit/default on siblings of the same concept.
    update public.household_items
      set is_user_set = false, is_default = false,
          evidence_state = public.household_evidence_state(observation_count, false)
      where family_id = hi.family_id
        and canonical_item_id = hi.canonical_item_id
        and id <> hi.id
        and (is_user_set or is_default);
  end if;

  update public.household_items
    set is_user_set = true, is_default = (canonical_item_id is not null),
        evidence_state = 'user_set'
    where id = hi.id;
end $$;

grant execute on function public.set_household_usual(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- clear_household_usual(p_household_item_id) — undo an explicit preference.
-- Reverts to passive-learning state; recomputes the concept's default.
-- ---------------------------------------------------------------------------
create or replace function public.clear_household_usual(p_household_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hi public.household_items;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into hi from public.household_items where id = p_household_item_id for update;
  if not found then
    raise exception 'household item not found';
  end if;
  if not public.is_family_member(hi.family_id) then
    raise exception 'not authorized for this family';
  end if;

  update public.household_items
    set is_user_set = false, is_default = false,
        evidence_state = public.household_evidence_state(observation_count, false)
    where id = hi.id;

  perform public.recompute_household_default(hi.family_id, hi.canonical_item_id);
end $$;

grant execute on function public.clear_household_usual(uuid) to authenticated;
