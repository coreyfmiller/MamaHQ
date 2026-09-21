// MamaHQ — First 90 Days journey state (Beta Phase 4).
//
// A PURE, DETERMINISTIC helper that turns the baby's birth date + the current local
// time into an honest "where am I in the first 90 days" view. No React, no network,
// no AI. It exists so both Today and the First 90 surfaces agree on:
//   * which day of the journey it is,
//   * whether there is a real daily read for TODAY (only Days 1–90),
//   * an honest label once the 90-day journey is complete.
//
// DAY CALCULATION (matches components/mama/profile.tsx `dayNumber`, documented here):
//   Day 1 = the local calendar day the baby was born. Each subsequent local day
//   increments the number. Computed from the difference of LOCAL midnights (uses the
//   local Date, not a UTC slice — so it's correct across timezones and DST). An
//   invalid or future birth date clamps to Day 1 (we never show Day 0 or negatives,
//   and we never fabricate a postpartum age we can't compute).
//
// IMPORTANT (§4 honesty): the editorial collection has content for Days 1–90 only.
// After Day 90 there is NO "today's read" — surfaces must NOT keep presenting the
// Day 90 piece as if it were today's. `hasReadToday` is the single source of truth
// for that, and Day-90-fallback lookups are for graceful rendering only, never to
// pretend a fresh daily read exists past the journey.

/** The last day of the editorial First 90 Days journey. */
export const FIRST_90_LAST_DAY = 90

export interface First90State {
  /** The journey day number (>= 1). Day 1 = birth day. */
  day: number
  /** True while the baby is within the 1–90 day editorial journey. */
  withinJourney: boolean
  /** True only when there is a real daily read to show FOR TODAY (Days 1–90). */
  hasReadToday: boolean
  /** True once the journey is complete (day > 90). */
  graduated: boolean
}

/**
 * Compute the First 90 Days journey state from a birth date + now.
 * Mirrors `dayNumber` exactly (local-midnight diff, Day 1 = birth day, clamp >= 1),
 * then layers the honest 1–90 boundary on top.
 */
export function firstNinetyState(birthDate: string | null | undefined, now: Date = new Date()): First90State {
  const day = journeyDay(birthDate, now)
  const withinJourney = day >= 1 && day <= FIRST_90_LAST_DAY
  return {
    day,
    withinJourney,
    hasReadToday: withinJourney,
    graduated: day > FIRST_90_LAST_DAY,
  }
}

/**
 * The journey day number for a birth date. Day 1 = birth day. Invalid/missing/future
 * dates clamp to Day 1. Uses LOCAL midnights (no UTC-slice boundary bug). Kept in
 * lockstep with `dayNumber` in profile.tsx.
 */
export function journeyDay(birthDate: string | null | undefined, now: Date = new Date()): number {
  if (!birthDate) return 1
  const birthMidnight = localBirthMidnightMs(birthDate)
  if (birthMidnight === null) return 1
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.max(1, Math.floor((nowMidnight - birthMidnight) / 86_400_000) + 1)
}

/**
 * Local-midnight ms for a birth date. A plain 'YYYY-MM-DD' is parsed as a LOCAL
 * calendar day (NOT UTC) — `new Date('2026-09-22')` is UTC-midnight, which in a
 * negative-offset timezone reads back as the previous local day and would shift every
 * day number by one. We split the parts and build a local Date to avoid that. Any
 * other/invalid format returns null (caller clamps to Day 1).
 */
function localBirthMidnightMs(birthDate: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate)
  if (m) {
    const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3])
    const dt = new Date(y, mo - 1, d)
    return isNaN(dt.getTime()) ? null : dt.getTime()
  }
  const parsed = new Date(birthDate)
  if (isNaN(parsed.getTime())) return null
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime()
}
