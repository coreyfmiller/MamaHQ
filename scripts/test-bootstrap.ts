// MamaHQ — Owner-family bootstrap integrity tests (0015).
//
// Runs against a LOCAL/CI Supabase stack (never production) with REAL authenticated
// JWTs. Proves the P1 duplicate-owner-family defect is fixed at the DATABASE layer:
// concurrent/repeated ensure_family() can never create two owner families for one
// user, while idempotent reuse, singular owner person/membership, and the existing
// invitation/membership semantics (Person ≠ Account ≠ Membership) all still hold.
//
// Run: node scripts/test-bootstrap.ts  (env: SUPABASE_URL, SUPABASE_ANON_KEY,
//                                       SUPABASE_SERVICE_ROLE_KEY)

import { createHash, randomBytes } from 'node:crypto'
import {
  admin, createUser, makeRunner, assert, assertEqual, cleanupUsers,
} from './db/harness.ts'

const A = admin()
const { test, finish } = makeRunner('Bootstrap Integrity')

// How many families does this user currently OWN (the thing we must keep at <= 1)?
async function ownedFamilyCount(userId: string): Promise<number> {
  const { count, error } = await A.from('families').select('*', { count: 'exact', head: true }).eq('owner_id', userId)
  assert(!error, `count owned families failed: ${error?.message}`)
  return count ?? 0
}

async function ownerMembershipCount(userId: string): Promise<number> {
  const { count, error } = await A.from('family_members')
    .select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('role', 'owner')
  assert(!error, `count owner memberships failed: ${error?.message}`)
  return count ?? 0
}

async function ownerPersonCount(familyId: string, userId: string): Promise<number> {
  const { count, error } = await A.from('household_people')
    .select('*', { count: 'exact', head: true }).eq('family_id', familyId).eq('user_id', userId)
  assert(!error, `count owner people failed: ${error?.message}`)
  return count ?? 0
}

function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  const hash = createHash('sha256').update(token).digest('hex')
  return { token, hash }
}

async function main() {
  await cleanupUsers(A)

  // === 1) First bootstrap creates exactly one family =========================
  await test('first ensure_family() creates exactly one owner family', async () => {
    const u = await createUser(A, 'boot-first')
    const { data, error } = await u.client.rpc('ensure_family')
    assert(!error, `ensure_family failed: ${error?.message}`)
    assert(!!data, 'returns a family id')
    assertEqual(await ownedFamilyCount(u.id), 1, 'exactly one owned family')
    assertEqual(await ownerMembershipCount(u.id), 1, 'exactly one owner membership')
  })

  // === 2) Repeated (sequential) bootstrap returns/reuses the same family =====
  await test('repeated ensure_family() reuses the same family (idempotent)', async () => {
    const u = await createUser(A, 'boot-repeat')
    const first = await u.client.rpc('ensure_family')
    assert(!first.error, `first failed: ${first.error?.message}`)
    const fid1 = first.data as string
    for (let i = 0; i < 5; i++) {
      const again = await u.client.rpc('ensure_family')
      assert(!again.error, `repeat ${i} failed: ${again.error?.message}`)
      assertEqual(again.data as string, fid1, `repeat ${i} returns the same family`)
    }
    assertEqual(await ownedFamilyCount(u.id), 1, 'still exactly one owned family after repeats')
  })

  // === 3) CONCURRENT bootstrap cannot create two owner families ==============
  // This is the regression test for the exact production defect (two families ~1ms
  // apart). Fire many ensure_family() calls in parallel for a brand-new user.
  await test('concurrent ensure_family() x12 creates exactly one owner family', async () => {
    const u = await createUser(A, 'boot-concurrent')
    const N = 12
    const results = await Promise.all(
      Array.from({ length: N }, () => u.client.rpc('ensure_family')),
    )
    // No call should hard-error (a lost race must resolve to the existing family,
    // not surface a unique-violation to the caller).
    const errored = results.filter((r) => r.error)
    assert(errored.length === 0, `no call should error; got ${errored.length}: ${errored[0]?.error?.message}`)
    // Every call must return the SAME family id.
    const ids = new Set(results.map((r) => r.data as string))
    assertEqual(ids.size, 1, `all ${N} concurrent calls return one family id (got ${ids.size} distinct)`)
    // And the storage layer must hold exactly one owned family.
    assertEqual(await ownedFamilyCount(u.id), 1, 'exactly one owned family after concurrent bootstrap')
    assertEqual(await ownerMembershipCount(u.id), 1, 'exactly one owner membership after concurrent bootstrap')
  })

  // === 4) Owner person remains singular/correct after concurrent bootstrap ===
  // ensure_owner_person is bootstrapped by higher layers (set_my_display_name /
  // onboarding); here we bootstrap it directly and prove concurrency keeps it single.
  await test('owner person stays singular under concurrent ensure_owner_person', async () => {
    const u = await createUser(A, 'boot-person')
    const fid = (await u.client.rpc('ensure_family')).data as string
    // set_my_display_name resolves+links the owner person; call it concurrently.
    const results = await Promise.all(
      Array.from({ length: 6 }, () => u.client.rpc('set_my_display_name', { p_family_id: fid, p_display_name: 'Alex' })),
    )
    const errored = results.filter((r) => r.error)
    assert(errored.length === 0, `no set_my_display_name error; got: ${errored[0]?.error?.message}`)
    assertEqual(await ownerPersonCount(fid, u.id), 1, 'exactly one owner-linked person')
  })

  // === 5) Membership remains singular/correct ================================
  await test('membership stays singular under concurrent bootstrap', async () => {
    const u = await createUser(A, 'boot-membership')
    await Promise.all(Array.from({ length: 8 }, () => u.client.rpc('ensure_family')))
    const { data, error } = await A.from('family_members').select('family_id,role').eq('user_id', u.id)
    assert(!error, `membership read failed: ${error?.message}`)
    const rows = (data ?? []) as { family_id: string; role: string }[]
    assertEqual(rows.length, 1, 'exactly one membership row')
    assertEqual(rows[0].role, 'owner', 'the single membership is owner')
  })

  // === 6) Existing invitation/membership semantics still work ================
  // A second adult can still JOIN an owner's household as a MEMBER (multi-household
  // membership is not blocked by the owner-uniqueness constraint).
  await test('invitation acceptance still links a member (owner-uniqueness does not block membership)', async () => {
    const owner = await createUser(A, 'boot-inv-owner')
    const partner = await createUser(A, 'boot-inv-partner')
    const fid = (await owner.client.rpc('ensure_family')).data as string

    // Owner adds an account-less person, invites them.
    const { data: person, error: pErr } = await owner.client
      .from('household_people').insert({ family_id: fid, display_name: 'Partner', relationship: 'partner' }).select('id').single()
    assert(!pErr, `add person failed: ${pErr?.message}`)
    const personId = (person as { id: string }).id
    const { hash } = newToken()
    const inv = await owner.client.rpc('create_household_invitation', {
      p_person_id: personId, p_token_hash: hash, p_email: null, p_ttl_seconds: 604800,
    })
    assert(!inv.error, `create invite failed: ${inv.error?.message}`)

    const acc = await partner.client.rpc('accept_household_invitation', { p_token_hash: hash })
    assert(!acc.error, `accept failed: ${acc.error?.message}`)
    const res = acc.data as { family_id: string; household_person_id: string }
    assertEqual(res.family_id, fid, 'partner joins the OWNER family')

    // Partner is a MEMBER of the owner family...
    const { count: memberCount } = await A.from('family_members')
      .select('*', { count: 'exact', head: true }).eq('family_id', fid).eq('user_id', partner.id).eq('role', 'member')
    assertEqual(memberCount, 1, 'partner has exactly one member row in the owner family')
    // ...and the owner still owns exactly one family (unchanged by the join).
    assertEqual(await ownedFamilyCount(owner.id), 1, 'owner still owns exactly one family')
    // The partner does NOT own the family (Person/Membership ≠ Ownership).
    assertEqual(await ownedFamilyCount(partner.id), 0, 'member does not own the joined family')
  })

  // === 7) No regression to Person ≠ Account ≠ Membership =====================
  await test('Person ≠ Account ≠ Membership: owner-uniqueness targets ownership only', async () => {
    const u = await createUser(A, 'boot-identity')
    const fid = (await u.client.rpc('ensure_family')).data as string
    // Account-less people (no user_id) are unconstrained by owner-uniqueness: a
    // family can have many people who are neither accounts nor members.
    for (const name of ['Grandma', 'Sitter', 'Uncle']) {
      const { error } = await u.client.from('household_people').insert({ family_id: fid, display_name: name, relationship: 'other' })
      assert(!error, `insert account-less person ${name} failed: ${error?.message}`)
    }
    const { count: ppl } = await A.from('household_people').select('*', { count: 'exact', head: true }).eq('family_id', fid)
    assert((ppl ?? 0) >= 4, 'family has the owner person + 3 account-less people (people are not gated by ownership)')
    // Still exactly one owner family + one membership for the account.
    assertEqual(await ownedFamilyCount(u.id), 1, 'one owned family')
    assertEqual(await ownerMembershipCount(u.id), 1, 'one owner membership')
    // A client cannot pre-link an account-less person to a user id (0009 guard intact).
    const { error: guardErr } = await u.client
      .from('household_people').insert({ family_id: fid, display_name: 'Hijack', relationship: 'other', user_id: u.id })
    assert(!!guardErr, 'inserting a pre-linked person must be blocked by the 0009 guard')
  })

  await cleanupUsers(A)
  finish()
}

main().catch((e) => {
  console.error('Fatal:', e instanceof Error ? e.message : e)
  process.exit(1)
})
