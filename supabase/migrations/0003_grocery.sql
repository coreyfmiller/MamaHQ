-- ============================================================================
-- MamaHQ — 0003_grocery (Grocery operational foundation — Step 2)
-- ============================================================================
-- The DURABLE bottom two layers of the eventual Grocery stack:
--
--   canonical concept   (LATER — not built)
--         ↓
--   household item      (LATER — not built)
--         ↓
--   grocery_items       ← THIS migration (the operational list)
--         ↓
--   purchase_events     ← THIS migration (retained history)
--
-- Deliberately simple: no catalog, no aliases, no units registry, no search, no
-- AI. A household can add / edit / complete / restore items and keep purchase
-- history — all WITHOUT MamaHQ "understanding" any item. display_name is the
-- source of truth and never depends on resolution.
--
-- Idempotent + non-destructive. Apply AFTER 0002_household_people.sql.
--
-- DESIGN DECISIONS (see docs/GROCERY_FOUNDATION.md for full rationale):
--  * Single implicit family list. No grocery_lists table yet — it would add a join
--    and a "which list?" concept with zero present value. `list_id` is reserved as
--    a NULLABLE column with NO foreign key (the target table doesn't exist).
--    null = the family's primary list. When named lists (Costco Run, Camping, …)
--    arrive: create grocery_lists, backfill list_id, then add the FK. Cheap + safe.
--  * canonical_item_id / household_item_id are DEFERRED entirely — no speculative
--    columns and no fake FKs to nonexistent tables. Adding a nullable uuid column
--    later is a trivial non-destructive migration. (list_id is the one reserved
--    column because it has a concrete near-term product need; these do not yet.)
--  * quantity is numeric + nullable unit text now, so "x2" works today and
--    "2 lb ground beef" / "3 x 796 mL cans" fit later with NO schema change. No
--    parser is built.
--  * status is a small state machine (active | completed); completion is a STATE
--    change, never a delete. Room to add removed/archived later.
--  * Attribution references household_people (Step 1), ON DELETE SET NULL so
--    removing a person never destroys a grocery item or its history.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- grocery_items — the operational shared list (one implicit list per family).
-- ---------------------------------------------------------------------------
create table if not exists public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,

  -- Reserved for future named lists. NULL = the family's primary list.
  -- Intentionally NO foreign key: grocery_lists does not exist yet.
  list_id uuid,

  -- The user's words. Source of truth; works with zero intelligence.
  display_name text not null check (length(display_name) between 1 and 200),

  -- Quantity now (e.g. 2). unit reserved for later ("lb","L","cans"); null today.
  quantity numeric not null default 1 check (quantity > 0),
  unit text,

  -- Optional product detail the user may type; all nullable, all free-text.
  brand text,
  variant text,
  size text,

  -- Optional organization; free-text today (a catalog may standardize later).
  category text,
  store text,

  note text,
  photo_url text,

  -- Optional ordering hint. Small int; 0 = normal.
  priority smallint not null default 0,

  -- Attribution to household people (Step 1). SET NULL keeps items/history intact
  -- if a person is removed. "assigned_to" = who's responsible for buying it.
  added_by_person_id uuid references public.household_people(id) on delete set null,
  assigned_to_person_id uuid references public.household_people(id) on delete set null,

  -- Provenance: how this item came to exist. Kept as free-ish text with a broad
  -- check so future sources (meal, bundle, recurring, voice, tell-mamahq, …) don't
  -- need a migration. source_id points at the originating row when applicable.
  source_type text not null default 'manual'
    check (source_type in ('manual','autocomplete','voice','tell_mamahq','meal','recipe','bundle','recurring','suggestion','barcode','photo','import')),
  source_id uuid,

  -- State machine. Completion is a status change (never a hard delete).
  status text not null default 'active' check (status in ('active','completed')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- The list query: a family's ACTIVE items, newest-ish first (priority then time).
create index if not exists grocery_items_family_status
  on public.grocery_items (family_id, status, priority desc, created_at desc);
-- Attribution lookups (who's responsible).
create index if not exists grocery_items_assigned
  on public.grocery_items (assigned_to_person_id) where assigned_to_person_id is not null;

drop trigger if exists trg_grocery_items_updated on public.grocery_items;
create trigger trg_grocery_items_updated before update on public.grocery_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- purchase_events — retained history. Written when an item is completed as
-- purchased. A denormalized SNAPSHOT so history survives even if the source item
-- is later edited or removed. Enough signal to later derive: recently/frequently
-- purchased, typical quantity, preferred product/store, recurrence, running-low.
-- ---------------------------------------------------------------------------
create table if not exists public.purchase_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,

  -- Soft link to the item it came from (null if that item is later deleted).
  item_id uuid references public.grocery_items(id) on delete set null,

  -- Snapshot of the item at purchase time (independent of the live item).
  display_name text not null,
  quantity numeric,
  unit text,
  brand text,
  variant text,
  size text,
  category text,
  store text,

  purchased_by_person_id uuid references public.household_people(id) on delete set null,
  source_type text,

  purchased_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- History queries: a family's purchases over time; and "how often is X bought".
create index if not exists purchase_events_family_purchased
  on public.purchase_events (family_id, purchased_at desc);
create index if not exists purchase_events_family_name
  on public.purchase_events (family_id, display_name);

-- ---------------------------------------------------------------------------
-- RLS — same household-isolation boundary as every other table.
-- ---------------------------------------------------------------------------
alter table public.grocery_items enable row level security;
alter table public.purchase_events enable row level security;

drop policy if exists grocery_items_all on public.grocery_items;
create policy grocery_items_all on public.grocery_items
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

drop policy if exists purchase_events_all on public.purchase_events;
create policy purchase_events_all on public.purchase_events
  for all using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

commit;
