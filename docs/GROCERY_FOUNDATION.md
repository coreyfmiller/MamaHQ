# MamaHQ — Grocery Operational Foundation (Step 2)

Implementation report. Scope was strictly the **operational foundation**: a durable,
family-scoped grocery list + retained purchase history, a domain/data layer, and a
simple add/edit/complete/restore UI. **No** catalog, canonical concepts, household
items, aliases, units registry, search, or AI were built.

Migration: `supabase/migrations/0003_grocery.sql` (applied live + verified, HTTP 201,
RLS confirmed). Apply order: `0001_baseline` → `0002_household_people` → `0003_grocery`.

## Data model

### `grocery_items` — the operational shared list
Family-scoped, one implicit list per family. Key columns:
- `display_name` (source of truth; works with zero intelligence — "Milk", "Purple
  Dragon Cereal", "Grandma's weird sauce" all just work).
- `quantity numeric default 1` + nullable `unit` (so "×2" works now, "2 lb" / "3 ×
  796 mL" fit later with no schema change; no parser built).
- Optional free-text `brand` / `variant` / `size` / `category` / `store` / `note` /
  `photo_url`, and `priority smallint`.
- `added_by_person_id` / `assigned_to_person_id` → `household_people` (Step 1),
  `ON DELETE SET NULL` (removing a person never destroys an item).
- `source_type` (checked, broad set incl. manual/voice/tell_mamahq/meal/…) +
  `source_id` for provenance (enables "remove Tuesday's taco items" later).
- `status` (`active` | `completed`) — completion is a STATE change, never a delete.
- `created_at` / `updated_at` (trigger) / `completed_at`.

### `purchase_events` — retained history
Family-scoped. Written when an item is completed as purchased: a **denormalized
snapshot** (name/quantity/unit/brand/variant/size/category/store + who + when) with
a soft `item_id` link (`ON DELETE SET NULL`). History therefore survives edits or
removal of the source item. Enough signal to later derive recently/frequently
purchased, typical quantity, preferred product/store, recurrence, running-low timing.

Both tables: RLS enabled with `<table>_all using/​with check is_family_member(family_id)`
— the same household-isolation boundary as every other table.

## Design decisions (as required by the brief)

1. **Single implicit family list — no `grocery_lists` table yet.** At V1 there is
   exactly one list per family; a table + join + "which list?" concept would add
   complexity with zero present value. Future-safe via a **nullable `list_id uuid`
   column with NO foreign key** (the target table doesn't exist). `null` = the
   primary list. When named lists (Costco Run, Camping, …) arrive: create
   `grocery_lists`, backfill `list_id`, add the FK — cheap and non-destructive. No
   multi-list UI now.

2. **`canonical_item_id` / `household_item_id` deferred entirely.** No fake FKs to
   nonexistent tables, and — deliberately — no speculative nullable columns either,
   since they'd provide zero present value and adding a nullable uuid later is a
   trivial safe migration. (This is the difference from `list_id`, which has a
   concrete near-term product need and is therefore worth reserving now.)

3. **`display_name` is standalone and authoritative.** Basic grocery functionality
   never depends on resolution; intelligence may later attach a canonical concept
   without changing how the list works.

4. **Quantity now, parser later.** `quantity numeric` + nullable `unit` supports the
   simple "×2" UI today and richer quantities later with no schema churn.

5. **Status, not deletion.** `active` / `completed` (check constraint leaves room for
   `removed` / `archived`). Completing writes the purchase snapshot and stamps
   `completed_at`; restore flips back to `active` and clears it.

## Client / domain layer
- `lib/supabase/data.ts`: `DbGroceryItem` + `DbPurchaseEvent` interfaces and
  family-scoped CRUD (`fetchGroceryItems`, `insertGroceryItem`, `updateGroceryItem`,
  `deleteGroceryItem`, `insertPurchaseEvent`, `fetchPurchaseEvents`). Added
  `purchase_events` + `grocery_items` to `clearFamilyData()` (children first).
- `components/mama/grocery.tsx`: `GroceryProvider` + `useGrocery()` following the
  established store pattern (cloud when `familyId`, localStorage fallback when signed
  out, optimistic writes). `addItem`, `editItem`, `completeItem` (writes a
  purchase_event), `restoreItem`, `removeItem`. Attribution via `useHousehold().me`
  for `added_by_person_id`. Wired into the provider tree (inside `HouseholdProvider`,
  since it reads the current person).
- `components/mama/screens/grocery.tsx`: the list UI (add row, quantity stepper, tap
  to mark bought, a "Bought" section with restore/remove). Registered as the
  `'grocery'` overlay (`context.tsx` + `prototype.tsx`) and opened from a compact
  Grocery card on the Today screen.

## Shared-list note
The list is family-scoped at the data layer, so the moment a second person is a real
member of the family, both see and edit the same list (attribution records who added
each item). Actual second-person login/participation still depends on the full-user
partner work (tracked separately); nothing here needs rework when that lands.

## Explicitly NOT built
Canonical catalog, household items, aliases, unit registry, search/autocomplete,
duplicate detection, realtime sync, offline queue, Meals, and AI/"Tell MamaHQ"
routing — all out of scope for Step 2.

---

## Reliability correction — atomic + idempotent completion (migration 0004)

The initial Step 2 `completeItem` did two independent client writes (update status,
then insert purchase_event), fire-and-forget. That allowed split-brain (one succeeds,
one fails), duplicate history (double-tap / retry / two devices), and orphaned events
on restore. Corrected in `supabase/migrations/0004_grocery_completion.sql`:

- **`completion_id`** on both `grocery_items` and `purchase_events`; a **partial
  unique index** `purchase_events_completion_uniq (completion_id) where completion_id
  is not null` makes duplicate history impossible.
- **`complete_grocery_item(p_item_id)`** — SECURITY DEFINER, single transaction:
  locks the item (`for update`), authorizes via `is_family_member(item.family_id)`
  derived from the item (never a caller-supplied family_id), and if `active` stamps a
  fresh `completion_id`, sets status/`completed_at`, and inserts the snapshot — commit
  both or neither. Already-completed → idempotent no-op returning the existing
  `completion_id`. The insert uses `on conflict (completion_id) where completion_id is
  not null do nothing` for race safety.
- **`restore_grocery_item(p_item_id)`** — SECURITY DEFINER, single transaction: sets
  the item active, clears `completed_at`/`completion_id`, and **deletes the
  purchase_event for that completion** (documented decision: an accidental check is a
  reversed operational mistake, not immutable audit history, so it must not
  contaminate purchase data).
- **Client:** `GroceryProvider.completeItem`/`restoreItem` now call
  `completeGroceryItemRpc`/`restoreGroceryItemRpc` (one call each). On failure they
  **rehydrate the item from the cloud** rather than silently leaving a false success.
  The public `useGrocery` API is unchanged.

Verified against the live DB (temp rows, cleaned up): normal completion → 1 event;
duplicate completion → still 1; restore → item active + event reversed; re-complete →
exactly 1 new event; concurrent double-call in one statement → 1 event; non-member
call → rejected ("not authorized for this family"), item unchanged; custom item name
("Grandma's weird sauce") flows through with no catalog.
