// MamaHQ — Step 9 Responsibility Acceptance & Care Handoff tests.
//
// Runs against a LOCAL/CI Supabase stack (never production) with REAL authenticated
// JWTs, so RLS + the SECURITY DEFINER RPC authorization genuinely execute. Covers
// Step 9 §26:
//   Task acknowledgement — assignee accepts; impersonation / cross-family /
//     unconnected-person / direct-forge rejected; reassign / reopen / relinquish
//     clear current acceptance; completion needs no acceptance; duplicate accept safe.
//   Care handoff — valid same-family handoff; cross-family recipient rejected;
//     unauthorized sender rejected; recipient accepts (holder moves atomically);
//     another member cannot accept for the recipient; decline; cancel; stale accept
//     after cancel/decline rejected; duplicate accept safe; direct client writes
//     cannot forge accepted state.
//
// Run: node scripts/test-handoff.ts  (env: SUPABASE_URL, SUPABASE_ANON_KEY,
//                                      SUPABASE_SERVICE_ROLE_KEY)

import { createHash, randomBytes } from 'node:crypto'
import {
  admin, createUser, makeRunner, assert, assertEqual, errorContains, cleanupUsers,
  type Client, type TestUser,
} from './db/harness.ts'

const A = admin()
const { test, finish } = makeRunner('Responsibility / Care Handoff')

async function ensureFamily(u: TestUser): Promise<string> {
  const { data, error } = await u.client.rpc('ensure_family')
  assert(!error, `ensure_family failed: ${error?.message}`)
  return data as string
}

async function addPerson(client: Client, familyId: string, name: string, relationship = 'member'): Promise<string> {
  const { data, error } = await client
    .from('household_people')
    .insert({ family_id: familyId, display_name: name, relationship })
    .select('id')
    .single()
  assert(!error, `insert household_people failed: ${error?.message}`)
  return (data as { id: string }).id
}

async function myPersonId(client: Client, familyId: string, userId: string): Promise<string> {
  const { data, error } = await client
    .from('household_people').select('id')
    .eq('family_id', familyId).eq('user_id', userId).maybeSingle()
  assert(!error && data, `resolve my person failed: ${error?.message}`)
  return (data as { id: string }).id
}

// Connect a partner account to an existing person via a real Step 7 invitation.
async function invitePartner(owner: TestUser, familyId: string, personId: string, partner: TestUser): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const hash = createHash('sha256').update(token).digest('hex')
  const c = await owner.client.rpc('create_household_invitation', {
    p_person_id: personId, p_token_hash: hash, p_email: null, p_ttl_seconds: 604800,
  })
  assert(!c.error, `create invite failed: ${c.error?.message}`)
  const a = await partner.client.rpc('accept_household_invitation', { p_token_hash: hash })
  assert(!a.error, `accept invite failed: ${a.error?.message}`)
}

async function createTask(client: Client, familyId: string, title: string, assignee?: string | null): Promise<string> {
  const { data, error } = await client.rpc('create_task', {
    p_family_id: familyId, p_title: title, p_assigned_to_person_id: assignee ?? null,
    p_due_at: null, p_notes: null, p_source: 'manual', p_client_task_id: null,
  })
  assert(!error, `create_task failed: ${error?.message}`)
  return data as string
}

async function taskRow(client: Client, taskId: string) {
  const { data } = await client.from('tasks').select('*').eq('id', taskId).maybeSingle()
  return data as {
    id: string; status: string; assigned_to_person_id: string | null
    acknowledged_at: string | null; acknowledged_by_user_id: string | null
    acknowledged_by_household_person_id: string | null; completed_by_user_id: string | null
  } | null
}

async function eventTypes(client: Client, familyId: string, taskId: string): Promise<string[]> {
  const { data } = await client
    .from('task_events').select('event_type').eq('family_id', familyId).eq('task_id', taskId)
    .order('created_at', { ascending: true })
  return (data ?? []).map((e) => (e as { event_type: string }).event_type)
}

async function handoffRow(client: Client, id: string) {
  const { data } = await client.from('care_handoffs').select('*').eq('id', id).maybeSingle()
  return data as { id: string; status: string; to_person_id: string } | null
}

async function currentHolder(client: Client, familyId: string): Promise<string | null> {
  const { data } = await client.from('care_responsibility').select('holder_person_id').eq('family_id', familyId).maybeSingle()
  return (data as { holder_person_id: string | null } | null)?.holder_person_id ?? null
}

async function main() {
  await cleanupUsers(A)

  const owner = await createUser(A, 'ho-owner')      // Mom
  const partner = await createUser(A, 'ho-partner')  // James (connected)
  const other = await createUser(A, 'ho-other')      // Sarah (connected, same family)
  const outsider = await createUser(A, 'ho-outsider')

  const famA = await ensureFamily(owner)
  const famB = await ensureFamily(outsider)
  assert(famA !== famB, 'distinct families')

  const momPid = await myPersonId(owner.client, famA, owner.id)
  const jamesPid = await addPerson(owner.client, famA, 'James', 'partner')
  await invitePartner(owner, famA, jamesPid, partner)
  const sarahPid = await addPerson(owner.client, famA, 'Sarah', 'grandparent')
  await invitePartner(owner, famA, sarahPid, other)
  const grandmaPid = await addPerson(owner.client, famA, 'Grandma', 'grandparent') // no account
  const famBPid = await myPersonId(outsider.client, famB, outsider.id)

  // ========================================================================
  // TASK ACKNOWLEDGEMENT
  // ========================================================================
  await test('the assigned connected person can accept ("I\'ve got it"); acceptance ≠ completion', async () => {
    const id = await createTask(owner.client, famA, 'Take garbage out', jamesPid)
    const { error } = await partner.client.rpc('accept_task', { p_task_id: id })
    assert(!error, `accept failed: ${error?.message}`)
    const row = await taskRow(A, id)
    assertEqual(row?.status, 'open', 'still open (acceptance is not completion)')
    assertEqual(row?.acknowledged_by_household_person_id, jamesPid, 'acknowledged by James person')
    assertEqual(row?.acknowledged_by_user_id, partner.id, 'acknowledged by James account')
    assert(row?.acknowledged_at, 'acknowledged_at set')
    const ev = await eventTypes(owner.client, famA, id)
    assert(ev.includes('accepted'), 'an accepted event exists')
  })

  await test('an unrelated same-family member cannot accept on the assignee\'s behalf', async () => {
    const id = await createTask(owner.client, famA, 'James task', jamesPid)
    // Sarah (a real family member, but not the assignee) tries to accept.
    const { error } = await other.client.rpc('accept_task', { p_task_id: id })
    assert(error, 'expected non-assignee accept to fail')
    assert(errorContains(error, 'only the assigned person'), `got: ${error?.message}`)
    assertEqual((await taskRow(A, id))?.acknowledged_at, null, 'not accepted')
  })

  await test('a cross-family member cannot accept', async () => {
    const id = await createTask(owner.client, famA, 'Cross-family accept', jamesPid)
    const { error } = await outsider.client.rpc('accept_task', { p_task_id: id })
    assert(error, 'expected outsider accept to fail')
    // Outsider can't even read the task → not authorized for this family.
    assert(errorContains(error, 'not authorized') || errorContains(error, 'not found'), `got: ${error?.message}`)
  })

  await test('an account-less assignee cannot be accepted by anyone', async () => {
    const id = await createTask(owner.client, famA, 'Grandma task', grandmaPid)
    // Even the owner (a member) cannot accept for account-less Grandma.
    const { error } = await owner.client.rpc('accept_task', { p_task_id: id })
    assert(error, 'expected accept for account-less person to fail')
    assert(errorContains(error, 'only the assigned person'), `got: ${error?.message}`)
    assertEqual((await taskRow(A, id))?.acknowledged_at, null, 'not accepted')
  })

  await test('acceptance cannot be forged by a direct client table update', async () => {
    const id = await createTask(owner.client, famA, 'Forge accept', jamesPid)
    // Owner tries to directly set acknowledgement columns (RLS blocks task update).
    await owner.client.from('tasks').update({
      acknowledged_at: new Date().toISOString(), acknowledged_by_user_id: owner.id,
      acknowledged_by_household_person_id: jamesPid,
    }).eq('id', id)
    assertEqual((await taskRow(A, id))?.acknowledged_at, null, 'no forged acceptance (RLS blocks update)')
  })

  await test('reassignment clears current acceptance; history preserved', async () => {
    const id = await createTask(owner.client, famA, 'Pick up prescription', jamesPid)
    await partner.client.rpc('accept_task', { p_task_id: id }) // James accepts
    await owner.client.rpc('assign_task', { p_task_id: id, p_person_id: sarahPid }) // reassign to Sarah
    const row = await taskRow(A, id)
    assertEqual(row?.assigned_to_person_id, sarahPid, 'now assigned to Sarah')
    assertEqual(row?.acknowledged_at, null, 'acceptance cleared by reassignment')
    const ev = await eventTypes(owner.client, famA, id)
    assert(ev.includes('accepted'), 'James\'s historical acceptance remains')
    assert(ev.includes('reassigned'), 'reassigned event exists')
    // Sarah must accept for herself now.
    const { error } = await other.client.rpc('accept_task', { p_task_id: id })
    assert(!error, `Sarah accept failed: ${error?.message}`)
    assertEqual((await taskRow(A, id))?.acknowledged_by_household_person_id, sarahPid, 'Sarah now has it')
  })

  await test('reopen clears current acceptance (re-acceptance required)', async () => {
    const id = await createTask(owner.client, famA, 'Reopen clears accept', jamesPid)
    await partner.client.rpc('accept_task', { p_task_id: id })
    await partner.client.rpc('complete_task', { p_task_id: id })
    await owner.client.rpc('reopen_task', { p_task_id: id })
    assertEqual((await taskRow(A, id))?.acknowledged_at, null, 'acceptance cleared on reopen')
  })

  await test('relinquish clears acceptance but keeps assignment; only the accepter may relinquish', async () => {
    const id = await createTask(owner.client, famA, 'Relinquish me', jamesPid)
    await partner.client.rpc('accept_task', { p_task_id: id })
    // Sarah cannot relinquish James's acceptance.
    const bad = await other.client.rpc('relinquish_task', { p_task_id: id })
    assert(bad.error, 'expected non-accepter relinquish to fail')
    // James relinquishes.
    const { error } = await partner.client.rpc('relinquish_task', { p_task_id: id })
    assert(!error, `relinquish failed: ${error?.message}`)
    const row = await taskRow(A, id)
    assertEqual(row?.acknowledged_at, null, 'acceptance cleared')
    assertEqual(row?.assigned_to_person_id, jamesPid, 'still assigned to James (not reassigned)')
    const ev = await eventTypes(owner.client, famA, id)
    assert(ev.includes('relinquished'), 'relinquished event exists')
  })

  await test('completion does not require acceptance; completer recorded, no fake acceptance', async () => {
    const id = await createTask(owner.client, famA, 'Complete without accept', jamesPid)
    const { error } = await partner.client.rpc('complete_task', { p_task_id: id })
    assert(!error, `complete failed: ${error?.message}`)
    const row = await taskRow(A, id)
    assertEqual(row?.status, 'completed', 'completed')
    assertEqual(row?.completed_by_user_id, partner.id, 'completer recorded')
    assertEqual(row?.acknowledged_at, null, 'no fabricated acceptance')
    const ev = await eventTypes(owner.client, famA, id)
    assert(!ev.includes('accepted'), 'no accepted event was fabricated')
  })

  await test('duplicate acceptance is safe (no duplicate event)', async () => {
    const id = await createTask(owner.client, famA, 'Double accept', jamesPid)
    await partner.client.rpc('accept_task', { p_task_id: id })
    await partner.client.rpc('accept_task', { p_task_id: id }) // retry
    const ev = await eventTypes(owner.client, famA, id)
    assertEqual(ev.filter((e) => e === 'accepted').length, 1, 'exactly one accepted event')
  })

  // ========================================================================
  // CARE HANDOFF
  // ========================================================================
  // Establish Mom as the initial holder (first ensure caller becomes holder).
  await test('ensure_care_responsibility bootstraps the caller as holder', async () => {
    const { error } = await owner.client.rpc('ensure_care_responsibility', { p_family_id: famA })
    assert(!error, `ensure failed: ${error?.message}`)
    assertEqual(await currentHolder(A, famA), momPid, 'Mom is the initial holder')
  })

  await test('valid same-family handoff: propose does NOT move the holder', async () => {
    const { data, error } = await owner.client.rpc('propose_care_handoff', {
      p_family_id: famA, p_to_person_id: jamesPid, p_context: { lastFeed: { at: new Date().toISOString() } },
    })
    assert(!error, `propose failed: ${error?.message}`)
    const hid = data as string
    assertEqual((await handoffRow(A, hid))?.status, 'pending', 'handoff pending')
    assertEqual(await currentHolder(A, famA), momPid, 'holder unchanged on propose')
    // Clean up for later tests: cancel it.
    await owner.client.rpc('cancel_care_handoff', { p_handoff_id: hid })
  })

  await test('cross-family recipient is rejected', async () => {
    const { error } = await owner.client.rpc('propose_care_handoff', {
      p_family_id: famA, p_to_person_id: famBPid, p_context: {},
    })
    assert(error, 'expected cross-family recipient to fail')
    assert(errorContains(error, 'not in this family'), `got: ${error?.message}`)
  })

  await test('handoff to an account-less person is rejected (they could never accept)', async () => {
    const { error } = await owner.client.rpc('propose_care_handoff', {
      p_family_id: famA, p_to_person_id: grandmaPid, p_context: {},
    })
    assert(error, 'expected account-less recipient to fail')
    assert(errorContains(error, 'no connected account'), `got: ${error?.message}`)
  })

  await test('an unauthorized (cross-family) sender cannot propose into Family A', async () => {
    const { error } = await outsider.client.rpc('propose_care_handoff', {
      p_family_id: famA, p_to_person_id: jamesPid, p_context: {},
    })
    assert(error, 'expected outsider propose to fail')
    assert(errorContains(error, 'not authorized'), `got: ${error?.message}`)
  })

  await test('recipient accepts → holder moves atomically to the recipient', async () => {
    const p = await owner.client.rpc('propose_care_handoff', { p_family_id: famA, p_to_person_id: jamesPid, p_context: {} })
    const hid = p.data as string
    // Another member (Sarah) cannot accept for James.
    const bad = await other.client.rpc('accept_care_handoff', { p_handoff_id: hid })
    assert(bad.error, 'expected non-recipient accept to fail')
    assert(errorContains(bad.error, 'only the recipient'), `got: ${bad.error?.message}`)
    // James accepts.
    const { error } = await partner.client.rpc('accept_care_handoff', { p_handoff_id: hid })
    assert(!error, `accept failed: ${error?.message}`)
    assertEqual((await handoffRow(A, hid))?.status, 'accepted', 'handoff accepted')
    assertEqual(await currentHolder(A, famA), jamesPid, 'holder moved to James atomically')
    // Duplicate accept is safe.
    const dup = await partner.client.rpc('accept_care_handoff', { p_handoff_id: hid })
    assert(!dup.error, 'duplicate accept safe')
    assertEqual(await currentHolder(A, famA), jamesPid, 'holder still James')
  })

  await test('decline: holder unchanged, no implied transfer', async () => {
    // James (current holder) proposes back to Sarah; Sarah declines.
    const p = await partner.client.rpc('propose_care_handoff', { p_family_id: famA, p_to_person_id: sarahPid, p_context: {} })
    const hid = p.data as string
    const { error } = await other.client.rpc('decline_care_handoff', { p_handoff_id: hid })
    assert(!error, `decline failed: ${error?.message}`)
    assertEqual((await handoffRow(A, hid))?.status, 'declined', 'declined')
    assertEqual(await currentHolder(A, famA), jamesPid, 'holder still James after decline')
  })

  await test('stale accept after decline is rejected', async () => {
    const p = await partner.client.rpc('propose_care_handoff', { p_family_id: famA, p_to_person_id: sarahPid, p_context: {} })
    const hid = p.data as string
    await other.client.rpc('decline_care_handoff', { p_handoff_id: hid })
    const { error } = await other.client.rpc('accept_care_handoff', { p_handoff_id: hid })
    assert(error, 'expected stale accept to fail')
    assert(errorContains(error, 'no longer pending'), `got: ${error?.message}`)
    assertEqual(await currentHolder(A, famA), jamesPid, 'holder unchanged')
  })

  await test('cancel: sender cancels pending; recipient can no longer accept (stale)', async () => {
    const p = await partner.client.rpc('propose_care_handoff', { p_family_id: famA, p_to_person_id: sarahPid, p_context: {} })
    const hid = p.data as string
    // James is the current holder / proposer → may cancel.
    const c = await partner.client.rpc('cancel_care_handoff', { p_handoff_id: hid })
    assert(!c.error, `cancel failed: ${c.error?.message}`)
    assertEqual((await handoffRow(A, hid))?.status, 'cancelled', 'cancelled')
    const { error } = await other.client.rpc('accept_care_handoff', { p_handoff_id: hid })
    assert(error, 'expected stale accept after cancel to fail')
    assert(errorContains(error, 'no longer pending'), `got: ${error?.message}`)
    assertEqual(await currentHolder(A, famA), jamesPid, 'holder unchanged')
  })

  await test('direct client writes cannot forge an accepted handoff or move the holder', async () => {
    const p = await partner.client.rpc('propose_care_handoff', { p_family_id: famA, p_to_person_id: sarahPid, p_context: {} })
    const hid = p.data as string
    // Sarah tries to directly flip the handoff to accepted + set herself holder.
    await other.client.from('care_handoffs').update({ status: 'accepted' }).eq('id', hid)
    await other.client.from('care_responsibility').update({ holder_person_id: sarahPid }).eq('family_id', famA)
    assertEqual((await handoffRow(A, hid))?.status, 'pending', 'handoff still pending (RLS blocks update)')
    assertEqual(await currentHolder(A, famA), jamesPid, 'holder not forged')
    // clean up
    await partner.client.rpc('cancel_care_handoff', { p_handoff_id: hid })
  })

  await test('cross-family cannot read Family A care rows', async () => {
    const { data: cr } = await outsider.client.from('care_responsibility').select('id').eq('family_id', famA)
    assertEqual((cr ?? []).length, 0, 'outsider reads zero care_responsibility rows')
    const { data: ch } = await outsider.client.from('care_handoffs').select('id').eq('family_id', famA)
    assertEqual((ch ?? []).length, 0, 'outsider reads zero care_handoffs rows')
  })

  await cleanupUsers(A)
  finish()
}

main().catch((e) => {
  console.error('Fatal:', e instanceof Error ? e.message : e)
  process.exit(1)
})
