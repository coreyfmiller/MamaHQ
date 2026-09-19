// MamaHQ Grocery — Gold Standard Resolver tests (Step 5A).
//
// Deterministic. Node 24 native TS. Tiny inline assert harness; exits non-zero on
// failure. Asserts the STRUCTURE of proposals (quantity, unit, packaged, canonical
// concept, extracted attributes, confidence, custom path). The resolver proposes —
// it does not execute.
//
//   node scripts/test-grocery-resolver.ts   (npm run test:grocery-resolver)

import { resolveGroceryPhrase } from '../lib/grocery/resolver/resolve.ts'
import type { ProposedGroceryItem } from '../lib/grocery/resolver/types.ts'

let passed = 0
let failed = 0
const failures: string[] = []

function ok(cond: boolean, msg: string) {
  if (cond) passed++
  else {
    failed++
    failures.push(msg)
  }
}
function attr(p: ProposedGroceryItem, id: string): string | boolean | undefined {
  return p.extractedAttributes.find((a) => a.attribute_id === id)?.value
}

/* --------------------------------- bare item -------------------------------- */
{
  const p = resolveGroceryPhrase('milk')
  ok(p.canonicalItemId === 'food.dairy_eggs.milk.milk', `"milk" → milk concept (got ${p.canonicalItemId})`)
  ok(p.quantity.value === 1, `"milk" qty 1 (got ${p.quantity.value})`)
  ok(p.unmatched === false && p.confidence === 'high', `"milk" high confidence matched`)
}

/* -------------------------------- count + item ------------------------------ */
{
  const p = resolveGroceryPhrase('2 milk')
  ok(p.quantity.value === 2 && !p.quantity.unit, `"2 milk" qty 2 no unit (got ${p.quantity.value}/${p.quantity.unit})`)
  ok(p.canonicalItemId === 'food.dairy_eggs.milk.milk', `"2 milk" → milk`)
}
{
  const p = resolveGroceryPhrase('2 milks')
  ok(p.quantity.value === 2, `"2 milks" qty 2`)
  ok(p.canonicalItemId === 'food.dairy_eggs.milk.milk', `"2 milks" → milk (got ${p.canonicalItemId})`)
}
{
  const p = resolveGroceryPhrase('two milks')
  ok(p.quantity.value === 2, `"two milks" qty 2 (got ${p.quantity.value})`)
  ok(p.canonicalItemId === 'food.dairy_eggs.milk.milk', `"two milks" → milk`)
}

/* ------------------------------ count + size + item ------------------------- */
{
  const p = resolveGroceryPhrase('two 4L milks')
  ok(p.quantity.value === 2, `"two 4L milks" count 2 (got ${p.quantity.value})`)
  ok(p.quantity.size?.value === 4 && p.quantity.size?.unit === 'L', `"two 4L milks" size 4L (got ${JSON.stringify(p.quantity.size)})`)
  ok(p.canonicalItemId === 'food.dairy_eggs.milk.milk', `"two 4L milks" → milk (got ${p.canonicalItemId})`)
}

/* --------------------------- count + package + item ------------------------- */
{
  const p = resolveGroceryPhrase('3 cans tomato soup')
  ok(p.quantity.value === 3, `"3 cans tomato soup" qty 3`)
  ok(p.quantity.unit === 'can' && p.quantity.packaged === true, `"3 cans…" unit can packaged (got ${p.quantity.unit}/${p.quantity.packaged})`)
  ok(p.canonicalItemId === 'food.pantry.soup.canned_soup', `"3 cans tomato soup" → canned soup (got ${p.canonicalItemId})`)
}
{
  const p = resolveGroceryPhrase('2 bags frozen blueberries')
  ok(p.quantity.value === 2 && p.quantity.unit === 'bag' && p.quantity.packaged === true, `"2 bags…" qty 2 bag packaged (got ${p.quantity.value}/${p.quantity.unit})`)
  ok(p.canonicalItemId === 'food.frozen.frozen_fruit.frozen_berries', `"2 bags frozen blueberries" → frozen berries (got ${p.canonicalItemId})`)
}

/* --------------------------------- weight ---------------------------------- */
{
  const p = resolveGroceryPhrase('1.5 kg ground beef')
  ok(p.quantity.value === 1.5 && p.quantity.unit === 'kg' && p.quantity.unitKind === 'weight', `"1.5 kg…" 1.5 kg weight (got ${p.quantity.value}/${p.quantity.unit})`)
  ok(p.canonicalItemId === 'food.meat_seafood.beef.ground_beef', `"1.5 kg ground beef" → ground beef`)
}
{
  const p = resolveGroceryPhrase('lean ground beef')
  ok(p.canonicalItemId === 'food.meat_seafood.beef.ground_beef', `"lean ground beef" → ground beef`)
  ok(attr(p, 'ground_meat.lean') === 'lean', `"lean ground beef" lean attr (got ${String(attr(p, 'ground_meat.lean'))})`)
}

/* --------------------------------- dozen ----------------------------------- */
{
  const p = resolveGroceryPhrase('2 dozen eggs')
  // Decision: preserve "dozen" as the stated unit; do NOT auto-expand to 24.
  ok(p.quantity.value === 2 && p.quantity.unit === 'dozen', `"2 dozen eggs" qty 2 unit dozen (got ${p.quantity.value}/${p.quantity.unit})`)
  ok(p.canonicalItemId === 'food.dairy_eggs.eggs.eggs', `"2 dozen eggs" → eggs (got ${p.canonicalItemId})`)
}

/* ------------------------------- attributes -------------------------------- */
{
  const p = resolveGroceryPhrase('size 4 diapers')
  ok(p.canonicalItemId === 'baby.diapering.disposable_diapers', `"size 4 diapers" → diapers (got ${p.canonicalItemId})`)
  ok(attr(p, 'diapers.diaper_size') === '4', `"size 4 diapers" size 4 (got ${String(attr(p, 'diapers.diaper_size'))})`)
}
{
  const p = resolveGroceryPhrase('boneless chicken breasts')
  ok(p.canonicalItemId === 'food.meat_seafood.poultry.chicken_breast', `"boneless chicken breasts" → chicken breast (got ${p.canonicalItemId})`)
  ok(attr(p, 'chicken.cut_bone') === 'boneless', `"boneless…" bone=boneless (got ${String(attr(p, 'chicken.cut_bone'))})`)
}
{
  const p = resolveGroceryPhrase('red peppers')
  ok(p.canonicalItemId === 'food.produce.vegetable.bell_pepper', `"red peppers" → bell pepper (got ${p.canonicalItemId})`)
  ok(attr(p, 'bell_pepper.colour') === 'red', `"red peppers" colour=red (got ${String(attr(p, 'bell_pepper.colour'))})`)
}
{
  const p = resolveGroceryPhrase('2% milk')
  ok(p.canonicalItemId === 'food.dairy_eggs.milk.milk', `"2% milk" → milk`)
  ok(attr(p, 'milk.fat_percentage') === '2%', `"2% milk" fat 2% (got ${String(attr(p, 'milk.fat_percentage'))})`)
}

/* ----------------------------- custom / no match --------------------------- */
{
  const p = resolveGroceryPhrase('Purple Dragon Cereal')
  ok(p.unmatched === true && p.canonicalItemId === null, `"Purple Dragon Cereal" custom (unmatched, null id)`)
  ok(p.displayName.toLowerCase().includes('purple dragon cereal'), `"Purple Dragon Cereal" keeps display name (got "${p.displayName}")`)
  ok(p.needsReview === false, `custom item is a normal outcome (needsReview false)`)
}
{
  const p = resolveGroceryPhrase("2 Grandma's weird sauce")
  ok(p.unmatched === true && p.quantity.value === 2, `"2 Grandma's weird sauce" custom, qty 2 (got ${p.quantity.value})`)
}

/* ------------------------------ does NOT execute --------------------------- */
{
  // Sanity: the resolver returns a proposal object; it never mutates anything. We
  // just assert the shape has the proposal fields.
  const p = resolveGroceryPhrase('milk')
  ok('candidates' in p && 'confidence' in p && 'unmatched' in p, `proposal shape intact`)
}

/* -------------------------------- attribute scoping ------------------------- */
{
  // "red" must NOT attach a colour attribute to a concept that has none.
  const p = resolveGroceryPhrase('red onion')
  ok(p.canonicalItemId === 'food.produce.vegetable.red_onion' || p.canonicalItemId === 'food.produce.vegetable.yellow_onion', `"red onion" resolves to an onion (got ${p.canonicalItemId})`)
  // onion has onion.colour attribute so colour=red is legitimate; assert it's onion.colour not bell_pepper.colour
  ok(attr(p, 'bell_pepper.colour') === undefined, `"red onion" must not carry bell_pepper.colour`)
}

/* ------------- position-independent measure size (Step 6 follow-up) --------- */
// A fused/standalone MEASURE size must survive regardless of whether it appears
// before or after a recognized attribute/modifier. Both orderings must yield the
// SAME explicit attribute AND the SAME explicit size. General correction — proven
// across several catalog concepts, not milk-specific.

// Helper: read the resolved measure size as a normalized "<value><unit>" string,
// tolerating both representations (leading-count → quantity.size; bare measure →
// quantity.value+unit).
function measure(p: ProposedGroceryItem): string | null {
  if (p.quantity.size) return `${p.quantity.size.value}${p.quantity.size.unit}`
  if (p.quantity.unit && (p.quantity.unitKind === 'weight' || p.quantity.unitKind === 'volume')) {
    return `${p.quantity.value}${p.quantity.unit}`
  }
  return null
}

// Milk (volume + fat %): the exact asymmetry that Step 6 surfaced.
{
  const before = resolveGroceryPhrase('2L 1% milk') // size before attr
  const after = resolveGroceryPhrase('1% 2L milk') // size after attr
  ok(measure(before) === '2L', `"2L 1% milk" keeps 2L (got ${measure(before)})`)
  ok(measure(after) === '2L', `"1% 2L milk" keeps 2L (got ${measure(after)}) — the fixed case`)
  ok(attr(before, 'milk.fat_percentage') === '1%', `"2L 1% milk" keeps 1%`)
  ok(attr(after, 'milk.fat_percentage') === '1%', `"1% 2L milk" keeps 1%`)
  ok(before.canonicalItemId === after.canonicalItemId && after.canonicalItemId === 'food.dairy_eggs.milk.milk', `both orderings → milk`)
}
{
  const before = resolveGroceryPhrase('4L 2% milk')
  const after = resolveGroceryPhrase('2% 4L milk')
  ok(measure(before) === '4L' && measure(after) === '4L', `4L survives both orderings (got ${measure(before)}/${measure(after)})`)
  ok(attr(before, 'milk.fat_percentage') === '2%' && attr(after, 'milk.fat_percentage') === '2%', `2% survives both orderings`)
}
// Ground beef (weight + lean): "500g lean ground beef" vs "lean 500g ground beef".
{
  const before = resolveGroceryPhrase('500g lean ground beef')
  const after = resolveGroceryPhrase('lean 500g ground beef')
  ok(measure(before) === '500g', `"500g lean ground beef" keeps 500g (got ${measure(before)})`)
  ok(measure(after) === '500g', `"lean 500g ground beef" keeps 500g (got ${measure(after)})`)
  ok(attr(before, 'ground_meat.lean') === 'lean' && attr(after, 'ground_meat.lean') === 'lean', `lean survives both orderings`)
  ok(before.canonicalItemId === 'food.meat_seafood.beef.ground_beef' && after.canonicalItemId === 'food.meat_seafood.beef.ground_beef', `both → ground beef`)
}
// Chicken breast (weight + boneless): trailing size after a modifier.
{
  const before = resolveGroceryPhrase('500g boneless chicken breast')
  const after = resolveGroceryPhrase('boneless 500g chicken breast')
  ok(measure(before) === '500g' && measure(after) === '500g', `chicken 500g survives both orderings (got ${measure(before)}/${measure(after)})`)
  ok(attr(before, 'chicken.cut_bone') === 'boneless' && attr(after, 'chicken.cut_bone') === 'boneless', `boneless survives both orderings`)
}
// Trailing size with NO attribute: "milk 2L".
{
  const p = resolveGroceryPhrase('milk 2L')
  ok(measure(p) === '2L', `"milk 2L" keeps 2L (got ${measure(p)})`)
  ok(p.canonicalItemId === 'food.dairy_eggs.milk.milk', `"milk 2L" → milk`)
}
// Leading count + attribute + trailing size → count preserved, size is per-item.
{
  const p = resolveGroceryPhrase('3 1% 2L milk')
  ok(p.quantity.value === 3, `"3 1% 2L milk" count 3 (got ${p.quantity.value})`)
  ok(p.quantity.size?.value === 2 && p.quantity.size?.unit === 'L', `"3 1% 2L milk" per-item size 2L (got ${JSON.stringify(p.quantity.size)})`)
  ok(attr(p, 'milk.fat_percentage') === '1%', `"3 1% 2L milk" keeps 1%`)
}
// GUARD: the correction must NOT strip a non-measure numeric attribute. "size 4
// diapers" — the "4" is an attribute value, not a measure size; diapers stays a
// diaper with size 4 and no bogus measure.
{
  const p = resolveGroceryPhrase('size 4 diapers')
  ok(measure(p) === null, `"size 4 diapers" has NO measure size (4 is an attribute, got ${measure(p)})`)
  ok(attr(p, 'diapers.diaper_size') === '4', `"size 4 diapers" keeps size 4 attribute`)
  ok(p.canonicalItemId === 'baby.diapering.disposable_diapers', `"size 4 diapers" → diapers`)
}
// GUARD: package words and counts are not treated as measure sizes.
{
  const p = resolveGroceryPhrase('3 cans tomato soup')
  ok(measure(p) === null, `"3 cans tomato soup" has no measure size (can is a package)`)
  ok(p.quantity.unit === 'can' && p.quantity.value === 3, `"3 cans…" still 3 cans`)
}
{
  const p = resolveGroceryPhrase('2 dozen eggs')
  ok(measure(p) === null, `"2 dozen eggs" has no measure size (dozen is a count)`)
  ok(p.quantity.unit === 'dozen' && p.quantity.value === 2, `"2 dozen eggs" still 2 dozen`)
}
// GUARD: a leading brand/modifier + attribute still resolves without losing the mod.
{
  const p = resolveGroceryPhrase('natrel 2% milk')
  ok(p.canonicalItemId === 'food.dairy_eggs.milk.milk', `"natrel 2% milk" → milk`)
  ok(p.unmatchedModifiers.includes('natrel'), `"natrel 2% milk" keeps natrel as a modifier`)
}

/* -------------------------------- REPORT ----------------------------------- */
console.log(`\nGrocery Resolver Gold Standard: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('\nFailures:')
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log('✓ all resolver tests passed')
process.exit(0)
