// MamaHQ — Step 10 Shared Calendar & Household Commitments tests.
//
// Runs against a LOCAL/CI Supabase stack (never production) with REAL authenticated
// JWTs, so RLS + the SECURITY DEFINER RPC authorization genuinely execute. Covers
// Step 10 §39:
//   Creation — timed / all-day / multi-day; participants (multiple + account-less);
//     responsible person (account-less + also-a-participant); title/start required.
//   Authorization — outsider cannot read/update/delete; cross-family participant +
//     responsible rejected; direct-write bypass rejected.
//   Editing — transactional participant replacement; responsibility change/clear;
//     timed ↔ all-day switch.
//   Deletion — member deletes; outsider cannot.
//   Time — all-day date retained; timed instant retained; multi-day valid;
//     overlapping events permitted.
//
// Run: node scripts/test-calendar.ts  (env: SUPABASE_URL, SUPABASE_ANON_KEY,
//                                       SUPABASE_SERVICE_ROLE_KEY)

import { randomBytes } from 'node:crypto'
import {
  admin, createUser, makeRunner, assert, assertEqual, errorContains, cleanupUsers,
  type Client, type TestUser,
} from './db/harness.ts'

const A = admin()
const { test, finish } = makeRunner('Calendar / Commitments')

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

interface CreateArgs {
  title?: string
  allDay?: boolean
  startsAt?: string | null
  endsAt?: string | null
  startDate?: string | null
  endDate?: string | null
  location?: string | null
  notes?: string | null
  responsible?: string | null
  participants?: string[] | null
  clientId?: string | null
}

async function createEvent(client: Client, familyId: string, a: CreateArgs) {
  return client.rpc('create_calendar_event', {
    p_family_id: familyId,
    p_title: a.title ?? 'Event',
    p_all_day: a.allDay ?? false,
    p_starts_at: a.startsAt ?? null,
    p_ends_at: a.endsAt ?? null,
    p_start_date: a.startDate ?? null,
    p_end_date: a.endDate ?? null,
    p_location: a.location ?? null,
    p_notes: a.notes ?? null,
    p_responsible_person_id: a.responsible ?? null,
    p_participant_ids: a.participants ?? null,
    p_client_event_id: a.clientId ?? null,
  })
}

async function eventRow(client: Client, id: string) {
  const { data } = await client.from('calendar_events').select('*').eq('id', id).maybeSingle()
  return data as {
    id: string; family_id: string; title: string; all_day: boolean
    starts_at: string | null; ends_at: string | null
    start_date: string | null; end_date: string | null
    location: string | null; responsible_person_id: string | null
  } | null
}

async function participantIds(client: Client, eventId: string): Promise<string[]> {
  const { data } = await client.from('calendar_event_participants').select('person_id').eq('event_id', eventId)
  return (data ?? []).map((r) => (r as { person_id: string }).person_id).sort()
}

const soon = new Date(Date.now() + 3 * 3600_000).toISOString()
const later = new Date(Date.now() + 4 * 3600_000).toISOString()

async function main() {
  await cleanupUsers(A)

  const owner = await createUser(A, 'cal-owner')     // Mom
  const partner = await createUser(A, 'cal-partner') // James (connected)
  const outsider = await createUser(A, 'cal-outsider')

  const famA = await ensureFamily(owner)
  const famB = await ensureFamily(outsider)
  assert(famA !== famB, 'distinct families')

  const momPid = await myPersonId(owner.client, famA, owner.id)
  const madelynPid = await addPerson(owner.client, famA, 'Madelyn', 'child')       // account-less
  const coreyPid = await addPerson(owner.client, famA, 'Corey', 'partner')          // account-less
  const kaelanPid = await addPerson(owner.client, famA, 'Kaelan', 'child')          // account-less
  const famBPid = await myPersonId(outsider.client, famB, outsider.id)

  // ========================================================================
  // CREATION
  // ========================================================================
  await test('household member can create a timed event; instant retained', async () => {
    const { data, error } = await createEvent(owner.client, famA, { title: 'Dentist', startsAt: soon, endsAt: later })
    assert(!error, `create failed: ${error?.message}`)
    const row = await eventRow(A, data as string)
    assertEqual(row?.all_day, false, 'timed')
    assertEqual(row?.starts_at ? new Date(row.starts_at).toISOString() : null, soon, 'starts_at instant retained')
    assertEqual(row?.start_date, null, 'no start_date for timed')
  })

  await test('title is required', async () => {
    const { error } = await createEvent(owner.client, famA, { title: '   ', startsAt: soon })
    assert(error, 'expected empty title to fail')
    assert(errorContains(error, 'title is required'), `got: ${error?.message}`)
  })

  await test('all-day event retains its date and does not tz-shift', async () => {
    const { data, error } = await createEvent(owner.client, famA, { title: 'School closed', allDay: true, startDate: '2026-11-26' })
    assert(!error, `create all-day failed: ${error?.message}`)
    const row = await eventRow(A, data as string)
    assertEqual(row?.all_day, true, 'all-day')
    assertEqual(row?.start_date, '2026-11-26', 'start_date preserved exactly (no tz shift)')
    assertEqual(row?.starts_at, null, 'no timestamp for all-day')
  })

  await test('multi-day all-day event is valid (vacation Jul 4–10)', async () => {
    const { data, error } = await createEvent(owner.client, famA, { title: 'Vacation', allDay: true, startDate: '2026-07-04', endDate: '2026-07-10' })
    assert(!error, `create multi-day failed: ${error?.message}`)
    const row = await eventRow(A, data as string)
    assertEqual(row?.start_date, '2026-07-04', 'start date')
    assertEqual(row?.end_date, '2026-07-10', 'end date spans multiple days')
  })

  await test('participants can be added (multiple, incl. account-less)', async () => {
    const { data, error } = await createEvent(owner.client, famA, {
      title: 'Family dinner', startsAt: soon, participants: [momPid, madelynPid, coreyPid],
    })
    assert(!error, `create with participants failed: ${error?.message}`)
    const parts = await participantIds(A, data as string)
    assertEqual(parts.length, 3, 'three participants')
    assert(parts.includes(madelynPid), 'account-less Madelyn is a participant')
  })

  await test('responsible person can be set (account-less), and may also be a participant', async () => {
    const { data, error } = await createEvent(owner.client, famA, {
      title: 'Dentist', startsAt: soon, participants: [madelynPid, coreyPid], responsible: coreyPid,
    })
    assert(!error, `create failed: ${error?.message}`)
    const row = await eventRow(A, data as string)
    assertEqual(row?.responsible_person_id, coreyPid, 'Corey (account-less) is responsible')
    const parts = await participantIds(A, data as string)
    assert(parts.includes(coreyPid), 'Corey is also a participant (both roles allowed)')
  })

  await test('create is idempotent on client event id', async () => {
    const cid = randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
    const r1 = await createEvent(owner.client, famA, { title: 'Retry event', startsAt: soon, clientId: cid })
    const r2 = await createEvent(owner.client, famA, { title: 'Retry event', startsAt: soon, clientId: cid })
    assertEqual(r1.data, r2.data, 'same id on retry')
    const { count } = await A.from('calendar_events').select('*', { count: 'exact', head: true }).eq('id', cid)
    assertEqual(count, 1, 'exactly one row')
  })

  // ========================================================================
  // AUTHORIZATION / cross-family
  // ========================================================================
  await test('cross-family participant is rejected', async () => {
    const { error } = await createEvent(owner.client, famA, { title: 'Bad participant', startsAt: soon, participants: [famBPid] })
    assert(error, 'expected cross-family participant to fail')
    assert(errorContains(error, 'not in this family'), `got: ${error?.message}`)
  })

  await test('cross-family responsible person is rejected', async () => {
    const { error } = await createEvent(owner.client, famA, { title: 'Bad responsible', startsAt: soon, responsible: famBPid })
    assert(error, 'expected cross-family responsible to fail')
    assert(errorContains(error, 'not in this family'), `got: ${error?.message}`)
  })

  await test('outsider cannot create into Family A', async () => {
    const { error } = await createEvent(outsider.client, famA, { title: 'Intruder', startsAt: soon })
    assert(error, 'expected outsider create to fail')
    assert(errorContains(error, 'not authorized'), `got: ${error?.message}`)
  })

  await test('outsider cannot READ Family A events', async () => {
    const { data } = await createEvent(owner.client, famA, { title: 'A-private', startsAt: soon })
    const { data: seen } = await outsider.client.from('calendar_events').select('id').eq('id', data as string)
    assertEqual((seen ?? []).length, 0, 'outsider reads zero')
  })

  await test('direct client INSERT is blocked (writes go via RPC)', async () => {
    const { error } = await owner.client.from('calendar_events').insert({ family_id: famA, title: 'Direct', starts_at: soon })
    assert(error, 'expected direct insert to be blocked')
  })

  await test('direct client UPDATE is blocked (no silent field change)', async () => {
    const { data } = await createEvent(owner.client, famA, { title: 'No direct update', startsAt: soon })
    const id = data as string
    await owner.client.from('calendar_events').update({ title: 'HACKED' }).eq('id', id)
    assertEqual((await eventRow(A, id))?.title, 'No direct update', 'title unchanged by direct client update')
  })

  await test('two authenticated adults see the same event (shared household)', async () => {
    // Connect James so he is a member of famA... via the Step 7 invite flow.
    const { createHash } = await import('node:crypto')
    const token = randomBytes(32).toString('base64url')
    const hash = createHash('sha256').update(token).digest('hex')
    const jamesPersion = await addPerson(owner.client, famA, 'James', 'partner')
    await owner.client.rpc('create_household_invitation', { p_person_id: jamesPersion, p_token_hash: hash, p_email: null, p_ttl_seconds: 604800 })
    await partner.client.rpc('accept_household_invitation', { p_token_hash: hash })
    const { data } = await createEvent(owner.client, famA, { title: 'Shared event', startsAt: soon })
    const { data: seen, error } = await partner.client.from('calendar_events').select('id').eq('id', data as string)
    assert(!error, `partner read failed: ${error?.message}`)
    assertEqual((seen ?? []).length, 1, 'partner sees the owner-created event')
  })

  // ========================================================================
  // EDITING
  // ========================================================================
  await test('member can edit fields; participant replacement is transactional', async () => {
    const { data } = await createEvent(owner.client, famA, { title: 'Soccer', startsAt: soon, participants: [kaelanPid] })
    const id = data as string
    const { error } = await owner.client.rpc('update_calendar_event', {
      p_event_id: id, p_title: 'Soccer practice', p_location: 'Saint John Field',
      p_participant_ids: [kaelanPid, madelynPid], p_replace_participants: true,
    })
    assert(!error, `update failed: ${error?.message}`)
    const row = await eventRow(A, id)
    assertEqual(row?.title, 'Soccer practice', 'title updated')
    assertEqual(row?.location, 'Saint John Field', 'location updated')
    const parts = await participantIds(A, id)
    assertEqual(parts.length, 2, 'participants replaced atomically to 2')
  })

  await test('responsibility can change and be cleared', async () => {
    const { data } = await createEvent(owner.client, famA, { title: 'Pickup', startsAt: soon, responsible: coreyPid })
    const id = data as string
    // change
    await owner.client.rpc('update_calendar_event', { p_event_id: id, p_responsible_person_id: momPid })
    assertEqual((await eventRow(A, id))?.responsible_person_id, momPid, 'responsibility changed to Mom')
    // clear
    await owner.client.rpc('update_calendar_event', { p_event_id: id, p_clear_responsible: true })
    assertEqual((await eventRow(A, id))?.responsible_person_id, null, 'responsibility cleared')
  })

  await test('event can switch timed ↔ all-day safely (time model stays coherent)', async () => {
    const { data } = await createEvent(owner.client, famA, { title: 'Switch me', startsAt: soon })
    const id = data as string
    // timed → all-day
    await owner.client.rpc('update_calendar_event', { p_event_id: id, p_all_day: true, p_start_date: '2026-05-01' })
    let row = await eventRow(A, id)
    assertEqual(row?.all_day, true, 'now all-day')
    assertEqual(row?.starts_at, null, 'timestamp cleared')
    assertEqual(row?.start_date, '2026-05-01', 'date set')
    // all-day → timed
    await owner.client.rpc('update_calendar_event', { p_event_id: id, p_all_day: false, p_starts_at: soon })
    row = await eventRow(A, id)
    assertEqual(row?.all_day, false, 'now timed')
    assertEqual(row?.start_date, null, 'date cleared')
    assert(row?.starts_at, 'timestamp set')
  })

  await test('outsider cannot update a Family A event', async () => {
    const { data } = await createEvent(owner.client, famA, { title: 'Guard update', startsAt: soon })
    const { error } = await outsider.client.rpc('update_calendar_event', { p_event_id: data as string, p_title: 'HACK' })
    assert(error, 'expected outsider update to fail')
    assert(errorContains(error, 'not authorized') || errorContains(error, 'not found'), `got: ${error?.message}`)
    assertEqual((await eventRow(A, data as string))?.title, 'Guard update', 'unchanged')
  })

  await test('cross-family participant cannot be injected via update', async () => {
    const { data } = await createEvent(owner.client, famA, { title: 'Inject guard', startsAt: soon })
    const { error } = await owner.client.rpc('update_calendar_event', {
      p_event_id: data as string, p_participant_ids: [famBPid], p_replace_participants: true,
    })
    assert(error, 'expected cross-family participant injection to fail')
    assert(errorContains(error, 'not in this family'), `got: ${error?.message}`)
  })

  // ========================================================================
  // DELETION
  // ========================================================================
  await test('member can delete their family event via the RPC (participants cascade)', async () => {
    const { data } = await createEvent(owner.client, famA, { title: 'Delete me', startsAt: soon, participants: [madelynPid] })
    const id = data as string
    const { error } = await owner.client.rpc('delete_calendar_event', { p_event_id: id })
    assert(!error, `delete failed: ${error?.message}`)
    assertEqual(await eventRow(A, id), null, 'event gone')
    assertEqual((await participantIds(A, id)).length, 0, 'participants cascaded')
  })

  await test('direct client DELETE is blocked (deletion only via the RPC — single boundary)', async () => {
    const { data } = await createEvent(owner.client, famA, { title: 'No direct delete', startsAt: soon })
    const id = data as string
    // A member attempts a direct table DELETE; RLS has no delete policy → 0 rows.
    await owner.client.from('calendar_events').delete().eq('id', id)
    assert(await eventRow(A, id), 'event still exists after a direct client delete attempt')
    // The RPC still works for the same member.
    await owner.client.rpc('delete_calendar_event', { p_event_id: id })
    assertEqual(await eventRow(A, id), null, 'RPC deletion still works')
  })

  await test('outsider cannot delete a Family A event', async () => {
    const { data } = await createEvent(owner.client, famA, { title: 'Protected', startsAt: soon })
    const id = data as string
    const { error } = await outsider.client.rpc('delete_calendar_event', { p_event_id: id })
    assert(error, 'expected outsider delete to fail')
    assert(errorContains(error, 'not authorized'), `got: ${error?.message}`)
    assert(await eventRow(A, id), 'event still exists')
  })

  // ========================================================================
  // TIME behaviors
  // ========================================================================
  await test('overlapping events are permitted', async () => {
    const r1 = await createEvent(owner.client, famA, { title: 'Soccer', startsAt: soon })
    const r2 = await createEvent(owner.client, famA, { title: 'Parent meeting', startsAt: soon })
    assert(!r1.error && !r2.error, 'both overlapping events created')
  })

  await test('end before start is rejected (coherent time model)', async () => {
    const start = new Date(Date.now() + 3600_000).toISOString()
    const endBefore = new Date(Date.now() - 3600_000).toISOString()
    const { error } = await createEvent(owner.client, famA, { title: 'Bad range', startsAt: start, endsAt: endBefore })
    assert(error, 'expected end-before-start to fail the CHECK constraint')
  })

  await cleanupUsers(A)
  finish()
}

main().catch((e) => {
  console.error('Fatal:', e instanceof Error ? e.message : e)
  process.exit(1)
})
