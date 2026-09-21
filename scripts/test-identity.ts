// MamaHQ — Beta Phase 1 Household Identity tests (0014_owner_identity).
//
// Runs against a LOCAL/CI Supabase stack (never production) with REAL authenticated
// JWTs, so RLS + the SECURITY DEFINER set_my_display_name authorization genuinely
// execute. Proves the canonical-identity rule: the onboarding/settings name updates
// the CALLER'S OWN linked HouseholdPerson, idempotently, without creating duplicates
// or ever touching another person / another family, and downstream domains read the
// corrected identity.
//
// Run: node scripts/test-identity.ts  (env: SUPABASE_URL, SUPABASE_ANON_KEY,
//                                      SUPABASE_SERVICE_ROLE_KEY)

import { createHash, randomBytes } from 'node:crypto'
import {
  admin, createUser, makeRunner, assert, assertEqual, errorContains, cleanupUsers,
  type Client, type TestUser,
} from './db/harness.ts'

const A = admin()
const { test, finish } = makeRunner('Household Identity')

async function ensureFamily(u: TestUser): Promise<string> {
  const { data, error } = await u.client.rpc('ensure_family')
  assert(!error, `ensure_family failed: ${error?.message}`)
  return data as string
}

// The owner person is created by ensure_owner_person (0009). Call it so the owner
// has a linked HouseholdPerson (named 'Me') to rename — mirrors the app bootstrap.
async function ensureOwnerPerson(u: TestUser, familyId: string): Promise<string> {
  const { data, error } = await u.client.rpc('ensure_owner_person', { fid: familyId })
  assert(!error, `ensure_owner_person failed: ${error?.message}`)
  return data as string
}

async function addPerson(client: Client, familyId: string, name: string, rel = 'member'): Promise<string> {
  const { data, error } = await client
    .from('household_people').insert({ family_id: familyId, display_name: name, relationship: rel })
    .select('id').single()
  assert(!error, `insert person failed: ${error?.message}`)
  return (data as { id: string }).id
}

async function personRow(client: Client, id: string) {
  const { data } = await client.from('household_people').select('*').eq('id', id).maybeSingle()
  return data as { id: string; display_name: string; user_id: string | null; family_id: string } | null
}

async function invitePartner(owner: TestUser, personId: string, partner: TestUser): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const hash = createHash('sha256').update(token).digest('hex')
  await owner.client.rpc('create_household_invitation', { p_person_id: personId, p_token_hash: hash, p_email: null, p_ttl_seconds: 604800 })
  await partner.client.rpc('accept_household_invitation', { p_token_hash: hash })
}

async function myPersonId(client: Client, familyId: string, userId: string): Promise<string | null> {
  const { data } = await client.from('household_people').select('id').eq('family_id', familyId).eq('user_id', userId).maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

async function main() {
  await cleanupUsers(A)

  const mom = await createUser(A, 'id-mom')
  const partner = await createUser(A, 'id-partner')
  const outsider = await createUser(A, 'id-outsider')

  const famA = await ensureFamily(mom)
  const famB = await ensureFamily(outsider)
  assert(famA !== famB, 'distinct families')

  const momPid = await ensureOwnerPerson(mom, famA)
  const outsiderPid = await ensureOwnerPerson(outsider, famB)

  // ========================================================================
  // CORE: onboarding name updates the caller's own linked person
  // ========================================================================
  await test('set_my_display_name renames the caller\'s OWN linked person (placeholder → real)', async () => {
    assertEqual((await personRow(A, momPid))?.display_name, 'Me', 'owner starts as placeholder "Me"')
    const { data, error } = await mom.client.rpc('set_my_display_name', { p_family_id: famA, p_display_name: 'Sarah' })
    assert(!error, `rename failed: ${error?.message}`)
    assertEqual(data, momPid, 'returns the caller\'s own person id')
    const row = await personRow(A, momPid)
    assertEqual(row?.display_name, 'Sarah', 'display name updated to Sarah')
    assertEqual(row?.user_id, mom.id, 'account link preserved')
  })

  await test('no duplicate person is created by renaming', async () => {
    const { count } = await A.from('household_people').select('*', { count: 'exact', head: true }).eq('family_id', famA).eq('user_id', mom.id)
    assertEqual(count, 1, 'exactly one owner person after rename')
  })

  await test('rename is idempotent (same name twice → no duplicate, no error)', async () => {
    await mom.client.rpc('set_my_display_name', { p_family_id: famA, p_display_name: 'Sarah' })
    await mom.client.rpc('set_my_display_name', { p_family_id: famA, p_display_name: 'Sarah' })
    const { count } = await A.from('household_people').select('*', { count: 'exact', head: true }).eq('family_id', famA).eq('user_id', mom.id)
    assertEqual(count, 1, 'still exactly one owner person')
    assertEqual((await personRow(A, momPid))?.display_name, 'Sarah', 'name unchanged on retry')
  })

  // ========================================================================
  // VALIDATION
  // ========================================================================
  await test('empty / whitespace-only name is rejected', async () => {
    const e1 = await mom.client.rpc('set_my_display_name', { p_family_id: famA, p_display_name: '   ' })
    assert(e1.error, 'expected empty name to be rejected')
    assert(errorContains(e1.error, 'name is required'), `got: ${e1.error?.message}`)
    assertEqual((await personRow(A, momPid))?.display_name, 'Sarah', 'name unchanged after rejected empty')
  })

  await test('unicode / apostrophe / hyphen names are accepted and normalized', async () => {
    await mom.client.rpc('set_my_display_name', { p_family_id: famA, p_display_name: '  Renée-Aoi   O’Brien ' })
    assertEqual((await personRow(A, momPid))?.display_name, 'Renée-Aoi O’Brien', 'unicode accepted + internal whitespace collapsed + trimmed')
  })

  await test('excessively long name is rejected', async () => {
    const long = 'x'.repeat(200)
    const { error } = await mom.client.rpc('set_my_display_name', { p_family_id: famA, p_display_name: long })
    assert(error, 'expected too-long name to be rejected')
    assert(errorContains(error, 'too long'), `got: ${error?.message}`)
  })

  // ========================================================================
  // SECURITY: cannot touch another person / another family
  // ========================================================================
  await test('an outsider cannot set a name in another family', async () => {
    const { error } = await outsider.client.rpc('set_my_display_name', { p_family_id: famA, p_display_name: 'HACK' })
    assert(error, 'expected cross-family rename to be rejected')
    assert(errorContains(error, 'not authorized'), `got: ${error?.message}`)
    assertEqual((await personRow(A, momPid))?.display_name, 'Renée-Aoi O’Brien', 'Family A owner name untouched')
  })

  await test('renaming only ever affects the caller\'s own person, never another member', async () => {
    // Connect a partner in famA with their own person.
    const jamesPid = await addPerson(mom.client, famA, 'James', 'partner')
    await invitePartner(mom, jamesPid, partner)
    const partnerPid = await myPersonId(partner.client, famA, partner.id)
    assert(partnerPid === jamesPid, 'partner linked to the James person')
    // Partner renames themselves.
    await partner.client.rpc('set_my_display_name', { p_family_id: famA, p_display_name: 'Jamie' })
    assertEqual((await personRow(A, jamesPid))?.display_name, 'Jamie', 'partner renamed their own person')
    // Mom's person is untouched by the partner's rename.
    assertEqual((await personRow(A, momPid))?.display_name, 'Renée-Aoi O’Brien', 'mom\'s person untouched')
    // And mom renaming herself does not touch the partner.
    await mom.client.rpc('set_my_display_name', { p_family_id: famA, p_display_name: 'Mom' })
    assertEqual((await personRow(A, jamesPid))?.display_name, 'Jamie', 'partner untouched by mom\'s rename')
  })

  await test('membership + account link remain intact after rename', async () => {
    const { data: mem } = await A.from('family_members').select('role,status').eq('family_id', famA).eq('user_id', mom.id).maybeSingle()
    assertEqual((mem as { role: string; status?: string })?.role, 'owner', 'owner membership intact')
    assertEqual((await personRow(A, momPid))?.user_id, mom.id, 'account link intact')
  })

  // ========================================================================
  // DOWNSTREAM: identity reads flow through to task ownership
  // ========================================================================
  await test('downstream domains read the corrected identity (task ownership shows the new name)', async () => {
    // Create a task owned by mom's person; the notification/name derivation reads
    // household_people.display_name, which is now the corrected canonical name.
    const { data: taskId, error } = await mom.client.rpc('create_task', {
      p_family_id: famA, p_title: 'Read the corrected name', p_assigned_to_person_id: momPid,
      p_due_at: null, p_notes: null, p_source: 'manual', p_client_task_id: null,
    })
    assert(!error, `create_task failed: ${error?.message}`)
    const { data: t } = await A.from('tasks').select('assigned_to_person_id').eq('id', taskId as string).maybeSingle()
    const ownerPid = (t as { assigned_to_person_id: string }).assigned_to_person_id
    assertEqual((await personRow(A, ownerPid))?.display_name, 'Mom', 'task owner resolves to the corrected canonical name')
  })

  await test('outsider is unaffected in their own family (isolation sanity)', async () => {
    await outsider.client.rpc('set_my_display_name', { p_family_id: famB, p_display_name: 'Dana' })
    assertEqual((await personRow(A, outsiderPid))?.display_name, 'Dana', 'outsider renamed their own person in their own family')
    assertEqual((await personRow(A, momPid))?.display_name, 'Mom', 'Family A unaffected')
  })

  await cleanupUsers(A)
  finish()
}

main().catch((e) => {
  console.error('Fatal:', e instanceof Error ? e.message : e)
  process.exit(1)
})
