// MamaHQ — log duplicate-submission guard (Beta Phase 5 §26).
//
// Pure, no React, no DB, no clock — so it's deterministic and unit-testable in a bare
// `node scripts/test-*.ts` run (same convention as lib/today/model.ts, lib/first90.ts).
//
// Logs are written OPTIMISTICALLY the instant a button is tapped, which makes a fast
// accidental double-tap create two identical entries. This module answers one narrow
// question: "does this new add look like an accidental immediate repeat of the entry
// we just made?" — so the caller can collapse it back to the existing entry instead of
// double-logging. It is deliberately conservative: a genuine second feed/diaper a few
// minutes later differs in time (beyond the window) and is always kept.

/** The minimal shape the guard needs from a stored log entry. Kept structural so both
 *  the client LogEntry and test fixtures satisfy it without importing the client type. */
export interface DedupeLog {
  kind: 'feed' | 'sleep' | 'diaper' | 'pumping' | 'medication'
  createdAt: string
  amount?: string
  side?: 'left' | 'right'
  diaperType?: 'wet' | 'dirty' | 'mixed'
  note?: string
}

/** The distinguishing fields of an incoming add (no id/createdAt assigned yet). */
export type DedupeCandidate = Omit<DedupeLog, 'createdAt'> & { createdAt?: string }

// Window within which an identical add is treated as an accidental double-fire rather
// than a real second event. Short enough that a genuine second event a few minutes
// later is always kept; long enough to absorb a fast double-tap or a re-render retry.
export const DUPLICATE_WINDOW_MS = 4_000

/** True when `entry` looks like an accidental immediate repeat of the existing
 *  newest-of-kind `recent` log: same kind + same distinguishing fields, created within
 *  DUPLICATE_WINDOW_MS. Sleeps are never treated as duplicates here (a running sleep
 *  already has its own single-active guard, and past sleeps are entered with explicit
 *  times). */
export function isDuplicateAdd(recent: DedupeLog, entry: DedupeCandidate, nowISO: string): boolean {
  if (recent.kind !== entry.kind) return false
  if (recent.kind === 'sleep') return false
  const dt = new Date(nowISO).getTime() - new Date(recent.createdAt).getTime()
  if (!(dt >= 0 && dt <= DUPLICATE_WINDOW_MS)) return false
  return (
    (recent.amount ?? undefined) === (entry.amount ?? undefined) &&
    (recent.side ?? undefined) === (entry.side ?? undefined) &&
    (recent.diaperType ?? undefined) === (entry.diaperType ?? undefined) &&
    (recent.note ?? undefined) === (entry.note ?? undefined)
  )
}
