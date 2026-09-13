// Mama HQ — local-first store (localStorage). No auth/DB yet; perfect the loop first.
// All reads/writes are SSR-guarded (localStorage is browser-only).

import type { AppState, LogEntry, PlanItem, InboxCapture, SleepEntry } from './types'

const STORAGE_KEY = 'mama-hq:v1'

function defaultState(): AppState {
  const today = new Date()
  const birth = new Date(today)
  birth.setDate(birth.getDate() - 16) // "Day 17" — the mock's newborn era
  return {
    baby: { id: 'baby-1', name: 'Emma', birthDate: birth.toISOString().slice(0, 10) },
    logs: [],
    plan: [],
    captures: [],
  }
}

export function loadState(): AppState {
  if (typeof window === 'undefined') return defaultState()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const p = JSON.parse(raw) as AppState
    if (!p.baby || !Array.isArray(p.logs)) return defaultState()
    return { baby: p.baby, logs: p.logs, plan: p.plan ?? [], captures: p.captures ?? [] }
  } catch {
    return defaultState()
  }
}

export function saveState(state: AppState) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Never crash the parent's app over persistence.
  }
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ----- immutable updates -----
export function addLog(s: AppState, entry: LogEntry): AppState {
  return { ...s, logs: [entry, ...s.logs] }
}
export function updateLog(s: AppState, id: string, patch: Partial<LogEntry>): AppState {
  return { ...s, logs: s.logs.map((l) => (l.id === id ? ({ ...l, ...patch } as LogEntry) : l)) }
}
export function addPlan(s: AppState, item: PlanItem): AppState {
  return { ...s, plan: [item, ...s.plan] }
}
export function updatePlan(s: AppState, id: string, patch: Partial<PlanItem>): AppState {
  return { ...s, plan: s.plan.map((p) => (p.id === id ? ({ ...p, ...patch } as PlanItem) : p)) }
}
export function addCapture(s: AppState, capture: InboxCapture): AppState {
  return { ...s, captures: [capture, ...s.captures] }
}
export function updateCapture(s: AppState, id: string, patch: Partial<InboxCapture>): AppState {
  return { ...s, captures: s.captures.map((c) => (c.id === id ? { ...c, ...patch } : c)) }
}

// ----- derived: Today needs these -----

export function dayNumber(birthDate: string, now = new Date()): number {
  const b = new Date(birthDate + 'T00:00:00')
  const days = Math.floor((now.getTime() - b.getTime()) / 86400000)
  return Math.max(1, days + 1) // day of birth = Day 1
}

export function lastOfKind<K extends LogEntry['kind']>(
  logs: LogEntry[],
  kind: K,
): Extract<LogEntry, { kind: K }> | undefined {
  return logs.find((l) => l.kind === kind) as Extract<LogEntry, { kind: K }> | undefined
}

// The currently-active (not-yet-ended) sleep, if any.
export function activeSleep(logs: LogEntry[]): SleepEntry | undefined {
  return logs.find((l) => l.kind === 'sleep' && l.endedAt === null) as SleepEntry | undefined
}

export function isSameDay(iso: string, now = new Date()): boolean {
  const d = new Date(iso)
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

// "1h 42m ago"
export function timeAgo(iso: string, now = new Date()): string {
  const mins = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h < 24) return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

// "1h 06m" elapsed since a start time (for active sleep)
export function elapsed(iso: string, now = new Date()): string {
  const mins = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function greeting(now = new Date()): string {
  const h = now.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
