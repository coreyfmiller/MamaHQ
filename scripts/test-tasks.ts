// MamaHQ — Step 8 Tasks, Responsibilities & Ownership tests.
//
// Runs against a LOCAL/CI Supabase stack (never production) with REAL authenticated
// JWTs, so PostgreSQL RLS + the SECURITY DEFINER RPC authorization genuinely
// execute. Covers Step 8 §43/§27/§28: creation (+ idempotent retry), assignment
// (self / partner / unconnected person / cross-family reject / nonexistent reject),
// reassignment (history preserved), completion (any adult, actor retained, ownership
// retained, duplicate-safe), reopen (metadata cleared, ownership preserved),
// household sharing + "Mine" semantics + creator≠owner, RLS isolation (Family B
// blocked from read/create/mutate/history), and ownership by an account-less person.
//
// Run: node scripts/test-tasks.ts  (env: SUPABASE_URL, SUPABASE_ANON_KEY,
//                                    SUPABASE_SERVICE_ROLE_KEY)

import { createHash, randomBytes } from 'node:crypto'
import {
  admin, createUser, makeRunner, assert, assertEqual, errorContains, cleanupUsers,
  type Client, type TestUser,
} from './db/harness.ts'

const A = admin()
const { test, finish } = makeRunner('Tasks / Ownership')

async function ensureFamily(u: TestUser): Promise<string> {
  const { data, error } = await u.client.rpc('ensure_family')
  assert(!error, `ensure_family failed: ${error?.message}`)
  return data as string
}

// Add an account-less household person (as an authenticated member of the family).
async function addPerson(client: Client, familyId: string, name: string, relationship = 'member'): Promise<string> {
  const { data, error } = await client
    .from('household_people')
    .insert({ family_id: familyId, display_name: name, relationship })
    .select('id')
    .single()
  assert(!error, `insert household_people failed: ${error?.message}`)
  return (data as { id: string }).id
}

// Resolve the current user's connected person id in a family (the owner-person).
async function myPersonId(client: Client, familyId: string, userId: string): Promise<string> {
  const { data, error } = await client
    .from('household_people')
    .select('id')
    .eq('family_id', familyId)
    .eq('user_id', userId)
    .maybeSingle()
  assert(!error, `resolve my person failed: ${error?.message}`)
  assert(data, 'expected a connected owner-person to exist')
  return (data as { id: string }).id
}

async function createTask(
  client: Client,
  familyId: string,
  title: string,
  opts: { assignee?: string | null; due?: string | null; clientId?: string | null } = {},
): Promise<string> {
  const { data, error } = await client.rpc('create_task', {
    p_family_id: familyId,
    p_title: title,
    p_assigned_to_person_id: opts.assignee ?? null,
    p_due_at: opts.due ?? null,
    p_notes: null,
    p_source: 'manual',
    p_client_task_id: opts.clientId ?? null,
  })
  assert(!error, `create_task failed: ${error?.message}`)
  return data as string
}

async function taskRow(client: Client, taskId: string) {
  const { data } = await client.from('tasks').select('*').eq('id', taskId).maybeSingle()
  return data as {
    id: string
    family_id: string
    status: string
    assigned_to_person_id: string | null
    created_by_user_id: string | null
    completed_by_user_id: string | null
    completed_at: string | null
  } | null
}

async function events(client: Client, familyId: string, taskId: string) {
  const { data } = await client
    .from('task_events').select('event_type, actor_user_id, prev_person_id, new_person_id')
    .eq('family_id', familyId).eq('task_id', taskId).order('created_at', { ascending: true })
  return (data ?? []) as { event_type: string; actor_user_id: string | null; prev_person_id: string | null; new_person_id: string | null }[]
}

// Link an existing person to a partner user via a real invitation (so the partner is
// an authorized member with a connected person). Mirrors the Step 7 flow.
async function invitePartner(owner: TestUser, familyId: string, personId: string, partner: TestUser): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const hash = createHash('sha256').update(token).digest('hex')
  const { error: cErr } = await owner.client.rpc('create_household_invitation', {
    p_person_id: personId, p_token_hash: hash, p_email: null, p_ttl_seconds: 604800,
  })
  assert(!cErr, `create invite failed: ${cErr?.message}`)
  const { error: aErr } = await partner.client.rpc('accept_household_invitation', { p_token_hash: hash })
  assert(!aErr, `accept invite failed: ${aErr?.message}`)
}

async function main() {
  await cleanupUsers(A)

  const owner = await createUser(A, 'task-owner')     // Mom
  const partner = await createUser(A, 'task-partner') // James (will be a member)
  const outsider = await createUser(A, 'task-outsider')

  const famA = await ensureFamily(owner)
  const famB = await ensureFamily(outsider)
  assert(famA !== famB, 'two independent families must have distinct ids')

  const ownerPid = await myPersonId(owner.client, famA, owner.id) // Mom's person
  // James: an existing account-less person that we then connect via invitation.
  const jamesPid = await addPerson(owner.client, famA, 'James', 'partner')
  await invitePartner(owner, famA, jamesPid, partner)
  const grandmaPid = await addPerson(owner.client, famA, 'Grandma', 'grandparent') // no account, ever
  const famBPersonId = await myPersonId(outsider.client, famB, outsider.id)

  // ========================================================================
  // CREATION
  // ========================================================================
  await test('owner creates an unassigned task; a created event exists', async () => {
    const id = await createTask(owner.client, famA, 'Buy birthday card for Emma')
    const row = await taskRow(owner.client, id)
    assertEqual(row?.status, 'open', 'new task is open')
    assertEqual(row?.assigned_to_person_id, null, 'new task is unassigned')
    assertEqual(row?.created_by_user_id, owner.id, 'creator is the owner user')
    const ev = await events(owner.client, famA, id)
    assertEqual(ev.length, 1, 'exactly one event')
    assertEqual(ev[0].event_type, 'created', 'the event is created')
  })

  await test('partner (member) can create a task', async () => {
    const id = await createTask(partner.client, famA, 'Partner-created task')
    const row = await taskRow(partner.client, id)
    assertEqual(row?.created_by_user_id, partner.id, 'creator is the partner user')
    assertEqual(row?.status, 'open', 'open')
  })

  await test('create is idempotent on client task id (retry does not duplicate)', async () => {
    const cid = randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
    const id1 = await createTask(owner.client, famA, 'Retry-safe task', { clientId: cid })
    const id2 = await createTask(owner.client, famA, 'Retry-safe task', { clientId: cid })
    assertEqual(id1, id2, 'same id returned on retry')
    const { count } = await A.from('tasks').select('*', { count: 'exact', head: true }).eq('id', cid)
    assertEqual(count, 1, 'exactly one task row')
    const ev = await events(owner.client, famA, id1)
    assertEqual(ev.filter((e) => e.event_type === 'created').length, 1, 'only one created event')
  })

  await test('creating an already-assigned task records created + assigned events', async () => {
    const id = await createTask(owner.client, famA, 'Call pediatrician', { assignee: jamesPid })
    const row = await taskRow(owner.client, id)
    assertEqual(row?.assigned_to_person_id, jamesPid, 'owned by James')
    const ev = await events(owner.client, famA, id)
    assertEqual(ev.length, 2, 'created + assigned')
    assertEqual(ev[0].event_type, 'created', 'first is created')
    assertEqual(ev[1].event_type, 'assigned', 'second is assigned')
    assertEqual(ev[1].new_person_id, jamesPid, 'assigned to James')
  })

  // ========================================================================
  // ASSIGNMENT + integrity (§28)
  // ========================================================================
  await test('assign to self (the owner-person) works', async () => {
    const id = await createTask(owner.client, famA, 'Assign to me')
    const { error } = await owner.client.rpc('assign_task', { p_task_id: id, p_person_id: ownerPid })
    assert(!error, `assign failed: ${error?.message}`)
    assertEqual((await taskRow(owner.client, id))?.assigned_to_person_id, ownerPid, 'owned by Mom')
  })

  await test('assign to an unconnected (account-less) Family A person is allowed', async () => {
    const id = await createTask(owner.client, famA, 'Pick Madelyn up from school')
    const { error } = await owner.client.rpc('assign_task', { p_task_id: id, p_person_id: grandmaPid })
    assert(!error, `assign to account-less person failed: ${error?.message}`)
    assertEqual((await taskRow(owner.client, id))?.assigned_to_person_id, grandmaPid, 'owned by Grandma (no account)')
  })

  await test('assigning a Family B person to a Family A task is REJECTED', async () => {
    const id = await createTask(owner.client, famA, 'Cross-family attempt')
    const { error } = await owner.client.rpc('assign_task', { p_task_id: id, p_person_id: famBPersonId })
    assert(error, 'expected cross-family assignment to fail')
    assert(errorContains(error, 'not in this family'), `expected family mismatch error, got: ${error?.message}`)
    assertEqual((await taskRow(owner.client, id))?.assigned_to_person_id, null, 'still unassigned')
  })

  await test('assigning a nonexistent person is REJECTED', async () => {
    const id = await createTask(owner.client, famA, 'Ghost assignee')
    const fake = '00000000-0000-0000-0000-000000000000'
    const { error } = await owner.client.rpc('assign_task', { p_task_id: id, p_person_id: fake })
    assert(error, 'expected nonexistent person to fail')
    assert(errorContains(error, 'not found'), `expected not-found, got: ${error?.message}`)
  })

  await test('creating a Family A task assigned to a Family B person is REJECTED', async () => {
    const { error } = await owner.client.rpc('create_task', {
      p_family_id: famA, p_title: 'Cross-family create', p_assigned_to_person_id: famBPersonId,
      p_due_at: null, p_notes: null, p_source: 'manual', p_client_task_id: null,
    })
    assert(error, 'expected cross-family create-assign to fail')
    assert(errorContains(error, 'not in this family'), `expected family mismatch, got: ${error?.message}`)
  })

  // ========================================================================
  // REASSIGNMENT (§10, §32)
  // ========================================================================
  await test('reassign James → Mom: current owner updated, history preserved, one reassigned event', async () => {
    const id = await createTask(owner.client, famA, 'Pick up prescription', { assignee: jamesPid })
    const { error } = await owner.client.rpc('assign_task', { p_task_id: id, p_person_id: ownerPid })
    assert(!error, `reassign failed: ${error?.message}`)
    assertEqual((await taskRow(owner.client, id))?.assigned_to_person_id, ownerPid, 'now owned by Mom')
    const ev = await events(owner.client, famA, id)
    // created, assigned(James), reassigned(James→Mom)
    assertEqual(ev.length, 3, 'created + assigned + reassigned')
    const re = ev.find((e) => e.event_type === 'reassigned')
    assert(re, 'a reassigned event exists')
    assertEqual(re?.prev_person_id, jamesPid, 'previous owner James preserved')
    assertEqual(re?.new_person_id, ownerPid, 'new owner Mom')
  })

  await test('assigning the same owner again is a no-op (no duplicate event)', async () => {
    const id = await createTask(owner.client, famA, 'No-op reassign', { assignee: jamesPid })
    await owner.client.rpc('assign_task', { p_task_id: id, p_person_id: jamesPid }) // same owner
    const ev = await events(owner.client, famA, id)
    assertEqual(ev.filter((e) => e.event_type === 'reassigned').length, 0, 'no reassigned event for a no-op')
  })

  // ========================================================================
  // COMPLETION (§8)
  // ========================================================================
  await test('the assignee completes their task; completer + ownership both retained', async () => {
    const id = await createTask(owner.client, famA, 'James completes his task', { assignee: jamesPid })
    const { error } = await partner.client.rpc('complete_task', { p_task_id: id })
    assert(!error, `complete failed: ${error?.message}`)
    const row = await taskRow(owner.client, id)
    assertEqual(row?.status, 'completed', 'completed')
    assertEqual(row?.completed_by_user_id, partner.id, 'completed by James')
    assertEqual(row?.assigned_to_person_id, jamesPid, 'still owned by James')
  })

  await test('a different authorized adult may complete; owner unchanged, completer recorded', async () => {
    // Owner=James, completed by Mom. Both facts remain true and distinct.
    const id = await createTask(owner.client, famA, 'Take garbage out', { assignee: jamesPid })
    const { error } = await owner.client.rpc('complete_task', { p_task_id: id })
    assert(!error, `complete-by-other failed: ${error?.message}`)
    const row = await taskRow(owner.client, id)
    assertEqual(row?.completed_by_user_id, owner.id, 'completed by Mom')
    assertEqual(row?.assigned_to_person_id, jamesPid, 'owner remains James (ownership not rewritten)')
  })

  await test('duplicate completion does not create a duplicate completed event', async () => {
    const id = await createTask(owner.client, famA, 'Double complete')
    await owner.client.rpc('complete_task', { p_task_id: id })
    await owner.client.rpc('complete_task', { p_task_id: id }) // retry / race
    const ev = await events(owner.client, famA, id)
    assertEqual(ev.filter((e) => e.event_type === 'completed').length, 1, 'exactly one completed event')
  })

  // ========================================================================
  // REOPEN (§9)
  // ========================================================================
  await test('reopen a completed task: status open, completion metadata cleared, ownership preserved, reopened event', async () => {
    const id = await createTask(owner.client, famA, 'Reopen me', { assignee: jamesPid })
    await partner.client.rpc('complete_task', { p_task_id: id })
    const { error } = await owner.client.rpc('reopen_task', { p_task_id: id })
    assert(!error, `reopen failed: ${error?.message}`)
    const row = await taskRow(owner.client, id)
    assertEqual(row?.status, 'open', 'open again')
    assertEqual(row?.completed_at, null, 'completed_at cleared')
    assertEqual(row?.completed_by_user_id, null, 'completed_by cleared')
    assertEqual(row?.assigned_to_person_id, jamesPid, 'ownership preserved through reopen')
    const ev = await events(owner.client, famA, id)
    assertEqual(ev.filter((e) => e.event_type === 'reopened').length, 1, 'one reopened event')
  })

  await test('reopening an already-open task is a no-op (no event)', async () => {
    const id = await createTask(owner.client, famA, 'Already open')
    await owner.client.rpc('reopen_task', { p_task_id: id })
    const ev = await events(owner.client, famA, id)
    assertEqual(ev.filter((e) => e.event_type === 'reopened').length, 0, 'no reopened event')
  })

  // ========================================================================
  // HOUSEHOLD + "Mine" + creator ≠ owner (§24, §7, §25)
  // ========================================================================
  await test('both authenticated adults see the same task (shared household state)', async () => {
    const id = await createTask(owner.client, famA, 'Shared visibility', { assignee: jamesPid })
    const { data: seen } = await partner.client.from('tasks').select('id').eq('id', id)
    assertEqual((seen ?? []).length, 1, 'partner sees the owner-created task')
  })

  await test('"Mine" resolves through the linked HouseholdPerson, not the creator', async () => {
    // Mom creates a task and assigns it to James. It is JAMES's ("Mine" for James),
    // not Mom's, even though Mom created it.
    const id = await createTask(owner.client, famA, 'Mom made, James owns', { assignee: jamesPid })
    // James's "Mine": tasks whose assignee is James's person.
    const { data: jamesMine } = await partner.client
      .from('tasks').select('id').eq('family_id', famA).eq('assigned_to_person_id', jamesPid)
    assert((jamesMine ?? []).some((t) => (t as { id: string }).id === id), 'task appears under James (owner)')
    // Mom's "Mine": tasks assigned to Mom's person — this one must NOT appear.
    const { data: momMine } = await owner.client
      .from('tasks').select('id').eq('family_id', famA).eq('assigned_to_person_id', ownerPid)
    assert(!(momMine ?? []).some((t) => (t as { id: string }).id === id), 'not in Mom\'s Mine despite Mom creating it')
  })

  // ========================================================================
  // SECURITY / RLS — Family B is fully blocked (§27)
  // ========================================================================
  await test('Family B cannot READ Family A tasks', async () => {
    const id = await createTask(owner.client, famA, 'A-private task')
    const { data } = await outsider.client.from('tasks').select('id').eq('id', id)
    assertEqual((data ?? []).length, 0, 'outsider reads zero Family A tasks')
  })

  await test('Family B cannot CREATE into Family A', async () => {
    const { error } = await outsider.client.rpc('create_task', {
      p_family_id: famA, p_title: 'Intruder task', p_assigned_to_person_id: null,
      p_due_at: null, p_notes: null, p_source: 'manual', p_client_task_id: null,
    })
    assert(error, 'expected outsider create into Family A to fail')
    assert(errorContains(error, 'not authorized'), `expected authorization error, got: ${error?.message}`)
  })

  await test('Family B cannot COMPLETE / REASSIGN a Family A task', async () => {
    const id = await createTask(owner.client, famA, 'A task the outsider will attack', { assignee: jamesPid })
    const c = await outsider.client.rpc('complete_task', { p_task_id: id })
    assert(c.error, 'expected outsider complete to fail')
    assert(errorContains(c.error, 'not authorized'), `expected auth error on complete, got: ${c.error?.message}`)
    const r = await outsider.client.rpc('assign_task', { p_task_id: id, p_person_id: famBPersonId })
    assert(r.error, 'expected outsider reassign to fail')
    // Verify (as service role) the task is untouched.
    const row = await taskRow(A, id)
    assertEqual(row?.status, 'open', 'task not completed by outsider')
    assertEqual(row?.assigned_to_person_id, jamesPid, 'owner not changed by outsider')
  })

  await test('direct client INSERT into tasks is blocked by RLS (writes go via RPC)', async () => {
    const { error } = await owner.client.from('tasks').insert({ family_id: famA, title: 'Direct insert' })
    assert(error, 'expected direct client insert to be blocked')
  })

  await test('direct client UPDATE of a task is blocked by RLS (no silent status flip)', async () => {
    const id = await createTask(owner.client, famA, 'No direct update')
    await owner.client.from('tasks').update({ status: 'completed' }).eq('id', id)
    const row = await taskRow(A, id) // service role read = ground truth
    assertEqual(row?.status, 'open', 'status unchanged by a direct client update')
  })

  await test('Family B cannot read Family A task events (history)', async () => {
    const id = await createTask(owner.client, famA, 'History privacy', { assignee: jamesPid })
    const { data } = await outsider.client.from('task_events').select('id').eq('task_id', id)
    assertEqual((data ?? []).length, 0, 'outsider reads zero Family A events')
  })

  // ========================================================================
  // HISTORICAL PERSON — account status does not define ownership (§14, §15)
  // ========================================================================
  await test('a task may be owned by an account-less person; ownership persists', async () => {
    const id = await createTask(owner.client, famA, 'Grandma owns this', { assignee: grandmaPid })
    const row = await taskRow(owner.client, id)
    assertEqual(row?.assigned_to_person_id, grandmaPid, 'owned by an account-less person')
    // Grandma has no user_id; confirm she genuinely has no account.
    const { data: g } = await A.from('household_people').select('user_id').eq('id', grandmaPid).maybeSingle()
    assertEqual((g as { user_id: string | null })?.user_id, null, 'Grandma has no account')
  })

  await cleanupUsers(A)
  finish()
}

main().catch((e) => {
  console.error('Fatal:', e instanceof Error ? e.message : e)
  process.exit(1)
})
