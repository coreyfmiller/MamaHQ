// MamaHQ — Today projection deterministic tests (Beta Phase 3).
//
// Pure, no network, no DB, no AI. Proves buildTodayModel projects trusted domain
// state into the Today view WITHOUT inventing urgency, ownership, acceptance, or
// care state, with transparent ordering and correct local-day date/time semantics.
//
//   node scripts/test-today.ts   (npm run test:today)

import {
  buildTodayModel,
  isSoloHousehold,
  type TodayInput,
  type TodayTask,
  type TodayEvent,
  type TodayHandoff,
} from '../lib/today/model.ts'

let passed = 0
let failed = 0
const failures: string[] = []
function ok(cond: boolean, msg: string) {
  if (cond) passed++
  else {
    failed++
    failures.push(msg)
  }
}
function eq<T>(actual: T, expected: T, msg: string) {
  ok(actual === expected, `${msg} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`)
}

// Fixed household + people.
const ME = 'p-me'
const ALEX = 'p-alex'
const SAM = 'p-sam' // account-less
const ME_USER = 'u-me'
const PEOPLE = [
  { id: ME, displayName: 'Sarah' },
  { id: ALEX, displayName: 'Alex' },
  { id: SAM, displayName: 'Sam' },
]

// A fixed "now": 2026-09-22 (Tuesday) 09:00 local.
const NOW = new Date(2026, 8, 22, 9, 0, 0)

function base(overrides: Partial<TodayInput> = {}): TodayInput {
  return {
    mePersonId: ME,
    meUserId: ME_USER,
    people: PEOPLE,
    tasks: [],
    tasksState: 'ok',
    events: [],
    calendarState: 'ok',
    careHolderPersonId: null,
    carePending: null,
    careContext: {},
    careState: 'ok',
    groceryActiveCount: 0,
    groceryState: 'ok',
    now: NOW,
    ...overrides,
  }
}

function task(o: Partial<TodayTask> & { id: string }): TodayTask {
  return {
    title: o.title ?? 'Task ' + o.id,
    status: o.status ?? 'open',
    assignedToPersonId: o.assignedToPersonId ?? null,
    dueAt: o.dueAt ?? null,
    acknowledgedAt: o.acknowledgedAt ?? null,
    ...o,
  }
}
function timedEvent(o: Partial<TodayEvent> & { id: string }): TodayEvent {
  return {
    title: o.title ?? 'Event ' + o.id,
    allDay: false,
    startsAt: o.startsAt ?? null,
    endsAt: o.endsAt ?? null,
    startDate: null,
    endDate: null,
    responsiblePersonId: o.responsiblePersonId ?? null,
    participantIds: o.participantIds ?? [],
    ...o,
  }
}
function allDayEvent(o: Partial<TodayEvent> & { id: string }): TodayEvent {
  return {
    title: o.title ?? 'Event ' + o.id,
    allDay: true,
    startsAt: null,
    endsAt: null,
    startDate: o.startDate ?? null,
    endDate: o.endDate ?? null,
    responsiblePersonId: o.responsiblePersonId ?? null,
    participantIds: o.participantIds ?? [],
    ...o,
  }
}
// Build an ISO string for a local time today (offset hours from NOW).
function todayAt(h: number, m = 0): string {
  return new Date(2026, 8, 22, h, m, 0).toISOString()
}

// ==========================================================================
// ATTENTION — inclusions
// ==========================================================================

// Overdue mine
{
  const m = buildTodayModel(base({ tasks: [task({ id: 't1', assignedToPersonId: ME, acknowledgedAt: todayAt(6), dueAt: todayAt(8) })] }))
  const it = m.attention.find((a) => a.refId === 't1')
  ok(!!it && it.kind === 'task_overdue', 'overdue accepted task assigned to me → task_overdue attention')
}
// Due today (later) mine
{
  const m = buildTodayModel(base({ tasks: [task({ id: 't2', assignedToPersonId: ME, acknowledgedAt: todayAt(6), dueAt: todayAt(15) })] }))
  const it = m.attention.find((a) => a.refId === 't2')
  ok(!!it && it.kind === 'task_due_today', 'accepted task due later today → task_due_today')
}
// Awaiting acceptance mine (takes priority over overdue/due-today classification)
{
  const m = buildTodayModel(base({ tasks: [task({ id: 't3', assignedToPersonId: ME, acknowledgedAt: null, dueAt: todayAt(8) })] }))
  const it = m.attention.find((a) => a.refId === 't3')
  ok(!!it && it.kind === 'task_awaiting_acceptance', 'unaccepted task assigned to me → task_awaiting_acceptance (even if overdue)')
}
// Incoming care handoff (waiting on me)
{
  const h: TodayHandoff = { id: 'h1', fromPersonId: ALEX, toPersonId: ME, proposedByUserId: 'u-alex', status: 'pending' }
  const m = buildTodayModel(base({ carePending: h, careHolderPersonId: ALEX }))
  const it = m.attention.find((a) => a.refId === 'h1')
  ok(!!it && it.kind === 'care_handoff_incoming', 'pending handoff to me → care_handoff_incoming attention')
  eq(it?.fromName, 'Alex', 'incoming handoff names the proposer')
}
// Upcoming responsible calendar commitment today
{
  const e = timedEvent({ id: 'e1', responsiblePersonId: ME, startsAt: todayAt(10, 30), endsAt: todayAt(11) })
  const m = buildTodayModel(base({ events: [e] }))
  const it = m.attention.find((a) => a.refId === 'e1')
  ok(!!it && it.kind === 'event_responsible_soon', 'today event where I am responsible (upcoming) → attention')
}

// ==========================================================================
// ATTENTION — exclusions (no invented urgency)
// ==========================================================================

// Completed task never in attention/mine
{
  const m = buildTodayModel(base({ tasks: [task({ id: 'c1', assignedToPersonId: ME, status: 'completed', dueAt: todayAt(8) })] }))
  ok(m.attention.length === 0, 'completed task is not attention')
  ok(m.mine.length === 0, 'completed task is not in mine')
}
// Future (not-today) task assigned to me, accepted → not attention
{
  const future = new Date(2026, 8, 25, 9, 0, 0).toISOString()
  const m = buildTodayModel(base({ tasks: [task({ id: 'f1', assignedToPersonId: ME, acknowledgedAt: todayAt(6), dueAt: future })] }))
  ok(!m.attention.some((a) => a.refId === 'f1'), 'accepted task due in the future is not attention')
  ok(m.mine.some((x) => x.id === 'f1'), 'but it is still in mine (I own it)')
}
// Partner-only task never in MY attention or mine
{
  const m = buildTodayModel(base({ tasks: [task({ id: 'p1', assignedToPersonId: ALEX, dueAt: todayAt(8) })] }))
  ok(m.attention.length === 0, "partner's overdue task is not MY attention")
  ok(m.mine.length === 0, "partner's task is not in mine")
  ok(m.household.some((h) => h.personId === ALEX && h.tasks.some((t) => t.id === 'p1')), "partner's task appears under household")
}
// Declined / cancelled handoff → no attention
{
  const declined: TodayHandoff = { id: 'h2', fromPersonId: ALEX, toPersonId: ME, proposedByUserId: 'u-alex', status: 'declined' }
  const m = buildTodayModel(base({ carePending: declined }))
  ok(m.attention.length === 0, 'declined handoff is not attention')
}
// Irrelevant future calendar event → not today's commitment
{
  const e = timedEvent({ id: 'ef', responsiblePersonId: ME, startsAt: new Date(2026, 8, 25, 10, 0, 0).toISOString() })
  const m = buildTodayModel(base({ events: [e] }))
  ok(m.commitments.length === 0, 'a future event is not a today commitment')
  ok(!m.attention.some((a) => a.refId === 'ef'), 'a future event is not attention')
}
// Past event today where I'm responsible → not nagged in attention (already ended)
{
  const e = timedEvent({ id: 'ep', responsiblePersonId: ME, startsAt: todayAt(6), endsAt: todayAt(7) })
  const m = buildTodayModel(base({ events: [e] }))
  ok(m.commitments.some((c) => c.id === 'ep'), 'past-today event still shows in the day plan')
  ok(!m.attention.some((a) => a.refId === 'ep'), 'past-today event is not attention (already ended)')
}

// ==========================================================================
// RESPONSIBILITY SEMANTICS
// ==========================================================================

// assigned ≠ accepted
{
  const m = buildTodayModel(base({
    tasks: [
      task({ id: 'a1', assignedToPersonId: ME, acknowledgedAt: null }),
      task({ id: 'a2', assignedToPersonId: ME, acknowledgedAt: todayAt(7) }),
    ],
  }))
  eq(m.mine.find((x) => x.id === 'a1')?.acceptance, 'assigned', 'unacknowledged task = assigned')
  eq(m.mine.find((x) => x.id === 'a2')?.acceptance, 'accepted', 'acknowledged task = accepted')
}
// participant ≠ responsible
{
  const e1 = timedEvent({ id: 'r1', responsiblePersonId: ME, participantIds: [SAM], startsAt: todayAt(10) })
  const e2 = timedEvent({ id: 'r2', responsiblePersonId: ALEX, participantIds: [ME], startsAt: todayAt(11) })
  const e3 = timedEvent({ id: 'r3', responsiblePersonId: ALEX, participantIds: [SAM], startsAt: todayAt(12) })
  const m = buildTodayModel(base({ events: [e1, e2, e3] }))
  eq(m.commitments.find((c) => c.id === 'r1')?.myRole, 'responsible', 'I am responsible → responsible')
  eq(m.commitments.find((c) => c.id === 'r2')?.myRole, 'attending', 'I am only a participant → attending')
  eq(m.commitments.find((c) => c.id === 'r3')?.myRole, 'other', 'neither → other')
}
// account-less person can be responsible/own tasks, but no acceptance implied falsely
{
  const m = buildTodayModel(base({ tasks: [task({ id: 's1', assignedToPersonId: SAM })] }))
  const sam = m.household.find((h) => h.personId === SAM)
  ok(!!sam, 'account-less Sam appears as handling a task')
  eq(sam?.tasks[0].acceptance, 'assigned', 'account-less owner shows assigned, not accepted')
}
// current care holder
{
  const m = buildTodayModel(base({ careHolderPersonId: ME }))
  ok(m.care.iHoldCare, 'I hold care when holder === me')
  eq(m.care.holderName, 'Sarah', 'holder name resolved')
}
{
  const m = buildTodayModel(base({ careHolderPersonId: ALEX }))
  ok(!m.care.iHoldCare, 'I do not hold care when holder is Alex')
  eq(m.care.holderName, 'Alex', 'holder name is Alex')
}
// outgoing pending handoff is truthful (I proposed to Alex) — never "Alex has the baby"
{
  const h: TodayHandoff = { id: 'ho', fromPersonId: ME, toPersonId: ALEX, proposedByUserId: ME_USER, status: 'pending' }
  const m = buildTodayModel(base({ carePending: h, careHolderPersonId: ME }))
  eq(m.care.outgoingPendingToName, 'Alex', 'outgoing pending handoff names the recipient')
  ok(m.attention.length === 0, 'my own outgoing handoff is not MY incoming attention')
  ok(m.care.iHoldCare, 'I still hold care until Alex accepts')
}

// ==========================================================================
// ORDERING
// ==========================================================================
{
  const h: TodayHandoff = { id: 'H', fromPersonId: ALEX, toPersonId: ME, proposedByUserId: 'u-alex', status: 'pending' }
  const m = buildTodayModel(base({
    carePending: h,
    tasks: [
      task({ id: 'await', assignedToPersonId: ME, acknowledgedAt: null, dueAt: todayAt(20) }),
      task({ id: 'over', assignedToPersonId: ME, acknowledgedAt: todayAt(6), dueAt: todayAt(8) }),
      task({ id: 'due', assignedToPersonId: ME, acknowledgedAt: todayAt(6), dueAt: todayAt(15) }),
    ],
    events: [timedEvent({ id: 'ev', responsiblePersonId: ME, startsAt: todayAt(18) })],
  }))
  const kinds = m.attention.map((a) => a.kind)
  eq(kinds[0], 'care_handoff_incoming', 'order[0] = incoming care handoff')
  eq(kinds[1], 'task_awaiting_acceptance', 'order[1] = awaiting acceptance')
  eq(kinds[2], 'task_overdue', 'order[2] = overdue')
  eq(kinds[3], 'task_due_today', 'order[3] = due today')
  eq(kinds[4], 'event_responsible_soon', 'order[4] = responsible event')
}
// commitments: all-day first, then chronological
{
  const m = buildTodayModel(base({
    events: [
      timedEvent({ id: 'noon', startsAt: todayAt(12) }),
      timedEvent({ id: 'morn', startsAt: todayAt(8) }),
      allDayEvent({ id: 'allday', startDate: '2026-09-22', endDate: '2026-09-22' }),
    ],
  }))
  eq(m.commitments[0].id, 'allday', 'all-day sorts first')
  eq(m.commitments[1].id, 'morn', 'then earliest timed')
  eq(m.commitments[2].id, 'noon', 'then later timed')
}
// deterministic/stable: same input twice → identical output
{
  const input = base({ tasks: [task({ id: 'z', assignedToPersonId: ME, dueAt: todayAt(10) })] })
  const a = JSON.stringify(buildTodayModel(input))
  const b = JSON.stringify(buildTodayModel(input))
  ok(a === b, 'projection is deterministic (identical output for identical input)')
}

// ==========================================================================
// DATE/TIME BOUNDARIES
// ==========================================================================
// Multi-day all-day event covering today
{
  const e = allDayEvent({ id: 'multi', startDate: '2026-09-20', endDate: '2026-09-24' })
  const m = buildTodayModel(base({ events: [e] }))
  ok(m.commitments.some((c) => c.id === 'multi'), 'multi-day all-day event covering today is in the plan')
}
// Late-evening now: a task due earlier today is overdue; midnight boundary respected
{
  const lateNow = new Date(2026, 8, 22, 23, 30, 0)
  const m = buildTodayModel(base({
    now: lateNow,
    tasks: [task({ id: 'late', assignedToPersonId: ME, acknowledgedAt: todayAt(6), dueAt: todayAt(20) })],
  }))
  ok(m.attention.find((a) => a.refId === 'late')?.kind === 'task_overdue', 'at 23:30 a task due 20:00 today is overdue')
}
// Early morning: a task due tomorrow is neither overdue nor due-today
{
  const earlyNow = new Date(2026, 8, 22, 0, 30, 0)
  const tomorrow = new Date(2026, 8, 23, 9, 0, 0).toISOString()
  const m = buildTodayModel(base({
    now: earlyNow,
    tasks: [task({ id: 'tmrw', assignedToPersonId: ME, acknowledgedAt: todayAt(0), dueAt: tomorrow })],
  }))
  ok(!m.attention.some((a) => a.refId === 'tmrw'), 'at 00:30 a task due tomorrow is not attention')
}
// Event crossing midnight into today (started yesterday evening, ends this morning)
{
  const start = new Date(2026, 8, 21, 22, 0, 0).toISOString()
  const end = new Date(2026, 8, 22, 6, 0, 0).toISOString()
  const e = timedEvent({ id: 'cross', startsAt: start, endsAt: end })
  const m = buildTodayModel(base({ events: [e] }))
  ok(m.commitments.some((c) => c.id === 'cross'), 'a timed event crossing midnight into today is in the plan')
}

// ==========================================================================
// EMPTY / LOADING / FAILURE
// ==========================================================================
// Empty: everything loaded, nothing relevant
{
  const m = buildTodayModel(base())
  ok(m.isEmpty, 'no data + all ok → isEmpty')
  ok(!m.isLoading, 'not loading when all ok')
  eq(m.failedDomains.length, 0, 'no failed domains')
}
// Loading: all core domains loading → isLoading, not empty
{
  const m = buildTodayModel(base({ tasksState: 'loading', calendarState: 'loading', careState: 'loading' }))
  ok(m.isLoading, 'all core loading → isLoading')
  ok(!m.isEmpty, 'loading is NOT empty')
}
// Partial failure: tasks fail, calendar ok → calendar renders, tasks flagged, not empty
{
  const e = timedEvent({ id: 'ok1', startsAt: todayAt(10) })
  const m = buildTodayModel(base({ tasksState: 'error', events: [e] }))
  ok(m.failedDomains.includes('tasks'), 'tasks failure recorded')
  ok(m.commitments.some((c) => c.id === 'ok1'), 'calendar still renders when tasks fail')
  ok(!m.isEmpty, 'partial failure is not empty')
  ok(!m.isLoading, 'partial failure is not loading (calendar loaded)')
  eq(m.mine.length, 0, 'no mine tasks projected from a failed tasks domain')
}
// A tasks failure must not fabricate "no tasks": mine is empty but tasks flagged failed
{
  const m = buildTodayModel(base({ tasksState: 'error' }))
  ok(m.failedDomains.includes('tasks') && !m.isEmpty, 'failed tasks ≠ empty tasks')
}
// No mePersonId (unresolved identity) → no mine/attention, still safe
{
  const m = buildTodayModel(base({ mePersonId: null, tasks: [task({ id: 'x', assignedToPersonId: ALEX })] }))
  eq(m.mine.length, 0, 'no mine without a resolved person')
  ok(m.household.some((h) => h.personId === ALEX), 'household still shows others')
}

// ==========================================================================
// REOPEN / REASSIGN semantics (follow canonical domain state)
// ==========================================================================
// A reopened task (status back to 'open') reappears in mine/attention.
{
  const reopened = task({ id: 're', assignedToPersonId: ME, status: 'open', acknowledgedAt: null, dueAt: todayAt(8) })
  const m = buildTodayModel(base({ tasks: [reopened] }))
  ok(m.mine.some((x) => x.id === 're'), 'a reopened (open) task assigned to me is in mine again')
  ok(m.attention.some((a) => a.refId === 're'), 'a reopened open task assigned to me is attention again')
}
// A task reassigned AWAY from me (now owned by Alex) leaves my mine/attention entirely.
{
  const m = buildTodayModel(base({ tasks: [task({ id: 'gone', assignedToPersonId: ALEX, acknowledgedAt: null, dueAt: todayAt(8) })] }))
  ok(!m.mine.some((x) => x.id === 'gone'), 'a task reassigned to Alex is no longer mine')
  ok(!m.attention.some((a) => a.refId === 'gone'), 'a task reassigned to Alex is not my attention')
  ok(m.household.some((h) => h.personId === ALEX && h.tasks.some((t) => t.id === 'gone')), 'it shows under Alex in household')
}
// An accepted partner task shows under household as "has it" (accepted), never mine.
{
  const m = buildTodayModel(base({ tasks: [task({ id: 'pa', assignedToPersonId: ALEX, acknowledgedAt: todayAt(7) })] }))
  const alex = m.household.find((h) => h.personId === ALEX)
  eq(alex?.tasks.find((t) => t.id === 'pa')?.acceptance, 'accepted', "accepted partner task shows 'accepted' under household")
  ok(m.mine.length === 0, 'accepted partner task is never mine')
}
// Unassigned open task appears in NEITHER mine nor household (no owner to attribute).
{
  const m = buildTodayModel(base({ tasks: [task({ id: 'un', assignedToPersonId: null, dueAt: todayAt(8) })] }))
  ok(m.mine.length === 0, 'unassigned task is not mine')
  ok(m.household.length === 0, 'unassigned task is not attributed to anyone in household')
  ok(m.attention.length === 0, 'unassigned task creates no attention')
}
// Ordering: equal-rank, equal-time items are stable by refId (no array-order dependence).
{
  const tasksA = [
    task({ id: 'b', assignedToPersonId: ME, acknowledgedAt: todayAt(6), dueAt: todayAt(15) }),
    task({ id: 'a', assignedToPersonId: ME, acknowledgedAt: todayAt(6), dueAt: todayAt(15) }),
  ]
  const m1 = buildTodayModel(base({ tasks: tasksA }))
  const m2 = buildTodayModel(base({ tasks: [...tasksA].reverse() }))
  eq(
    m1.attention.map((a) => a.refId).join(','),
    m2.attention.map((a) => a.refId).join(','),
    'attention order does not depend on input array order (stable by refId at equal rank/time)',
  )
  eq(m1.attention[0].refId, 'a', 'equal rank+time → stable ascending by refId')
}

// ==========================================================================
// RESPONSIBILITY TEACHING STATE — isSoloHousehold predicate
// (gates the Today "Share the load" card; must be literally true — only a
//  CONNECTED other adult ends the solo state; invited/account-less do not.)
// ==========================================================================
{
  const meP = { id: ME, accountStatus: 'connected' as const }
  // Solo: just me connected.
  ok(isSoloHousehold([meP], ME), 'solo when I am the only connected adult')
  // Solo: me + an account-less person (Sam has no account).
  ok(
    isSoloHousehold([meP, { id: SAM, accountStatus: 'none' }], ME),
    'still solo with an account-less person (no account = cannot participate)',
  )
  // Solo: me + a merely-INVITED (not yet joined) partner — teaching copy stays true.
  ok(
    isSoloHousehold([meP, { id: ALEX, accountStatus: 'invited' }], ME),
    'still solo while a partner is only invited (not yet accepted)',
  )
  // NOT solo: another connected adult exists.
  ok(
    !isSoloHousehold([meP, { id: ALEX, accountStatus: 'connected' }], ME),
    'not solo once another adult is connected',
  )
  // NOT solo even if I have no resolved person but a connected other exists.
  ok(
    !isSoloHousehold([{ id: ALEX, accountStatus: 'connected' }], null),
    'not solo when a connected adult exists and my person is unresolved',
  )
  // Empty household → solo (nothing to share with yet).
  ok(isSoloHousehold([], ME), 'empty household is solo')
}

// ==========================================================================
console.log(`\nToday projection: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log('  - ' + f)
  process.exit(1)
}
console.log('✓ all Today projection tests passed')
process.exit(0)
