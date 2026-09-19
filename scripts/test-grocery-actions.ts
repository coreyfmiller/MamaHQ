// MamaHQ Grocery — Gold Standard Action Resolver tests (Step 5B).
//
// Deterministic. Node 24 native TS. Exits non-zero on failure. Exercises the PURE
// resolveGroceryAction decision matrix (proposal + active list → validated action).
// DB execution is verified separately (the increment RPC was verified live).
//
//   node scripts/test-grocery-actions.ts   (npm run test:grocery-actions)

import { resolveGroceryPhrase } from '../lib/grocery/resolver/resolve.ts'
import { resolveGroceryAction } from '../lib/grocery/actions/resolve-action.ts'
import type { ActiveGroceryItem } from '../lib/grocery/actions/types.ts'
import type { ExtractedAttribute } from '../lib/grocery/resolver/types.ts'

let passed = 0
let failed = 0
const failures: string[] = []
function ok(cond: boolean, msg: string) {
  if (cond) passed++
  else { failed++; failures.push(msg) }
}

// Build an active item quickly.
let seq = 0
function active(partial: Partial<ActiveGroceryItem> & { canonicalItemId: string | null; displayName: string }): ActiveGroceryItem {
  return {
    id: `it-${++seq}`,
    status: 'active',
    quantity: 1,
    attributes: [],
    packageSize: null,
    packageType: null,
    unmatchedModifiers: [],
    ...partial,
  }
}
const attr = (id: string, value: string | boolean): ExtractedAttribute => ({ attribute_id: id, value, matchedText: '' })

function act(phrase: string, activeItems: ActiveGroceryItem[]) {
  return resolveGroceryAction(resolveGroceryPhrase(phrase), activeItems)
}

/* 36 — new item */
ok(act('milk', []).type === 'ADD_NEW', 'empty list + milk → ADD_NEW')

/* 37 — same canonical, increment by default 1 */
{
  const a = act('milk', [active({ canonicalItemId: 'food.dairy_eggs.milk.milk', displayName: 'Milk', quantity: 1 })])
  ok(a.type === 'INCREMENT_EXISTING' && a.incrementBy === 1 && a.resultingQuantity === 2, `milk on Milk×1 → INCREMENT +1 → 2 (got ${a.type}/${a.incrementBy}/${a.resultingQuantity})`)
}

/* 38 — explicit quantity increment */
{
  const a = act('2 milk', [active({ canonicalItemId: 'food.dairy_eggs.milk.milk', displayName: 'Milk', quantity: 1 })])
  ok(a.type === 'INCREMENT_EXISTING' && a.incrementBy === 2 && a.resultingQuantity === 3, `2 milk on Milk×1 → INCREMENT +2 → 3 (got ${a.incrementBy}/${a.resultingQuantity})`)
}

/* 39 — different canonical */
{
  const a = act('chocolate milk', [active({ canonicalItemId: 'food.dairy_eggs.milk.milk', displayName: 'Milk' })])
  ok(a.type === 'ADD_NEW', `chocolate milk vs Milk → ADD_NEW (got ${a.type} / ${a.proposal.canonicalItemId})`)
}

/* 40 — attribute conflict (fat %) */
{
  const existing = active({ canonicalItemId: 'food.dairy_eggs.milk.milk', displayName: '2% Milk', attributes: [attr('milk.fat_percentage', '2%')] })
  const a = act('whole milk', [existing])
  ok(a.type === 'ADD_SEPARATE', `whole milk vs 2% Milk → ADD_SEPARATE (got ${a.type})`)
}

/* 41 — colour conflict */
{
  const existing = active({ canonicalItemId: 'food.produce.vegetable.bell_pepper', displayName: 'Red Bell Peppers', attributes: [attr('bell_pepper.colour', 'red')] })
  const a = act('green peppers', [existing])
  ok(a.type === 'ADD_SEPARATE', `green peppers vs red Bell Pepper → ADD_SEPARATE (got ${a.type})`)
}

/* 42 — diaper size conflict */
{
  const existing = active({ canonicalItemId: 'baby.diapering.disposable_diapers', displayName: 'Size 4 Diapers', attributes: [attr('diapers.diaper_size', '4')] })
  const a = act('size 5 diapers', [existing])
  ok(a.type === 'ADD_SEPARATE', `size 5 vs size 4 diapers → ADD_SEPARATE (got ${a.type})`)
}

/* 43 — package size conflict */
{
  const existing = active({ canonicalItemId: 'food.dairy_eggs.milk.milk', displayName: 'Milk 2L', packageSize: { value: 2, unit: 'L' } })
  const a = act('4L milk', [existing])
  ok(a.type === 'ADD_SEPARATE', `4L milk vs 2L Milk → ADD_SEPARATE (got ${a.type})`)
}

/* 44 — same package size increments */
{
  const existing = active({ canonicalItemId: 'food.dairy_eggs.milk.milk', displayName: 'Milk 4L', quantity: 1, packageSize: { value: 4, unit: 'L' } })
  const a = act('2 4L milks', [existing])
  ok(a.type === 'INCREMENT_EXISTING' && a.incrementBy === 2 && a.resultingQuantity === 3, `2 4L milks on Milk 4L×1 → INCREMENT +2 → 3 (got ${a.type}/${a.incrementBy}/${a.resultingQuantity})`)
}

/* 45 — custom exact duplicate */
{
  const existing = active({ canonicalItemId: null, displayName: 'Purple Dragon Cereal' })
  const a = act('purple dragon cereal', [existing])
  ok(a.type === 'INCREMENT_EXISTING', `custom exact dup → INCREMENT_EXISTING (got ${a.type})`)
}

/* 46 — custom non-duplicate */
{
  const existing = active({ canonicalItemId: null, displayName: 'Purple Dragon Cereal' })
  const a = act("Grandma's weird sauce", [existing])
  ok(a.type === 'ADD_CUSTOM', `unrelated custom → ADD_CUSTOM (got ${a.type})`)
}

/* 47 — unknown modifier (Natrel) must not silently merge */
{
  const existing = active({ canonicalItemId: 'food.dairy_eggs.milk.milk', displayName: 'Milk' })
  const a = act('natrel milk', [existing])
  ok(a.type === 'ADD_SEPARATE', `natrel milk vs Milk → ADD_SEPARATE (preserve modifier) (got ${a.type}); modifiers=${JSON.stringify(a.proposal.unmatchedModifiers)}`)
  ok((a.proposal.unmatchedModifiers ?? []).includes('natrel'), `natrel preserved as unmatched modifier`)
}

/* 48 — completed item is ignored (no resurrection) */
{
  const completed = active({ canonicalItemId: 'food.dairy_eggs.milk.milk', displayName: 'Milk', status: 'completed' })
  const a = act('milk', [completed])
  ok(a.type === 'ADD_NEW', `milk with only a COMPLETED Milk → ADD_NEW (got ${a.type})`)
}

/* 49 — ambiguous resolver result → confirmation */
{
  // "gummies" is a known ambiguous alias (fruit snacks vs gummy candy).
  const a = act('gummies', [])
  ok(a.type === 'REQUIRES_CONFIRMATION' && a.requiresConfirmation, `ambiguous "gummies" → REQUIRES_CONFIRMATION (got ${a.type}); ambiguous=${a.proposal.ambiguous}`)
  ok((a.confirmationChoices?.length ?? 0) >= 1, `confirmation offers choices`)
}

/* 50 — invalid unit → confirmation, no nonsense persisted */
{
  const a = act('4 litres toilet paper', [])
  ok(a.type === 'REQUIRES_CONFIRMATION', `"4 litres toilet paper" → REQUIRES_CONFIRMATION (got ${a.type}); invalid=${a.proposal.invalidStructure}`)
}

/* clientActionId present for idempotency */
ok(typeof act('milk', []).clientActionId === 'string' && act('milk', []).clientActionId.length > 0, 'clientActionId generated')

/* -------------------------------- REPORT ----------------------------------- */
console.log(`\nGrocery Action Resolver Gold Standard: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('\nFailures:')
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log('✓ all action tests passed')
process.exit(0)
