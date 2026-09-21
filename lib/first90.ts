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
//   Day 1 = the local calendar day the baby was born. Each subsequent local calendar
//   day increments the number. Computed with CALENDAR-DAY arithmetic (diff of stable
//   UTC-based day indices of each local date) — NOT by subtracting local-midnight
//   timestamps and dividing by 86,400,000, which is off by one across DST transitions
//   (a spring-forward day is 23h, a fall-back day 25h). A plain 'YYYY-MM-DD' birth date
//   is treated as a LOCAL calendar day (not a UTC parse, which would shift the day in
//   negative-offset zones). An invalid or future birth date clamps to Day 1 (we never
//   show Day 0 or negatives, and never fabricate a postpartum age we can't compute).
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
 * dates clamp to Day 1. Kept in lockstep with `dayNumber` in profile.tsx.
 *
 * CALENDAR-DAY arithmetic (DST-safe): we take the LOCAL (year, month, day) of both the
 * birth and now, map each to a stable UTC-based day index, and diff those indices.
 * We do NOT subtract local-midnight timestamps and divide by 86,400,000 — across a DST
 * transition two local midnights are 23h or 25h apart, so that division is off by one
 * (spring-forward makes 8 real calendar days read as 7). UTC day indices are always
 * exactly 24h apart, so the difference is the true number of calendar days between the
 * two dates regardless of local DST.
 */
export function journeyDay(birthDate: string | null | undefined, now: Date = new Date()): number {
  if (!birthDate) return 1
  const birthIndex = birthDayIndex(birthDate)
  if (birthIndex === null) return 1
  const nowIndex = utcDayIndex(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(1, nowIndex - birthIndex + 1)
}

/** A stable integer day index for a local calendar date (UTC midnights are DST-free,
 *  always 86,400,000 ms apart), so index differences equal exact calendar-day counts. */
function utcDayIndex(year: number, monthZeroBased: number, day: number): number {
  return Math.floor(Date.UTC(year, monthZeroBased, day) / 86_400_000)
}

/**
 * Day index for a birth date. A plain 'YYYY-MM-DD' is treated as a LOCAL calendar day
 * (NOT parsed via `new Date('YYYY-MM-DD')`, which is UTC-midnight and reads back as the
 * previous local day in a negative-offset timezone — shifting every day number by one).
 * We split the parts directly. Any other value is parsed then reduced to its LOCAL
 * (y, m, d). Invalid input returns null (caller clamps to Day 1).
 */
function birthDayIndex(birthDate: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate)
  if (m) {
    const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3])
    // Validate the parts form a real date (e.g. reject 2026-13-40).
    const probe = new Date(y, mo - 1, d)
    if (isNaN(probe.getTime()) || probe.getFullYear() !== y || probe.getMonth() !== mo - 1 || probe.getDate() !== d) {
      return null
    }
    return utcDayIndex(y, mo - 1, d)
  }
  const parsed = new Date(birthDate)
  if (isNaN(parsed.getTime())) return null
  return utcDayIndex(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
}
