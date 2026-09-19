// MamaHQ — Step 6 Household Grocery Memory tests.
//
// Runs against a LOCAL/CI Supabase stack (never production) with REAL authenticated
// JWTs. Exercises the full learning chain end to end: completion → structured
// PurchaseEvent snapshot → household variant + observation → derived evidence/default;
// restore reversal; idempotency; multiple variants; and the pure enrichment layer's
// explicit-input precedence.
//
// Run: node scripts/test-household.ts   (env: SUPABASE_URL, SUPABASE_ANON_KEY,
//                                        SUPABASE_SERVICE_ROLE_KEY)

import {
  admin, createUser, makeRunner, assert, assertEqual, cleanupUsers,
  type Client, type TestUser,
} from './db/harness.ts'
import { resolveGroceryPhrase } from '../lib/grocery/resolver/resolve.ts'
import {
  enrichProposalWithHouseholdMemory, buildHouseholdMemory, type HouseholdVariant,
} from '../lib/grocery/household/index.ts'

const A = admin()
const { test, finish } = makeRunner('Household Grocery Memory')

async function ensureFamily(u: TestUser): Promise<string> {
  const { data, error } = await u.client.rpc('ensure_family')
  assert(!error, `ensure_family failed: ${error?.message}`)
  return data as string
}

interface InsertItemOpts {
  canonicalItemId?: string | null
  quantity?: number
  attributes?: { attribute_id: string; value: string | boolean }[]
  packageSize?: { value: number; unit: string } | null
  packageType?: string | null
  unmatchedModifiers?: string[]
  unit?: string | null
}

// Insert an ACTIVE grocery item with structured identity, as the authenticated owner.
async function addItem(client: Client, familyId: string, displayName: string, opts: InsertItemOpts = {}): Promise<string> {
  const { data, error } = await client
    .from('grocery_items')
    .insert({
      family_id: familyId,
      display_name: displayName,
      canonical_item_id: opts.canonicalItemId ?? null,
      quantity: opts.quantity ?? 1,
      unit: opts.unit ?? null,
      resolved_attributes: opts.attributes ?? [],
      package_size: opts.packageSize ?? null,
      package_type: opts.packageType ?? null,
      unmatched_modifiers: opts.unmatchedModifiers ?? [],
    })
    .select('id')
    .single()
  assert(!error, `insert grocery_items failed: ${error?.message}`)
  return (data as { id: string }).id
}

async function complete(client: Client, itemId: string): Promise<void> {
  const { error } = await client.rpc('complete_grocery_item', { p_item_id: itemId })
  assert(!error, `complete failed: ${error?.message}`)
}
async function restore(client: Client, itemId: string): Promise<void> {
  const { error } = await client.rpc('restore_grocery_item', { p_item_id: itemId })
  assert(!error, `restore failed: ${error?.message}`)
}

// A fresh completed purchase of a canonical concept with given identity. Returns the
// grocery item id. (Each "purchase" is a distinct grocery row, like real life.)
async function purchase(client: Client, familyId: string, name: string, opts: InsertItemOpts): Promise<string> {
  const id = await addItem(client, familyId, name, opts)
  await complete(client, id)
  return id
}

async function variantsFor(client: Client, familyId: string, canonicalId: string): Promise<HouseholdVariant[]> {
  const { data, error } = await client
    .from('household_items')
    .select('*')
    .eq('family_id', familyId)
    .eq('canonical_item_id', canonicalId)
  assert(!error, `fetch household_items failed: ${error?.message}`)
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>
    return {
      id: row.id as string,
      canonicalItemId: row.canonical_item_id as string | null,
      variantKey: row.variant_key as string,
      displayName: row.display_name as string,
      packageSize: (row.package_size as { value: number; unit: string } | null) ?? null,
      packageType: (row.package_type as string | null) ?? null,
      packageUnit: (row.package_unit as string | null) ?? null,
      resolvedAttributes: (row.resolved_attributes as { attribute_id: string; value: string | boolean }[]) ?? [],
      evidenceState: row.evidence_state as HouseholdVariant['evidenceState'],
      observationCount: row.observation_count as number,
      isUserSet: row.is_user_set as boolean,
      isDefault: row.is_default as boolean,
      lastObservedAt: (row.last_observed_at as string | null) ?? null,
    }
  })
}

async function eventCountForItem(client: Client, itemId: string): Promise<number> {
  const { count, error } = await client
    .from('purchase_events')
    .select('*', { count: 'exact', head: true })
    .eq('item_id', itemId)
  assert(!error, `count purchase_events failed: ${error?.message}`)
  return count ?? 0
}

// A canonical id + attribute id that exist in the catalog. Milk with a milk_fat
// attribute is the spec's running example; we look them up dynamically so the test
// stays valid if catalog ids shift.
async function findMilk(): Promise<{ canonicalId: string; fatAttr: string }> {
  // Resolve "2% milk" through the real resolver to discover the live canonical id
  // and the attribute id used for milk fat.
  const p = resolveGroceryPhrase('2% milk')
  assert(p.canonicalItemId, `expected "2% milk" to resolve to a canonical concept, got custom`)
  const fatAttr = p.extractedAttributes[0]?.attribute_id
  assert(fatAttr, 'expected a milk-fat attribute to be extracted from "2% milk"')
  return { canonicalId: p.canonicalItemId as string, fatAttr }
}

async function main() {
  await cleanupUsers(A)
  const userA = await createUser(A, 'hh-A')
  const famA = await ensureFamily(userA)
  const { canonicalId: MILK, fatAttr: FAT } = await findMilk()

  // Helper to buy "2% 4L milk" (the household's eventual usual).
  const buy2pct4L = () =>
    purchase(userA.client, famA, '2% milk', {
      canonicalItemId: MILK,
      attributes: [{ attribute_id: FAT, value: '2%' }],
      packageSize: { value: 4, unit: 'L' },
    })

  // === PurchaseEvent structured snapshot ==================================
  await test('purchase snapshot captures structured identity immutably', async () => {
    const itemId = await buy2pct4L()
    const { data, error } = await userA.client
      .from('purchase_events')
      .select('canonical_item_id, resolved_attributes, package_size, package_type, unmatched_modifiers, display_name')
      .eq('item_id', itemId)
      .single()
    assert(!error, `read event failed: ${error?.message}`)
    const ev = data as Record<string, unknown>
    assertEqual(ev.canonical_item_id, MILK, 'snapshot canonical_item_id')
    assertEqual((ev.package_size as { value: number; unit: string }).value, 4, 'snapshot package size value')
    assertEqual((ev.package_size as { value: number; unit: string }).unit, 'L', 'snapshot package size unit')
    const attrs = ev.resolved_attributes as { attribute_id: string; value: string }[]
    assert(attrs.some((a) => a.attribute_id === FAT && a.value === '2%'), 'snapshot attributes include 2% milk fat')
  })

  await test('completion idempotency: repeat completion makes no duplicate event/observation', async () => {
    const itemId = await addItem(userA.client, famA, '2% milk', {
      canonicalItemId: MILK, attributes: [{ attribute_id: FAT, value: '2%' }], packageSize: { value: 4, unit: 'L' },
    })
    await complete(userA.client, itemId)
    await complete(userA.client, itemId) // retry
    assertEqual(await eventCountForItem(userA.client, itemId), 1, 'exactly one purchase event after retry')
  })

  // === Conservative learning thresholds ===================================
  await test('learning thresholds: 1→observed, 2→emerging, 3→established', async () => {
    // Use a distinct family so counts are clean.
    const u = await createUser(A, 'hh-thresh')
    const fam = await ensureFamily(u)
    const buy = () => purchase(u.client, fam, '2% milk', {
      canonicalItemId: MILK, attributes: [{ attribute_id: FAT, value: '2%' }], packageSize: { value: 4, unit: 'L' },
    })

    await buy()
    let v = (await variantsFor(u.client, fam, MILK))[0]
    assertEqual(v.observationCount, 1, 'count after 1 purchase')
    assertEqual(v.evidenceState, 'observed', 'state after 1')
    assertEqual(v.isDefault, false, 'not default after 1')

    await buy()
    v = (await variantsFor(u.client, fam, MILK)).find((x) => x.variantKey === v.variantKey)!
    assertEqual(v.observationCount, 2, 'count after 2')
    assertEqual(v.evidenceState, 'emerging', 'state after 2')
    assertEqual(v.isDefault, false, 'not default after 2')

    await buy()
    v = (await variantsFor(u.client, fam, MILK)).find((x) => x.variantKey === v.variantKey)!
    assertEqual(v.observationCount, 3, 'count after 3')
    assertEqual(v.evidenceState, 'established', 'state after 3')
    assertEqual(v.isDefault, true, 'single established variant becomes default')
  })

  // === No fake certainty (inconsistent purchases) =========================
  await test('no fake certainty: 2% ,1% ,2% does not crown a default (both < established or ambiguous)', async () => {
    const u = await createUser(A, 'hh-mixed')
    const fam = await ensureFamily(u)
    const buyFat = (fat: string) => purchase(u.client, fam, `${fat} milk`, {
      canonicalItemId: MILK, attributes: [{ attribute_id: FAT, value: fat }], packageSize: { value: 4, unit: 'L' },
    })
    await buyFat('2%'); await buyFat('1%'); await buyFat('2%')
    const vs = await variantsFor(u.client, fam, MILK)
    // Two variants: 2%(x2) and 1%(x1). Neither reaches established(3) → no default.
    assertEqual(vs.length, 2, 'two distinct fat variants')
    assertEqual(vs.filter((v) => v.isDefault).length, 0, 'no default declared on a 2–1 split')
  })

  await test('no fake certainty: two established variants remain ambiguous (no default)', async () => {
    const u = await createUser(A, 'hh-ambig')
    const fam = await ensureFamily(u)
    const buyFat = (fat: string) => purchase(u.client, fam, `${fat} milk`, {
      canonicalItemId: MILK, attributes: [{ attribute_id: FAT, value: fat }], packageSize: { value: 4, unit: 'L' },
    })
    for (let i = 0; i < 3; i++) await buyFat('2%')
    for (let i = 0; i < 3; i++) await buyFat('1%')
    const vs = await variantsFor(u.client, fam, MILK)
    assert(vs.filter((v) => v.observationCount >= 3).length === 2, 'two established variants')
    assertEqual(vs.filter((v) => v.isDefault).length, 0, 'ambiguity preserved: no default among two established')
  })

  // === Explicit preference (make usual) ===================================
  await test('explicit make-usual wins immediately (no 3 purchases) and sets exactly one default', async () => {
    const u = await createUser(A, 'hh-explicit')
    const fam = await ensureFamily(u)
    const itemId = await purchase(u.client, fam, '1% milk', {
      canonicalItemId: MILK, attributes: [{ attribute_id: FAT, value: '1%' }], packageSize: { value: 2, unit: 'L' },
    })
    assert(itemId, 'purchased once')
    let vs = await variantsFor(u.client, fam, MILK)
    assertEqual(vs[0].isDefault, false, 'not default from a single passive buy')
    const { error } = await u.client.rpc('set_household_usual', { p_household_item_id: vs[0].id })
    assert(!error, `set_household_usual failed: ${error?.message}`)
    vs = await variantsFor(u.client, fam, MILK)
    assertEqual(vs[0].isUserSet, true, 'variant is user_set')
    assertEqual(vs[0].isDefault, true, 'variant is default after explicit make-usual')
    assertEqual(vs[0].evidenceState, 'user_set', 'evidence_state user_set')
  })

  await test('explicit preference can be changed; only one default remains', async () => {
    const u = await createUser(A, 'hh-change')
    const fam = await ensureFamily(u)
    const a = await purchase(u.client, fam, '2% milk', { canonicalItemId: MILK, attributes: [{ attribute_id: FAT, value: '2%' }], packageSize: { value: 4, unit: 'L' } })
    const b = await purchase(u.client, fam, '1% milk', { canonicalItemId: MILK, attributes: [{ attribute_id: FAT, value: '1%' }], packageSize: { value: 2, unit: 'L' } })
    assert(a && b, 'two variants purchased')
    let vs = await variantsFor(u.client, fam, MILK)
    const twoPct = vs.find((v) => v.resolvedAttributes.some((x) => x.value === '2%'))!
    const onePct = vs.find((v) => v.resolvedAttributes.some((x) => x.value === '1%'))!
    await u.client.rpc('set_household_usual', { p_household_item_id: twoPct.id })
    await u.client.rpc('set_household_usual', { p_household_item_id: onePct.id }) // change
    vs = await variantsFor(u.client, fam, MILK)
    assertEqual(vs.filter((v) => v.isDefault).length, 1, 'exactly one default')
    assertEqual(vs.filter((v) => v.isUserSet).length, 1, 'exactly one user_set')
    assertEqual(vs.find((v) => v.isDefault)!.id, onePct.id, 'the newly chosen variant is default')
  })

  // === Restore reverses learning =========================================
  await test('restore removes observation, corrects count, and un-defaults when evidence drops', async () => {
    const u = await createUser(A, 'hh-restore')
    const fam = await ensureFamily(u)
    const buy = () => purchase(u.client, fam, '2% milk', { canonicalItemId: MILK, attributes: [{ attribute_id: FAT, value: '2%' }], packageSize: { value: 4, unit: 'L' } })
    await buy(); await buy(); const third = await buy()
    let v = (await variantsFor(u.client, fam, MILK))[0]
    assertEqual(v.observationCount, 3, 'established at 3')
    assertEqual(v.isDefault, true, 'default at 3')
    await restore(u.client, third)
    v = (await variantsFor(u.client, fam, MILK))[0]
    assertEqual(v.observationCount, 2, 'count dropped to 2 after restore')
    assertEqual(v.evidenceState, 'emerging', 'state back to emerging')
    assertEqual(v.isDefault, false, 'default cleared when evidence drops below established')
  })

  await test('restore then re-complete creates exactly one new observation (fresh chain)', async () => {
    const u = await createUser(A, 'hh-recomplete')
    const fam = await ensureFamily(u)
    const itemId = await purchase(u.client, fam, '2% milk', { canonicalItemId: MILK, attributes: [{ attribute_id: FAT, value: '2%' }], packageSize: { value: 4, unit: 'L' } })
    let v = (await variantsFor(u.client, fam, MILK))[0]
    assertEqual(v.observationCount, 1, 'one observation')
    await restore(u.client, itemId)
    v = (await variantsFor(u.client, fam, MILK))[0]
    assertEqual(v.observationCount, 0, 'zero after restore')
    await complete(u.client, itemId)
    v = (await variantsFor(u.client, fam, MILK))[0]
    assertEqual(v.observationCount, 1, 'exactly one after re-complete')
    assertEqual(await eventCountForItem(u.client, itemId), 1, 'exactly one purchase event')
  })

  // === Multiple variants don't collapse ===================================
  await test('multiple variants: distinct package sizes/attrs stay separate rows', async () => {
    const u = await createUser(A, 'hh-variants')
    const fam = await ensureFamily(u)
    await purchase(u.client, fam, '2% milk', { canonicalItemId: MILK, attributes: [{ attribute_id: FAT, value: '2%' }], packageSize: { value: 4, unit: 'L' } })
    await purchase(u.client, fam, 'lactose-free milk', { canonicalItemId: MILK, attributes: [{ attribute_id: FAT, value: '2%' }], packageSize: { value: 2, unit: 'L' } })
    const vs = await variantsFor(u.client, fam, MILK)
    assert(vs.length >= 2, 'at least two distinct variants (different package size)')
  })

  // === Enrichment: explicit input precedence (pure layer) =================
  // Build memory where the household usual is 2% / 4L, then enrich phrases.
  await test('enrichment: "milk" fills household usual 2% + 4L', async () => {
    const usual: HouseholdVariant = {
      id: 'v1', canonicalItemId: MILK, variantKey: 'k', displayName: 'Milk',
      packageSize: { value: 4, unit: 'L' }, packageType: null, packageUnit: 'L',
      resolvedAttributes: [{ attribute_id: FAT, value: '2%' }],
      evidenceState: 'established', observationCount: 3, isUserSet: false, isDefault: true, lastObservedAt: null,
    }
    const mem = buildHouseholdMemory([usual])
    const p = resolveGroceryPhrase('milk')
    const out = enrichProposalWithHouseholdMemory(p, mem)
    assert(out.enriched, 'should enrich bare milk')
    assertEqual(out.proposal.quantity.size?.value, 4, 'filled package size 4')
    assert(out.proposal.extractedAttributes.some((a) => a.attribute_id === FAT && a.value === '2%'), 'filled 2%')
  })

  await test('enrichment: "1% milk" keeps 1% explicit; household 2% must NOT override', async () => {
    const usual: HouseholdVariant = {
      id: 'v1', canonicalItemId: MILK, variantKey: 'k', displayName: 'Milk',
      packageSize: { value: 4, unit: 'L' }, packageType: null, packageUnit: 'L',
      resolvedAttributes: [{ attribute_id: FAT, value: '2%' }],
      evidenceState: 'established', observationCount: 3, isUserSet: false, isDefault: true, lastObservedAt: null,
    }
    const mem = buildHouseholdMemory([usual])
    const out = enrichProposalWithHouseholdMemory(resolveGroceryPhrase('1% milk'), mem)
    const fat = out.proposal.extractedAttributes.filter((a) => a.attribute_id === FAT)
    assertEqual(fat.length, 1, 'exactly one milk-fat attribute')
    assertEqual(String(fat[0].value), '1%', 'explicit 1% preserved (household 2% did not override)')
    assertEqual(out.provenance.attributes, 'explicit', 'attributes provenance is explicit')
    // Missing size may still be filled from household.
    assertEqual(out.proposal.quantity.size?.value, 4, 'household filled the missing size')
  })

  await test('enrichment: "2L milk" keeps 2L explicit; household 4L must NOT override', async () => {
    const usual: HouseholdVariant = {
      id: 'v1', canonicalItemId: MILK, variantKey: 'k', displayName: 'Milk',
      packageSize: { value: 4, unit: 'L' }, packageType: null, packageUnit: 'L',
      resolvedAttributes: [{ attribute_id: FAT, value: '2%' }],
      evidenceState: 'established', observationCount: 3, isUserSet: false, isDefault: true, lastObservedAt: null,
    }
    const mem = buildHouseholdMemory([usual])
    const out = enrichProposalWithHouseholdMemory(resolveGroceryPhrase('2L milk'), mem)
    assertEqual(out.proposal.quantity.size?.value, 2, 'explicit 2L preserved')
    assertEqual(out.provenance.packageSize, 'explicit', 'packageSize provenance explicit')
  })

  await test('enrichment: "1% 2L milk" keeps BOTH explicit fields untouched', async () => {
    const usual: HouseholdVariant = {
      id: 'v1', canonicalItemId: MILK, variantKey: 'k', displayName: 'Milk',
      packageSize: { value: 4, unit: 'L' }, packageType: null, packageUnit: 'L',
      resolvedAttributes: [{ attribute_id: FAT, value: '2%' }],
      evidenceState: 'established', observationCount: 3, isUserSet: false, isDefault: true, lastObservedAt: null,
    }
    const mem = buildHouseholdMemory([usual])
    const out = enrichProposalWithHouseholdMemory(resolveGroceryPhrase('1% 2L milk'), mem)
    assertEqual(out.proposal.quantity.size?.value, 2, '2L preserved')
    const fat = out.proposal.extractedAttributes.filter((a) => a.attribute_id === FAT)
    assertEqual(String(fat[0].value), '1%', '1% preserved')
    assertEqual(out.enriched, false, 'nothing filled — both fields explicit')
  })

  await test('enrichment: ambiguous household (two established) fills nothing', async () => {
    const mk = (id: string, fat: string): HouseholdVariant => ({
      id, canonicalItemId: MILK, variantKey: id, displayName: 'Milk',
      packageSize: { value: 4, unit: 'L' }, packageType: null, packageUnit: 'L',
      resolvedAttributes: [{ attribute_id: FAT, value: fat }],
      evidenceState: 'established', observationCount: 3, isUserSet: false, isDefault: false, lastObservedAt: null,
    })
    const mem = buildHouseholdMemory([mk('a', '2%'), mk('b', '1%')])
    const out = enrichProposalWithHouseholdMemory(resolveGroceryPhrase('milk'), mem)
    assertEqual(out.enriched, false, 'no fill under ambiguity')
    assertEqual(out.ambiguousHousehold, true, 'ambiguity flagged')
  })

  await cleanupUsers(A)
  finish()
}

main().catch((e) => {
  console.error('Fatal:', e instanceof Error ? e.message : e)
  process.exit(1)
})
