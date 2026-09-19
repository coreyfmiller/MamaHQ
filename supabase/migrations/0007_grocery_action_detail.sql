-- ============================================================================
-- MamaHQ — 0007_grocery_action_detail (Step 5B)
-- ============================================================================
-- Persists the operational detail the Action Resolver needs to (a) tell items
-- apart for duplicate handling and (b) reconstruct a faithful display, plus an
-- atomic, idempotent quantity-increment RPC.
--
--   resolved_attributes  jsonb   — [{ attribute_id, value }] snapshot (2%, size 4,
--                                   boneless, red…). Operational snapshot, NOT a
--                                   catalog mutation; survives catalog changes.
--   package_size         jsonb   — { value, unit } | null  (e.g. {4,"L"}) so
--                                   "two 4L milks" isn't collapsed to "Milk x2".
--   package_type         text    — a package unit ('can','bag',…) | null.
--   unmatched_modifiers  jsonb   — ["natrel", …] the user's words we couldn't
--                                   resolve; never silently discarded.
--   client_action_id     text    — idempotency key for the last mutation that
--                                   touched the row (so a retried add/increment
--                                   doesn't double-apply).
--
-- Idempotent + non-destructive. Apply AFTER 0006_grocery_canonical_ref.sql.
-- ============================================================================

begin;

alter table public.grocery_items
  add column if not exists resolved_attributes jsonb not null default '[]'::jsonb;
alter table public.grocery_items
  add column if not exists package_size jsonb;
alter table public.grocery_items
  add column if not exists package_type text;
alter table public.grocery_items
  add column if not exists unmatched_modifiers jsonb not null default '[]'::jsonb;
alter table public.grocery_items
  add column if not exists client_action_id text;

-- ---------------------------------------------------------------------------
-- increment_grocery_item(p_item_id, p_delta, p_client_action_id): atomically add
-- p_delta to an ACTIVE item's quantity in ONE statement (no read-modify-write race).
-- SECURITY DEFINER but authorizes via is_family_member(item.family_id). Idempotent:
-- if the same client_action_id already applied, it's a no-op returning the current
-- quantity — so a retried increment can't double-apply.
-- ---------------------------------------------------------------------------
create or replace function public.increment_grocery_item(
  p_item_id uuid,
  p_delta numeric,
  p_client_action_id text
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  it public.grocery_items;
  new_qty numeric;
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

  -- Idempotency: same action already applied to this row → no-op.
  if p_client_action_id is not null and it.client_action_id is not distinct from p_client_action_id then
    return it.quantity;
  end if;

  update public.grocery_items
     set quantity = quantity + p_delta,
         client_action_id = coalesce(p_client_action_id, client_action_id),
         updated_at = now()
   where id = it.id
   returning quantity into new_qty;

  return new_qty;
end $$;

grant execute on function public.increment_grocery_item(uuid, numeric, text) to authenticated;

commit;
