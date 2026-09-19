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
