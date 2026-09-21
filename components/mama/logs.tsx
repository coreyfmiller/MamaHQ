'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import * as db from '@/lib/supabase/data'
import { isDuplicateAdd } from '@/lib/logs/dedupe'

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
  /**
   * Truthfulness (Beta Phase 5 §24): logs are written optimistically so the UI feels
   * instant AND keeps working offline. But when signed in, the write is also meant to
   * reach the cloud — and previously a failed cloud write vanished into console.warn
   * while the UI still claimed success. `syncError` surfaces the LAST cloud-sync
   * failure so the shell can tell the truth ("Saved on this device, but couldn't sync
   * to the cloud"). It's set only for signed-in cloud writes, and cleared the moment a
   * later cloud write (or a fresh load) succeeds. It never blocks the optimistic write.
   */
  syncError: string | null
  /** Dismiss the current sync-error banner (e.g. after the shell has shown it). */
  clearSyncError: () => void
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
  syncError: null,
  clearSyncError: () => {},
})

export function useLogs() {
  return useContext(Ctx)
}

// UUID client-side so the same id is valid locally AND in Postgres.
function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

// Map a DB row → client LogEntry (drop nulls to keep the client shape tidy).
function fromDb(r: db.DbLog): LogEntry {
  return {
    id: r.id,
    kind: r.kind,
    createdAt: r.created_at,
    endedAt: r.ended_at,
    amount: r.amount ?? undefined,
    side: r.side ?? undefined,
    diaperType: r.diaper_type ?? undefined,
    note: r.note ?? undefined,
  }
}
// Map a client LogEntry → DB row for insert.
function toDb(l: LogEntry, familyId: string): db.DbLog {
  return {
    id: l.id,
    family_id: familyId,
    kind: l.kind,
    created_at: l.createdAt,
    ended_at: l.endedAt ?? null,
    amount: l.amount ?? null,
    side: l.side ?? null,
    diaper_type: l.diaperType ?? null,
    note: l.note ?? null,
  }
}

export function LogsProvider({ children }: { children: ReactNode }) {
  const { familyId, status } = useAuth()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  // A single place to record the outcome of a cloud write. On failure we surface a
  // truthful message (the optimistic local entry is untouched); on success we clear a
  // stale error so the banner doesn't linger once syncing recovers.
  const noteSync = (op: string) => ({
    ok: () => setSyncError(null),
    fail: (e: unknown) => {
      console.warn(`log ${op} sync`, e)
      setSyncError(`Saved on this device, but couldn't sync your last ${op} to the cloud.`)
    },
  })
  const clearSyncError = () => setSyncError(null)

  // Load from the right source when auth resolves: cloud (family) or local.
  useEffect(() => {
    let alive = true
    setHydrated(false)

    if (familyId) {
      db.fetchLogs(familyId)
        .then((rows) => {
          if (!alive) return
          setLogs(rows.map(fromDb))
          setSyncError(null) // a good read means the cloud is reachable again
          setHydrated(true)
        })
        .catch(() => {
          if (!alive) return
          setLogs(readLocal())
          setHydrated(true)
        })
      return () => {
        alive = false
      }
    }

    if (status !== 'loading') {
      setLogs(readLocal())
      setSyncError(null) // signed out → no cloud to be out of sync with
      setHydrated(true)
    }
    return () => {
      alive = false
    }
  }, [familyId, status])

  // When signed out, mirror state to localStorage so nothing is lost offline.
  useEffect(() => {
    if (!hydrated || familyId) return
    writeLocal(logs)
  }, [logs, hydrated, familyId])

  const addLog: LogsCtx['addLog'] = (entry) => {
    const now = entry.createdAt ?? new Date().toISOString()
    // Duplicate-submission guard (Beta Phase 5 §26): a fast double-tap on a one-tap
    // log (or the feed/diaper amount button) should not create two identical entries.
    // We collapse an add that exactly matches the newest entry of the same kind within
    // a short window back to that existing entry. This is deliberately narrow — a real
    // second feed a few minutes later differs in time (>window) and is kept; only a
    // near-instant identical repeat is treated as an accidental double-fire. We only
    // guard entries the user creates "now" (no explicit past createdAt) so logging a
    // past sleep with matching fields is never suppressed.
    if (!entry.createdAt) {
      const recent = logs.find((l) => l.kind === entry.kind)
      if (recent && isDuplicateAdd(recent, entry, now)) return recent
    }
    const full: LogEntry = {
      id: newId(),
      createdAt: now,
      ...entry,
    }
    setLogs((prev) => [full, ...prev]) // optimistic
    if (familyId) {
      const s = noteSync(full.kind)
      db.insertLog(toDb(full, familyId)).then(s.ok, s.fail)
    }
    return full
  }

  const patchLog: LogsCtx['patchLog'] = (id, patch) => {
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
    if (familyId) {
      // Translate client field names → DB columns for the patch.
      const dbPatch: Partial<db.DbLog> = {}
      if ('endedAt' in patch) dbPatch.ended_at = patch.endedAt ?? null
      if ('amount' in patch) dbPatch.amount = patch.amount ?? null
      if ('side' in patch) dbPatch.side = patch.side ?? null
      if ('diaperType' in patch) dbPatch.diaper_type = patch.diaperType ?? null
      if ('note' in patch) dbPatch.note = patch.note ?? null
      if ('createdAt' in patch && patch.createdAt) dbPatch.created_at = patch.createdAt
      const s = noteSync('edit')
      db.updateLog(id, dbPatch).then(s.ok, s.fail)
    }
  }

  const deleteLog = (id: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== id))
    if (familyId) {
      const s = noteSync('delete')
      db.deleteLog(id).then(s.ok, s.fail)
    }
  }

  const startSleep: LogsCtx['startSleep'] = () => {
    if (logs.some((l) => l.kind === 'sleep' && !l.endedAt)) return null
    const full: LogEntry = {
      id: newId(),
      kind: 'sleep',
      createdAt: new Date().toISOString(),
      endedAt: null,
    }
    setLogs((prev) => [full, ...prev])
    if (familyId) {
      const s = noteSync('sleep')
      db.insertLog(toDb(full, familyId)).then(s.ok, s.fail)
    }
    return full
  }

  const endSleep = (id: string, endedAt?: string) => {
    const end = endedAt ?? new Date().toISOString()
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, endedAt: end } : l)))
    if (familyId) {
      const s = noteSync('sleep')
      db.updateLog(id, { ended_at: end }).then(s.ok, s.fail)
    }
  }

  const clearLogs = () => {
    setLogs([])
    writeLocal([])
    // Cloud rows are cleared by the reset flow (family-wide delete) separately.
  }

  const value = useMemo(
    () => ({ logs, hydrated, addLog, patchLog, deleteLog, clearLogs, startSleep, endSleep, syncError, clearSyncError }),
    [logs, hydrated, familyId, syncError],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/* ---------------- localStorage helpers (signed-out fallback) ---------------- */

function readLocal(): LogEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as LogEntry[]) : []
  } catch {
    return []
  }
}
function writeLocal(logs: LogEntry[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logs))
  } catch {
    // non-fatal
  }
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
