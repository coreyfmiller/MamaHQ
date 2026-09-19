# MamaHQ Grocery — Search & Autocomplete (Step 4)

Deterministic, local, offline, explainable search over the 417-concept Tier-A
catalog, plus autocomplete wired into the Grocery add flow and the deferred
`canonical_item_id` reference. **No** Resolver, AI, household intelligence,
quantity/package parsing, Tell MamaHQ, Meals, realtime, or offline sync.

## Architecture
`lib/grocery/search/` (pure domain logic, zero React/DB/network):
- `normalize.ts` — query/catalog normalization + tokenizer + conservative plural.
- `index.ts` — `buildSearchIndex(catalog)` → in-memory `SearchIndexEntry[]`.
- `rank.ts` — per-entry match classification + scoring + Damerau-Levenshtein.
- `search.ts` — orchestration: normalize → scan → sort → limit → results.
- `types.ts` — `SearchResult` contract + `MatchClass` + `SearchOptions` + explain.
- `labels.ts` — UI labels for shopping categories.

Pipeline: `raw query → normalize → scan index (score each entry) → sort → limit → results`.

## Normalization
NFKD → strip combining diacritics (`jalapeño`→`jalapeno`) → lowercase → drop
apostrophes (`confectioner's`→`confectioners`) → hyphens/underscores/slashes → space
(`all-purpose`, `half-and-half`) → keep letters/numbers/`%`/space, other punctuation →
space → collapse whitespace → trim. Deliberately conservative (keeps `%` and internal
digits). Same normalizer runs on queries and catalog strings.

## Search index
Built once from the active catalog (417 entries). Each entry precomputes normalized
canonical_name, display_name, per-alias normalized text, a distinct token set, token
singular-forms (for plural tolerance), and the shortest target length (a tiebreak).
Lazy singleton `defaultIndex()`. Memory footprint is small (a few normalized strings
+ token arrays per concept). Scales linearly (see Performance).

## Match classes (strongest → weakest)
`exact_canonical` > `exact_display` > `exact_alias` > `prefix_canonical` >
`prefix_display` > `prefix_alias` > `token_prefix` > `substring` > `fuzzy`. Each class
has a wide base-score band so a stronger class ALWAYS beats a weaker one.

## Ranking algorithm
Base score by class (bands 2000 apart). Within a band, bounded tie-breakers only:
`search_priority × 0.5` + tier bonus + class-specific extras (prefix completion
distance, token order/completion, substring position, fuzzy distance). Because bands
never overlap, **`search_priority` can never overpower a stronger textual match**
(spec §28) — e.g. Milk's high priority can't outrank another concept's exact alias.
Final sort: score desc, then `canonicalId` asc for a stable total order. One result
per concept (dedup by keeping the strongest match).

## Alias handling
Aliases are indexed as first-class searchable text and match nearly as strongly as
names (`exact_alias` just below `exact_display`; `prefix_alias` just below
`prefix_display`). The result always shows the canonical `displayName`; `matchedAlias`
is retained in metadata. Verified: hamburger/hamburger meat→Ground Beef, scallion/
spring onion→Green Onion, icing sugar/confectioners sugar→Powdered Sugar,
garbanzo→Chickpeas, pop/soft drink→Soda.

## Plural handling
Conservative `singularize()` (ies→y, es after s/x/z/ch/sh, oes→o, trailing s), guarded
so words ≤3 chars are never stripped and `-ss` is preserved. BOTH the token and its
singular are indexed, so exact forms always win and plurals still match (bananas→
Banana, tomatoes→Tomato, berries→…berry). Not a full stemmer.

## Fuzzy matching
Damerau-Levenshtein (optimal string alignment, transposition-aware) with an early-exit
cap. **Thresholds:** disabled entirely for queries < 5 chars (protects ham/yam/jam);
cap 1 edit for 5–7 chars; cap 2 for 8+ (mozarella→Mozzarella, diappers→Diapers).
Only runs when NO textual class matched, and only against targets of comparable length
(`|len diff| ≤ cap`). Single-token queries also fuzzy-match individual entry tokens
(so `mozarella` reaches the `mozzarella` token of "Mozzarella Cheese"). **Exact/prefix/
substring always outrank fuzzy** — the `fuzzy` band is the lowest.

## Fuzzy safety
Verified negative assertions: `ham`[0]≠Yam, ≠Jam; `pear`[0]≠Peas; short queries never
invoke fuzzy. If an exact match exists it is always #1.

## Parent / child behaviour
Generic parents and specific children are ordinary concepts. For a broad query the
parent tends to lead (`chicken` → Chicken before Chicken Breast, asserted); as the
query gets specific the child dominates naturally via prefix/exact (`chicken br` →
Chicken Breast; `cheddar` → Cheddar Cheese). No per-food hard-coding — pure ranking.

## Tags & taxonomy (§29–30)
**Excluded from matching in v1** (safer choice). Names + aliases only. Typing
"breakfast" or "produce" does not dump tagged/taxonomy items. Tags remain in the data
for future low-weight discoverability.

## Search result contract
`{ canonicalId, canonicalName, displayName, department, category, subcategory,
shoppingCategory, score, matchType, matchedText, matchedAlias, attributes,
defaultUnit, allowedUnits }`. With `{ debug: true }`, an `explain` trace is attached
(normalized query, match class, matched field, matched alias, base score,
tie-breakers, fuzzy distance, final score) — development only, never shown in UI.

## Result limit & empty query
Default limit 8, hard-capped at 25. `search("")` → `[]` (never dumps the catalog).
No-result queries (e.g. "Purple Dragon Cereal") → `[]` (custom item path handles it).

## Performance (measured, `npm run bench:grocery-search`)
| Catalog size | index build | avg query | p95 query |
| --- | --- | --- | --- |
| 417 (real) | 2.4 ms | **0.24 ms** | **0.41 ms** |
| ~2,500 (synthetic) | 7.0 ms | 1.25 ms | 1.94 ms |
| ~5,000 (synthetic) | 12.8 ms | 2.57 ms | 3.89 ms |
| ~10,000 (synthetic) | 26.4 ms | 4.91 ms | 7.62 ms |

Well under the targets (typical <20ms, p95 <50ms) — even at 10k concepts. Linear
scan is comfortably sufficient; no premature index infrastructure needed.

## Gold-standard tests (`npm run test:grocery-search`)
Node 24 native-TS, tiny inline assert harness, exits non-zero on failure.
**Result: 55 passed, 0 failed.** Families: exact, prefix, alias, multi-word prefix,
plural, typo, semantic safety (ham/yam/jam, pear/peas, coriander trio), custom/
no-result, parent/child, limits. Includes rank assertions (`[0] === expected`) and
negative assertions (`[0] !== forbidden`), plus catalog-wide sanity: every canonical
name resolves to its concept at rank 1, and every non-ambiguous alias resolves at
rank 1.

## Coriander semantic test
`cilantro`→Cilantro; `fresh coriander`→Cilantro (exact alias); `coriander seed`→
Coriander Seed (exact alias); bare `coriander` returns both. Negative: `coriander
seed`[0]≠Cilantro, `fresh coriander`[0]≠Coriander Seed. All pass.

## Ambiguous aliases (documented, not errors)
Terms legitimately claimed by >1 concept — search returns both and deterministic
ranking applies; catalog truth is not mutated:
- **`turnip`** — canonical name of Turnip AND a regional (en-CA) alias of Rutabaga.
- **`gummies`** — colloquial for both Fruit Snacks and Gummy Candy.
Future household/context ranking can disambiguate.

## Canonical reference on grocery items (DB decision)
Migration `0006_grocery_canonical_ref.sql` adds `grocery_items.canonical_item_id
text` (nullable, indexed). It references the catalog's **stable text `canonical_id`**
(e.g. `food.dairy_eggs.milk.milk`), not the projection's surrogate uuid, and has **no
hard FK** — the catalog is a re-seedable file-sourced projection, so grocery data must
never break if a concept id is reorganized (soft reference; `display_name` is always
the display source of truth). Nullable + no backfill: existing rows and custom items
stay valid.

## Custom item behaviour
Typing an unmatched name + Enter (or the + button) adds it with `canonical_item_id =
null` and `source_type = 'manual'`. Search is assistance, never a gate.

## Selected canonical behaviour
Selecting a result adds with `display_name = <canonical display>`,
`canonical_item_id = <canonical_id>`, `source_type = 'autocomplete'`. Only the
reference + operational snapshot fields are stored — catalog metadata is not copied.

## Edit-clears-canonical rule
Manually editing an item's display name clears `canonical_item_id` (both locally and
in the DB), because the edit may change semantic identity (Milk → Chocolate milk). A
fresh catalog selection re-sets it. Resolver-based reclassification is a later step.

## Autocomplete UX
Compact dropdown under the input showing `displayName` + shopping-category label (no
scores/match types). Keyboard: ↑/↓ move highlight, Enter selects highlighted result
(else adds typed text as custom), Escape closes. Touch/mouse: tap a result
(`onMouseDown` so it beats input blur). Typing + Enter always adds fast; autocomplete
never forces selection or adds a confirmation step. Empty input shows nothing.

## Risks / technical debt
- Fuzzy is intentionally conservative; some real typos on very short words won't
  match (correct trade-off — safety over recall).
- `turnip`/`gummies` ambiguity resolves by deterministic ranking only until
  household/context ranking exists.
- Soft (unenforced) canonical reference means a reorganized catalog id could leave a
  dangling string on an old grocery row (harmless; display_name governs display).
- Tags/taxonomy excluded from search; revisit if discoverability needs it.

## Decisions required before Resolver
- Quantity/unit/package parsing grammar ("2 lb", "two 4L milks", "3 × 796 mL cans").
- Duplicate resolution policy (increment vs separate) — needs canonical + attributes.
- Whether the Resolver consumes this search or a separate exact-resolve path.
- Attribute extraction from free text (2% milk, size-4 diapers).

## Recommended next step
Grocery Resolver (Step 5): structured natural-language → validated grocery action,
building on this search for concept resolution + the canonical reference just added.
Not started.
