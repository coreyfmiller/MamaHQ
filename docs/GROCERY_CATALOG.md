# MamaHQ Grocery — Catalog Foundation (Step 3)

Implementation report for the deterministic knowledge layer: canonical concepts,
taxonomy, units, attributes, aliases, a runnable validator, and a Supabase
projection. **Not** built (out of scope): autocomplete, fuzzy search, the Grocery
Resolver, household items/preferences, AI, Meals, realtime, offline.

Architecture added:
```
CANONICAL CONCEPT   ← this step (knowledge layer)
      ↓
GROCERY LIST ITEM   (Step 2)
      ↓
PURCHASE EVENT      (Step 2)
```

## Source of truth = version-controlled TypeScript files

`lib/grocery/catalog/` is the authoritative catalog. Decision rationale:
- The whole app is TypeScript; typed data files give **compile-time** safety on
  every concept and match the existing precedent (`lib/daily-reads.ts`).
- **Git-reviewable, testable, deterministic** — concepts change via PRs, not by
  editing production rows.
- **zod** (already a dependency) defines the schema once; TS types are inferred
  from it (`z.infer`), so the compiler and the runtime validator can't drift.
- **Node 24** runs the validator directly on the `.ts` files (native type
  stripping) — no build step, no new dev-dependency. `npm run catalog:validate`.

Supabase holds a **projection** (`canonical_items`), seeded one-way from the files
by `scripts/seed-catalog.ts`. Production rows are never the source of truth.

Files:
- `types.ts` — enums + zod schema + `CanonicalItem` type + `normalizeTerm` + id regex.
- `taxonomy.ts` — Department → Category → Subcategory (Food is the deep one).
- `shopping-categories.ts` — the flat, aisle-oriented UI grouping.
- `units.ts` — controlled unit ontology (dimension + convertibility).
- `attributes.ts` — universal vs concept-specific attribute registry.
- `items.ts` — the Tier-A seed concepts.
- `index.ts` — aggregator + deterministic lookups (`getCanonical`, `matchTermExact`, …).
- `validate.ts` — the validator (runnable; exits non-zero on hard errors).

## Key modeling decisions

- **Stable ids (§3):** `canonical_id` is lowercase ASCII, dot-hierarchical,
  snake_case components (`food.produce.fruit.banana`), immutable after publication.
  A surrogate uuid PK exists in the DB projection, but `canonical_id` is the real
  external identity (unique). Ids are never deleted — deprecation redirects them.
- **Identity vs display (§4):** `canonical_name` (Banana) is separate from
  `default_display_name` (Bananas). No forced pluralization of identity.
- **Three distinct axes (§5–6):** taxonomy ("what is it?") ≠ `shopping_category`
  ("where in the store?") ≠ `tags` ("why/how a household uses it"). Kept as
  separate fields; never collapsed.
- **Concept level + attributes, not combinatorial concepts (§8–9):** generic
  parents (Cheese, Chicken) with specific children (Cheddar, Chicken Breast).
  Variations are **attributes** (chicken bone/skin, milk fat %, diaper size), so we
  never create "Boneless Skinless Chicken Breast" as a concept. **Universal**
  attributes (brand/organic/package_size/package_count) live once in the registry
  and are NOT attached per concept (the validator rejects that).
- **Units (§10):** count/weight/volume are convertible within their dimension;
  **package units (bag/box/…) are explicitly non-convertible** ("1 bag" has no
  inherent weight). Each concept declares `default_unit` + `allowed_units[]`
  (validator enforces default ∈ allowed).
- **Aliases (§11–12):** first-class, typed (synonym/regional/abbreviation/
  misspelling/colloquial) with optional locale. NA terminology is captured:
  ground beef ← hamburger/hamburger meat; green onion ← scallion/spring onion;
  powdered sugar ← icing sugar (en-CA) / confectioners sugar (en-US); chickpeas ←
  garbanzo beans; soda ← pop (en-CA). Household-specific aliases ("Dad coffee") are
  explicitly NOT here — they belong to the future Household Item layer.
- **Lifecycle + versioning + deprecation (§16–18):** `status`
  (draft/review_required/approved/active/deprecated/rejected) so generated data
  can't silently become truth; `version` + `added_in` for provenance; deprecation
  carries `replaced_by` so ids are redirected, never deleted.

## The two semantic test cases (proof the model is semantic, not string-based)

- **§13 Coriander:** `food.produce.fresh_herbs.cilantro` (the leaf) is its own
  concept and aliases "fresh coriander" / "coriander leaves". `food.herbs_spices_
  seasonings.spice.coriander_seed` is a SEPARATE spice concept. They are NOT
  merged; the validator's `alias_collision` check would flag it if they were.
- **§14 Brands are not concepts:** the validator's brand/SKU contamination check
  (known-brand tokens, ™/® symbols, embedded pack/size specs) rejects things like
  "Natrel 2% Milk 4L", "Heinz Ketchup", "Pampers Diapers". Verified: a scratch
  "Natrel 2% Milk 4L" concept produced `brand_token` + `sku_spec_in_name` errors.

## Validator (`npm run catalog:validate`)

Hard errors (block; exit non-zero): schema violations, bad/duplicate canonical_id,
missing names, invalid taxonomy/shopping_category/unit references, default_unit not
in allowed_units, unknown/universal attribute misuse, broken/self/looping parent
refs, empty aliases, deprecation-contract violations, brand/SKU contamination.
Warnings (advise): no aliases, oversized alias sets, alias collisions, near-/exact
duplicate canonical names.

Current catalog: **47 concepts across all 10 departments, 0 errors, 25 warnings**
(all benign `no_aliases` on staples). Verified the gate works by injecting a
malformed concept → 6 hard errors caught (bad_subcategory, default_unit_not_allowed,
universal_attribute_on_concept, brand_token, sku_spec_in_name, broken_parent).

## Supabase projection (`canonical_items`, migration 0005)

GLOBAL (not family-scoped) — the catalog is shared knowledge with zero household
data. RLS: any authenticated user may **read**; there is **no client write policy**,
so browsers can't mutate it — only the service role (the seed script) writes.
`canonical_id` is unique. Rich data (aliases/tags/attributes) stored as jsonb.
`scripts/seed-catalog.ts` validates first (refuses to seed on any hard error) then
upserts by `canonical_id` (idempotent). Applied + seeded live: 47 rows.

## Toolchain note
Added `"allowImportingTsExtensions": true` to `tsconfig.json` (valid under the
project's `noEmit`) so the catalog's internal `./x.ts` imports satisfy both `tsc`
and Node 24's native-TS ESM resolver. The app is built by Next (its own bundler),
unaffected.

## Next step (not started)
Wave-1 catalog expansion (~2,500 concepts) and/or the Grocery Resolver + household
items that consume this layer — future steps.

---

## Step 3B — Tier-A expansion (417 concepts)

Expanded the catalog from 47 → **417 validated concepts** (0 hard errors). The
brief's target was ~500 as a coverage guide, not a quota — every concept here is a
real North American shopping-list item; quality was prioritized over hitting 500.

### Structure change
`items.ts` is now a thin re-export of a deterministic aggregator, with concepts
split into per-category files under `lib/grocery/catalog/items/` for reviewability:
`produce.ts`, `meat-seafood.ts`, `dairy-eggs.ts`, `bakery-deli.ts`, `frozen.ts`,
`pantry.ts`, `breakfast-snacks.ts`, `condiments-baking-spices.ts`, `beverages.ts`,
`nonfood.ts` (baby/household/personal-care/health/pet/consumables), plus
`_helper.ts` (the shared `item()` factory) and `items/index.ts` (aggregator). All
existing importers (`index.ts`, `validate.ts`, `seed-catalog.ts`) are unchanged —
they still import `{ ITEMS }` from `./items`. Architecture was NOT redesigned.

### Registry growth (content/config, not architecture)
`taxonomy.ts` gained the categories/subcategories the expansion needs (deli,
frozen sub-types, pantry sub-types, snacks/candy, condiments/baking/spices/oils,
beverages, personal_care, health, pet). `attributes.ts` gained a few concept-
specific attributes (potato/onion/grape variety-ish, yogurt/tea/rice/pasta/tortilla
style, ground-meat lean %). No new units were required.

### Actual totals
- **Total: 417 concepts.**
- By department: food 352, household 17, personal_care 16, baby 14,
  health_wellness 8, pet 5, home_kitchen_consumables 5.
- Food by category: produce 92, pantry 37, meat_seafood 32, dairy_eggs 27,
  frozen 25, snacks 21, bakery 18, herbs_spices_seasonings 17, condiments_sauces 14,
  beverages 14, baking 13, deli 10, breakfast 9, coffee_tea 8, candy 6,
  oils_cooking_fats 5, nut_butters_jams_spreads 4.
- By shopping category (drives future list grouping): produce 92, pantry 90,
  meat_seafood 32, snacks 27, dairy_eggs 27, frozen 25, beverages 22, household 22,
  bakery 18, personal_care 16, baby 14, deli 10, breakfast 9, health 8, pet 5.

### Quality guardrails held
- Semantic separation intact: `cilantro` (produce, aliases "fresh coriander") and
  `coriander_seed` (spices) remain distinct — no alias collision between them.
- No brands/SKUs. During validation the brand heuristic false-positived on
  "French Fries" (matched brand "French's"); fixed the detector to whole-word
  matching so ordinary words aren't flagged while real possessive brands still are.
- Variations are attributes, not combinatorial concepts (e.g. Chicken Breast +
  bone/skin; Milk + fat %; Diapers + size). Generic parents (Chicken, Cheese, Rice,
  Pasta, Bread, Soda, Tea, Coffee) have specific children.
- Benign warnings only: mostly `no_aliases` on staples; a few `near_duplicate_name`
  (pear/peas, yam/ham, mint/mints) that are genuinely distinct concepts; one
  `alias_collision` on "gummies" (fruit snacks vs gummy candy) — a real colloquial
  ambiguity, left as advisory.

### Seed sync
`scripts/seed-catalog.ts` now also PRUNES rows whose canonical_id is no longer in
the files, so the Supabase `canonical_items` projection is an exact mirror. Re-seed
result: 6 retired ids pruned (a handful of Step-3 ids were regularized during the
split, e.g. `food.bakery.bread` → `food.bakery.bread.bread`), table holds exactly
417 rows. Safe because the catalog is global read-only data with no user references.
