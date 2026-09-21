// MamaHQ — log duplicate-submission guard deterministic tests (Beta Phase 5 §26).
//
// Pure, no network, no DB, no AI, no clock. Proves the optimistic log write collapses
// an accidental immediate double-tap back to the existing entry WITHOUT ever
// suppressing a genuine second event (different time, different fields, or a
// deliberately-timed past entry).
//
//   node scripts/test-log-dedupe.ts   (npm run test:log-dedupe)

import { isDuplicateAdd, DUPLICATE_WINDOW_MS, type DedupeLog, type DedupeCandidate } from '../lib/logs/dedupe.ts'

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

// A fixed reference instant so every case is deterministic.
const T0 = '2026-09-19T12:00:00.000Z'
const at = (msOffset: number) => new Date(new Date(T0).getTime() + msOffset).toISOString()

function feed(createdAt: string, amount?: string): DedupeLog {
  return { kind: 'feed', createdAt, amount }
}
function diaper(createdAt: string, diaperType?: DedupeLog['diaperType']): DedupeLog {
  return { kind: 'diaper', createdAt, diaperType }
}

// ---- A double-tap of the SAME thing within the window is a duplicate ----
{
  const recent = feed(T0, '4 oz')
  const entry: DedupeCandidate = { kind: 'feed', amount: '4 oz' }
  ok(isDuplicateAdd(recent, entry, at(500)), 'identical feed 0.5s later → duplicate')
  ok(isDuplicateAdd(recent, entry, at(DUPLICATE_WINDOW_MS)), 'identical feed exactly at window edge → duplicate')
}

// ---- Just past the window is NOT a duplicate (a real second event) ----
{
  const recent = feed(T0, '4 oz')
  const entry: DedupeCandidate = { kind: 'feed', amount: '4 oz' }
  ok(!isDuplicateAdd(recent, entry, at(DUPLICATE_WINDOW_MS + 1)), 'identical feed just past window → kept')
  ok(!isDuplicateAdd(recent, entry, at(5 * 60_000)), 'same feed 5 min later → kept (real second feed)')
}

// ---- Different distinguishing fields are NOT duplicates ----
{
  const recent = feed(T0, '4 oz')
  ok(!isDuplicateAdd(recent, { kind: 'feed', amount: '5 oz' }, at(500)), 'different amount → kept')
  ok(!isDuplicateAdd(recent, { kind: 'feed' }, at(500)), 'amount vs no-amount → kept')
}
{
  const recent = diaper(T0, 'wet')
  ok(isDuplicateAdd(recent, { kind: 'diaper', diaperType: 'wet' }, at(500)), 'identical diaper → duplicate')
  ok(!isDuplicateAdd(recent, { kind: 'diaper', diaperType: 'dirty' }, at(500)), 'different diaper type → kept')
  ok(!isDuplicateAdd(recent, { kind: 'diaper', diaperType: 'mixed' }, at(500)), 'wet vs mixed → kept')
}

// ---- Nursing side is part of identity: same amount, different side is NOT a dup ----
{
  const recent: DedupeLog = { kind: 'feed', createdAt: T0, side: 'left' }
  ok(isDuplicateAdd(recent, { kind: 'feed', side: 'left' }, at(400)), 'identical side → duplicate')
  ok(!isDuplicateAdd(recent, { kind: 'feed', side: 'right' }, at(400)), 'left vs right side → kept')
  ok(!isDuplicateAdd(recent, { kind: 'feed' }, at(400)), 'side vs no-side → kept')
}

// ---- Different kind is never a duplicate ----
{
  const recent = feed(T0, '4 oz')
  ok(!isDuplicateAdd(recent, { kind: 'diaper', diaperType: 'wet' }, at(500)), 'feed vs diaper → kept')
}

// ---- Sleep is NEVER deduped (has its own single-active guard) ----
{
  const recent: DedupeLog = { kind: 'sleep', createdAt: T0 }
  ok(!isDuplicateAdd(recent, { kind: 'sleep' }, at(500)), 'sleep is never treated as a duplicate')
}

// ---- One-tap kinds (medication / pumping) with matching note dedupe; differing note kept ----
{
  const recent: DedupeLog = { kind: 'medication', createdAt: T0, note: 'Vitamin D' }
  ok(isDuplicateAdd(recent, { kind: 'medication', note: 'Vitamin D' }, at(300)), 'identical medication → duplicate')
  ok(!isDuplicateAdd(recent, { kind: 'medication', note: 'Tylenol' }, at(300)), 'different medication note → kept')
}
{
  const recent: DedupeLog = { kind: 'pumping', createdAt: T0 }
  ok(isDuplicateAdd(recent, { kind: 'pumping' }, at(300)), 'identical pumping → duplicate')
}

// ---- A negative dt (recent is in the FUTURE relative to now) is not a duplicate ----
{
  const recent = feed(at(1000), '4 oz')
  ok(!isDuplicateAdd(recent, { kind: 'feed', amount: '4 oz' }, T0), 'recent newer than now (negative dt) → kept')
}

// ---- Report ----
if (failed > 0) {
  console.error(`\nLog dedupe: ${passed} passed, ${failed} failed`)
  for (const f of failures) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log(`Log dedupe: ${passed} passed, 0 failed`)
process.exit(0)
