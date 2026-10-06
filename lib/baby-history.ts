// MamaHQ — Baby History (last 14 days). Pure + deterministic, no React/network.
//
// Groups already-fetched logs into per-day summaries for the Baby → History tab.
// CORE PRINCIPLE: this reports "what you RECORDED", never "what happened". Logs are a
// user-authored diary and are always incomplete, so every number here is a count of
// logged entries only — no totals-as-fact, no averages-as-behavior, no zero-alarms.
// A day with no logs is simply absent from the list (surfaced as a quiet
// "no activity logged on N other days" count by the caller), never "0 feeds".

/** The structural subset of a log entry this module needs (matches LogEntry). */
export interface HistoryLog {
  kind: 'feed' | 'sleep' | 'diaper' | 'pumping' | 'medication'
  createdAt: string
  endedAt?: string | null
  amount?: string
}

/** A single day's RECORDED summary. Only metrics with data are non-zero; the caller
 *  renders only the cells it wants. `sleepMinutes` counts COMPLETED sleeps only
 *  (both createdAt + endedAt that day) — a running sleep contributes nothing yet. */
export interface DaySummary {
  /** Local calendar day key 'YYYY-MM-DD'. */
  dayKey: string
  feeds: number
  diapers: number
  pumps: number
  meds: number
  /** Minutes of completed sleep recorded that day (0 when none). */
  sleepMinutes: number
  /** Total logs that day (so the caller can treat 0 as "nothing logged"). */
  total: number
}

export interface HistoryResult {
  /** Days WITH at least one log, newest first, within the window. */
  days: DaySummary[]
  /** How many days IN THE WINDOW had no logs at all (for the quiet footnote). */
  emptyDayCount: number
  /** The window length in days (e.g. 14). */
  windowDays: number
}

/** Local 'YYYY-MM-DD' for a Date (not UTC — avoids day-shift in negative offsets). */
export function localDayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Whole-day difference (local calendar days) between two day keys, a - b. */
function dayKeyDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  // UTC midnights are DST-free, so the difference is exact calendar days.
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000)
}

export const DEFAULT_HISTORY_WINDOW_DAYS = 14

/**
 * Summarize logs into per-day recorded summaries for the last `windowDays` local
 * days (inclusive of today). Only days with ≥1 log appear in `days` (newest first);
 * `emptyDayCount` is how many of the remaining in-window days had nothing logged.
 * Logs outside the window are ignored. Deterministic given `now`.
 */
export function buildHistory(
  logs: HistoryLog[],
  now: Date = new Date(),
  windowDays: number = DEFAULT_HISTORY_WINDOW_DAYS,
): HistoryResult {
  const todayKey = localDayKey(now)
  const byDay = new Map<string, DaySummary>()

  for (const l of logs) {
    const d = new Date(l.createdAt)
    if (isNaN(d.getTime())) continue
    const key = localDayKey(d)
    const age = dayKeyDiff(todayKey, key)
    // Keep only the window: today (age 0) back through windowDays-1 days ago.
    if (age < 0 || age > windowDays - 1) continue

    let s = byDay.get(key)
    if (!s) {
      s = { dayKey: key, feeds: 0, diapers: 0, pumps: 0, meds: 0, sleepMinutes: 0, total: 0 }
      byDay.set(key, s)
    }
    s.total++
    switch (l.kind) {
      case 'feed': s.feeds++; break
      case 'diaper': s.diapers++; break
      case 'pumping': s.pumps++; break
      case 'medication': s.meds++; break
      case 'sleep': {
        // Completed sleeps only — a running sleep (no endedAt) is not a recorded
        // duration yet, so it adds nothing to the day's logged sleep.
        if (l.endedAt) {
          const start = new Date(l.createdAt).getTime()
          const end = new Date(l.endedAt).getTime()
          if (end > start) s.sleepMinutes += Math.round((end - start) / 60_000)
        }
        break
      }
    }
  }

  const days = [...byDay.values()].sort((a, b) => (a.dayKey < b.dayKey ? 1 : a.dayKey > b.dayKey ? -1 : 0))
  const emptyDayCount = Math.max(0, windowDays - days.length)
  return { days, emptyDayCount, windowDays }
}

/* ---------------- Presentation helpers (pure) ---------------- */

/** "Today" / "Yesterday" / "Mon, Oct 6" for a day key, relative to `now`. */
export function dayLabel(dayKey: string, now: Date = new Date()): string {
  const age = dayKeyDiff(localDayKey(now), dayKey)
  if (age === 0) return 'Today'
  if (age === 1) return 'Yesterday'
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Minutes → "4h 20m" / "45m" (empty string for 0). */
export function formatSleep(minutes: number): string {
  if (minutes <= 0) return ''
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`
}

/** The recorded-only metric cells for a day, each already pluralized. Only metrics
 *  with data are returned, so the row shows "6 feeds · 4h 20m sleep" and nothing for
 *  categories not logged that day. Order: feeds, sleep, diapers, pumps, meds. */
export function daySummaryCells(s: DaySummary): string[] {
  const cells: string[] = []
  if (s.feeds > 0) cells.push(`${s.feeds} ${s.feeds === 1 ? 'feed' : 'feeds'}`)
  const sleep = formatSleep(s.sleepMinutes)
  if (sleep) cells.push(`${sleep} sleep`)
  if (s.diapers > 0) cells.push(`${s.diapers} ${s.diapers === 1 ? 'diaper' : 'diapers'}`)
  if (s.pumps > 0) cells.push(`${s.pumps} ${s.pumps === 1 ? 'pump' : 'pumps'}`)
  if (s.meds > 0) cells.push(`${s.meds} ${s.meds === 1 ? 'med' : 'meds'}`)
  return cells
}

/** The quiet footnote for in-window days with nothing logged (null when none). */
export function emptyDaysNote(emptyDayCount: number): string | null {
  if (emptyDayCount <= 0) return null
  return emptyDayCount === 1 ? 'No activity logged on 1 other day.' : `No activity logged on ${emptyDayCount} other days.`
}
