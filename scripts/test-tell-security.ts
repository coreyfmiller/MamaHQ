// MamaHQ — Tell MamaHQ execution-boundary security tests (Step 12).
//
// Runs against a LOCAL/CI Supabase stack with REAL JWTs. Tell MamaHQ's interpreter
// is not exercised here (that needs a live model); these tests instead prove the
// SECURITY BOUNDARY that matters: even if the AI (or a tampering client) proposes
// something, EXECUTION goes only through the trusted domain RPCs, which enforce
// authorization, cross-family integrity, assignment≠acceptance, and idempotency.
// This mirrors exactly what lib/tell/execute.ts does (same RPCs, same client-id
// idempotency keys), so it proves the real execution path is safe.
//
//   AI proposes. MamaHQ validates. The user approves. Trusted domains execute.
//
// Covers Step 12 §86: unauth rejected (route-level, documented), client cannot pick
// another family, cross-family person reference rejected, tampered proposal rejected,
// model-generated arbitrary uuid rejected, execution passes through domain authz,
// AI cannot mark a task accepted for someone else, AI cannot accept a handoff for
// someone else, AI cannot forge notifications, AI cannot write arbitrary tables,
// and retries do not duplicate.
//
//   node scripts/test-tell-security.ts   (npm run test:tell-security)

import { createHash, randomBytes } from 'node:crypto'
import {
  admin, createUser, makeRunner, assert, assertEqual, errorContains, cleanupUsers,
  type Client, type TestUser,
} from './db/harness.ts'

const A = admin()
const { test, finish } = makeRunner('Tell MamaHQ / Execution Security')

async function ensureFamily(u: TestUser): Promise<string> {
  const { data, error } = await u.client.rpc('ensure_family')
  assert(!error, `ensure_family failed: ${error?.message}`)
  return data as string
}
async function addPerson(client: Client, familyId: string, name: string, rel = 'member'): Promise<string> {
  const { data, error } = await client.from('household_people').insert({ family_id: familyId, display_name: name, relationship: rel }).select('id').single()
  assert(!error, `insert person failed: ${error?.message}`)
  return (data as { id: string }).id
}
async function myPersonId(client: Client, familyId: string, userId: string): Promise<string> {
  const { data } = await client.from('household_people').select('id').eq('family_id', familyId).eq('user_id', userId).maybeSingle()
  return (data as { id: string }).id
}
async function invitePartner(owner: TestUser, personId: string, partner: TestUser): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const hash = createHash('sha256').update(token).digest('hex')
  await owner.client.rpc('create_household_invitation', { p_person_id: personId, p_token_hash: hash, p_email: null, p_ttl_seconds: 604800 })
  await partner.client.rpc('accept_household_invitation', { p_token_hash: hash })
}

// Mirror of lib/tell/execute.ts id derivation, so idempotency is proven for the
// EXACT keys the dispatcher uses.
const taskClientId = (proposalId: string) => `tell-task-${proposalId}`
const eventClientId = (proposalId: string) => `tell-event-${proposalId}`

async function taskRow(client: Client, id: string) {
  const { data } = await client.from('tasks').select('*').eq('id', id).maybeSingle()
  return data as { id: string; status: string; acknowledged_at: string | null; source: string; assigned_to_person_id: string | null } | null
}

async function main() {
  await cleanupUsers(A)

  const mom = await createUser(A, 'tell-mom')
  const james = await createUser(A, 'tell-james')
  const outsider = await createUser(A, 'tell-outsider')

  const famA = await ensureFamily(mom)
  const famB = await ensureFamily(outsider)
  assert(famA !== famB, 'distinct families')

  const jamesPid = await addPerson(mom.client, famA, 'James', 'partner')
  await invitePartner(mom, jamesPid, james)
  const grandmaPid = await addPerson(mom.client, famA, 'Grandma', 'grandparent') // account-less
  const famBPid = await myPersonId(outsider.client, famB, outsider.id)

  // ========================================================================
  // EXECUTION PASSES THROUGH DOMAIN AUTHORIZATION
  // ========================================================================
  await test('a Tell task execution creates a normal task with tell_mamahq provenance, NO acceptance', async () => {
    const proposalId = randomBytes(6).toString('hex')
    const { data, error } = await mom.client.rpc('create_task', {
      p_family_id: famA, p_title: 'Call dentist', p_assigned_to_person_id: jamesPid,
      p_due_at: null, p_notes: null, p_source: 'tell_mamahq', p_client_task_id: taskClientId(proposalId),
    })
    assert(!error, `create failed: ${error?.message}`)
    const row = await taskRow(A, data as string)
    assertEqual(row?.source, 'tell_mamahq', 'provenance recorded as tell_mamahq')
    assertEqual(row?.acknowledged_at, null, 'assignment did NOT record acceptance (assignment ≠ acceptance)')
  })

  await test('a Tell task retry with the same proposal id does NOT duplicate', async () => {
    const proposalId = randomBytes(6).toString('hex')
    const args = {
      p_family_id: famA, p_title: 'Order photos', p_assigned_to_person_id: jamesPid,
      p_due_at: null, p_notes: null, p_source: 'tell_mamahq', p_client_task_id: taskClientId(proposalId),
    }
    const r1 = await mom.client.rpc('create_task', args)
    const r2 = await mom.client.rpc('create_task', args) // retry (double-click / timeout)
    assertEqual(r1.data, r2.data, 'same task id returned on retry')
    const { count } = await A.from('tasks').select('*', { count: 'exact', head: true }).eq('id', r1.data as string)
    assertEqual(count, 1, 'exactly one task row (idempotent)')
  })

  await test('a Tell calendar retry with the same proposal id does NOT duplicate', async () => {
    const proposalId = randomBytes(6).toString('hex')
    const soon = new Date(Date.now() + 3 * 3600_000).toISOString()
    const args = {
      p_family_id: famA, p_title: 'Soccer', p_all_day: false, p_starts_at: soon, p_ends_at: null,
      p_start_date: null, p_end_date: null, p_location: null, p_notes: null,
      p_responsible_person_id: null, p_participant_ids: null, p_client_event_id: eventClientId(proposalId),
    }
    const r1 = await mom.client.rpc('create_calendar_event', args)
    const r2 = await mom.client.rpc('create_calendar_event', args)
    assertEqual(r1.data, r2.data, 'same event id on retry')
    const { count } = await A.from('calendar_events').select('*', { count: 'exact', head: true }).eq('id', r1.data as string)
    assertEqual(count, 1, 'exactly one event row (idempotent)')
  })

  // ========================================================================
  // TAMPERED / CROSS-FAMILY PROPOSAL → REJECTED BY THE DOMAIN
  // ========================================================================
  await test('a tampered task assignee (cross-family person) is rejected at execution', async () => {
    const { error } = await mom.client.rpc('create_task', {
      p_family_id: famA, p_title: 'Tampered', p_assigned_to_person_id: famBPid, // client swapped in a foreign person id
      p_due_at: null, p_notes: null, p_source: 'tell_mamahq', p_client_task_id: taskClientId(randomBytes(6).toString('hex')),
    })
    assert(error, 'expected cross-family assignee to be rejected')
    assert(errorContains(error, 'not in this family') || errorContains(error, 'not found'), `got: ${error?.message}`)
  })

  await test('a tampered calendar responsible (cross-family) is rejected at execution', async () => {
    const soon = new Date(Date.now() + 3 * 3600_000).toISOString()
    const { error } = await mom.client.rpc('create_calendar_event', {
      p_family_id: famA, p_title: 'Tampered', p_all_day: false, p_starts_at: soon, p_ends_at: null,
      p_start_date: null, p_end_date: null, p_location: null, p_notes: null,
      p_responsible_person_id: famBPid, p_participant_ids: null, p_client_event_id: eventClientId(randomBytes(6).toString('hex')),
    })
    assert(error, 'expected cross-family responsible to be rejected')
    assert(errorContains(error, 'not in this family'), `got: ${error?.message}`)
  })

  await test('a model-invented (random) uuid person reference is rejected at execution', async () => {
    const bogus = randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
    const { error } = await mom.client.rpc('create_task', {
      p_family_id: famA, p_title: 'Bogus person', p_assigned_to_person_id: bogus,
      p_due_at: null, p_notes: null, p_source: 'tell_mamahq', p_client_task_id: taskClientId(randomBytes(6).toString('hex')),
    })
    assert(error, 'expected a random uuid assignee to be rejected')
    assert(errorContains(error, 'not found') || errorContains(error, 'not in this family'), `got: ${error?.message}`)
  })

  await test('client cannot execute into another family (family id is validated by RLS/RPC)', async () => {
    // Outsider tries to create a task into Family A.
    const { error } = await outsider.client.rpc('create_task', {
      p_family_id: famA, p_title: 'Intruder', p_assigned_to_person_id: null,
      p_due_at: null, p_notes: null, p_source: 'tell_mamahq', p_client_task_id: taskClientId(randomBytes(6).toString('hex')),
    })
    assert(error, 'expected cross-family create to be rejected')
    assert(errorContains(error, 'not authorized'), `got: ${error?.message}`)
  })

  // ========================================================================
  // AI CANNOT FORGE ACCEPTANCE / HANDOFF ACCEPTANCE
  // ========================================================================
  await test('executing a Tell task assignment can NEVER mark it accepted for the assignee', async () => {
    // The ONLY way to accept is accept_task, restricted to the assignee's account.
    // There is no execute path that sets acknowledgement, so a Tell-created+assigned
    // task is unaccepted until James himself accepts.
    const { data } = await mom.client.rpc('create_task', {
      p_family_id: famA, p_title: 'Prescription', p_assigned_to_person_id: jamesPid,
      p_due_at: null, p_notes: null, p_source: 'tell_mamahq', p_client_task_id: taskClientId(randomBytes(6).toString('hex')),
    })
    assertEqual((await taskRow(A, data as string))?.acknowledged_at, null, 'not accepted by the AI/execution path')
    // Mom (not the assignee) cannot accept on James's behalf even directly.
    const { error } = await mom.client.rpc('accept_task', { p_task_id: data as string })
    assert(error, 'a non-assignee cannot accept')
  })

  await test('care handoff proposal to an account-less person is rejected at execution', async () => {
    // execute.ts blocks this pre-flight, and the RPC also rejects it. Prove the RPC.
    const { error } = await mom.client.rpc('propose_care_handoff', { p_family_id: famA, p_to_person_id: grandmaPid, p_context: {} })
    assert(error, 'expected account-less handoff recipient to be rejected')
    assert(errorContains(error, 'no connected account') || errorContains(error, 'cannot accept'), `got: ${error?.message}`)
  })

  await test('a Tell care handoff proposal never transfers care (holder unchanged)', async () => {
    // Ensure responsibility exists (Mom becomes initial holder), then propose to James.
    await mom.client.rpc('ensure_care_responsibility', { p_family_id: famA })
    const before = await A.from('care_responsibility').select('holder_person_id').eq('family_id', famA).maybeSingle()
    const { error } = await mom.client.rpc('propose_care_handoff', { p_family_id: famA, p_to_person_id: jamesPid, p_context: {} })
    assert(!error, `propose failed: ${error?.message}`)
    const after = await A.from('care_responsibility').select('holder_person_id').eq('family_id', famA).maybeSingle()
    assertEqual(
      (after.data as { holder_person_id: string | null })?.holder_person_id,
      (before.data as { holder_person_id: string | null })?.holder_person_id,
      'holder unchanged by a proposal (only the recipient accepting moves it)',
    )
  })

  // ========================================================================
  // AI CANNOT WRITE ARBITRARY TABLES / FORGE NOTIFICATIONS
  // ========================================================================
  await test('the execution path cannot directly INSERT a notification (RLS blocks it)', async () => {
    // Tell MamaHQ never inserts notifications; domains do. Prove a client insert is
    // blocked regardless (so even a compromised client cannot forge one).
    const { error } = await mom.client.from('notifications').insert({
      family_id: famA, recipient_user_id: james.id, type: 'task_assigned', domain: 'task',
      title: 'Forged by AI', dedupe_key: `tell-forge-${randomBytes(6).toString('hex')}`,
    })
    assert(error, 'expected direct notification insert to be blocked')
  })

  await test('the execution path cannot directly INSERT a task row (RLS: RPC-only writes)', async () => {
    const { error } = await mom.client.from('tasks').insert({ family_id: famA, title: 'Direct write' })
    assert(error, 'expected direct task insert to be blocked (writes go through create_task)')
  })

  await cleanupUsers(A)
  finish()
}

main().catch((e) => {
  console.error('Fatal:', e instanceof Error ? e.message : e)
  process.exit(1)
})
