// MamaHQ — First 90 Days journey tests (Beta Phase 4).
//
// Pure, no network, no DB, no AI. Proves the deterministic journey-state helper and
// the honest Day 90+ boundary: within Days 1–90 there is a read for today; after Day
// 90 there is NOT (surfaces must not keep presenting the Day 90 piece as "today's").
//
//   node scripts/test-first90.ts   (npm run test:first90)

import { firstNinetyState, journeyDay, FIRST_90_LAST_DAY } from '../lib/first90.ts'
import { pickDailyRead } from '../lib/daily-reads.ts'

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

// Local date at midnight for a given Y/M/D (month is 1-based here for readability).
function ymd(y: number, m: number, d: number, h = 9): Date {
  return new Date(y, m - 1, d, h, 0, 0)
}
// Birth date stored as an ISO date-only string (how the profile stores it).
function birthISO(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// ==========================================================================
// DAY CALCULATION — Day 1 = birth day (local), boundaries
// ==========================================================================
// A local date N days after the birth local-midnight (N=0 → birth day = Day 1).
function daysAfterBirth(by: number, bm: number, bd: number, n: number, h = 9): Date {
  return new Date(by, bm - 1, bd + n, h, 0, 0)
}
{
  const birth = birthISO(2026, 9, 22) // Tue
  eq(journeyDay(birth, daysAfterBirth(2026, 9, 22, 0)), 1, 'birth day is Day 1')
  eq(journeyDay(birth, daysAfterBirth(2026, 9, 22, 1)), 2, 'next local day is Day 2')
  eq(journeyDay(birth, daysAfterBirth(2026, 9, 22, 29)), 30, 'Day 30 = birth + 29 days')
  // Day 89 / 90 / 91 boundaries derived from the birth date (avoids manual calendar math).
  eq(journeyDay(birth, daysAfterBirth(2026, 9, 22, 88)), 89, 'Day 89 = birth + 88 days')
  eq(journeyDay(birth, daysAfterBirth(2026, 9, 22, 89)), 90, 'Day 90 = birth + 89 days')
  eq(journeyDay(birth, daysAfterBirth(2026, 9, 22, 90)), 91, 'Day 91 = birth + 90 days')
}
// Late-evening and just-after-midnight do not shift the local day number.
{
  const birth = birthISO(2026, 9, 22)
  eq(journeyDay(birth, ymd(2026, 9, 22, 23)), 1, 'late evening on birth day is still Day 1')
  eq(journeyDay(birth, ymd(2026, 9, 23, 0)), 2, 'just after midnight is Day 2')
}
// Missing / invalid / future date clamps to Day 1 (never Day 0 or negative).
{
  eq(journeyDay(null, ymd(2026, 9, 22)), 1, 'missing birth date → Day 1')
  eq(journeyDay(undefined, ymd(2026, 9, 22)), 1, 'undefined birth date → Day 1')
  eq(journeyDay('not-a-date', ymd(2026, 9, 22)), 1, 'invalid birth date → Day 1')
  eq(journeyDay(birthISO(2027, 1, 1), ymd(2026, 9, 22)), 1, 'future birth date clamps to Day 1')
}

// ==========================================================================
// JOURNEY STATE — within journey vs graduated; hasReadToday boundary
// ==========================================================================
{
  const birth = birthISO(2026, 9, 22)
  const d1 = firstNinetyState(birth, daysAfterBirth(2026, 9, 22, 0))
  ok(d1.withinJourney && d1.hasReadToday && !d1.graduated, 'Day 1: within journey, has read, not graduated')

  const d90 = firstNinetyState(birth, daysAfterBirth(2026, 9, 22, 89))
  eq(d90.day, 90, 'Day 90 number')
  ok(d90.withinJourney && d90.hasReadToday && !d90.graduated, 'Day 90: still within journey + has read')

  const d91 = firstNinetyState(birth, daysAfterBirth(2026, 9, 22, 90))
  eq(d91.day, 91, 'Day 91 number')
  ok(!d91.withinJourney, 'Day 91: NOT within journey')
  ok(!d91.hasReadToday, 'Day 91: NO read for today (honest boundary)')
  ok(d91.graduated, 'Day 91: graduated')
}
// Far past Day 90 stays graduated / no read.
{
  const birth = birthISO(2025, 1, 1)
  const s = firstNinetyState(birth, ymd(2026, 9, 22))
  ok(s.day > FIRST_90_LAST_DAY && !s.hasReadToday && s.graduated, 'long after Day 90: graduated, no read today')
}

// ==========================================================================
// READ LOOKUP — every journey day 1..90 resolves to a real read for that day
// ==========================================================================
{
  let allMatch = true
  for (let d = 1; d <= 90; d++) {
    const r = pickDailyRead(d)
    if (!r || r.day !== d) allMatch = false
  }
  ok(allMatch, 'every Day 1..90 resolves to its own read')
  // Day 91+ falls back to Day 90 content ONLY as a graceful lookup — the UI gates on
  // hasReadToday and never shows it as "today's read".
  eq(pickDailyRead(91).day, 90, 'pickDailyRead(91) falls back to Day 90 (graceful lookup only)')
  eq(pickDailyRead(0).day, 90, 'pickDailyRead(0) falls back to Day 90')
}

// ==========================================================================
console.log(`\nFirst 90 Days: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log('  - ' + f)
  process.exit(1)
}
console.log('✓ all First 90 Days tests passed')
process.exit(0)
