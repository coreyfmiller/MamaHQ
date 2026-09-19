-- ============================================================================
-- MamaHQ — 0006_grocery_canonical_ref (Step 4)
-- ============================================================================
-- Associates a grocery_items row with a catalog canonical concept, now that the
-- catalog exists. Deferred from Step 2 on purpose; the time has arrived.
--
--   grocery_items.canonical_item_id  →  canonical_items.canonical_id  (the stable,
--   human-readable id, e.g. 'food.dairy_eggs.milk.milk')
--
-- DESIGN:
--  * NULLABLE. Custom items (typed, unmatched) keep canonical_item_id = null and
--    remain fully first-class.
--  * References the STABLE TEXT id (canonical_id), not the catalog row's surrogate
--    uuid — canonical_id is the durable external identity and what search returns.
--  * NO hard FK constraint to canonical_items(canonical_id): the catalog is a
--    file-sourced projection that can be re-seeded/pruned, and grocery data must
--    never break if a concept id is reorganized. It is a SOFT reference. (If a
--    concept is later removed/renamed, the worst case is a dangling id string on an
--    old item — harmless; display_name is always the source of truth for display.)
--  * No backfill. Existing rows stay canonical-null and valid.
--
-- Idempotent + non-destructive. Apply AFTER 0005_catalog.sql.
-- ============================================================================

begin;

alter table public.grocery_items
  add column if not exists canonical_item_id text;

-- Handy for future "how many list items map to concept X" style reads.
create index if not exists grocery_items_canonical
  on public.grocery_items (canonical_item_id) where canonical_item_id is not null;

commit;
