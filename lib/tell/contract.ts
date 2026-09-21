// MamaHQ — Tell MamaHQ structured action contract (Step 12).
//
//   AI proposes. MamaHQ validates. The user approves. Trusted domain services execute.
//   A proposal is NOT household truth.
//
// This module defines the STRICT, VERSIONED contract for what the interpreter is
// allowed to return, and the SAFE, resolved proposal shape the product/domain layer
// works with. Two distinct schemas on purpose:
//
//   1. RAW MODEL OUTPUT (`rawInterpretationSchema`) — untrusted. The LLM emits this.
//      It references PEOPLE ONLY by a `personRef` string (a display-name token or the
//      literal "me"), NEVER by a database id. The model can never mint a trusted uuid.
//
//   2. RESOLVED PROPOSALS (`ResolvedProposal`) — produced by the deterministic
//      resolver AFTER validating every reference against canonical household state.
//      Only these can be executed, and only after explicit user confirmation.
//
// Everything is a discriminated union on `type`, so validation and the execution
// dispatcher are exhaustive. No `action: string; payload: any`.

import { z } from 'zod'

// Bump when the contract shape changes; recorded with each capture for debugging.
export const TELL_SCHEMA_VERSION = 1 as const
export const TELL_INTERPRETER_VERSION = 'tell-mamahq-v1' as const

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

// Bounded free text — guards against oversized model payloads becoming proposals.
const shortText = z.string().trim().min(1).max(300)
const optionalText = z.string().trim().max(1000).optional()

// A reference to a household person, as the MODEL sees it: a name token the user
// said ("James", "Madelyn", "Grandma") or the literal "me"/"myself"/"I". The model
// MUST NOT emit uuids — reference resolution is deterministic and server-side.
const personRefSchema = z.string().trim().min(1).max(80)

// A normalized clock/date the model proposes. Kept as explicit parts so the
// deterministic layer (which knows the user's local now) does the actual math and
// the confirmation UI can show exactly what will happen. All optional so the model
// can express "Thursday, time unknown" without inventing precision.
export const proposedWhenSchema = z
  .object({
    // ISO date 'YYYY-MM-DD' the model resolved from the phrase (relative to the
    // provided local "today"). Absent = no date stated.
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    // 'HH:MM' 24h local time. Absent = no time stated.
    time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    // The model's judgment that this is an all-day/date-based event ("birthday").
    allDay: z.boolean().optional(),
  })
  .strict()
export type ProposedWhen = z.infer<typeof proposedWhenSchema>

// ---------------------------------------------------------------------------
// RAW proposal union (what the model emits) — people are personRef strings.
// ---------------------------------------------------------------------------

// NOTE: every raw object is `.strict()`. A model that hallucinates an EXTRA field —
// e.g. a `responsiblePersonId` uuid, a `familyId`, `accepted: true`, an `rpc` name —
// is REJECTED outright rather than having the field silently stripped. This makes
// "the model cannot smuggle a trusted field" an enforced guarantee, not a reliance
// on downstream code happening to ignore unknown keys. (Defense in depth: the
// resolver also only ever reads the allow-listed fields below.)

const rawGroceryAddSchema = z
  .object({
    type: z.literal('GROCERY_ADD'),
    // The grocery phrase to hand to the deterministic Grocery resolver, e.g.
    // "2% milk", "bananas". The model does NOT resolve products — the catalog does.
    phrase: shortText,
  })
  .strict()

const rawTaskCreateSchema = z
  .object({
    type: z.literal('TASK_CREATE'),
    title: shortText,
    // Who is responsible (a name token or "me"). Absent = unassigned.
    assigneeRef: personRefSchema.optional(),
    when: proposedWhenSchema.optional(), // due date/time
    notes: optionalText,
  })
  .strict()

const rawCalendarCreateSchema = z
  .object({
    type: z.literal('CALENDAR_CREATE'),
    title: shortText,
    when: proposedWhenSchema.optional(),
    // Who the event is ABOUT (participants) — distinct from who is responsible.
    participantRefs: z.array(personRefSchema).max(20).optional(),
    // Who is designated to handle it (a designation, NEVER an acceptance).
    responsibleRef: personRefSchema.optional(),
    location: z.string().trim().max(200).optional(),
    notes: optionalText,
  })
  .strict()

const rawCareHandoffSchema = z
  .object({
    type: z.literal('CARE_HANDOFF_PROPOSE'),
    // Who to hand the baby to. Must resolve to a CONNECTED account downstream.
    toRef: personRefSchema,
  })
  .strict()

export const rawProposalSchema = z.discriminatedUnion('type', [
  rawGroceryAddSchema,
  rawTaskCreateSchema,
  rawCalendarCreateSchema,
  rawCareHandoffSchema,
])
export type RawProposal = z.infer<typeof rawProposalSchema>

// The whole untrusted interpreter payload.
export const rawInterpretationSchema = z
  .object({
    version: z.literal(TELL_SCHEMA_VERSION),
    // A one-line human summary of what was understood (shown, never executed).
    summary: z.string().trim().max(400).optional(),
    proposals: z.array(rawProposalSchema).max(20),
    // Things the model recognized but cannot express as a supported action, e.g.
    // "buy a stroller from Amazon". Surfaced to the user; never turned into an action.
    unsupported: z
      .array(
        z
          .object({
            text: z.string().trim().max(300),
            reason: z.string().trim().max(200).optional(),
          })
          .strict(),
      )
      .max(20)
      .optional(),
  })
  .strict()
export type RawInterpretation = z.infer<typeof rawInterpretationSchema>

// ---------------------------------------------------------------------------
// RESOLVED proposals (post reference-resolution) — safe to review + execute.
// People are canonical household_people ids (validated against the family) or a
// deterministic clarification issue. The confirmation UI renders these.
// ---------------------------------------------------------------------------

export type ProposalKind =
  | 'GROCERY_ADD'
  | 'TASK_CREATE'
  | 'CALENDAR_CREATE'
  | 'CARE_HANDOFF_PROPOSE'

// A clarification the user must resolve before a proposal can execute. Deterministic
// (not raw model confidence): the real question is "can MamaHQ safely execute this?"
export type IssueCode =
  | 'ambiguous_person' // more than one household match for a name
  | 'unknown_person' // no household match — do not invent people
  | 'missing_date' // calendar/timed task needs a date
  | 'missing_time' // calendar timed event needs a time
  | 'recipient_not_connected' // care handoff target has no account
  | 'no_me_person' // "me" but the account is not linked to a person
  | 'invalid_reference' // a reference could not be validated
  | 'grocery_needs_confirmation' // grocery action resolver requires a choice

export interface ProposalIssue {
  code: IssueCode
  // Human sentence explaining the actual ambiguity (not "low confidence").
  message: string
  // For ambiguous_person: which field + the candidate person ids to choose from.
  field?: 'assignee' | 'responsible' | 'participant' | 'recipient'
  candidates?: { personId: string; displayName: string }[]
}

// A resolved reference: either a canonical person id, or unresolved (drives issues).
export interface ResolvedPersonRef {
  raw: string
  personId: string | null
  displayName: string | null
}

interface BaseResolved {
  // Stable id assigned at the boundary BEFORE execution — drives edit/remove,
  // execution state, retry, and idempotency. Never an array index.
  id: string
  kind: ProposalKind
  status: ProposalStatus
  issues: ProposalIssue[]
}

export type ProposalStatus =
  | 'ready' // fully resolved, safe to execute
  | 'needs_clarification' // one or more blocking issues
  | 'executing'
  | 'succeeded'
  | 'failed'
  | 'removed'

export interface ResolvedGroceryAdd extends BaseResolved {
  kind: 'GROCERY_ADD'
  phrase: string
  displayName: string // resolved by the deterministic grocery resolver
}

export interface ResolvedTaskCreate extends BaseResolved {
  kind: 'TASK_CREATE'
  title: string
  assignee: ResolvedPersonRef | null
  dueISO: string | null // normalized from ProposedWhen, or null
  dueLabel: string | null // human "Tomorrow · 9:00 AM" for the card
  notes: string | null
}

export interface ResolvedCalendarCreate extends BaseResolved {
  kind: 'CALENDAR_CREATE'
  title: string
  allDay: boolean
  startISO: string | null // timed instant (allDay=false)
  startDate: string | null // YYYY-MM-DD (allDay=true)
  whenLabel: string | null // human "Thursday, Sep 24 · 6:00 PM"
  participants: ResolvedPersonRef[]
  responsible: ResolvedPersonRef | null
  location: string | null
  notes: string | null
}

export interface ResolvedCareHandoff extends BaseResolved {
  kind: 'CARE_HANDOFF_PROPOSE'
  recipient: ResolvedPersonRef | null
}

export type ResolvedProposal =
  | ResolvedGroceryAdd
  | ResolvedTaskCreate
  | ResolvedCalendarCreate
  | ResolvedCareHandoff

export interface UnsupportedNote {
  text: string
  reason?: string
}

// The full result the server returns to the client for review.
export interface TellInterpretation {
  interpreterVersion: string
  schemaVersion: number
  summary: string | null
  proposals: ResolvedProposal[]
  unsupported: UnsupportedNote[]
}

// A proposal is ready iff it has no blocking issues.
export function isReady(p: ResolvedProposal): boolean {
  return p.issues.length === 0
}
