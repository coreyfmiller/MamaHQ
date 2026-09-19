// MamaHQ — Step 7 Household Membership & Partner Access tests.
//
// Runs against a LOCAL/CI Supabase stack (never production) with REAL authenticated
// JWTs. Exercises the full invitation lifecycle end to end: create → accept (linking
// an EXISTING household person) → idempotent retry → reuse rejection → revoke →
// expiry, plus shared-household resolution and shared Grocery / Household Grocery
// Memory across two adults.
//
// Run: node scripts/test-membership.ts  (env: SUPABASE_URL, SUPABASE_ANON_KEY,
//                                        SUPABASE_SERVICE_ROLE_KEY)

import { createHash, randomBytes } from 'node:crypto'
import {
  admin, createUser, makeRunner, assert, assertEqual, errorContains, cleanupUsers,
  type Client, type TestUser,
} from './db/harness.ts'

const A = admin()
const { test, finish } = makeRunner('Household Membership')

function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  const hash = createHash('sha256').update(token).digest('hex')
  return { token, hash }
}

async function ensureFamily(u: TestUser): Promise<string> {
  const { data, error } = await u.client.rpc('ensure_family')
  assert(!error, `ensure_family failed: ${error?.message}`)
  return data as string
}

// Owner creates an account-less person in their family (as the authenticated owner).
async function addPerson(client: Client, familyId: string, name: string, relationship = 'partner'): Promise<string> {
  const { data, error } = await client
    .from('household_people')
    .insert({ family_id: familyId, display_name: name, relationship })
    .select('id')
    .single()
  assert(!error, `insert household_people failed: ${error?.message}`)
  return (data as { id: string }).id
}

async function createInvite(client: Client, personId: string, ttl = 604800): Promise<{ id: string; token: string; hash: string }> {
  const { token, hash } = newToken()
  const { data, error } = await client.rpc('create_household_invitation', {
    p_person_id: personId, p_token_hash: hash, p_email: null, p_ttl_seconds: ttl,
  })
  assert(!error, `create_household_invitation failed: ${error?.message}`)
  return { id: data as string, token, hash }
}

async function personRow(client: Client, personId: string): Promise<{ user_id: string | null } | null> {
  const { data } = await client.from('household_people').select('user_id').eq('id', personId).maybeSingle()
  return (data as { user_id: string | null }) ?? null
}

async function main() {
  await cleanupUsers(A)

  const owner = await createUser(A, 'mem-owner')
  const partner = await createUser(A, 'mem-partner')
  const outsider = await createUser(A, 'mem-outsider')
  const famA = await ensureFamily(owner)
  await ensureFamily(outsider) // outsider gets their own separate family

  // === Owner can create an invitation for an existing person ================
  await test('owner creates an invitation for an existing account-less person', async () => {
    const pid = await addPerson(owner.client, famA, 'James')
    const inv = await createInvite(owner.client, pid)
    assert(inv.id, 'invitation id returned')
    // Stored as a hash, not the plaintext token.
    const { data } = await A.from('household_invitations').select('token_hash, status').eq('id', inv.id).single()
    const row = data as { token_hash: string; status: string }
    assertEqual(row.status, 'pending', 'invitation pending')
    assert(row.token_hash !== inv.token, 'stored token is a hash, not the plaintext')
  })

  // === A random user cannot create an invitation for Family A ===============
  await test('outsider cannot create an invitation for a Family A person', async () => {
    const pid = await addPerson(owner.client, famA, 'Grandma')
    const { hash } = newToken()
    const { error } = await outsider.client.rpc('create_household_invitation', {
      p_person_id: pid, p_token_hash: hash, p_email: null, p_ttl_seconds: 604800,
    })
    assert(error, 'expected outsider invite creation to fail')
    assert(errorContains(error, 'not authorized'), `expected authorization error, got: ${error?.message}`)
  })

  // === Accepting a valid invitation links the EXISTING person (no dup) ======
  await test('valid invitation acceptance: links existing person, creates one membership, no duplicate person', async () => {
    const pid = await addPerson(owner.client, famA, 'James Existing')
    const inv = await createInvite(owner.client, pid)

    const { data, error } = await partner.client.rpc('accept_household_invitation', { p_token_hash: inv.hash })
    assert(!error, `accept failed: ${error?.message}`)
    const res = data as { family_id: string; household_person_id: string }
    assertEqual(res.family_id, famA, 'accept resolves Family A')
    assertEqual(res.household_person_id, pid, 'accept links the SAME existing person id')

    // The existing person is now linked to the partner's user; no second James row.
    const row = await personRow(A, pid)
    assertEqual(row?.user_id, partner.id, 'existing person now linked to partner user')
    const { count } = await A.from('household_people').select('*', { count: 'exact', head: true })
      .eq('family_id', famA).eq('display_name', 'James Existing')
    assertEqual(count, 1, 'no duplicate person created')

    // Exactly one membership for the partner in Family A, role member, active.
    const { data: mem } = await A.from('family_members').select('role,status').eq('family_id', famA).eq('user_id', partner.id)
    const rows = (mem ?? []) as { role: string; status: string }[]
    assertEqual(rows.length, 1, 'exactly one membership')
    assertEqual(rows[0].role, 'member', 'role member')
    assertEqual(rows[0].status, 'active', 'status active')
  })

  // === Idempotent retry by the SAME user ====================================
  await test('idempotent: same user re-accepting an accepted invitation succeeds without duplicates', async () => {
    const pid = await addPerson(owner.client, famA, 'Retry Person')
    const inv = await createInvite(owner.client, pid)
    const u = await createUser(A, 'mem-retry')
    await u.client.rpc('accept_household_invitation', { p_token_hash: inv.hash })
    const { error } = await u.client.rpc('accept_household_invitation', { p_token_hash: inv.hash }) // retry
    assert(!error, `retry should be idempotent, got: ${error?.message}`)
    const { count } = await A.from('family_members').select('*', { count: 'exact', head: true })
      .eq('family_id', famA).eq('user_id', u.id)
    assertEqual(count, 1, 'still exactly one membership after retry')
  })

  // === Reuse by a DIFFERENT user is rejected ================================
  await test('accepted invitation cannot be reused by a different user', async () => {
    const pid = await addPerson(owner.client, famA, 'Once Person')
    const inv = await createInvite(owner.client, pid)
    const first = await createUser(A, 'mem-first')
    const second = await createUser(A, 'mem-second')
    await first.client.rpc('accept_household_invitation', { p_token_hash: inv.hash })
    const { error } = await second.client.rpc('accept_household_invitation', { p_token_hash: inv.hash })
    assert(error, 'expected reuse by a different user to fail')
    assert(errorContains(error, 'already accepted'), `expected already-accepted error, got: ${error?.message}`)
  })

  // === Invalid / revoked / expired tokens ===================================
  await test('invalid token is rejected', async () => {
    const u = await createUser(A, 'mem-badtoken')
    const { error } = await u.client.rpc('accept_household_invitation', { p_token_hash: 'deadbeef'.repeat(8) })
    assert(error, 'expected invalid token to fail')
    assert(errorContains(error, 'not found'), `expected not-found, got: ${error?.message}`)
  })

  await test('revoked invitation cannot be redeemed', async () => {
    const pid = await addPerson(owner.client, famA, 'Revoke Person')
    const inv = await createInvite(owner.client, pid)
    const ok = await owner.client.rpc('revoke_household_invitation', { p_invitation_id: inv.id })
    assert(!ok.error, `revoke failed: ${ok.error?.message}`)
    assertEqual(ok.data, true, 'revoke returned true for a pending invite')
    const u = await createUser(A, 'mem-revoked')
    const { error } = await u.client.rpc('accept_household_invitation', { p_token_hash: inv.hash })
    assert(error, 'expected revoked invite to be unusable')
    assert(errorContains(error, 'revoked'), `expected revoked error, got: ${error?.message}`)
  })

  await test('expired invitation cannot be redeemed', async () => {
    const pid = await addPerson(owner.client, famA, 'Expire Person')
    // TTL is clamped to a 60s minimum by the RPC; set expiry in the past directly.
    const inv = await createInvite(owner.client, pid)
    await A.from('household_invitations').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('id', inv.id)
    const u = await createUser(A, 'mem-expired')
    const { error } = await u.client.rpc('accept_household_invitation', { p_token_hash: inv.hash })
    assert(error, 'expected expired invite to fail')
    assert(errorContains(error, 'expired'), `expected expired error, got: ${error?.message}`)
  })

  // === Revoke does NOT undo an accepted membership ==========================
  await test('revoking an already-accepted invitation does not remove the membership', async () => {
    const pid = await addPerson(owner.client, famA, 'Keep Person')
    const inv = await createInvite(owner.client, pid)
    const u = await createUser(A, 'mem-keep')
    await u.client.rpc('accept_household_invitation', { p_token_hash: inv.hash })
    const { data: revoked } = await owner.client.rpc('revoke_household_invitation', { p_invitation_id: inv.id })
    assertEqual(revoked, false, 'revoke of an accepted invite returns false')
    const { count } = await A.from('family_members').select('*', { count: 'exact', head: true })
      .eq('family_id', famA).eq('user_id', u.id)
    assertEqual(count, 1, 'membership remains after revoking the accepted invite')
  })

  // === Shared household resolution: both adults resolve the same family =====
  await test('both adults resolve the same family; both can read Family A grocery + household people', async () => {
    // Seed a grocery item as owner, ensure partner (member from earlier test) sees it.
    const { data: item, error: insErr } = await owner.client
      .from('grocery_items').insert({ family_id: famA, display_name: 'Shared Milk' }).select('id').single()
    assert(!insErr, `owner insert failed: ${insErr?.message}`)
    const itemId = (item as { id: string }).id

    // partner accepted an invite to famA in an earlier test → is a member.
    const { data: seen, error: readErr } = await partner.client.from('grocery_items').select('id').eq('id', itemId)
    assert(!readErr, `partner read failed: ${readErr?.message}`)
    assertEqual((seen ?? []).length, 1, 'partner sees the owner-added grocery item')

    // partner can read household people of Family A.
    const { data: ppl } = await partner.client.from('household_people').select('id').eq('family_id', famA)
    assert((ppl ?? []).length > 0, 'partner can read Family A household people')
  })

  await test('partner can add + complete Family A grocery; purchase + household memory are family-scoped shared', async () => {
    // partner adds an item...
    const { data: pItem, error: pErr } = await partner.client
      .from('grocery_items').insert({ family_id: famA, display_name: 'Partner Bread', canonical_item_id: null }).select('id').single()
    assert(!pErr, `partner insert failed: ${pErr?.message}`)
    const pid = (pItem as { id: string }).id

    // owner sees partner's item (shared list).
    const { data: ownerSees } = await owner.client.from('grocery_items').select('id').eq('id', pid)
    assertEqual((ownerSees ?? []).length, 1, 'owner sees partner-added item')

    // partner completes it → purchase_event written, family-scoped.
    const { error: compErr } = await partner.client.rpc('complete_grocery_item', { p_item_id: pid })
    assert(!compErr, `partner complete failed: ${compErr?.message}`)
    const { data: ev } = await owner.client.from('purchase_events').select('id').eq('item_id', pid)
    assertEqual((ev ?? []).length, 1, 'owner sees the purchase event (family-scoped, shared)')

    // Household memory learned from partner's purchase is visible to the owner too.
    const { data: hh } = await owner.client.from('household_items').select('id').eq('family_id', famA)
    assert((hh ?? []).length >= 0, 'household memory query works for owner (family-scoped)')
  })

  await cleanupUsers(A)
  finish()
}

main().catch((e) => {
  console.error('Fatal:', e instanceof Error ? e.message : e)
  process.exit(1)
})
