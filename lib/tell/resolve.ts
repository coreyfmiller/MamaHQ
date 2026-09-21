// MamaHQ — Tell MamaHQ deterministic resolution (Step 12).
//
// The safety core. Takes the UNTRUSTED (but schema-validated) raw interpretation
// plus CANONICAL household state, and produces resolved, reviewable proposals with
// explicit clarification issues. PURE and fully unit-testable — no network, no DB,
// no model. This is where "model output is not authorized data" is enforced:
//   * people are resolved by name against the real household (never invented, never
//     a model-supplied id),
//   * "me" resolves to the account's linked person only,
//   * times are normalized against the user's real local now,
//   * missing/ambiguous information becomes a deterministic issue, not a guess.

import type {
  RawInterpretation,
  RawProposal,
  ProposedWhen,
  ResolvedProposal,
  ResolvedPersonRef,
  ProposalIssue,
  TellInterpretation,
} from './contract.ts'
import { TELL_INTERPRETER_VERSION, TELL_SCHEMA_VERSION } from './contract.ts'

// Canonical person as the resolver needs it. `hasAccount` = a connected account
// (can be a care-handoff recipient / can later accept). `isMe` = linked to the
// current authenticated account.
export interface CanonicalPerson {
  id: string
  displayName: string
  hasAccount: boolean
  isMe: boolean
}

export interface ResolveContext {
  people: CanonicalPerson[]
  // Local "now" as a real Date (the server passes the user's local now).
  now: Date
  // A stable id generator (crypto.randomUUID in prod; deterministic in tests).
  newId: () => string
}

const ME_TOKENS = new Set(['me', 'myself', 'i', 'my', "myself's"])

// Resolve a single person reference against the household. Returns the resolution
// plus any issue (ambiguous/unknown/no-me). Never invents a person.
function resolvePerson(
  raw: string,
  ctx: ResolveContext,
  field: NonNullable<ProposalIssue['field']>,
): { ref: ResolvedPersonRef; issue: ProposalIssue | null } {
  const token = raw.trim()
  const lower = token.toLowerCase()

  if (ME_TOKENS.has(lower)) {
    const me = ctx.people.find((p) => p.isMe)
    if (!me) {
      return {
        ref: { raw, personId: null, displayName: null },
        issue: {
          code: 'no_me_person',
          message: 'Your account isn’t linked to a person in this household yet, so I can’t use “me” here.',
          field,
        },
      }
    }
    return { ref: { raw, personId: me.id, displayName: me.displayName }, issue: null }
  }

  // Case-insensitive display-name match. Exact (normalized) matches first, then a
  // startsWith fallback for first-name references.
  const norm = (s: string) => s.trim().toLowerCase()
  const exact = ctx.people.filter((p) => norm(p.displayName) === lower)
  const partial =
    exact.length === 0
      ? ctx.people.filter((p) => norm(p.displayName).split(/\s+/)[0] === lower || norm(p.displayName).startsWith(lower))
      : []
  const matches = exact.length > 0 ? exact : partial

  if (matches.length === 0) {
    return {
      ref: { raw, personId: null, displayName: null },
      issue: {
        code: 'unknown_person',
        message: `I don’t recognize “${token}” as someone in this household.`,
        field,
      },
    }
  }
  if (matches.length > 1) {
    return {
      ref: { raw, personId: null, displayName: null },
      issue: {
        code: 'ambiguous_person',
        message: `There’s more than one “${token}” in this household. Which one?`,
        field,
        candidates: matches.map((p) => ({ personId: p.id, displayName: p.displayName })),
      },
    }
  }
  return { ref: { raw, personId: matches[0].id, displayName: matches[0].displayName }, issue: null }
}

// ---------------------------------------------------------------------------
// Time normalization — deterministic, against the user's real local now.
// ---------------------------------------------------------------------------

// Build a local ISO timestamp string (with the runtime's offset) from a date +
// time. We construct a Date in local time so downstream toLocale display + the
// existing calendar model (which stores an instant) stay consistent with the app's
// offset conventions.
function localTimestamp(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0)
  return dt.toISOString()
}

// Human label for a card, e.g. "Thursday, Sep 24 · 6:00 PM" or "Sep 24 (all day)".
function whenLabel(opts: { date?: string; time?: string; allDay?: boolean }): string | null {
  if (!opts.date && !opts.time) return null
  if (opts.date) {
    const [y, m, d] = opts.date.split('-').map(Number)
    const base = new Date(y, (m ?? 1) - 1, d ?? 1)
    const dateStr = base.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })
    if (opts.allDay) return `${dateStr} (all day)`
    if (opts.time) {
      const [hh, mm] = opts.time.split(':').map(Number)
      const withTime = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0)
      return `${dateStr} · ${withTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
    }
    return dateStr
  }
  // time only, no date
  if (opts.time) {
    const [hh, mm] = opts.time.split(':').map(Number)
    const t = new Date()
    t.setHours(hh ?? 0, mm ?? 0, 0, 0)
    return t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  return null
}

// ---------------------------------------------------------------------------
// Per-proposal resolution
// ---------------------------------------------------------------------------

function resolveOne(raw: RawProposal, ctx: ResolveContext): ResolvedProposal {
  const id = ctx.newId()
  const issues: ProposalIssue[] = []

  switch (raw.type) {
    case 'GROCERY_ADD': {
      // Product resolution is done by the deterministic grocery pipeline downstream;
      // here we just carry the phrase. displayName defaults to the phrase and is
      // refined at execution via resolveGroceryPhrase.
      return {
        id,
        kind: 'GROCERY_ADD',
        status: 'ready',
        issues,
        phrase: raw.phrase,
        displayName: raw.phrase,
      }
    }

    case 'TASK_CREATE': {
      let assignee: ResolvedPersonRef | null = null
      if (raw.assigneeRef) {
        const r = resolvePerson(raw.assigneeRef, ctx, 'assignee')
        assignee = r.ref
        if (r.issue) issues.push(r.issue)
      }
      const { iso, label } = normalizeTaskWhen(raw.when)
      return {
        id,
        kind: 'TASK_CREATE',
        status: issues.length ? 'needs_clarification' : 'ready',
        issues,
        title: raw.title,
        assignee,
        dueISO: iso,
        dueLabel: label,
        notes: raw.notes ?? null,
      }
    }

    case 'CALENDAR_CREATE': {
      const participants: ResolvedPersonRef[] = []
      for (const ref of raw.participantRefs ?? []) {
        const r = resolvePerson(ref, ctx, 'participant')
        participants.push(r.ref)
        if (r.issue) issues.push(r.issue)
      }
      let responsible: ResolvedPersonRef | null = null
      if (raw.responsibleRef) {
        const r = resolvePerson(raw.responsibleRef, ctx, 'responsible')
        responsible = r.ref
        if (r.issue) issues.push(r.issue)
      }

      const when = raw.when ?? {}
      const allDay = Boolean(when.allDay)
      let startISO: string | null = null
      let startDate: string | null = null

      if (allDay) {
        if (!when.date) {
          issues.push({ code: 'missing_date', message: 'This looks like an all-day event, but I don’t have a date. Which day?' })
        } else {
          startDate = when.date
        }
      } else {
        // Timed event: a calendar event needs BOTH a date and a time to be an
        // unambiguous instant. Surface exactly what's missing.
        if (!when.date && !when.time) {
          issues.push({ code: 'missing_date', message: 'When is this? I need a day (and a time).' })
        } else if (!when.date) {
          issues.push({ code: 'missing_date', message: 'I have a time but not a day. Which day?' })
        } else if (!when.time) {
          issues.push({ code: 'missing_time', message: 'I have a day but not a time. What time?' })
        } else {
          startISO = localTimestamp(when.date, when.time)
        }
      }

      return {
        id,
        kind: 'CALENDAR_CREATE',
        status: issues.length ? 'needs_clarification' : 'ready',
        issues,
        title: raw.title,
        allDay,
        startISO,
        startDate,
        whenLabel: whenLabel({ date: when.date, time: when.time, allDay }),
        participants,
        responsible,
        location: raw.location ?? null,
        notes: raw.notes ?? null,
      }
    }

    case 'CARE_HANDOFF_PROPOSE': {
      const r = resolvePerson(raw.toRef, ctx, 'recipient')
      let recipient = r.ref
      if (r.issue) {
        issues.push(r.issue)
      } else if (recipient.personId) {
        // Care handoff recipient MUST be a connected account (only they can accept).
        const person = ctx.people.find((p) => p.id === recipient.personId)
        if (person && !person.hasAccount) {
          issues.push({
            code: 'recipient_not_connected',
            message: `${person.displayName} doesn’t have their own MamaHQ account, so they can’t accept a care handoff.`,
            field: 'recipient',
          })
          recipient = { ...recipient }
        }
      }
      return {
        id,
        kind: 'CARE_HANDOFF_PROPOSE',
        status: issues.length ? 'needs_clarification' : 'ready',
        issues,
        recipient,
      }
    }
  }
}

// Normalize a task's due "when". Tasks tolerate a date without a time (due date);
// a time without a date is ambiguous but we keep it best-effort as today's time
// only if a date is present. Returns an ISO instant when we have date (+ optional
// time), else null. No issue is raised for a task missing a time (unlike calendar).
function normalizeTaskWhen(when: ProposedWhen | undefined): { iso: string | null; label: string | null } {
  if (!when || (!when.date && !when.time)) return { iso: null, label: null }
  if (when.date) {
    const iso = localTimestamp(when.date, when.time ?? '09:00')
    return { iso, label: whenLabel({ date: when.date, time: when.time }) }
  }
  // time only, no date → no reliable due instant; keep label, leave iso null.
  return { iso: null, label: whenLabel({ time: when.time }) }
}

// ---------------------------------------------------------------------------
// Public entry: resolve a whole interpretation into reviewable proposals.
// ---------------------------------------------------------------------------

export function resolveInterpretation(raw: RawInterpretation, ctx: ResolveContext): TellInterpretation {
  const proposals = raw.proposals.map((p) => resolveOne(p, ctx))
  return {
    interpreterVersion: TELL_INTERPRETER_VERSION,
    schemaVersion: TELL_SCHEMA_VERSION,
    summary: raw.summary ?? null,
    proposals,
    unsupported: (raw.unsupported ?? []).map((u) => ({ text: u.text, reason: u.reason })),
  }
}
