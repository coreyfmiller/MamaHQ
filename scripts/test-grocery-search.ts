// MamaHQ Grocery — Gold Standard Search tests.
//
// Deterministic. Runs on Node 24 native TS. Tiny inline assert harness (no test
// framework installed on purpose). Exits non-zero on any failure so it can gate CI.
//
//   node scripts/test-grocery-search.ts   (or: npm run test:grocery-search)

import { search } from '../lib/grocery/search/search.ts'
import { ACTIVE_ITEMS } from '../lib/grocery/catalog/index.ts'
import { normalize } from '../lib/grocery/search/normalize.ts'

let passed = 0
let failed = 0
const failures: string[] = []

function top(query: string): string | undefined {
  return search(query, { limit: 8 })[0]?.canonicalId
}
function topName(query: string): string | undefined {
  return search(query, { limit: 8 })[0]?.canonicalName
}
function ids(query: string, limit = 8): string[] {
  return search(query, { limit }).map((r) => r.canonicalId)
}

function ok(cond: boolean, msg: string) {
  if (cond) passed++
  else {
    failed++
    failures.push(msg)
  }
}
// top result's canonicalId equals expected
function assertTop(query: string, expectedId: string) {
  const got = top(query)
  ok(got === expectedId, `search("${query}")[0] should be ${expectedId}, got ${got ?? '(none)'}`)
}
// top result's canonicalId is NOT the forbidden id
function assertNotTop(query: string, forbiddenId: string) {
  const got = top(query)
  ok(got !== forbiddenId, `search("${query}")[0] must NOT be ${forbiddenId}`)
}
// expected id appears anywhere in results
function assertContains(query: string, expectedId: string, limit = 8) {
  const got = ids(query, limit)
  ok(got.includes(expectedId), `search("${query}") should contain ${expectedId}, got [${got.join(', ')}]`)
}
function assertEmpty(query: string) {
  const got = ids(query)
  ok(got.length === 0, `search("${query}") should be empty, got [${got.join(', ')}]`)
}
// a ranks strictly before b
function assertBefore(query: string, aId: string, bId: string) {
  const arr = ids(query, 20)
  const ai = arr.indexOf(aId)
  const bi = arr.indexOf(bId)
  ok(ai !== -1 && (bi === -1 || ai < bi), `search("${query}"): ${aId} should rank before ${bId} (got [${arr.join(', ')}])`)
}

/* --------------------------------- EXACT --------------------------------- */
assertTop('milk', 'food.dairy_eggs.milk.milk')
assertTop('banana', 'food.produce.fruit.banana')
assertTop('ground beef', 'food.meat_seafood.beef.ground_beef')
assertTop('baby wipes', 'baby.diapering.baby_wipes')
assertTop('toilet paper', 'household.paper.toilet_paper')

/* --------------------------------- PREFIX -------------------------------- */
assertTop('mil', 'food.dairy_eggs.milk.milk')
assertTop('ban', 'food.produce.fruit.banana')
assertContains('grou', 'food.meat_seafood.beef.ground_beef')
assertContains('chick', 'food.meat_seafood.poultry.chicken')
assertContains('toil', 'household.paper.toilet_paper')

/* --------------------------------- ALIAS --------------------------------- */
assertTop('hamburger', 'food.meat_seafood.beef.ground_beef')
assertTop('hamburger meat', 'food.meat_seafood.beef.ground_beef')
assertTop('scallion', 'food.produce.vegetable.green_onion')
assertTop('spring onion', 'food.produce.vegetable.green_onion')
assertTop('icing sugar', 'food.baking.sugar.powdered_sugar')
assertTop('confectioners sugar', 'food.baking.sugar.powdered_sugar')
assertTop('garbanzo', 'food.pantry.legumes.chickpeas')
assertTop('pop', 'food.beverages.soft_drink.soda')
assertTop('soft drink', 'food.beverages.soft_drink.soda')

/* ---------------------------- MULTI-WORD PREFIX -------------------------- */
assertTop('ground b', 'food.meat_seafood.beef.ground_beef')
assertTop('chicken br', 'food.meat_seafood.poultry.chicken_breast')
assertTop('baby w', 'baby.diapering.baby_wipes')
assertTop('whole whe', 'food.bakery.bread.whole_wheat_bread')
assertTop('dish det', 'household.dishwashing.dishwasher_detergent')

/* --------------------------------- PLURAL -------------------------------- */
assertTop('bananas', 'food.produce.fruit.banana')
assertTop('eggs', 'food.dairy_eggs.eggs.eggs')
assertTop('scallions', 'food.produce.vegetable.green_onion')
assertTop('tomatoes', 'food.produce.vegetable.tomato')
assertContains('berries', 'food.produce.prepared_produce.mixed_berries')

/* ---------------------------------- TYPO --------------------------------- */
assertTop('bananna', 'food.produce.fruit.banana')
assertTop('strawbery', 'food.produce.fruit.strawberry')
assertTop('brocoli', 'food.produce.vegetable.broccoli')
assertTop('mozarella', 'food.dairy_eggs.cheese.mozzarella_cheese')
assertTop('diappers', 'baby.diapering.disposable_diapers')

/* ----------------------------- SEMANTIC SAFETY --------------------------- */
// ham / yam / jam — exact must win, fuzzy must not cross
assertNotTop('ham', 'food.produce.vegetable.yam')
assertNotTop('ham', 'food.nut_butters_jams_spreads.jam.jam')
// pear must not resolve to peas
assertTop('pear', 'food.produce.fruit.pear')
assertNotTop('pear', 'food.produce.vegetable.peas')
// coriander trio
assertTop('cilantro', 'food.produce.fresh_herbs.cilantro')
assertTop('fresh coriander', 'food.produce.fresh_herbs.cilantro')
assertTop('coriander seed', 'food.herbs_spices_seasonings.spice.coriander_seed')
assertNotTop('coriander seed', 'food.produce.fresh_herbs.cilantro')
assertNotTop('fresh coriander', 'food.herbs_spices_seasonings.spice.coriander_seed')
// bare "coriander" may return both; just assert both are present
assertContains('coriander', 'food.produce.fresh_herbs.cilantro')
assertContains('coriander', 'food.herbs_spices_seasonings.spice.coriander_seed')

/* ------------------------------ CUSTOM / NONE ---------------------------- */
assertEmpty('Purple Dragon Cereal')
assertEmpty("Grandma's weird sauce")
assertEmpty('zzzzzzzzz')

/* ---------------------------- PARENT / CHILD ----------------------------- */
assertTop('cheddar', 'food.dairy_eggs.cheese.cheddar_cheese')
assertBefore('chicken', 'food.meat_seafood.poultry.chicken', 'food.meat_seafood.poultry.chicken_breast')

/* ------------------------- CATALOG-WIDE SANITY --------------------------- */
// Every active concept's own canonical_name should find it at rank 1 (unless a
// documented legitimate ambiguity). We track and report exceptions rather than
// silently passing.
const canonicalExceptions: string[] = []
for (const it of ACTIVE_ITEMS) {
  const r = top(it.canonical_name)
  if (r !== it.canonical_id) canonicalExceptions.push(`${it.canonical_id} (name "${it.canonical_name}" → ${r ?? 'none'})`)
}
ok(canonicalExceptions.length === 0, `canonical-name sanity: ${canonicalExceptions.length} exception(s): ${canonicalExceptions.slice(0, 12).join('; ')}`)

// Every alias should resolve to its own concept AT rank 1, EXCEPT documented
// ambiguous aliases shared by >1 concept (e.g. "gummies"). For those, the concept
// must at least appear in the results.
// A term is AMBIGUOUS if more than one concept lays claim to it via ANY searchable
// field (canonical name, display name, or alias). Such a term legitimately can't be
// required to resolve #1 to a specific concept.
const termOwners = new Map<string, Set<string>>()
const claim = (term: string, id: string) => {
  const n = normalize(term)
  if (!n) return
  if (!termOwners.has(n)) termOwners.set(n, new Set())
  termOwners.get(n)!.add(id)
}
for (const it of ACTIVE_ITEMS) {
  claim(it.canonical_name, it.canonical_id)
  claim(it.default_display_name, it.canonical_id)
  for (const a of it.aliases) claim(a.alias, it.canonical_id)
}
const ambiguousAliases = [...termOwners.entries()].filter(([, owners]) => owners.size > 1).map(([a]) => a)
const aliasExceptions: string[] = []
for (const it of ACTIVE_ITEMS) {
  for (const a of it.aliases) {
    const n = normalize(a.alias)
    if (ambiguousAliases.includes(n)) {
      if (!ids(a.alias, 12).includes(it.canonical_id)) aliasExceptions.push(`ambiguous "${a.alias}" missing ${it.canonical_id}`)
    } else {
      const r = top(a.alias)
      if (r !== it.canonical_id) aliasExceptions.push(`"${a.alias}" → ${r ?? 'none'} (want ${it.canonical_id})`)
    }
  }
}
ok(aliasExceptions.length === 0, `alias sanity: ${aliasExceptions.length} exception(s): ${aliasExceptions.slice(0, 15).join('; ')}`)

/* --------------------------------- LIMITS -------------------------------- */
ok(search('e', { limit: 3 }).length <= 3, 'limit is respected')
ok(search('milk', { limit: 999 }).length <= 25, 'limit is hard-capped at 25')
ok(search('').length === 0, 'empty query returns []')

/* -------------------------------- REPORT --------------------------------- */
console.log(`\nAmbiguous aliases: ${ambiguousAliases.length ? ambiguousAliases.join(', ') : '(none)'}`)
console.log(`\nGrocery Search Gold Standard: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('\nFailures:')
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log('✓ all search tests passed')
process.exit(0)
