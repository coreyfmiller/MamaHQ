'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

// Kinds line up with the existing CategoryChip categories so they render for free.
export type LogKind = 'feed' | 'sleep' | 'diaper' | 'pumping' | 'medication'

export interface LogEntry {
  id: string
  kind: LogKind
  /** ISO timestamp of when it happened / started (defaults to now on creation). */
  createdAt: string
  /**
   * For duration events (sleep): ISO timestamp when it ended. `null`/undefined
   * means it's still running (an "active" sleep). Point events leave this unset.
   */
  endedAt?: string | null
  /** feed/pumping amount, e.g. "4 oz". */
  amount?: string
  /** feed side. */
  side?: 'left' | 'right'
  /** diaper contents. */
  diaperType?: 'wet' | 'dirty' | 'mixed'
  note?: string
}

const STORAGE_KEY = 'mamahq.proto.logs.v1'

interface LogsCtx {
  logs: LogEntry[]
  hydrated: boolean
  addLog: (entry: Omit<LogEntry, 'id' | 'createdAt'> & { createdAt?: string }) => LogEntry
  /** Edit fields on an existing log (e.g. correct a stop time). */
  patchLog: (id: string, patch: Partial<Omit<LogEntry, 'id'>>) => void
  deleteLog: (id: string) => void
  clearLogs: () => void
  /** Start a running sleep (no-op if one is already active). Returns it, or null. */
  startSleep: () => LogEntry | null
  /** Stop a running sleep by id, stamping endedAt (defaults to now). */
  endSleep: (id: string, endedAt?: string) => void
}

const Ctx = createContext<LogsCtx>({
  logs: [],
  hydrated: false,
  addLog: () => ({ id: '', kind: 'feed', createdAt: '' }),
  patchLog: () => {},
  deleteLog: () => {},
  clearLogs: () => {},
  startSleep: () => null,
  endSleep: () => {},
})

export function useLogs() {
  return useContext(Ctx)
}

function newId(): string {
  return `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function LogsProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) setLogs(JSON.parse(raw) as LogEntry[])
    } catch {
      // ignore corrupt/blocked storage
    }
    setHydrated(true)
  }, [])

  // Persist whenever logs change (after hydration, so we don't clobber on first paint).
  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logs))
    } catch {
      // non-fatal
    }
  }, [logs, hydrated])

  const addLog: LogsCtx['addLog'] = (entry) => {
    const full: LogEntry = {
      id: newId(),
      createdAt: entry.createdAt ?? new Date().toISOString(),
      ...entry,
    }
    setLogs((prev) => [full, ...prev])
    return full
  }

  const patchLog: LogsCtx['patchLog'] = (id, patch) =>
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))

  const deleteLog = (id: string) => setLogs((prev) => prev.filter((l) => l.id !== id))

  const startSleep: LogsCtx['startSleep'] = () => {
    // Guard: never run two sleeps at once.
    if (logs.some((l) => l.kind === 'sleep' && !l.endedAt)) return null
    const full: LogEntry = {
      id: newId(),
      kind: 'sleep',
      createdAt: new Date().toISOString(),
      endedAt: null,
    }
    setLogs((prev) => [full, ...prev])
    return full
  }

  const endSleep = (id: string, endedAt?: string) => {
    const end = endedAt ?? new Date().toISOString()
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, endedAt: end } : l)))
  }

  const clearLogs = () => {
    setLogs([])
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  const value = useMemo(
    () => ({ logs, hydrated, addLog, patchLog, deleteLog, clearLogs, startSleep, endSleep }),
    [logs, hydrated],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/* ---------------- Selectors & formatting ---------------- */

/** Most recent log of a kind (logs are stored newest-first). */
export function lastOfKind(logs: LogEntry[], kind: LogKind): LogEntry | undefined {
  return logs.find((l) => l.kind === kind)
}

/** The currently-running sleep, if any (kind sleep with no endedAt). */
export function activeSleep(logs: LogEntry[]): LogEntry | undefined {
  return logs.find((l) => l.kind === 'sleep' && !l.endedAt)
}

/** Compact duration like "1h 9m" / "42m" / "just now" for elapsed/complete spans. */
export function elapsed(fromISO: string, toISO?: string | null, now: Date = new Date()): string {
  const end = toISO ? new Date(toISO).getTime() : now.getTime()
  const mins = Math.max(0, Math.floor((end - new Date(fromISO).getTime()) / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  const remMin = mins % 60
  return remMin ? `${hrs}h ${remMin}m` : `${hrs}h`
}

/** Compact "just now / 14m ago / 2h 3m ago / 1d ago" relative time. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  const remMin = mins % 60
  if (hrs < 24) return remMin ? `${hrs}h ${remMin}m ago` : `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

/** Clock time like "2:14 PM". */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** ISO → value for a <input type="datetime-local"> (local time, no seconds/zone). */
export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  // Shift by the local tz offset so the input shows local wall-clock time.
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

/** A <input type="datetime-local"> value → ISO string. */
export function fromLocalInput(value: string): string {
  return new Date(value).toISOString()
}

/** Whether an ISO timestamp falls on the same calendar day as `now`. */
export function isSameDay(iso: string, now: Date = new Date()): boolean {
  const d = new Date(iso)
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

/** Human title + optional detail for a log entry, for lists/timelines. */
export function describeLog(l: LogEntry): { title: string; detail?: string } {
  switch (l.kind) {
    case 'feed':
      return { title: l.side ? `Nursing (${l.side})` : 'Feed', detail: l.amount }
    case 'sleep':
      // A finished sleep shows its duration; a running one is handled live in the UI.
      return { title: 'Sleep', detail: l.endedAt ? elapsed(l.createdAt, l.endedAt) : l.note }
    case 'diaper':
      return { title: 'Diaper', detail: l.diaperType }
    case 'pumping':
      return { title: 'Pumping', detail: l.amount }
    case 'medication':
      return { title: 'Medication', detail: l.note }
  }
}

/**
 * Ticks `now` on an interval so elapsed timers re-render while a sleep is running.
 * Default 30s is plenty for minute-resolution durations and stays light.
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
