-- ============================================================================
-- MamaHQ — 0004_grocery_completion (Step 2 reliability correction)
-- ============================================================================
-- Makes "complete a grocery item" ATOMIC and IDEMPOTENT.
--
-- BEFORE: the client did two independent fire-and-forget writes
--   (1) update grocery_items.status = 'completed'
--   (2) insert a purchase_events row
-- If (1) succeeded and (2) failed → completed item with NO history (or the
-- reverse). Double-taps / retries / two devices could insert duplicate history.
-- Restore left the purchase_events row orphaned, contaminating history.
--
-- AFTER: a single SECURITY DEFINER Postgres function does BOTH in one transaction
-- (commit both or neither), gated on authenticated family membership derived FROM
-- THE ITEM (never a caller-supplied family_id). A `completion_id` links an item's
-- current completion to exactly one purchase_events row; a UNIQUE constraint on
-- purchase_events.completion_id makes duplicate history impossible even under
-- concurrency/retry. Restore reverses the accidental completion by deleting that
-- one event.
--
-- Idempotent + non-destructive. Apply AFTER 0003_grocery.sql.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Completion identity: one completion == one completion_id == <=1 purchase_event.
-- ---------------------------------------------------------------------------
alter table public.grocery_items
  add column if not exists completion_id uuid;

alter table public.purchase_events
  add column if not exists completion_id uuid;

-- The idempotency guarantee: at most one purchase_events row per completion.
-- (Partial unique so historical rows with null completion_id — none today — and
-- any future non-completion-sourced events don't collide.)
create unique index if not exists purchase_events_completion_uniq
  on public.purchase_events (completion_id) where completion_id is not null;

-- ---------------------------------------------------------------------------
-- complete_grocery_item(p_item_id): atomic complete + snapshot, idempotent.
-- SECURITY DEFINER so it runs inside one server-side transaction; it STILL
-- enforces authorization via is_family_member() on the item's own family_id.
-- Returns the completion_id (new or existing).
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
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Lock the row so concurrent completions serialize on it.
  select * into it from public.grocery_items where id = p_item_id for update;
  if not found then
    raise exception 'grocery item not found';
  end if;

  -- Authorization derived from the ITEM's family — never caller-supplied.
  if not public.is_family_member(it.family_id) then
    raise exception 'not authorized for this family';
  end if;

  -- Idempotent: already completed → return the existing completion_id, do nothing.
  if it.status = 'completed' then
    return it.completion_id;
  end if;

  cid := gen_random_uuid();

  -- The calling user's household person (for purchased_by attribution), if any.
  select p.id into me_pid
  from public.household_people p
  where p.family_id = it.family_id and p.user_id = auth.uid()
  limit 1;

  update public.grocery_items
    set status = 'completed', completed_at = now(), completion_id = cid
    where id = it.id;

  -- One snapshot per completion. on conflict guards against any race that would
  -- otherwise duplicate history for the same completion_id.
  insert into public.purchase_events (
    family_id, item_id, completion_id, display_name, quantity, unit,
    brand, variant, size, category, store, purchased_by_person_id, source_type, purchased_at
  ) values (
    it.family_id, it.id, cid, it.display_name, it.quantity, it.unit,
    it.brand, it.variant, it.size, it.category, it.store, me_pid, it.source_type, now()
  )
  on conflict (completion_id) where completion_id is not null do nothing;

  return cid;
end $$;

grant execute on function public.complete_grocery_item(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- restore_grocery_item(p_item_id): reverse a completion (the "oops, I checked
-- that by accident" path). Sets the item back to active, clears completion state,
-- and DELETES the purchase_events row for that completion — an accidental check
-- must not contaminate purchase history. (Documented decision: a reversed
-- operational mistake, not immutable audit history.) Atomic + authorized.
-- ---------------------------------------------------------------------------
create or replace function public.restore_grocery_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  it public.grocery_items;
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

  -- Already active → nothing to do (idempotent).
  if it.status <> 'completed' then
    return;
  end if;

  -- Reverse the exact event created by THIS completion.
  if it.completion_id is not null then
    delete from public.purchase_events where completion_id = it.completion_id;
  end if;

  update public.grocery_items
    set status = 'active', completed_at = null, completion_id = null
    where id = it.id;
end $$;

grant execute on function public.restore_grocery_item(uuid) to authenticated;

commit;
