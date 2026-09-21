// MamaHQ — Step 11 Realtime & Notifications tests (notification layer).
//
// Runs against a LOCAL/CI Supabase stack (never production) with REAL authenticated
// JWTs, so RLS + the SECURITY DEFINER generation/read-state RPCs genuinely execute.
// Realtime websocket behavior itself cannot be proven deterministically in CI (see
// docs/MANUAL_QA.md — manual realtime QA stays OUTSTANDING); these tests instead
// prove the DURABLE, TRUSTED foundation realtime rides on: who gets notified, who
// can read it, self-suppression, dedupe, and that notifications never become domain
// truth. Covers Step 11 §36/§37.
//
//   Recipient security — intended recipient reads; same-family non-recipient cannot;
//     outsider cannot; recipient marks own read; another user cannot mark it read;
//     cross-family cannot mark read; direct client INSERT is blocked (no forgery).
//   Generation — task assignment notifies the assignee; self-assignment does NOT
//     self-notify; acceptance notifies the creator; care-handoff proposal notifies
//     the recipient; care-handoff acceptance notifies the proposer; calendar
//     responsibility assignment notifies the responsible person; an account-less
//     responsible person produces NO (impossible) digital notification.
//   Dedupe — a retried/idempotent domain op produces ONE notification.
//   Domain independence — reading a notification does not mutate task/care/calendar.
//
// Run: node scripts/test-notifications.ts  (env: SUPABASE_URL, SUPABASE_ANON_KEY,
//                                            SUPABASE_SERVICE_ROLE_KEY)

import { createHash, randomBytes } from 'node:crypto'
import {
  admin, createUser, makeRunner, assert, assertEqual, errorContains, cleanupUsers,
  type Client, type TestUser,
} from './db/harness.ts'

const A = admin()
const { test, finish } = makeRunner('Realtime / Notifications')

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

// Connect a partner account to an existing person via a real Step 7 invitation, so
// the person has a linked auth account that CAN receive notifications.
async function invitePartner(owner: TestUser, personId: string, partner: TestUser): Promise<void> {
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

// Read notifications AS a given user (RLS scopes to them). Service-role reads
// everything (used to assert generation from a trusted vantage point).
async function myNotifications(client: Client, opts: { type?: string; entityId?: string } = {}) {
  let q = client.from('notifications').select('*').order('created_at', { ascending: false })
  if (opts.type) q = q.eq('type', opts.type)
  if (opts.entityId) q = q.eq('entity_id', opts.entityId)
  const { data, error } = await q
  assert(!error, `read notifications failed: ${error?.message}`)
  return (data ?? []) as {
    id: string; family_id: string; recipient_user_id: string; actor_user_id: string | null
    type: string; domain: string; entity_id: string | null; title: string
    dedupe_key: string; read_at: string | null
  }[]
}

async function main() {
  await cleanupUsers(A)

  // Family A: Mom (owner) + James (connected partner). Family B: an outsider.
  const mom = await createUser(A, 'ntf-mom')
  const james = await createUser(A, 'ntf-james')
  const outsider = await createUser(A, 'ntf-outsider')

  const famA = await ensureFamily(mom)
  const famB = await ensureFamily(outsider)
  assert(famA !== famB, 'distinct families')

  const momPid = await myPersonId(mom.client, famA, mom.id)
  const jamesPid = await addPerson(mom.client, famA, 'James', 'partner')
  await invitePartner(mom, jamesPid, james) // James now has a linked account in famA
  const grandmaPid = await addPerson(mom.client, famA, 'Grandma', 'grandparent') // account-less
  const famBPid = await myPersonId(outsider.client, famB, outsider.id)

  // ========================================================================
  // GENERATION — task assignment
  // ========================================================================
  await test('assigning a task to another person notifies that person (task_assigned)', async () => {
    const taskId = await createTask(mom.client, famA, 'Pick up prescription')
    const { error } = await mom.client.rpc('assign_task', { p_task_id: taskId, p_person_id: jamesPid })
    assert(!error, `assign failed: ${error?.message}`)
    const jamesSees = await myNotifications(james.client, { type: 'task_assigned', entityId: taskId })
    assertEqual(jamesSees.length, 1, 'James has exactly one task_assigned notification')
    assertEqual(jamesSees[0].recipient_user_id, james.id, 'addressed to James')
    assertEqual(jamesSees[0].actor_user_id, mom.id, 'actor is Mom')
    assertEqual(jamesSees[0].domain, 'task', 'domain is task')
    assert(jamesSees[0].title.includes('Pick up prescription'), `human title: ${jamesSees[0].title}`)
  })

  await test('creating a task already-assigned to another person notifies them', async () => {
    const taskId = await createTask(mom.client, famA, 'Book pediatrician', jamesPid)
    const jamesSees = await myNotifications(james.client, { type: 'task_assigned', entityId: taskId })
    assertEqual(jamesSees.length, 1, 'assignment-at-create notified James')
  })

  await test('self-assignment does NOT create a self-notification', async () => {
    const taskId = await createTask(mom.client, famA, 'My own errand', momPid)
    const momSees = await myNotifications(mom.client, { type: 'task_assigned', entityId: taskId })
    assertEqual(momSees.length, 0, 'no self-notification for a task Mom assigned to herself')
  })

  await test('assigning to an account-less person creates no impossible digital notification', async () => {
    const taskId = await createTask(mom.client, famA, 'Grandma errand')
    await mom.client.rpc('assign_task', { p_task_id: taskId, p_person_id: grandmaPid })
    // Nobody has a linked account, so from the trusted (service-role) vantage there
    // should be zero notifications for this task.
    const all = await myNotifications(A, { type: 'task_assigned', entityId: taskId })
    assertEqual(all.length, 0, 'account-less assignee → no notification row at all')
  })

  // ========================================================================
  // GENERATION — task acceptance notifies the creator
  // ========================================================================
  await test('accepting a task notifies the creator (task_accepted); accepter is not self-notified', async () => {
    // Mom creates + assigns to James; James accepts → Mom (creator) is notified.
    const taskId = await createTask(mom.client, famA, 'Return library books', jamesPid)
    const { error } = await james.client.rpc('accept_task', { p_task_id: taskId })
    assert(!error, `accept failed: ${error?.message}`)
    const momSees = await myNotifications(mom.client, { type: 'task_accepted', entityId: taskId })
    assertEqual(momSees.length, 1, 'creator Mom notified that James has it')
    assert(momSees[0].title.toLowerCase().includes('has it'), `human title: ${momSees[0].title}`)
    const jamesSees = await myNotifications(james.client, { type: 'task_accepted', entityId: taskId })
    assertEqual(jamesSees.length, 0, 'James (the accepter) is not self-notified')
  })

  // ========================================================================
  // GENERATION — care handoff
  // ========================================================================
  await test('proposing a care handoff notifies the recipient (care_handoff_proposed)', async () => {
    // Mom is initial holder (ensure on first proposer). Mom proposes to James.
    const { data, error } = await mom.client.rpc('propose_care_handoff', {
      p_family_id: famA, p_to_person_id: jamesPid, p_context: {},
    })
    assert(!error, `propose failed: ${error?.message}`)
    const hid = data as string
    const jamesSees = await myNotifications(james.client, { type: 'care_handoff_proposed', entityId: hid })
    assertEqual(jamesSees.length, 1, 'James notified of the proposed handoff')
    assertEqual(jamesSees[0].domain, 'care', 'domain is care')
  })

  await test('accepting a care handoff notifies the proposer (care_handoff_accepted)', async () => {
    // Reset holder to Mom, then Mom → James, James accepts → Mom notified.
    // (There may already be a pending handoff from the previous test; cancel it.)
    const pend = await mom.client.from('care_handoffs').select('id,status').eq('family_id', famA).eq('status', 'pending')
    for (const h of pend.data ?? []) await mom.client.rpc('cancel_care_handoff', { p_handoff_id: (h as { id: string }).id })
    const prop = await mom.client.rpc('propose_care_handoff', { p_family_id: famA, p_to_person_id: jamesPid, p_context: {} })
    assert(!prop.error, `propose failed: ${prop.error?.message}`)
    const hid = prop.data as string
    const { error } = await james.client.rpc('accept_care_handoff', { p_handoff_id: hid })
    assert(!error, `accept failed: ${error?.message}`)
    const momSees = await myNotifications(mom.client, { type: 'care_handoff_accepted', entityId: hid })
    assertEqual(momSees.length, 1, 'proposer Mom notified that James has the baby')
    const jamesSees = await myNotifications(james.client, { type: 'care_handoff_accepted', entityId: hid })
    assertEqual(jamesSees.length, 0, 'James (the accepter) is not self-notified')
  })

  // ========================================================================
  // GENERATION — calendar responsibility
  // ========================================================================
  await test('calendar responsibility assignment notifies the responsible person', async () => {
    const soon = new Date(Date.now() + 3 * 3600_000).toISOString()
    const { data, error } = await mom.client.rpc('create_calendar_event', {
      p_family_id: famA, p_title: 'Dentist', p_all_day: false, p_starts_at: soon, p_ends_at: null,
      p_start_date: null, p_end_date: null, p_location: null, p_notes: null,
      p_responsible_person_id: jamesPid, p_participant_ids: null, p_client_event_id: null,
    })
    assert(!error, `create event failed: ${error?.message}`)
    const eid = data as string
    const jamesSees = await myNotifications(james.client, { type: 'calendar_responsibility_assigned', entityId: eid })
    assertEqual(jamesSees.length, 1, 'James notified he is handling the event')
    assertEqual(jamesSees[0].domain, 'calendar', 'domain is calendar')
    assert(!jamesSees[0].title.toLowerCase().includes('accepted'), 'designation title must not imply acceptance')
  })

  await test('changing calendar responsibility to a new person notifies them; account-less does not', async () => {
    const soon = new Date(Date.now() + 3 * 3600_000).toISOString()
    const created = await mom.client.rpc('create_calendar_event', {
      p_family_id: famA, p_title: 'Soccer', p_all_day: false, p_starts_at: soon, p_ends_at: null,
      p_start_date: null, p_end_date: null, p_location: null, p_notes: null,
      p_responsible_person_id: null, p_participant_ids: null, p_client_event_id: null,
    })
    const eid = created.data as string
    // → James: notified.
    await mom.client.rpc('update_calendar_event', { p_event_id: eid, p_responsible_person_id: jamesPid })
    assertEqual((await myNotifications(james.client, { type: 'calendar_responsibility_assigned', entityId: eid })).length, 1, 'James notified on change')
    // → Grandma (account-less): no notification row is created for that transition.
    // The event's only responsibility notification remains James's one.
    await mom.client.rpc('update_calendar_event', { p_event_id: eid, p_responsible_person_id: grandmaPid })
    const all = await myNotifications(A, { type: 'calendar_responsibility_assigned', entityId: eid })
    assertEqual(all.length, 1, 'account-less responsible → no extra notification (still just James\'s)')
    assertEqual(all[0].recipient_user_id, james.id, 'the only responsibility notification is James\'s')
  })

  await test('calendar A→B→A re-designation notifies A again (transition-keyed dedupe, §17)', async () => {
    // Connect a second adult "Nan" so we have two account-linked people to cycle.
    const nan = await createUser(A, 'ntf-nan')
    const nanPid = await addPerson(mom.client, famA, 'Nan', 'grandparent')
    await invitePartner(mom, nanPid, nan)
    const soon = new Date(Date.now() + 3 * 3600_000).toISOString()
    // Create responsible = James (transition none→James).
    const created = await mom.client.rpc('create_calendar_event', {
      p_family_id: famA, p_title: 'Recital', p_all_day: false, p_starts_at: soon, p_ends_at: null,
      p_start_date: null, p_end_date: null, p_location: null, p_notes: null,
      p_responsible_person_id: jamesPid, p_participant_ids: null, p_client_event_id: null,
    })
    const eid = created.data as string
    // James → Nan → James. The final James is a DISTINCT transition (Nan→James) from
    // the create (none→James), so James must be notified again — not suppressed.
    await mom.client.rpc('update_calendar_event', { p_event_id: eid, p_responsible_person_id: nanPid })
    await mom.client.rpc('update_calendar_event', { p_event_id: eid, p_responsible_person_id: jamesPid })
    const jamesSees = await myNotifications(james.client, { type: 'calendar_responsibility_assigned', entityId: eid })
    assertEqual(jamesSees.length, 2, 'James notified for none→James AND Nan→James (not deduped away)')
  })

  await test('calendar routine edit with unchanged responsible does NOT re-notify (§16 anti-spam)', async () => {
    const soon = new Date(Date.now() + 3 * 3600_000).toISOString()
    const created = await mom.client.rpc('create_calendar_event', {
      p_family_id: famA, p_title: 'Checkup', p_all_day: false, p_starts_at: soon, p_ends_at: null,
      p_start_date: null, p_end_date: null, p_location: null, p_notes: null,
      p_responsible_person_id: jamesPid, p_participant_ids: null, p_client_event_id: null,
    })
    const eid = created.data as string
    const before = (await myNotifications(james.client, { type: 'calendar_responsibility_assigned', entityId: eid })).length
    // Edit title + notes, DON'T touch responsibility → no new notification.
    await mom.client.rpc('update_calendar_event', { p_event_id: eid, p_title: 'Checkup (rescheduled)', p_notes: 'bring forms' })
    // Re-pass the SAME responsible person → still no new notification (no transition).
    await mom.client.rpc('update_calendar_event', { p_event_id: eid, p_responsible_person_id: jamesPid })
    const after = (await myNotifications(james.client, { type: 'calendar_responsibility_assigned', entityId: eid })).length
    assertEqual(after, before, 'a routine edit / same-owner re-set does not re-notify')
  })

  // ========================================================================
  // DEDUPLICATION
  // ========================================================================
  await test('an idempotent/retried domain op produces exactly one notification', async () => {
    // create_task is idempotent on client id; retrying the same create must not
    // double-notify the assignee.
    const cid = randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
    const args = {
      p_family_id: famA, p_title: 'Idempotent task', p_assigned_to_person_id: jamesPid,
      p_due_at: null, p_notes: null, p_source: 'manual', p_client_task_id: cid,
    }
    await mom.client.rpc('create_task', args)
    await mom.client.rpc('create_task', args) // retry same client id
    const jamesSees = await myNotifications(james.client, { type: 'task_assigned', entityId: cid })
    assertEqual(jamesSees.length, 1, 'retry did not duplicate the notification')
  })

  await test('re-assigning to the same person (no-op) creates no new notification', async () => {
    const taskId = await createTask(mom.client, famA, 'No-op reassign', jamesPid)
    const before = (await myNotifications(james.client, { type: 'task_assigned', entityId: taskId })).length
    await mom.client.rpc('assign_task', { p_task_id: taskId, p_person_id: jamesPid }) // same owner → no-op
    const after = (await myNotifications(james.client, { type: 'task_assigned', entityId: taskId })).length
    assertEqual(after, before, 'no extra notification on a no-op reassignment')
  })

  await test('task A→B→A reassignment notifies A again (transition-keyed dedupe, §17)', async () => {
    // Mom (creator) assigns to James, then to Mom, then back to James. The final
    // James is a DISTINCT transition (Mom→James) from the first (none→James), so
    // James must be notified twice — not suppressed by a (task, person)-only key.
    const taskId = await createTask(mom.client, famA, 'Cycle task') // unassigned
    await mom.client.rpc('assign_task', { p_task_id: taskId, p_person_id: jamesPid }) // none→James
    await mom.client.rpc('assign_task', { p_task_id: taskId, p_person_id: momPid })   // James→Mom
    await mom.client.rpc('assign_task', { p_task_id: taskId, p_person_id: jamesPid }) // Mom→James
    const jamesSees = await myNotifications(james.client, { type: 'task_assigned', entityId: taskId })
    assertEqual(jamesSees.length, 2, 'James notified for none→James AND Mom→James (not deduped away)')
  })

  // ========================================================================
  // RECIPIENT SECURITY (recipient-scoped, stricter than family-scoped)
  // ========================================================================
  await test('a same-family member cannot read another member\'s notification', async () => {
    const taskId = await createTask(mom.client, famA, 'Private to James', jamesPid)
    // The notification is addressed to James. Mom is in the SAME family but is NOT
    // the recipient → must not see it.
    const momSees = await myNotifications(mom.client, { type: 'task_assigned', entityId: taskId })
    assertEqual(momSees.length, 0, 'family membership does not grant read of another\'s notification')
    // James does see it.
    assertEqual((await myNotifications(james.client, { type: 'task_assigned', entityId: taskId })).length, 1, 'recipient reads own')
  })

  await test('an outsider cannot read a family\'s notifications', async () => {
    const taskId = await createTask(mom.client, famA, 'Outsider blind', jamesPid)
    const outsiderSees = await myNotifications(outsider.client, { entityId: taskId })
    assertEqual(outsiderSees.length, 0, 'outsider reads zero')
  })

  await test('direct client INSERT of a notification is blocked (no forgery)', async () => {
    const { error } = await mom.client.from('notifications').insert({
      family_id: famA, recipient_user_id: james.id, type: 'task_assigned', domain: 'task',
      title: 'Forged', dedupe_key: `forge:${randomBytes(6).toString('hex')}`,
    })
    assert(error, 'expected direct notification insert to be blocked by RLS')
  })

  await test('recipient can mark own notification read; a non-recipient cannot', async () => {
    const taskId = await createTask(mom.client, famA, 'Mark read target', jamesPid)
    const jamesSees = await myNotifications(james.client, { type: 'task_assigned', entityId: taskId })
    const nid = jamesSees[0].id
    // Mom (non-recipient) attempts to mark it read → rejected (or no-op, never applied).
    const momAttempt = await mom.client.rpc('mark_notification_read', { p_notification_id: nid })
    // RLS hides the row from Mom, so the RPC treats it as unknown (no-op) OR raises
    // 'not authorized' — either way the row must remain UNREAD.
    assert(momAttempt.error == null || errorContains(momAttempt.error, 'not authorized') || errorContains(momAttempt.error, 'not found'),
      `unexpected error: ${momAttempt.error?.message}`)
    const stillUnread = await myNotifications(james.client, { type: 'task_assigned', entityId: taskId })
    assertEqual(stillUnread[0].read_at, null, 'a non-recipient could not mark it read')
    // James marks it read.
    const jamesMark = await james.client.rpc('mark_notification_read', { p_notification_id: nid })
    assert(!jamesMark.error, `recipient mark read failed: ${jamesMark.error?.message}`)
    const nowRead = await myNotifications(james.client, { type: 'task_assigned', entityId: taskId })
    assert(nowRead[0].read_at != null, 'recipient successfully marked own read')
  })

  await test('an outsider (other family) cannot mark a family\'s notification read', async () => {
    const taskId = await createTask(mom.client, famA, 'Cross-family mark', jamesPid)
    const nid = (await myNotifications(james.client, { type: 'task_assigned', entityId: taskId }))[0].id
    const attempt = await outsider.client.rpc('mark_notification_read', { p_notification_id: nid })
    assert(attempt.error == null || errorContains(attempt.error, 'not authorized') || errorContains(attempt.error, 'not found'),
      `unexpected error: ${attempt.error?.message}`)
    const stillUnread = await myNotifications(james.client, { type: 'task_assigned', entityId: taskId })
    assertEqual(stillUnread[0].read_at, null, 'outsider could not mark it read')
  })

  await test('mark_all_notifications_read only affects my own notifications', async () => {
    // James marks all his read; Mom's unread notifications are untouched.
    // Give Mom an unread one first (James assigns Mom a task → Mom notified).
    const t1 = await createTask(james.client, famA, 'For Mom from James', momPid)
    await james.client.rpc('mark_all_notifications_read')
    const momUnread = (await myNotifications(mom.client, { entityId: t1 })).filter((n) => !n.read_at)
    assert(momUnread.length >= 1, 'Mom\'s notification stays unread after James marks all his read')
    const jamesUnread = (await myNotifications(james.client)).filter((n) => !n.read_at)
    assertEqual(jamesUnread.length, 0, 'James has no unread after mark-all')
  })

  // ========================================================================
  // DOMAIN INDEPENDENCE — a notification is not domain truth
  // ========================================================================
  await test('reading a notification does not mutate task acceptance/domain truth', async () => {
    const taskId = await createTask(mom.client, famA, 'Truth stays put', jamesPid)
    const nid = (await myNotifications(james.client, { type: 'task_assigned', entityId: taskId }))[0].id
    await james.client.rpc('mark_notification_read', { p_notification_id: nid })
    // The task must NOT have become accepted just because its notification was read.
    const { data } = await A.from('tasks').select('acknowledged_at,status').eq('id', taskId).maybeSingle()
    const row = data as { acknowledged_at: string | null; status: string }
    assertEqual(row.acknowledged_at, null, 'reading a notification did not accept the task')
    assertEqual(row.status, 'open', 'reading a notification did not change task status')
  })

  await test('cross-family reference cannot generate a valid notification', async () => {
    // Mom tries to assign a famB person to a famA task → rejected upstream; no
    // notification can exist for a cross-family target.
    const taskId = await createTask(mom.client, famA, 'Cross-family guard')
    const { error } = await mom.client.rpc('assign_task', { p_task_id: taskId, p_person_id: famBPid })
    assert(error, 'cross-family assignment rejected')
    const any = await myNotifications(A, { entityId: taskId })
    assertEqual(any.length, 0, 'no notification generated for a rejected cross-family assignment')
  })

  await cleanupUsers(A)
  finish()
}

main().catch((e) => {
  console.error('Fatal:', e instanceof Error ? e.message : e)
  process.exit(1)
})
