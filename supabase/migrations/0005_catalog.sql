-- ============================================================================
-- MamaHQ — 0005_catalog (Grocery canonical catalog PROJECTION — Step 3)
-- ============================================================================
-- The GLOBAL grocery catalog. IMPORTANT: the SOURCE OF TRUTH is the
-- version-controlled TypeScript files in lib/grocery/catalog/. This table is a
-- deterministic PROJECTION, seeded/synced from those files by canonical_id. Never
-- edit rows here as primary truth — regenerate from the files.
--
-- Unlike every other table so far, this is GLOBAL (not family-scoped): the catalog
-- is shared knowledge, not household data. RLS therefore differs: any authenticated
-- user may READ; there is NO client write policy, so writes are impossible from the
-- browser (anon/authenticated) and only the service role (used by the seed script)
-- can insert/update. This keeps household isolation intact — the catalog contains
-- zero household data.
--
-- Idempotent + non-destructive. Apply AFTER 0004_grocery_completion.sql.
-- ============================================================================

begin;

create table if not exists public.canonical_items (
  -- Stable, human-readable hierarchical id is the real key (e.g.
  -- 'food.produce.fruit.banana'). A surrogate uuid PK exists for convenience/joins,
  -- but canonical_id is the externally meaningful, immutable identity.
  id uuid primary key default gen_random_uuid(),
  canonical_id text not null unique,

  canonical_name text not null,
  default_display_name text not null,

  department text not null,
  category text not null,
  subcategory text,
  shopping_category text not null,

  concept_level text not null check (concept_level in ('generic','specific')),
  parent_concept_id text,

  default_unit text not null,
  allowed_units text[] not null,
  storage_type text not null,

  search_priority int not null default 50,
  catalog_tier text not null check (catalog_tier in ('A','B','C')),
  status text not null check (status in ('draft','review_required','approved','active','deprecated','rejected')),

  version int not null default 1,
  added_in text not null,
  deprecated_replaced_by text,   -- set when status='deprecated'; ids are redirected, never deleted

  -- Rich, per-concept data kept as jsonb (arrays of small objects). The TS files
  -- + validator are the guardrail; storing as jsonb keeps the projection simple.
  aliases jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  attributes jsonb not null default '[]'::jsonb,

  synced_at timestamptz not null default now()
);

create index if not exists canonical_items_department on public.canonical_items (department);
create index if not exists canonical_items_shopping_category on public.canonical_items (shopping_category);
create index if not exists canonical_items_status on public.canonical_items (status);
create index if not exists canonical_items_parent on public.canonical_items (parent_concept_id) where parent_concept_id is not null;

-- RLS: readable by any authenticated user; NO write policy (service-role-only writes).
alter table public.canonical_items enable row level security;

drop policy if exists canonical_items_read on public.canonical_items;
create policy canonical_items_read on public.canonical_items
  for select to authenticated using (true);
-- Intentionally NO insert/update/delete policy → browser clients cannot write.
-- The seed script uses the service role, which bypasses RLS.

commit;
