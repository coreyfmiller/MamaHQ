// Mama HQ — pure derived helpers used by the UI (day counter, times, active-sleep, etc.).
// Persistence now lives in Supabase (lib/db.ts + /api routes); this file has no storage.

import type { AppState, LogEntry, SleepEntry } from './types'

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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
