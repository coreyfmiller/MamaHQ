// MamaHQ — Baby History (last 14 days) deterministic tests.
//
// Pure, no network/DB/AI. Proves the recorded-only, partial-data-honest grouping:
// per-day logged counts, completed-sleep-only duration, local-day bucketing (no UTC
// drift), the 14-day window boundary, days-with-no-logs surfaced as a count (never
// "0 feeds"), correct pluralization, and the day labels.
//
//   node scripts/test-baby-history.ts   (npm run test:baby-history)

import {
  buildHistory,
  dayLabel,
  daySummaryCells,
  emptyDaysNote,
  formatSleep,
  localDayKey,
  type HistoryLog,
} from '../lib/baby-history.ts'

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

// Fixed local "now": 2026-10-15 09:00.
const NOW = new Date(2026, 9, 15, 9, 0, 0)
// Local ISO at a given Y/M/D/H so logs land on a deterministic LOCAL day.
function at(y: number, m: number, d: number, h = 10, min = 0): string {
  return new Date(y, m - 1, d, h, min, 0).toISOString()
}
const feed = (iso: string): HistoryLog => ({ kind: 'feed', createdAt: iso })
const diaper = (iso: string): HistoryLog => ({ kind: 'diaper', createdAt: iso })
const pump = (iso: string): HistoryLog => ({ kind: 'pumping', createdAt: iso })
const med = (iso: string): HistoryLog => ({ kind: 'medication', createdAt: iso })
function sleep(startISO: string, endISO: string | null): HistoryLog {
  return { kind: 'sleep', createdAt: startISO, endedAt: endISO }
}

// ==========================================================================
// Per-day grouping + recorded counts
// ==========================================================================
{
  const logs: HistoryLog[] = [
    feed(at(2026, 10, 15, 7)), feed(at(2026, 10, 15, 10)), feed(at(2026, 10, 15, 13)),
    diaper(at(2026, 10, 15, 8)),
    sleep(at(2026, 10, 15, 1), at(2026, 10, 15, 3)), // 2h completed
    sleep(at(2026, 10, 15, 14), null), // running — contributes nothing
    med(at(2026, 10, 15, 9)),
    pump(at(2026, 10, 14, 11)), feed(at(2026, 10, 14, 12)),
  ]
  const r = buildHistory(logs, NOW)
  eq(r.days.length, 2, 'two days have logs')
  const today = r.days[0]
  eq(today.dayKey, '2026-10-15', 'newest day first')
  eq(today.feeds, 3, 'today: 3 feeds recorded')
  eq(today.diapers, 1, 'today: 1 diaper')
  eq(today.meds, 1, 'today: 1 med')
  eq(today.sleepMinutes, 120, 'today: only the COMPLETED 2h sleep counts (running one ignored)')
  eq(today.pumps, 0, 'today: no pumps')
  const yday = r.days[1]
  eq(yday.dayKey, '2026-10-14', 'second day is yesterday')
  eq(yday.pumps, 1, 'yesterday: 1 pump')
  eq(yday.feeds, 1, 'yesterday: 1 feed')
}

// ==========================================================================
// 14-day window boundary + empty-day count
// ==========================================================================
{
  const logs: HistoryLog[] = [
    feed(at(2026, 10, 15)), // today (age 0) — in
    feed(at(2026, 10, 2)),  // 13 days ago (age 13) — in (window is 14 days: age 0..13)
    feed(at(2026, 10, 1)),  // 14 days ago (age 14) — OUT
    feed(at(2026, 9, 20)),  // way out
  ]
  const r = buildHistory(logs, NOW, 14)
  eq(r.days.length, 2, 'only in-window days (today + 13-days-ago) are kept')
  ok(r.days.some((d) => d.dayKey === '2026-10-02'), 'the 13-days-ago edge is included')
  ok(!r.days.some((d) => d.dayKey === '2026-10-01'), 'the 14-days-ago day is excluded')
  eq(r.emptyDayCount, 12, '14-day window minus 2 logged days = 12 empty days')
  eq(r.windowDays, 14, 'window length reported')
}

// ==========================================================================
// No logs at all
// ==========================================================================
{
  const r = buildHistory([], NOW)
  eq(r.days.length, 0, 'no days')
  eq(r.emptyDayCount, 14, 'all 14 window days empty')
  eq(emptyDaysNote(r.emptyDayCount), 'No activity logged on 14 other days.', 'footnote plural')
}

// ==========================================================================
// Local-day bucketing (no UTC drift): a late-evening log stays on its local day
// ==========================================================================
{
  // 2026-10-14 23:30 local — must bucket to the 14th, not shift to the 15th/13th.
  const logs: HistoryLog[] = [feed(at(2026, 10, 14, 23, 30))]
  const r = buildHistory(logs, NOW)
  eq(r.days.length, 1, 'one day')
  eq(r.days[0].dayKey, '2026-10-14', 'late-evening log stays on its LOCAL day')
}

// ==========================================================================
// Future-dated / invalid logs are ignored (defensive)
// ==========================================================================
{
  const logs: HistoryLog[] = [feed(at(2026, 10, 16)), { kind: 'feed', createdAt: 'not-a-date' }, feed(at(2026, 10, 15))]
  const r = buildHistory(logs, NOW)
  eq(r.days.length, 1, 'future day (age -1) and invalid date excluded; only today remains')
  eq(r.days[0].dayKey, '2026-10-15', 'today kept')
}

// ==========================================================================
// Presentation helpers
// ==========================================================================
{
  eq(formatSleep(0), '', '0 minutes → empty')
  eq(formatSleep(45), '45m', 'under an hour')
  eq(formatSleep(260), '4h 20m', 'hours + minutes')
  eq(formatSleep(120), '2h 0m', 'exact hours')

  eq(dayLabel(localDayKey(NOW), NOW), 'Today', 'today label')
  eq(dayLabel('2026-10-14', NOW), 'Yesterday', 'yesterday label')
  ok(/Oct 6/.test(dayLabel('2026-10-06', NOW)), 'older day shows a date')

  // Recorded-only cells: pluralize, include only metrics with data, fixed order.
  const cells = daySummaryCells({ dayKey: '2026-10-15', feeds: 1, diapers: 2, pumps: 0, meds: 1, sleepMinutes: 200, total: 5 })
  eq(cells[0], '1 feed', 'singular feed')
  eq(cells[1], '3h 20m sleep', 'sleep cell after feeds')
  eq(cells[2], '2 diapers', 'plural diapers')
  eq(cells[3], '1 med', 'meds last; pumps omitted when 0')
  eq(cells.length, 4, 'no empty-metric cells')

  const cells2 = daySummaryCells({ dayKey: 'x', feeds: 2, diapers: 0, pumps: 1, meds: 0, sleepMinutes: 0, total: 3 })
  eq(cells2.join(' · '), '2 feeds · 1 pump', 'only feeds + pump; no sleep/diaper/med cells, correct plurals')

  eq(emptyDaysNote(0), null, 'no footnote when nothing empty')
  eq(emptyDaysNote(1), 'No activity logged on 1 other day.', 'singular day footnote')
}

// ==========================================================================
console.log(`\nBaby History: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log('  - ' + f)
  process.exit(1)
}
console.log('✓ all Baby History tests passed')
process.exit(0)
