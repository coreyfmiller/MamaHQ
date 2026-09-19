# MamaHQ Grocery — Resolver Core (Step 5A)

The resolver UNDERSTANDS a grocery phrase and returns a structured **proposal**. It
**never executes** anything — no DB, no household resolution, no duplicate handling,
no AI. Search is the ONLY concept-candidate engine (no second matcher). Out of scope
(not built): duplicate resolution, Household Items/preferences, Usually/Recently
Bought, Tell MamaHQ, AI, Meals, realtime, offline queues, shopping mode, barcode.

## Pipeline
```
raw phrase → normalize → peel quantity/unit(/size) → residue tokens
→ scan generic attribute modifiers → SEARCH (residue AND attribute-stripped residue,
  take the stronger) → resolve concept → keep only attributes the concept declares
→ confidence / ambiguity → ProposedGroceryItem
```

Layer files in `lib/grocery/resolver/`: `types.ts`, `normalize.ts`, `numbers.ts`,
`units.ts`, `quantity.ts`, `attributes.ts`, `confidence.ts`, `resolve.ts`. (Package
handling lives in `units.ts`/`quantity.ts` rather than a separate `packages.ts` —
`recognizeUnit()` already classifies package vs measure units, so a separate file
would only re-wrap it.)

## Normalization
The resolver uses its own light normalizer that **preserves decimals and `%`** — the
search normalizer intentionally strips `.` (splitting "1.5" into "1 5"), which is
wrong for quantity parsing. It folds diacritics, lowercases, drops apostrophes,
turns hyphens/slashes to spaces, keeps letters/digits/`.`/`%`, and only keeps a `.`
between digits. The concept-candidate RESIDUE is handed to Search, which
re-normalizes consistently on its side.

## Numbers
Digits ("2", "1.5"), simple number words ("one".."twelve", "a"/"an"→1, "couple"→2),
"half dozen"→6, and a compact "3x"/"3 x" multiplier. Bounded and deterministic — no
spelled big numbers.

## Quantity / unit / package
Peels a leading count, then an optional unit/package or fused size:
- **"2 milk" / "2 milks"** → value 2, no unit (plain count of the item).
- **"3 cans tomato soup"** → value 3, unit `can`, `packaged: true`.
- **"1.5 kg ground beef"** → value 1.5, unit `kg` (`unitKind: weight`).
- **"2 dozen eggs"** → value 2, unit `dozen`. **Decision:** `dozen` is preserved as
  the stated unit; it is NOT auto-expanded to 24. Expansion (if ever wanted) is a
  display/execution concern, not resolution.
- **"two 4L milks"** → value 2 (count) + `size { value: 4, unit: 'L' }` per item.
Unit aliases/plurals map to the catalog ontology (litre/liter→L, lb/lbs/pound(s)→lb,
gram(s)→g, kilo(s)→kg, tin(s)→can, …). Package units are flagged `packaged` and are
never math-converted (a "bag" has no inherent weight).

## Attribute extraction
Concept-specific attribute values are detected by deterministic lexicon detectors and
attached **only if the resolved concept declares that attribute** in the catalog
registry. Supported now: milk `fat_percentage` (skim/1%/2%/whole) + `lactose_free`;
`diapers.diaper_size` (size 4 / sz4 / newborn) + `style` (pull-up); `chicken.cut_bone`
(boneless/bone-in) + `skin` (skinless/skin-on); `bell_pepper.colour` / `onion.colour`
/ `grape.colour`; `ground_meat.lean` (lean / extra lean / regular / NN%); `coffee`
roast+format; `bread.style`; `eggs.size`; `tea.type`; `rice.type`.

**Strip-safety:** only PURE modifiers (colour, lean, fat%, diaper size, boneless/
skinless) are removed to form the attribute-stripped search candidate. Words that are
frequently CONCEPT heads too — "ground" (ground beef vs ground coffee), "white"/
"green"/"medium" — are detected for attribute attachment but NOT stripped, so they
never corrupt concept resolution. This is why "lean ground beef" strips "lean" →
searches "ground beef" (correct), while "ground" stays.

## Concept resolution (dual search)
The resolver searches BOTH the full residue and the attribute-stripped residue and
keeps the stronger match (by match class, then score). Full-text wins when the
modifier is part of a concept name ("whole wheat bread"); stripped wins when the
modifier is just an attribute ("red peppers" → "peppers" → Bell Pepper, colour=red).
Search remains the single matcher.

## Confidence / ambiguity
- Confidence: exact/prefix (any field) → **high**; token-prefix/substring/fuzzy →
  **medium**; nothing → **low** (custom).
- Ambiguous when the winning match is a known-ambiguous alias (`turnip`, `gummies`)
  or the runner-up is a near-tie in the same match class. Ambiguity caps confidence
  at medium and sets `needsReview`.

## Proposal contract (`ProposedGroceryItem`)
`{ rawPhrase, displayName, canonicalItemId|null, canonicalName?, shoppingCategory?,
quantity{ value, unit?, unitKind?, packaged?, size? }, extractedAttributes[
{ attribute_id, value, matchedText } ], candidates: SearchResult[], confidence,
ambiguous, needsReview, unmatched }` + optional `explain` (dev only). The resolver
returns this object and mutates nothing.

## Custom / unmatched
No catalog match → `unmatched: true`, `canonicalItemId: null`, `displayName` = cleaned
phrase (quantity still parsed). A custom item is a NORMAL outcome, not a problem
(`needsReview: false`). Search assists; it never gates.

## Tests (`npm run test:grocery-resolver`)
Node 24 native TS, tiny assert harness, exits non-zero on failure. **38 passed, 0
failed.** Covers every brief example (milk; 2 milk / 2 milks / two milks; two 4L
milks; 3 cans tomato soup; 2 bags frozen blueberries; 1.5 kg ground beef; lean ground
beef; 2 dozen eggs; size 4 diapers; boneless chicken breasts; red peppers; 2% milk)
plus custom/unmatched (Purple Dragon Cereal; "2 Grandma's weird sauce") and
attribute-scoping (red onion doesn't get bell_pepper.colour).

## Catalog additions
To support the brief examples, added legitimate concept aliases (not brands): Canned
Soup ← "tomato soup"/"chicken noodle soup"; Frozen Berries ← "frozen blueberries"/
"frozen strawberries"/"frozen mixed berries". Catalog still validates (417 concepts,
0 errors) and the projection was re-seeded (417 rows).

## Risks / debt
- Attribute lexicon is hand-curated per concept; broad natural language beyond these
  will fall through to plain concept resolution (acceptable for Step 5A).
- "2 dozen" not expanded — intentional; revisit at execution.
- Dual-search doubles search calls in the worst case (still sub-ms; negligible).

## Not built (later steps)
Household resolution, duplicate resolution ("milk already on list — add another?"),
validated action + domain execution, Tell MamaHQ, AI parsing, Meals, realtime,
offline. The proposal is the clean seam those steps will consume.

## Recommended next step
Step 5B — proposal → validated action + duplicate/household resolution + execution
(wiring the proposal into the Grocery add flow and the atomic complete/add domain).
Not started.
