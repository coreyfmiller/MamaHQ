// Mama HQ — core data model (V1, first-90-days scope).
// One baby, one family context. All logs live in one timeline so Today can summarize quickly.

// ---------- Baby (the newborn) ----------
export type Baby = {
  id: string
  name: string
  birthDate: string // ISO date (YYYY-MM-DD); drives the Day N counter
  onboarded: boolean // false until the guided setup (real name + birth date) is completed
}

// ---------- Baby log entries ----------
// Speed over exhaustive data. Every entry has a stable id + createdAt.

export type FeedMethod = 'breast' | 'bottle'
export type BottleContents = 'breast-milk' | 'formula' | 'unspecified'
export type Side = 'left' | 'right' | 'both'

export type FeedEntry = {
  id: string
  kind: 'feed'
  createdAt: string // when it happened / was logged (for a session: the start)
  method: FeedMethod
  // breast:
  side?: Side
  durationMin?: number | null
  // A running breastfeeding session: endedAt null = still feeding. When set, the feed is done.
  // Elapsed is always DERIVED from createdAt/endedAt timestamps so it survives reload (Flow A/D).
  endedAt?: string | null
  // Optional per-side seconds accumulated during a session (left/right), for switch-side support.
  leftSec?: number | null
  rightSec?: number | null
  // bottle:
  contents?: BottleContents
  amountMl?: number | null
  note?: string | null
}

// Sleep is special: it can be ACTIVE (started, not ended). endedAt null = currently sleeping.
export type SleepEntry = {
  id: string
  kind: 'sleep'
  createdAt: string // start
  endedAt: string | null // null while baby is still sleeping
  note?: string | null
}

export type DiaperKind = 'wet' | 'dirty' | 'both'
export type DiaperEntry = {
  id: string
  kind: 'diaper'
  createdAt: string
  diaper: DiaperKind
  note?: string | null
}

export type PumpEntry = {
  id: string
  kind: 'pump'
  createdAt: string
  side: Side
  amountMl?: number | null
  note?: string | null
}

export type LogEntry = FeedEntry | SleepEntry | DiaperEntry | PumpEntry

// ---------- Plan (tasks, appointments, questions, lists) ----------

export type Task = {
  id: string
  kind: 'task'
  createdAt: string
  title: string
  dueText?: string | null // human phrase ("tomorrow")
  assignee?: string | null // e.g. "Matt", or null = Mom/unassigned
  done: boolean
  note?: string | null
}

export type Appointment = {
  id: string
  kind: 'appointment'
  createdAt: string
  title: string
  whenText?: string | null // "Thursday at 10"
  location?: string | null
  who?: string | null // provider/person
  note?: string | null
  questionIds: string[] // questions associated with this appointment
}

export type Question = {
  id: string
  kind: 'question'
  createdAt: string
  text: string
  appointmentId?: string | null
  answered: boolean
}

export type ShoppingListName = 'shopping' | 'supplies' | 'general'
export type ShoppingItem = {
  id: string
  kind: 'shopping'
  createdAt: string
  item: string
  list: ShoppingListName
  done: boolean
}

export type PlanItem = Task | Appointment | Question | ShoppingItem

// ---------- Inbox capture (provenance is ABSOLUTE — never overwrite original) ----------
// A proposed action the AI extracted from a capture, awaiting the user's approval.

export type ProposedAction =
  | { type: 'appointment'; title: string; whenText?: string | null; location?: string | null; who?: string | null }
  | { type: 'question'; text: string }
  | { type: 'shopping'; item: string; list: ShoppingListName }
  | { type: 'task'; title: string; dueText?: string | null; assignee?: string | null }

export type InboxCapture = {
  id: string
  createdAt: string
  originalInput: string // VERBATIM, IMMUTABLE — never overwrite (data-and-ai-standard Rule 2)
  interpretation: string // short human summary of what the AI understood
  proposed: ProposedAction[] // what the AI proposed
  approved: ProposedAction[] // what the user actually committed (after edits/removals)
  status: 'proposed' | 'committed' | 'dismissed'
}

// ---------- Memories (the tiny moments hiding in the chaos) ----------
// V1 is text-only: a dated moment you don't want to forget. Photo attachments
// are a planned follow-up (Supabase Storage) — not faked here.

export type Memory = {
  id: string
  createdAt: string // when it was logged
  occurredOn: string // ISO date (YYYY-MM-DD) — the day the moment happened
  title: string // short label ("First real smile")
  note?: string | null // optional longer detail
}

// ---------- Mom check-in (gentle self-care prompts on Today) ----------
// Support for Mom, never evaluation. Records only that she ticked a prompt today. No scores.
export type MomCheckinItem = 'water' | 'eat' | 'rest'
export type MomCheckinToday = Record<MomCheckinItem, boolean>

// ---------- Whole app state ----------
export type AppState = {
  baby: Baby
  logs: LogEntry[]
  plan: PlanItem[]
  captures: InboxCapture[]
  memories: Memory[]
  // Which self-care prompts Mom has ticked TODAY (derived from mom_checkins).
  momCheckin: MomCheckinToday
}
