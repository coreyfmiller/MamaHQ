// MamaHQ — First 90 Days TEMPORAL-CORRECTNESS guard (editorial regression test).
//
// Pure, no network, no DB, no AI. Day N is displayed for the ENTIRE in-progress local
// calendar day N, so at any moment at most N−1 days are COMPLETE (see
// docs/FIRST90_TEMPORAL_RULES.md). This scanner catches the OBVIOUS temporal
// regressions without rejecting legitimate warm prose:
//
//   1. a completion verb ("made it through", "got through", "completed", "finished",
//      "survived", "is complete", "behind you", "N down") bound to the CURRENT-or-
//      future unit for day N — i.e. "Day N", "N days", the current week/month. The
//      SAFE forms ("made it through 13 days" on Day 14, present-tense labels like
//      "Two months.", "N days in") are deliberately NOT flagged.
//   2. a night affirmation declaring its OWN day/week/month complete (night can begin
//      at 18:00, up to ~6h before midnight). Day 90 night is the end-of-program
//      exception.
//   3. authoring/editorial notes leaking into user-facing read body/prompt.
//   4. a daily read asserting a time of day ("this morning", "tonight", "yesterday",
//      "tomorrow") — reads have NO morning/noon/night guarantee.
//
// It keys on completion-verb + current-day-unit, NOT on individual banned words, so
// legitimate phrasing passes.
//
//   node scripts/test-first90-temporal.ts   (npm run test:first90-temporal)

import { AFFIRMATIONS, type Slot } from '../lib/affirmations.ts'
import { ALL_READS, type DailyRead } from '../lib/daily-reads.ts'

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

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ')

// Completion verbs/phrases that assert a span is OVER.
const COMPLETION = [
  'made it through',
  'got through',
  'you completed',
  'you finished',
  'is complete',
  'are complete',
  'behind you',
  'survived',
]

// For a given day N, the unit references that would be FALSE if said to be complete
// (the current or a not-yet-finished unit). We DON'T flag "N-1 days" style truths.
function currentUnitPhrases(day: number): string[] {
  const spelledDays = numberWord(day)
  const phrases = [`day ${day}`, `${day} days`, `${day} sunsets`, `${day} nights`]
  // The current, in-progress week/month (floor+1), which is NOT finished on day N.
  if (day <= 7) phrases.push('first week', 'your first week')
  if (day <= 30) phrases.push('first month', 'your first month')
  // "N down" shorthand (e.g. "two weeks down", "fourteen days down") for the current
  // count — both numeric and spelled, for days and weeks.
  const weeks = Math.ceil(day / 7)
  phrases.push(`${weeks} weeks down`, `${day} days down`)
  const spelledWeeks = numberWord(weeks)
  if (spelledWeeks) phrases.push(`${spelledWeeks} weeks down`)
  if (spelledDays) phrases.push(`${spelledDays} days`, `${spelledDays} sunsets`, `${spelledDays} days down`)
  return phrases
}

function numberWord(n: number): string {
  const words: Record<number, string> = {
    1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven',
    8: 'eight', 9: 'nine', 10: 'ten', 14: 'fourteen', 21: 'twenty-one', 30: 'thirty',
    40: 'forty', 45: 'forty-five', 50: 'fifty', 60: 'sixty', 70: 'seventy',
    75: 'seventy-five', 80: 'eighty', 89: 'eighty-nine', 90: 'ninety',
  }
  return words[n] ?? ''
}

// Does `text` claim a CURRENT-unit completion for day N? (completion verb anywhere +
// a current-unit phrase anywhere in the same short string.)
function assertsCurrentCompletion(text: string, day: number): string | null {
  const t = norm(text)
  const units = currentUnitPhrases(day)
  // "N days down" / "N weeks down" is self-completing: the "...down" phrase IS the
  // claim, no separate verb needed.
  const downUnit = units.find((u) => u.endsWith(' down') && t.includes(u))
  if (downUnit) return `"${downUnit}"`
  // Otherwise require a completion verb bound to a current-unit reference.
  const hasCompletion = COMPLETION.find((c) => t.includes(c))
  if (!hasCompletion) return null
  const unit = units.find((u) => u && !u.endsWith(' down') && t.includes(u))
  if (!unit) return null
  return `"${hasCompletion}" + "${unit}"`
}

// ==========================================================================
// Rule 1 + 2 — affirmations: no current-day completion; night slot especially.
// ==========================================================================
for (let day = 1; day <= 90; day++) {
  const entry = AFFIRMATIONS[day]
  ok(!!entry, `Day ${day}: affirmations present`)
  if (!entry) continue
  for (const slot of ['morning', 'noon', 'night'] as Slot[]) {
    const text = entry[slot]
    // Day 90 night is the deliberate end-of-program celebration (the journey really is
    // complete at the last displayed day), so it's exempt from the completion check.
    if (day === 90 && slot === 'night') continue
    const hit = assertsCurrentCompletion(text, day)
    ok(hit === null, `Day ${day} ${slot}: must not claim the in-progress day/week/month is complete — found ${hit} in ${JSON.stringify(text)}`)
  }
}

// Morning must not assume today's events already happened. Narrow to actual
// completed-today assertions ("you already ...", "this morning you ...", "today has
// been ..."), NOT present-tense "today you know ..." which is correct.
const MORNING_PAST_EVENT = [
  'this morning you',
  'today you fed',
  'today you comforted',
  'today has been',
  'you already fed',
]
for (let day = 1; day <= 90; day++) {
  const text = norm(AFFIRMATIONS[day]?.morning ?? '')
  const bad = MORNING_PAST_EVENT.find((p) => text.includes(p))
  ok(!bad, `Day ${day} morning: must not assume today's events happened — found "${bad}"`)
}

// ==========================================================================
// Rule 3 — reads: no authoring/editorial notes in user-facing body/prompt.
// ==========================================================================
const AUTHORING_MARKERS = [
  'post-audit',
  'product notes',
  'hide the machinery',
  'must be contextual',
  'needs a verified layer',
  'protect variety',
  'do not optimize mom',
  'avoid fake intimacy',
]
for (const r of ALL_READS) {
  const strings = [...r.body, r.prompt ?? '']
  for (const s of strings) {
    const marker = AUTHORING_MARKERS.find((m) => norm(s).includes(m))
    ok(!marker, `Day ${r.day} read: authoring note leaked into user copy — "${marker}" in ${JSON.stringify(s)}`)
  }
}

// ==========================================================================
// Rule 1 (reads) + Rule 4 — reads: no current-day completion, no time-of-day assertion
// (reads have NO slot guarantee; they can be opened at any hour).
// ==========================================================================
// A read must not FACTUALLY assert how the user's clock-day went (reads have no slot
// guarantee). The dangerous construction is a definite time word bound to a factual
// past-tense claim about the user's day, e.g. "Yesterday worked. Today doesn't." We do
// NOT flag idiomatic/rhetorical use ("yesterday is not a contract", "don't solve it all
// tonight", "get yesterday back") — that is legitimate prose, and a blanket time-word
// ban would reject it (exactly the simplistic banned-word system to avoid).
const DAY_FACT_ASSERTION = [
  /\byesterday worked\b/,
  /\byesterday was (good|bad|hard|fine|better|worse)\b/,
  /\bthis morning (was|went|you woke|you fed|you comforted)\b/,
  /\blast night (was|you)\b/,
  /\btoday (?:has been|was|went) (good|bad|hard|fine|a disaster|terrible)\b/,
]
function readStrings(r: DailyRead): string[] {
  return [r.title, ...r.body, r.prompt ?? '']
}
for (const r of ALL_READS) {
  for (const s of readStrings(r)) {
    const hit = assertsCurrentCompletion(s, r.day)
    ok(hit === null, `Day ${r.day} read: must not claim the in-progress day is complete — found ${hit} in ${JSON.stringify(s)}`)
    const t = norm(s)
    const factHit = DAY_FACT_ASSERTION.find((re) => re.test(t))
    ok(!factHit, `Day ${r.day} read: factual time-of-day assertion about the user's day in a time-agnostic surface — ${JSON.stringify(s)}`)
  }
}

// ==========================================================================
// Milestone-specific locks (Days 1,2,7,14,30,42,60,90): week/month labels line up,
// and the specific night lines humans care about aren't completion claims.
// ==========================================================================
{
  // Week labels match the day count where present (present-tense "you're in week N").
  const weekLabel: Record<number, string> = { 21: 'three weeks', 42: 'six weeks', 49: 'seven weeks', 56: 'eight weeks', 63: 'nine weeks', 84: 'twelve weeks' }
  for (const [dayStr, label] of Object.entries(weekLabel)) {
    const day = Number(dayStr)
    const all = norm(Object.values(AFFIRMATIONS[day]).join(' '))
    ok(all.includes(label), `Day ${day}: expected the "${label}" label to match day count ${day}/7`)
  }
  // The three originally-broken night lines are now safe.
  for (const day of [1, 7, 30]) {
    ok(assertsCurrentCompletion(AFFIRMATIONS[day].night, day) === null, `Day ${day} night: regression guard (was a completion claim)`)
  }
  // Day 90 night SHOULD still celebrate the completed program (sanity: exemption real).
  ok(norm(AFFIRMATIONS[90].night).includes('first 90 days'), 'Day 90 night: end-of-program celebration preserved')
}

// ==========================================================================
// NEGATIVE SELF-TEST — the detector must actually FIRE on the known-bad forms, so it
// can't rot into a no-op. These are synthetic strings, not shipped content.
// ==========================================================================
{
  ok(assertsCurrentCompletion('You made it through Day 1.', 1) !== null, 'self: catches "made it through Day 1" on Day 1')
  ok(assertsCurrentCompletion('Your first week is complete.', 7) !== null, 'self: catches "first week is complete" on Day 7')
  ok(assertsCurrentCompletion('You made it through your first month.', 30) !== null, 'self: catches "first month" completion on Day 30')
  ok(assertsCurrentCompletion('Fourteen days down.', 14) !== null, 'self: catches "fourteen days down" on Day 14')
  // SAFE forms must NOT fire (guards against over-matching legitimate prose).
  ok(assertsCurrentCompletion("You've made it through 13 days.", 14) === null, 'self: allows "13 days" complete on Day 14')
  ok(assertsCurrentCompletion('Two months.', 60) === null, 'self: allows the present-tense label "Two months."')
  ok(assertsCurrentCompletion('Sixty days in, adapting.', 60) === null, 'self: allows "Sixty days in"')
  ok(/\byesterday worked\b/.test(norm('Yesterday worked. Today doesn\'t.')), 'self: day-fact regex catches "Yesterday worked"')
}

// ==========================================================================
console.log(`\nFirst 90 temporal guard: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log('  - ' + f)
  process.exit(1)
}
console.log('✓ all First 90 temporal-correctness checks passed')
process.exit(0)
