// MamaHQ — Step 5C RLS / authorization security tests.
//
// Runs against a LOCAL/CI Supabase stack (never production). Every assertion uses
// REAL authenticated JWTs (two independent families A and B) so PostgreSQL RLS
// genuinely executes — this is deliberately NOT a service-role/shape check.
//
// Covers Step 5C §13–§17, §51:
//   family read isolation, family write isolation, assigned != authorized,
//   global catalog authorization, SECURITY DEFINER RPC authorization,
//   RLS-enabled sanity.
//
// Run: node scripts/test-security.ts   (env: SUPABASE_URL, SUPABASE_ANON_KEY,
//                                       SUPABASE_SERVICE_ROLE_KEY)

import {
  admin, anonClient, createUser, makeRunner, assert, assertEqual, errorContains, cleanupUsers,
  type Client, type TestUser,
} from './db/harness.ts'

const A = admin()
const { test, finish } = makeRunner('Security / RLS')

async function ensureFamily(u: TestUser): Promise<string> {
  const { data, error } = await u.client.rpc('ensure_family')
  assert(!error, `ensure_family failed for ${u.email}: ${error?.message}`)
  return data as string
}

async function addItem(client: Client, familyId: string, name: string): Promise<string> {
  const { data, error } = await client
    .from('grocery_items')
    .insert({ family_id: familyId, display_name: name })
    .select('id')
    .single()
  assert(!error, `insert grocery_items failed: ${error?.message}`)
  return (data as { id: string }).id
}

async function addPerson(client: Client, familyId: string, name: string): Promise<string> {
  const { data, error } = await client
    .from('household_people')
    .insert({ family_id: familyId, display_name: name })
    .select('id')
    .single()
  assert(!error, `insert household_people failed: ${error?.message}`)
  return (data as { id: string }).id
}

async function main() {
  await cleanupUsers(A)

  const userA = await createUser(A, 'sec-A')
  const userB = await createUser(A, 'sec-B')
  const famA = await ensureFamily(userA)
  const famB = await ensureFamily(userB)
  assert(famA !== famB, 'two independent families must have distinct ids')

  // Seed some Family A data.
  const aItem = await addItem(userA.client, famA, 'Family A Milk')
  await userA.client.rpc('complete_grocery_item', { p_item_id: aItem }) // creates a purchase_event
  const aItem2 = await addItem(userA.client, famA, 'Family A Bread')
  const aPerson = await addPerson(userA.client, famA, 'Family A Grandma')

  // =========================================================================
  // §13 FAMILY READ ISOLATION — User B must see ZERO Family A rows.
  // =========================================================================
  await test('read isolation: User B sees 0 Family A grocery_items', async () => {
    const { data, error } = await userB.client.from('grocery_items').select('id').eq('family_id', famA)
    assert(!error, `select error: ${error?.message}`)
    assertEqual((data ?? []).length, 0, 'B must not read A grocery_items')
  })

  await test('read isolation: User B sees 0 Family A purchase_events', async () => {
    const { data, error } = await userB.client.from('purchase_events').select('id').eq('family_id', famA)
    assert(!error, `select error: ${error?.message}`)
    assertEqual((data ?? []).length, 0, 'B must not read A purchase_events')
  })

  await test('read isolation: User B sees 0 Family A household_people', async () => {
    const { data, error } = await userB.client.from('household_people').select('id').eq('family_id', famA)
    assert(!error, `select error: ${error?.message}`)
    assertEqual((data ?? []).length, 0, 'B must not read A household_people')
  })

  await test('read isolation: unauthenticated (anon) sees 0 grocery_items', async () => {
    const anon = anonClient()
    const { data, error } = await anon.from('grocery_items').select('id')
    // Either RLS returns empty, or the request is rejected — both acceptable.
    if (!error) assertEqual((data ?? []).length, 0, 'anon must not read any grocery_items')
  })

  await test('read isolation (inverse): User A sees 0 Family B grocery_items', async () => {
    const bItem = await addItem(userB.client, famB, 'Family B Secret')
    assert(bItem, 'B item created')
    const { data, error } = await userA.client.from('grocery_items').select('id').eq('family_id', famB)
    assert(!error, `select error: ${error?.message}`)
    assertEqual((data ?? []).length, 0, 'A must not read B grocery_items')
  })

  // =========================================================================
  // §14 FAMILY WRITE ISOLATION — User B cannot INSERT/UPDATE/DELETE Family A.
  // =========================================================================
  await test('write isolation: User B INSERT into Family A grocery_items is blocked', async () => {
    const { error } = await userB.client
      .from('grocery_items')
      .insert({ family_id: famA, display_name: 'B-injected' })
      .select('id')
      .single()
    assert(error, 'expected RLS to block cross-family insert')
  })

  await test('write isolation: User B UPDATE of Family A grocery_items affects 0 rows', async () => {
    const { data, error } = await userB.client
      .from('grocery_items')
      .update({ display_name: 'HACKED' })
      .eq('id', aItem2)
      .select('id')
    // RLS makes the row invisible → update matches nothing (no error, 0 rows).
    assert(!error, `unexpected error: ${error?.message}`)
    assertEqual((data ?? []).length, 0, 'B update must affect 0 A rows')
    // Confirm A's value is intact.
    const { data: check } = await userA.client.from('grocery_items').select('display_name').eq('id', aItem2).single()
    assertEqual((check as { display_name: string }).display_name, 'Family A Bread', 'A value unchanged')
  })

  await test('write isolation: User B DELETE of Family A grocery_items affects 0 rows', async () => {
    const { data, error } = await userB.client.from('grocery_items').delete().eq('id', aItem2).select('id')
    assert(!error, `unexpected error: ${error?.message}`)
    assertEqual((data ?? []).length, 0, 'B delete must affect 0 A rows')
    const { data: check } = await userA.client.from('grocery_items').select('id').eq('id', aItem2).single()
    assert(check, 'A row still exists after B delete attempt')
  })

  await test('write isolation: User B INSERT into Family A household_people is blocked', async () => {
    const { error } = await userB.client
      .from('household_people')
      .insert({ family_id: famA, display_name: 'B-injected person' })
      .select('id')
      .single()
    assert(error, 'expected RLS to block cross-family person insert')
  })

  await test('write isolation: User B UPDATE of Family A household_people affects 0 rows', async () => {
    const { data, error } = await userB.client
      .from('household_people')
      .update({ display_name: 'HACKED' })
      .eq('id', aPerson)
      .select('id')
    assert(!error, `unexpected error: ${error?.message}`)
    assertEqual((data ?? []).length, 0, 'B update must affect 0 A person rows')
  })

  await test('write isolation: User B INSERT into Family A purchase_events is blocked', async () => {
    const { error } = await userB.client
      .from('purchase_events')
      .insert({ family_id: famA, display_name: 'B-injected event' })
      .select('id')
      .single()
    assert(error, 'expected RLS to block cross-family purchase_events insert')
  })

  // =========================================================================
  // §15 ASSIGNED PERSON != AUTHORIZED USER
  // Attribute/assign a Family A item to a person, then link User B's auth id to a
  // household_people row and prove NONE of that grants B access to Family A.
  // =========================================================================
  await test('assigned != authorized: assigning/attributing a person grants no access', async () => {
    // A creates a person and an item attributed to that person.
    const personId = await addPerson(userA.client, famA, 'Assignee Person')
    const { data: item, error: insErr } = await userA.client
      .from('grocery_items')
      .insert({ family_id: famA, display_name: 'Assigned Item', added_by_person_id: personId, assigned_to_person_id: personId })
      .select('id')
      .single()
    assert(!insErr, `A insert failed: ${insErr?.message}`)
    const assignedItemId = (item as { id: string }).id

    // Admin links User B's auth id onto a Family A household_people row — i.e. B is
    // "represented in" Family A's roster. This must STILL not authorize B, because
    // authorization derives from family_members, not household_people.
    const { error: linkErr } = await A
      .from('household_people')
      .update({ user_id: userB.id })
      .eq('id', personId)
    assert(!linkErr, `admin link failed: ${linkErr?.message}`)

    // B tries to read the assigned Family A item — must see nothing.
    const { data: bRead, error: bErr } = await userB.client
      .from('grocery_items')
      .select('id')
      .eq('id', assignedItemId)
    assert(!bErr, `B read error: ${bErr?.message}`)
    assertEqual((bRead ?? []).length, 0, 'being represented/assigned in Family A grants B no read access')

    // B also cannot complete it (SECURITY DEFINER authorizes via family_members).
    const { error: compErr } = await userB.client.rpc('complete_grocery_item', { p_item_id: assignedItemId })
    assert(compErr, 'B must not be able to complete an item merely because a person row carries B\'s user_id')

    // Confirm B has NO family_members row in Family A (the true authorization gate).
    const { data: mem } = await A.from('family_members').select('user_id').eq('family_id', famA).eq('user_id', userB.id)
    assertEqual((mem ?? []).length, 0, 'B has no family_members row in Family A')
  })

  // =========================================================================
  // §16 GLOBAL CATALOG SECURITY — read allowed, writes rejected for app users.
  // =========================================================================
  await test('catalog: authenticated user CAN read canonical_items', async () => {
    // Seed one row via service role so there is something to read.
    await A.from('canonical_items').upsert({
      canonical_id: 's5c.test.concept', canonical_name: 'S5C Test', default_display_name: 'S5C Test',
      department: 'test', category: 'test', shopping_category: 'test', concept_level: 'generic',
      default_unit: 'ea', allowed_units: ['ea'], storage_type: 'ambient', catalog_tier: 'A', status: 'active', added_in: 's5c',
    }, { onConflict: 'canonical_id' })
    const { data, error } = await userA.client.from('canonical_items').select('canonical_id').eq('canonical_id', 's5c.test.concept')
    assert(!error, `read error: ${error?.message}`)
    assertEqual((data ?? []).length, 1, 'authenticated user can read the catalog')
  })

  await test('catalog: authenticated user INSERT is rejected', async () => {
    const { error } = await userA.client.from('canonical_items').insert({
      canonical_id: 's5c.evil.insert', canonical_name: 'x', default_display_name: 'x',
      department: 'x', category: 'x', shopping_category: 'x', concept_level: 'generic',
      default_unit: 'ea', allowed_units: ['ea'], storage_type: 'ambient', catalog_tier: 'A', status: 'active', added_in: 'x',
    }).select('canonical_id').single()
    assert(error, 'expected catalog insert to be rejected (no write policy)')
  })

  await test('catalog: authenticated user UPDATE affects 0 rows', async () => {
    const { data, error } = await userA.client
      .from('canonical_items')
      .update({ canonical_name: 'HACKED' })
      .eq('canonical_id', 's5c.test.concept')
      .select('canonical_id')
    // No write policy → update matches nothing under RLS.
    assert(!error, `unexpected error: ${error?.message}`)
    assertEqual((data ?? []).length, 0, 'catalog update must affect 0 rows for app users')
  })

  await test('catalog: authenticated user DELETE affects 0 rows', async () => {
    const { data, error } = await userA.client
      .from('canonical_items')
      .delete()
      .eq('canonical_id', 's5c.test.concept')
      .select('canonical_id')
    assert(!error, `unexpected error: ${error?.message}`)
    assertEqual((data ?? []).length, 0, 'catalog delete must affect 0 rows for app users')
  })

  // =========================================================================
  // §17 SECURITY DEFINER RPC AUTHORIZATION — authorized succeeds, cross-family fails.
  // (Completion/restore/increment cross-family rejection is covered in depth by
  // test-db-completion.ts; here we assert the authorized-path success + one cross
  // check to keep the security suite self-contained.)
  // =========================================================================
  await test('RPC auth: authorized family member CAN complete their own item', async () => {
    const itemId = await addItem(userA.client, famA, 'Authorized complete')
    const { data: cid, error } = await userA.client.rpc('complete_grocery_item', { p_item_id: itemId })
    assert(!error, `authorized complete failed: ${error?.message}`)
    assert(typeof cid === 'string' && cid, 'expected completion_id')
  })

  await test('RPC auth: is_family_member returns false for a foreign family', async () => {
    const { data, error } = await userB.client.rpc('is_family_member', { fid: famA })
    assert(!error, `is_family_member error: ${error?.message}`)
    assertEqual(data, false, 'B is not a member of Family A')
  })

  await test('RPC auth: is_family_member returns true for own family', async () => {
    const { data, error } = await userA.client.rpc('is_family_member', { fid: famA })
    assert(!error, `is_family_member error: ${error?.message}`)
    assertEqual(data, true, 'A is a member of Family A')
  })

  // =========================================================================
  // STEP 6 — Household Grocery Memory isolation (family-scoped private data).
  // A creates a household variant by completing a grocery item; B must not see or
  // touch A's household_items / observations, nor set A's usual.
  // =========================================================================
  // Seed a Family A household variant via a real completion (writes household_items
  // + observation atomically).
  const aMilkItem = await addItem(userA.client, famA, 'Family A 2% milk')
  await userA.client.rpc('complete_grocery_item', { p_item_id: aMilkItem })
  const { data: aVariants } = await A.from('household_items').select('id').eq('family_id', famA)
  const aVariantId = (aVariants?.[0] as { id: string } | undefined)?.id

  await test('household read isolation: User B sees 0 Family A household_items', async () => {
    const { data, error } = await userB.client.from('household_items').select('id').eq('family_id', famA)
    assert(!error, `select error: ${error?.message}`)
    assertEqual((data ?? []).length, 0, 'B must not read A household_items')
  })

  await test('household read isolation: User B sees 0 Family A observations', async () => {
    const { data, error } = await userB.client.from('household_item_observations').select('id').eq('family_id', famA)
    assert(!error, `select error: ${error?.message}`)
    assertEqual((data ?? []).length, 0, 'B must not read A household_item_observations')
  })

  await test('household write isolation: User B INSERT into Family A household_items is blocked', async () => {
    const { error } = await userB.client
      .from('household_items')
      .insert({ family_id: famA, variant_key: 'evil', display_name: 'B-injected' })
      .select('id')
      .single()
    assert(error, 'expected RLS to block cross-family household_items insert')
  })

  await test('household write isolation: User B UPDATE of Family A household_items affects 0 rows', async () => {
    if (!aVariantId) return
    const { data, error } = await userB.client
      .from('household_items')
      .update({ display_name: 'HACKED', is_default: true })
      .eq('id', aVariantId)
      .select('id')
    assert(!error, `unexpected error: ${error?.message}`)
    assertEqual((data ?? []).length, 0, 'B update must affect 0 A household rows')
  })

  await test('household RPC auth: User B cannot set_household_usual on Family A variant', async () => {
    if (!aVariantId) return
    const { error } = await userB.client.rpc('set_household_usual', { p_household_item_id: aVariantId })
    assert(error, 'expected cross-family set_household_usual to be rejected')
    assert(errorContains(error, 'not authorized') || errorContains(error, 'not found'),
      `expected authorization/not-found error, got: ${error?.message}`)
    // Confirm A's variant did not become user_set.
    const { data } = await A.from('household_items').select('is_user_set').eq('id', aVariantId).single()
    assertEqual((data as { is_user_set: boolean }).is_user_set, false, 'A variant unchanged after B attempt')
  })

  // =========================================================================
  // STEP 7 — Membership & invitation hardening.
  // The two privilege-escalation paths that MUST be closed: (a) a user inserting
  // their own family_members row into someone else's family, and (b) a user setting
  // household_people.user_id = auth.uid() to hijack an identity. Plus invitation
  // visibility isolation.
  // =========================================================================

  await test('membership fabrication: User B cannot INSERT a family_members row into Family A', async () => {
    const { error } = await userB.client
      .from('family_members')
      .insert({ family_id: famA, user_id: userB.id, role: 'member' })
      .select('user_id')
      .single()
    assert(error, 'expected direct family_members insert to be blocked by RLS')
    // And B still is not a member of Family A.
    const { data } = await A.from('family_members').select('user_id').eq('family_id', famA).eq('user_id', userB.id)
    assertEqual((data ?? []).length, 0, 'B did not become a member of Family A')
  })

  await test('membership fabrication: User B cannot INSERT their own family_members row even for their OWN uid+A family', async () => {
    // Explicitly the old-vulnerability shape: (someone_elses_family, self).
    const { error } = await userB.client
      .from('family_members')
      .insert({ family_id: famA, user_id: userB.id, role: 'owner', status: 'active' })
      .select('user_id')
      .single()
    assert(error, 'expected self-insert-into-foreign-family to be blocked')
  })

  await test('person hijack: User B cannot set household_people.user_id = self on a Family A person', async () => {
    // Seed a Family A account-less person via service role (bypasses the link guard
    // for setup only; the guard blocks CLIENT link changes, which is what we test).
    const { data: person } = await A
      .from('household_people')
      .insert({ family_id: famA, display_name: 'Hijack Target' })
      .select('id')
      .single()
    const personId = (person as { id: string }).id
    // B attempts to claim the person (RLS blocks the row from B entirely → 0 rows;
    // even if visible, the link-guard trigger rejects a user_id change).
    const { data: upd, error } = await userB.client
      .from('household_people')
      .update({ user_id: userB.id })
      .eq('id', personId)
      .select('id')
    // Either RLS makes it affect 0 rows, or the guard raises — both acceptable.
    if (!error) assertEqual((upd ?? []).length, 0, 'B update affected 0 rows (RLS)')
    const { data: check } = await A.from('household_people').select('user_id').eq('id', personId).single()
    assertEqual((check as { user_id: string | null }).user_id, null, 'person remains unlinked after B attempt')
  })

  await test('person hijack: even the OWNER cannot directly set user_id via the client (only via acceptance)', async () => {
    const { data: person } = await A
      .from('household_people')
      .insert({ family_id: famA, display_name: 'Owner Link Attempt' })
      .select('id')
      .single()
    const personId = (person as { id: string }).id
    // userA is a legitimate Family A member, but direct user_id linking is still
    // barred by the guard trigger (linking happens only through acceptance).
    const { error } = await userA.client
      .from('household_people')
      .update({ user_id: userA.id })
      .eq('id', personId)
      .select('id')
    assert(error, 'expected the link guard to reject a direct client user_id change')
    assert(errorContains(error, 'user_id') || errorContains(error, 'invitation'),
      `expected link-guard error, got: ${error?.message}`)
  })

  await test('invitation visibility: User B cannot enumerate Family A invitations', async () => {
    // Owner A creates an invitation for a Family A person.
    const { data: person } = await A
      .from('household_people')
      .insert({ family_id: famA, display_name: 'Invitee X' })
      .select('id')
      .single()
    const personId = (person as { id: string }).id
    const { error: invErr } = await userA.client.rpc('create_household_invitation', {
      p_person_id: personId, p_token_hash: 'a'.repeat(64), p_email: null, p_ttl_seconds: 604800,
    })
    assert(!invErr, `owner invite creation failed: ${invErr?.message}`)

    // B cannot see Family A's invitations.
    const { data: bSees } = await userB.client.from('household_invitations').select('id').eq('family_id', famA)
    assertEqual((bSees ?? []).length, 0, 'B cannot enumerate Family A invitations')
    // A (a member) can see them.
    const { data: aSees } = await userA.client.from('household_invitations').select('id').eq('family_id', famA)
    assert((aSees ?? []).length >= 1, 'Family A member can view its own invitations')
  })

  await test('invitation creation authz: User B cannot create an invitation for a Family A person', async () => {
    const { data: person } = await A
      .from('household_people')
      .insert({ family_id: famA, display_name: 'Invitee Y' })
      .select('id')
      .single()
    const personId = (person as { id: string }).id
    const { error } = await userB.client.rpc('create_household_invitation', {
      p_person_id: personId, p_token_hash: 'b'.repeat(64), p_email: null, p_ttl_seconds: 604800,
    })
    assert(error, 'expected cross-family invite creation to be rejected')
    assert(errorContains(error, 'not authorized'), `expected authorization error, got: ${error?.message}`)
  })

  await cleanupUsers(A)
  finish()
}

main().catch((e) => {
  console.error('Fatal:', e instanceof Error ? e.message : e)
  process.exit(1)
})
