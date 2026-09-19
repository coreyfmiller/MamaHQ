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

/* -------------------------------- REPORT ----------------------------------- */
console.log(`\nGrocery Resolver Gold Standard: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('\nFailures:')
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log('✓ all resolver tests passed')
process.exit(0)
