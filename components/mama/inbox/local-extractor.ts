// A deterministic, rule-based Extractor. No network, no AI, fully private and
// testable. It implements the same Extractor interface a future GeminiExtractor
// will, so the Inbox never needs to know which one is running.

import type { Extractor, ProposedItem, ProposedKind } from './types'
import type { LogKind } from '../logs'

let seq = 0
function pid(): string {
  seq += 1
  return `prop_${Date.now().toString(36)}_${seq}_${Math.random().toString(36).slice(2, 5)}`
}

/**
 * Split a brain dump into clauses on sentence punctuation, commas, and common
 * conjunctions — so "doctor Thursday, ask about the rash, buy formula" becomes
 * three separate items. We first protect "<day>, <time>" commas (e.g.
 * "Thursday, 11am") by turning that comma into a space, so a date+time stays one
 * clause instead of splitting into a title-less appointment and a stray time.
 */
function splitClauses(text: string): string[] {
  const dayTime =
    /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|today|tomorrow)\s*,\s*(?=\d{1,2}(:\d{2})?\s*(am|pm)?\b)/gi
  const protectedText = text.replace(dayTime, '$1 ')
  return protectedText
    .split(/[\n.;!?,]+|\s+(?:and then|and|then|also|plus)\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/* ---------------- time parsing ---------------- */

// Resolve a rough time reference in a clause to an ISO timestamp, relative to now.
function parseWhen(clause: string, now: Date): string | undefined {
  const lower = clause.toLowerCase()
  const base = new Date(now)

  // Day words
  let dayOffset: number | null = null
  if (/\btomorrow\b/.test(lower)) dayOffset = 1
  else if (/\btoday\b/.test(lower)) dayOffset = 0
  else if (/\byesterday\b/.test(lower)) dayOffset = -1

  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const wdIndex = weekdays.findIndex((d) => new RegExp(`\\b${d}\\b`).test(lower))

  // Clock time like "2", "2pm", "11:30 am"
  const timeMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/)
  let hour: number | null = null
  let minute = 0
  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10)
    minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0
    const mer = timeMatch[3]
    if (mer === 'pm' && hour < 12) hour += 12
    if (mer === 'am' && hour === 12) hour = 0
    // Bare "around 2" with no am/pm during daytime context → assume afternoon if <8
    if (!mer && hour <= 7) hour += 12
  }

  const applied = new Date(base)
  let touched = false

  if (wdIndex >= 0) {
    const diff = (wdIndex - base.getDay() + 7) % 7 || 7 // next occurrence
    applied.setDate(base.getDate() + diff)
    touched = true
  } else if (dayOffset !== null) {
    applied.setDate(base.getDate() + dayOffset)
    touched = true
  }

  if (hour !== null) {
    applied.setHours(hour, minute, 0, 0)
    touched = true
  }

  return touched ? applied.toISOString() : undefined
}

/* ---------------- clause → proposal ---------------- */

function amountFrom(clause: string): string | undefined {
  const m = clause.match(/(\d+(?:\.\d+)?)\s*(oz|ounce|ounces|ml)\b/i)
  if (!m) return undefined
  const unit = /ml/i.test(m[2]) ? 'ml' : 'oz'
  return `${m[1]} ${unit}`
}

function makeItem(kind: ProposedKind, label: string, confidence: ProposedItem['confidence']): ProposedItem {
  return { id: pid(), kind, label, include: true, confidence }
}

function classify(clause: string, now: Date): ProposedItem | null {
  const lower = clause.toLowerCase()

  // --- Appointment (before task, since "doctor" can appear in both) ---
  if (/\b(appointment|appt|checkup|check-up|doctor|pediatric|vaccine|vaccination|clinic|visit)\b/.test(lower) &&
      !/\b(ask|question)\b/.test(lower)) {
    const whenISO = parseWhen(clause, now) ?? defaultApptTime(now)
    const title = titleCase(stripFillers(clause)) || 'Appointment'
    const item = makeItem('appointment', `${title} · ${friendly(whenISO)}`, parseWhen(clause, now) ? 'high' : 'medium')
    item.appointment = { title, whenISO }
    return item
  }

  // --- Feed ---
  const amount = amountFrom(clause)
  if (amount || /\b(fed|feed|feeding|bottle|nursed|nursing|breast(?:fed|feed)?)\b/.test(lower)) {
    const whenISO = parseWhen(clause, now)
    const item = makeItem('log', `Feed${amount ? ` · ${amount}` : ''}`, amount ? 'high' : 'medium')
    item.log = { logKind: 'feed', amount, whenISO }
    return item
  }

  // --- Diaper ---
  const diaperType = /\bdirty|poop|poo|bm\b/.test(lower)
    ? 'dirty'
    : /\bwet|pee\b/.test(lower)
      ? 'wet'
      : /\bmixed|both\b/.test(lower)
        ? 'mixed'
        : undefined
  if (diaperType || /\bdiaper|nappy\b/.test(lower)) {
    const item = makeItem('log', `Diaper${diaperType ? ` · ${diaperType}` : ''}`, diaperType ? 'high' : 'medium')
    item.log = { logKind: 'diaper', diaperType, whenISO: parseWhen(clause, now) }
    return item
  }

  // --- Sleep ---
  if (/\b(nap|napped|slept|sleep|sleeping|down for)\b/.test(lower)) {
    const item = makeItem('log', 'Sleep', 'medium')
    item.log = { logKind: 'sleep', whenISO: parseWhen(clause, now) }
    return item
  }

  // --- Pumping ---
  if (/\bpump(?:ed|ing)?\b/.test(lower)) {
    const amt = amountFrom(clause)
    const item = makeItem('log', `Pumping${amt ? ` · ${amt}` : ''}`, 'medium')
    item.log = { logKind: 'pumping', amount: amt, whenISO: parseWhen(clause, now) }
    return item
  }

  // --- Medication ---
  if (/\b(medication|medicine|meds|vitamin|tylenol|dose|drops)\b/.test(lower)) {
    const item = makeItem('log', 'Medication', 'medium')
    item.log = { logKind: 'medication' as LogKind, whenISO: parseWhen(clause, now) }
    item.text = titleCase(clause)
    return item
  }

  // --- Question for the doctor ---
  if (/\b(ask|question)\b/.test(lower)) {
    const text = titleCase(stripFillers(clause))
    const item = makeItem('question', `Ask: ${text}`, 'medium')
    item.text = text
    return item
  }

  // --- Mom task (reminders / errands) ---
  if (/\b(remind|remember|buy|pick up|pickup|call|order|schedule|book|refill|need to|don'?t forget)\b/.test(lower)) {
    const text = titleCase(stripFillers(clause))
    const item = makeItem('task', text, 'medium')
    item.text = text
    return item
  }

  // --- Fallback: a note (low confidence, off by default is too aggressive; keep on) ---
  const text = titleCase(clause)
  const note = makeItem('note', text, 'low')
  note.text = text
  return note
}

export const localExtractor: Extractor = {
  extract(rawText: string): ProposedItem[] {
    const now = new Date()
    return splitClauses(rawText)
      .map((c) => classify(c, now))
      .filter((x): x is ProposedItem => x !== null)
  },
}

/* ---------------- helpers ---------------- */

function defaultApptTime(now: Date): string {
  const d = new Date(now)
  d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  return d.toISOString()
}

function friendly(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Drop leading filler verbs so "remind me to buy formula" → "Buy formula".
function stripFillers(clause: string): string {
  return clause
    .replace(/^\s*(please\s+)?(remind me to|remind me|remember to|remember|don'?t forget to|don'?t forget|i need to|need to|ask (?:about|the doctor about)?|make sure to)\s+/i, '')
    .replace(/^\s*(the|a|an)\s+/i, '')
    .trim()
}

function titleCase(s: string): string {
  const t = s.trim()
  if (!t) return t
  return t.charAt(0).toUpperCase() + t.slice(1)
}
