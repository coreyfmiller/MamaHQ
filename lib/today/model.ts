// MamaHQ — Today projection (Beta Phase 3).
//
// A PURE, DETERMINISTIC projection of already-trusted household state into the
// "Today" operating view. No React, no network, no AI, no randomness. Given a
// snapshot of the domains (tasks, calendar, care, grocery) + the current person +
// an explicit clock, it computes what matters now.
//
// DOCTRINE (must hold for every field this produces):
//   * Today INVENTS NOTHING. Every item maps 1:1 to persisted domain truth.
//   * "Mine" is precise: task ownership = my linked HouseholdPerson; calendar =
//     I'm the responsible person and/or a participant (kept distinct); care = I
//     currently hold care, or a handoff is waiting on ME.
//   * Assigned ≠ Accepted ≠ Completed. Participant ≠ Responsible. A relationship
//     label ("partner"/"Mom") NEVER implies responsibility.
//   * Urgency is TRANSPARENT and RULE-BASED — no opaque scores, no priority AI.
//
// This module is intentionally UI-free and independently testable (scripts/test-today.ts).

// ---------------------------------------------------------------------------
// Input types — deliberately structural (a subset of the provider types), so this
// module never imports React providers. The Today screen adapts provider output to
// these shapes.
// ---------------------------------------------------------------------------

export interface TodayTask {
  id: string
  title: string
  status: 'open' | 'completed'
  /** OWNERSHIP → HouseholdPerson id (may be account-less). null = unassigned. */
  assignedToPersonId: string | null
  /** Full ISO timestamp, or null. NOT date-only. */
  dueAt: string | null
  /** CURRENT ACCEPTANCE ("I've got it"). null = assigned but not accepted. */
  acknowledgedAt: string | null
}

export interface TodayEvent {
  id: string
  title: string
  allDay: boolean
  startsAt: string | null // timed model
  endsAt: string | null
  startDate: string | null // all-day model, 'YYYY-MM-DD'
  endDate: string | null
  responsiblePersonId: string | null
  participantIds: string[]
}

export interface TodayCareContext {
  lastFeed?: { at: string; detail?: string }
  lastDiaper?: { at: string; detail?: string }
  lastNap?: { start: string; end?: string; durationLabel?: string; inProgress?: boolean }
}

export interface TodayHandoff {
  id: string
  fromPersonId: string | null
  toPersonId: string
  proposedByUserId: string | null
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
}

/** A domain's load state, so Today can distinguish loading / ok / failed per domain. */
export type DomainState = 'loading' | 'ok' | 'error'

export interface TodayInput {
  /** The current user's linked HouseholdPerson id. null when unresolved/account-less-owner. */
  mePersonId: string | null
  /** The current user's auth id (for classifying who proposed a handoff). */
  meUserId: string | null
  /** Resolve a HouseholdPerson id → display name (for labels). Returns null if unknown. */
  people: { id: string; displayName: string }[]

  tasks: TodayTask[]
  tasksState: DomainState
  events: TodayEvent[]
  calendarState: DomainState
  careHolderPersonId: string | null
  carePending: TodayHandoff | null
  careContext: TodayCareContext
  careState: DomainState
  groceryActiveCount: number
  groceryState: DomainState

  /** Explicit clock — the user's current local time. Tests pass a fixed Date. */
  now: Date
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type AttentionKind =
  | 'care_handoff_incoming' // a care handoff is waiting on ME to accept/decline
  | 'task_awaiting_acceptance' // a task assigned to me that I haven't accepted ("I've got it")
  | 'task_overdue' // an open task assigned to me whose due time has passed
  | 'task_due_today' // an open task assigned to me due later today
  | 'event_responsible_soon' // a commitment today where I'm the responsible person

export interface AttentionItem {
  kind: AttentionKind
  /** Stable id of the underlying domain entity (task id / event id / handoff id). */
  refId: string
  title: string
  /** ISO time the attention is anchored to (due time / event start / handoff time), or null. */
  at: string | null
  /** For handoffs: who proposed it (display name), when known. */
  fromName?: string | null
}

export interface TodayCommitment {
  id: string
  title: string
  /** ISO start for timed events; null for all-day. */
  startsAt: string | null
  allDay: boolean
  /** 'responsible' when I'm the responsible person; 'attending' when I'm only a
   *  participant; 'other' when neither (someone else's / unassigned). */
  myRole: 'responsible' | 'attending' | 'other'
  responsibleName: string | null
  participantNames: string[]
}

export interface MineTask {
  id: string
  title: string
  dueAt: string | null
  /** 'accepted' when I've pressed "I've got it"; 'assigned' otherwise. */
  acceptance: 'assigned' | 'accepted'
  overdue: boolean
}

export interface HouseholdResponsibility {
  personId: string
  personName: string
  /** Open tasks currently owned by this other person (title + acceptance state). */
  tasks: { id: string; title: string; acceptance: 'assigned' | 'accepted' }[]
}

export interface TodayModel {
  /** Immediate attention, already ordered (see ordering rules below). */
  attention: AttentionItem[]
  /** Today's chronological commitments (all-day first, then by start time). */
  commitments: TodayCommitment[]
  /** Open tasks owned by me (not completed), ordered overdue → due-today → dated → undated. */
  mine: MineTask[]
  /** Useful visibility into what OTHER people are currently handling (open tasks). */
  household: HouseholdResponsibility[]
  /** Deterministic recent care context + who currently holds care. */
  care: {
    holderPersonId: string | null
    holderName: string | null
    /** I currently hold care responsibility. */
    iHoldCare: boolean
    context: TodayCareContext
    /** A pending handoff I proposed to someone else (truthful pending state). */
    outgoingPendingToName: string | null
  }
  grocery: { activeCount: number }
  /** True when every domain successfully loaded and there is genuinely nothing relevant. */
  isEmpty: boolean
  /** Domains that failed to load (so the UI can show a restrained per-domain error). */
  failedDomains: ('tasks' | 'calendar' | 'care' | 'grocery')[]
  /** True while we don't yet have enough loaded to render truthfully (all core domains loading). */
  isLoading: boolean
}

// ---------------------------------------------------------------------------
// Date/time helpers — LOCAL-day semantics, matching calendar.tsx exactly.
// ---------------------------------------------------------------------------

/** Local day key 'YYYY-MM-DD' for a Date (shifts by tz offset before slicing). */
export function localDayKey(now: Date): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function dayStartMs(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).getTime()
}
function dayEndMs(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999).getTime()
}

/** Event start in ms — timed uses startsAt; all-day uses local midnight of startDate. */
function eventStartMs(e: TodayEvent): number {
  if (!e.allDay && e.startsAt) return new Date(e.startsAt).getTime()
  if (e.allDay && e.startDate) {
    const [y, m, d] = e.startDate.split('-').map(Number)
    return new Date(y, (m ?? 1) - 1, d ?? 1).getTime()
  }
  return e.startsAt ? new Date(e.startsAt).getTime() : Number.MAX_SAFE_INTEGER
}
/** Event end in ms — timed uses endsAt (or start); all-day uses end-of-local-end-day. */
function eventEndMs(e: TodayEvent): number {
  if (!e.allDay) {
    if (e.endsAt) return new Date(e.endsAt).getTime()
    if (e.startsAt) return new Date(e.startsAt).getTime()
    return Number.MAX_SAFE_INTEGER
  }
  const key = e.endDate ?? e.startDate
  if (!key) return Number.MAX_SAFE_INTEGER
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999).getTime()
}

/** Does the event overlap the given local day? (Handles timed / all-day / multi-day.) */
function eventCoversDay(e: TodayEvent, dayKey: string): boolean {
  return eventStartMs(e) <= dayEndMs(dayKey) && eventEndMs(e) >= dayStartMs(dayKey)
}

// ---------------------------------------------------------------------------
// OVERDUE semantics (documented rule):
//   A task is overdue when it is OPEN, assigned to me, has a dueAt, and that dueAt
//   is strictly in the past (dueAt < now). `dueAt` is a full timestamp in this
//   schema (0010), so there is no date-only ambiguity — we never treat a dated task
//   as overdue at 12:01 AM unless its stored time has actually passed.
// ---------------------------------------------------------------------------
function isOverdue(t: TodayTask, nowMs: number): boolean {
  return t.status === 'open' && !!t.dueAt && new Date(t.dueAt).getTime() < nowMs
}

/** Is this task's dueAt within the current LOCAL calendar day (and not past)? */
function isDueToday(t: TodayTask, now: Date): boolean {
  if (t.status !== 'open' || !t.dueAt) return false
  const dueMs = new Date(t.dueAt).getTime()
  const key = localDayKey(now)
  return dueMs >= now.getTime() && dueMs >= dayStartMs(key) && dueMs <= dayEndMs(key)
}

function nameOf(input: TodayInput, personId: string | null): string | null {
  if (!personId) return null
  return input.people.find((p) => p.id === personId)?.displayName ?? null
}

// Numeric rank for attention ordering — LOWER = more urgent. Transparent + fixed.
const ATTENTION_RANK: Record<AttentionKind, number> = {
  care_handoff_incoming: 0, // someone is waiting on me to take the baby — most urgent
  task_awaiting_acceptance: 1, // a responsibility was handed to me; I haven't taken it
  task_overdue: 2,
  task_due_today: 3,
  event_responsible_soon: 4,
}

// ---------------------------------------------------------------------------
// buildTodayModel — the projection.
// ---------------------------------------------------------------------------
export function buildTodayModel(input: TodayInput): TodayModel {
  const {
    mePersonId,
    meUserId,
    tasks,
    tasksState,
    events,
    calendarState,
    careHolderPersonId,
    carePending,
    careContext,
    careState,
    groceryActiveCount,
    groceryState,
    now,
  } = input
  const nowMs = now.getTime()
  const todayKey = localDayKey(now)

  const failedDomains: TodayModel['failedDomains'] = []
  if (tasksState === 'error') failedDomains.push('tasks')
  if (calendarState === 'error') failedDomains.push('calendar')
  if (careState === 'error') failedDomains.push('care')
  if (groceryState === 'error') failedDomains.push('grocery')

  // Loading only while ALL core domains are still loading — a partial load renders
  // truthful partial state rather than a global spinner.
  const coreStates = [tasksState, calendarState, careState]
  const isLoading = coreStates.every((s) => s === 'loading')

  // ---- Attention ---------------------------------------------------------
  const attention: AttentionItem[] = []

  // Care handoff waiting on ME (I'm the recipient of a pending handoff).
  if (
    careState === 'ok' &&
    carePending &&
    carePending.status === 'pending' &&
    mePersonId &&
    carePending.toPersonId === mePersonId
  ) {
    attention.push({
      kind: 'care_handoff_incoming',
      refId: carePending.id,
      title: 'Care handoff waiting for you',
      at: null,
      fromName: nameOf(input, carePending.fromPersonId),
    })
  }

  // My tasks: awaiting acceptance, overdue, due today (mutually exclusive priority).
  if (tasksState === 'ok' && mePersonId) {
    for (const t of tasks) {
      if (t.status !== 'open' || t.assignedToPersonId !== mePersonId) continue
      if (!t.acknowledgedAt) {
        attention.push({ kind: 'task_awaiting_acceptance', refId: t.id, title: t.title, at: t.dueAt })
      } else if (isOverdue(t, nowMs)) {
        attention.push({ kind: 'task_overdue', refId: t.id, title: t.title, at: t.dueAt })
      } else if (isDueToday(t, now)) {
        attention.push({ kind: 'task_due_today', refId: t.id, title: t.title, at: t.dueAt })
      }
    }
  }

  // A commitment TODAY where I'm the responsible person (timed, still upcoming/ongoing).
  if (calendarState === 'ok' && mePersonId) {
    for (const e of events) {
      if (e.responsiblePersonId !== mePersonId) continue
      if (!eventCoversDay(e, todayKey)) continue
      // Only surface as attention if it hasn't ended yet (don't nag about past events).
      if (eventEndMs(e) < nowMs) continue
      attention.push({
        kind: 'event_responsible_soon',
        refId: e.id,
        title: e.title,
        at: e.allDay ? null : e.startsAt,
      })
    }
  }

  attention.sort((a, b) => {
    const r = ATTENTION_RANK[a.kind] - ATTENTION_RANK[b.kind]
    if (r !== 0) return r
    // Within a kind: earlier anchored time first; nulls last; stable by refId.
    const am = a.at ? new Date(a.at).getTime() : Number.MAX_SAFE_INTEGER
    const bm = b.at ? new Date(b.at).getTime() : Number.MAX_SAFE_INTEGER
    if (am !== bm) return am - bm
    return a.refId < b.refId ? -1 : a.refId > b.refId ? 1 : 0
  })

  // ---- Today's commitments (chronological) -------------------------------
  const commitments: TodayCommitment[] = []
  if (calendarState === 'ok') {
    const todays = events.filter((e) => eventCoversDay(e, todayKey))
    todays.sort((a, b) => {
      // All-day first, then by start time.
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
      return eventStartMs(a) - eventStartMs(b)
    })
    for (const e of todays) {
      const isResponsible = !!mePersonId && e.responsiblePersonId === mePersonId
      const isParticipant = !!mePersonId && e.participantIds.includes(mePersonId)
      const myRole: TodayCommitment['myRole'] = isResponsible ? 'responsible' : isParticipant ? 'attending' : 'other'
      commitments.push({
        id: e.id,
        title: e.title,
        startsAt: e.allDay ? null : e.startsAt,
        allDay: e.allDay,
        myRole,
        responsibleName: nameOf(input, e.responsiblePersonId),
        participantNames: e.participantIds.map((id) => nameOf(input, id)).filter((n): n is string => !!n),
      })
    }
  }

  // ---- Mine (open tasks I own) -------------------------------------------
  const mine: MineTask[] = []
  if (tasksState === 'ok' && mePersonId) {
    const mineTasks = tasks.filter((t) => t.status === 'open' && t.assignedToPersonId === mePersonId)
    for (const t of mineTasks) {
      mine.push({
        id: t.id,
        title: t.title,
        dueAt: t.dueAt,
        acceptance: t.acknowledgedAt ? 'accepted' : 'assigned',
        overdue: isOverdue(t, nowMs),
      })
    }
    mine.sort((a, b) => {
      // overdue first, then earliest due, then undated last, stable by id.
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
      const am = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER
      const bm = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER
      if (am !== bm) return am - bm
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
  }

  // ---- Household (what OTHERS are currently handling) --------------------
  // Only open tasks owned by a DIFFERENT person than me. Grouped by owner. This is
  // "someone else has it, so I can let it go" — not surveillance of every task.
  const household: HouseholdResponsibility[] = []
  if (tasksState === 'ok') {
    const byPerson = new Map<string, HouseholdResponsibility>()
    for (const t of tasks) {
      if (t.status !== 'open' || !t.assignedToPersonId) continue
      if (mePersonId && t.assignedToPersonId === mePersonId) continue // that's "mine"
      const pid = t.assignedToPersonId
      const pname = nameOf(input, pid)
      if (!pname) continue // don't show a nameless owner
      if (!byPerson.has(pid)) byPerson.set(pid, { personId: pid, personName: pname, tasks: [] })
      byPerson.get(pid)!.tasks.push({
        id: t.id,
        title: t.title,
        acceptance: t.acknowledgedAt ? 'accepted' : 'assigned',
      })
    }
    for (const entry of byPerson.values()) {
      // Stable ordering: by person name, then task id.
      entry.tasks.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      household.push(entry)
    }
    household.sort((a, b) => (a.personName < b.personName ? -1 : a.personName > b.personName ? 1 : 0))
  }

  // ---- Care --------------------------------------------------------------
  const iHoldCare = careState === 'ok' && !!mePersonId && careHolderPersonId === mePersonId
  // A pending handoff I proposed to someone else (I'm the sender / from-person).
  let outgoingPendingToName: string | null = null
  if (
    careState === 'ok' &&
    carePending &&
    carePending.status === 'pending' &&
    ((mePersonId && carePending.fromPersonId === mePersonId) ||
      (meUserId && carePending.proposedByUserId === meUserId)) &&
    !(mePersonId && carePending.toPersonId === mePersonId)
  ) {
    outgoingPendingToName = nameOf(input, carePending.toPersonId)
  }

  // ---- Empty ------------------------------------------------------------
  // Genuinely empty only when every domain loaded OK and produced nothing relevant.
  const allOk =
    tasksState === 'ok' && calendarState === 'ok' && careState === 'ok' && groceryState === 'ok'
  const isEmpty =
    allOk &&
    attention.length === 0 &&
    commitments.length === 0 &&
    mine.length === 0 &&
    household.length === 0 &&
    !iHoldCare &&
    !outgoingPendingToName &&
    !careContext.lastFeed &&
    !careContext.lastDiaper &&
    !careContext.lastNap &&
    groceryActiveCount === 0

  return {
    attention,
    commitments,
    mine,
    household,
    care: {
      holderPersonId: careHolderPersonId,
      holderName: nameOf(input, careHolderPersonId),
      iHoldCare,
      context: careContext,
      outgoingPendingToName,
    },
    grocery: { activeCount: groceryActiveCount },
    isEmpty,
    failedDomains,
    isLoading,
  }
}
