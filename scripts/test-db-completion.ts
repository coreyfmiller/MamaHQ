// MamaHQ — Step 5C completion / restore / increment reliability tests.
//
// Runs against a LOCAL/CI Supabase stack (never production). Exercises the
// grocery RPCs through REAL authenticated JWTs so RLS + SECURITY DEFINER auth
// checks genuinely execute. Covers Step 5C §19, §20, §52:
//   normal completion, duplicate completion, restore, re-complete,
//   unauthorized completion/restore, increment idempotency, unauthorized increment.
//
// Run: node scripts/test-db-completion.ts   (env: SUPABASE_URL, SUPABASE_ANON_KEY,
//                                            SUPABASE_SERVICE_ROLE_KEY)

import {
  admin, createUser, makeRunner, assert, assertEqual, errorContains, cleanupUsers,
  type Client, type TestUser,
} from './db/harness.ts'

const A = admin()
const { test, finish } = makeRunner('DB Completion/Restore/Increment')

// Bootstrap a user's family (ensure_family) and return the family id.
async function ensureFamily(u: TestUser): Promise<string> {
  const { data, error } = await u.client.rpc('ensure_family')
  assert(!error, `ensure_family failed for ${u.email}: ${error?.message}`)
  assert(typeof data === 'string' && data.length > 0, 'ensure_family returned no family id')
  return data as string
}

// Insert an active grocery item directly as the authenticated owner (RLS allows
// a family member to insert their own family's rows). Returns the new item id.
async function addItem(client: Client, familyId: string, displayName: string, quantity = 1): Promise<string> {
  const { data, error } = await client
    .from('grocery_items')
    .insert({ family_id: familyId, display_name: displayName, quantity })
    .select('id')
    .single()
  assert(!error, `insert grocery_items failed: ${error?.message}`)
  return (data as { id: string }).id
}

async function countEvents(client: Client, itemId: string): Promise<number> {
  const { count, error } = await client
    .from('purchase_events')
    .select('*', { count: 'exact', head: true })
    .eq('item_id', itemId)
  assert(!error, `count purchase_events failed: ${error?.message}`)
  return count ?? 0
}

async function itemStatus(client: Client, itemId: string): Promise<{ status: string; completion_id: string | null; quantity: number }> {
  const { data, error } = await client
    .from('grocery_items')
    .select('status, completion_id, quantity')
    .eq('id', itemId)
    .single()
  assert(!error, `read grocery_items failed: ${error?.message}`)
  const row = data as { status: string; completion_id: string | null; quantity: number }
  return row
}

async function main() {
  await cleanupUsers(A)

  const userA = await createUser(A, 'complete-A')
  const userB = await createUser(A, 'complete-B')
  const famA = await ensureFamily(userA)
  await ensureFamily(userB)

  // --- Normal completion: active -> completed + exactly one PurchaseEvent ------
  await test('normal completion: item becomes completed with exactly one purchase event', async () => {
    const itemId = await addItem(userA.client, famA, 'Milk')
    const { data: cid, error } = await userA.client.rpc('complete_grocery_item', { p_item_id: itemId })
    assert(!error, `complete failed: ${error?.message}`)
    assert(typeof cid === 'string' && cid, 'expected a completion_id')
    const st = await itemStatus(userA.client, itemId)
    assertEqual(st.status, 'completed', 'status after completion')
    assertEqual(st.completion_id, cid as string, 'completion_id persisted on item')
    assertEqual(await countEvents(userA.client, itemId), 1, 'exactly one purchase event')
  })

  // --- Duplicate completion: second call -> no duplicate PurchaseEvent ---------
  await test('duplicate completion: second call is idempotent (no duplicate event, same completion_id)', async () => {
    const itemId = await addItem(userA.client, famA, 'Eggs')
    const { data: cid1 } = await userA.client.rpc('complete_grocery_item', { p_item_id: itemId })
    const { data: cid2, error } = await userA.client.rpc('complete_grocery_item', { p_item_id: itemId })
    assert(!error, `second complete failed: ${error?.message}`)
    assertEqual(cid2 as string, cid1 as string, 'same completion_id returned')
    assertEqual(await countEvents(userA.client, itemId), 1, 'still exactly one purchase event')
  })

  // --- Restore: completed -> active, its purchase event reversed ---------------
  await test('restore: completed item returns to active and its purchase event is removed', async () => {
    const itemId = await addItem(userA.client, famA, 'Bread')
    await userA.client.rpc('complete_grocery_item', { p_item_id: itemId })
    assertEqual(await countEvents(userA.client, itemId), 1, 'event exists before restore')
    const { error } = await userA.client.rpc('restore_grocery_item', { p_item_id: itemId })
    assert(!error, `restore failed: ${error?.message}`)
    const st = await itemStatus(userA.client, itemId)
    assertEqual(st.status, 'active', 'status after restore')
    assertEqual(st.completion_id, null, 'completion_id cleared after restore')
    assertEqual(await countEvents(userA.client, itemId), 0, 'purchase event removed after restore')
  })

  // --- Re-complete: restored -> completed again, valid fresh cycle -------------
  await test('re-complete: restored item can be completed again with a fresh completion cycle', async () => {
    const itemId = await addItem(userA.client, famA, 'Butter')
    const { data: cid1 } = await userA.client.rpc('complete_grocery_item', { p_item_id: itemId })
    await userA.client.rpc('restore_grocery_item', { p_item_id: itemId })
    const { data: cid2, error } = await userA.client.rpc('complete_grocery_item', { p_item_id: itemId })
    assert(!error, `re-complete failed: ${error?.message}`)
    assert(typeof cid2 === 'string' && cid2, 'expected a fresh completion_id')
    assert((cid2 as string) !== (cid1 as string), 'fresh completion_id differs from the reversed one')
    assertEqual(await countEvents(userA.client, itemId), 1, 'exactly one event for the fresh completion')
  })

  // --- Unauthorized completion: Family B caller on Family A item -> rejected ---
  await test('unauthorized completion: another family cannot complete this family\'s item', async () => {
    const itemId = await addItem(userA.client, famA, 'Cheese')
    const { error } = await userB.client.rpc('complete_grocery_item', { p_item_id: itemId })
    assert(error, 'expected an error for cross-family completion')
    assert(errorContains(error, 'not authorized for this family'), `expected authorization error, got: ${error?.message}`)
    // And the item must remain active for A.
    const st = await itemStatus(userA.client, itemId)
    assertEqual(st.status, 'active', 'item stays active after rejected cross-family completion')
  })

  // --- Unauthorized restore: Family B caller on Family A completed item --------
  await test('unauthorized restore: another family cannot restore this family\'s item', async () => {
    const itemId = await addItem(userA.client, famA, 'Yogurt')
    await userA.client.rpc('complete_grocery_item', { p_item_id: itemId })
    const { error } = await userB.client.rpc('restore_grocery_item', { p_item_id: itemId })
    assert(error, 'expected an error for cross-family restore')
    assert(errorContains(error, 'not authorized for this family'), `expected authorization error, got: ${error?.message}`)
    const st = await itemStatus(userA.client, itemId)
    assertEqual(st.status, 'completed', 'item stays completed after rejected cross-family restore')
  })

  // --- Increment idempotency: same client_action_id must not double-apply ------
  await test('increment idempotency: repeated client_action_id does not double-increment', async () => {
    const itemId = await addItem(userA.client, famA, 'Apples', 1)
    const actionId = `act-${Date.now()}`
    const { data: q1, error: e1 } = await userA.client.rpc('increment_grocery_item', {
      p_item_id: itemId, p_delta: 2, p_client_action_id: actionId,
    })
    assert(!e1, `first increment failed: ${e1?.message}`)
    assertEqual(Number(q1), 3, 'quantity after first increment (1 + 2)')
    const { data: q2, error: e2 } = await userA.client.rpc('increment_grocery_item', {
      p_item_id: itemId, p_delta: 2, p_client_action_id: actionId,
    })
    assert(!e2, `second increment failed: ${e2?.message}`)
    assertEqual(Number(q2), 3, 'idempotent: same action id returns current quantity, no double-apply')
    const st = await itemStatus(userA.client, itemId)
    assertEqual(Number(st.quantity), 3, 'persisted quantity unchanged by duplicate action')
  })

  // A DIFFERENT client_action_id should apply again (sanity: idempotency is keyed).
  await test('increment: a distinct client_action_id applies a fresh delta', async () => {
    const itemId = await addItem(userA.client, famA, 'Oranges', 1)
    await userA.client.rpc('increment_grocery_item', { p_item_id: itemId, p_delta: 1, p_client_action_id: 'a1' })
    const { data: q, error } = await userA.client.rpc('increment_grocery_item', {
      p_item_id: itemId, p_delta: 1, p_client_action_id: 'a2',
    })
    assert(!error, `increment failed: ${error?.message}`)
    assertEqual(Number(q), 3, 'distinct action ids each apply (1 + 1 + 1)')
  })

  // --- Unauthorized increment: Family B caller on Family A item -> rejected -----
  await test('unauthorized increment: another family cannot increment this family\'s item', async () => {
    const itemId = await addItem(userA.client, famA, 'Bananas', 1)
    const { error } = await userB.client.rpc('increment_grocery_item', {
      p_item_id: itemId, p_delta: 5, p_client_action_id: 'x1',
    })
    assert(error, 'expected an error for cross-family increment')
    assert(errorContains(error, 'not authorized for this family'), `expected authorization error, got: ${error?.message}`)
    const st = await itemStatus(userA.client, itemId)
    assertEqual(Number(st.quantity), 1, 'quantity unchanged after rejected cross-family increment')
  })

  // --- Completion of a nonexistent item -> not found ---------------------------
  await test('completion of a nonexistent item is rejected with "grocery item not found"', async () => {
    const { error } = await userA.client.rpc('complete_grocery_item', {
      p_item_id: '00000000-0000-0000-0000-000000000000',
    })
    assert(error, 'expected an error for missing item')
    assert(errorContains(error, 'not found'), `expected not-found error, got: ${error?.message}`)
  })

  await cleanupUsers(A)
  finish()
}

main().catch((e) => {
  console.error('Fatal:', e instanceof Error ? e.message : e)
  process.exit(1)
})
