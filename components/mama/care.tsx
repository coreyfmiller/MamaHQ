'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { useHousehold } from './household'
import { useLogs, lastOfKind, activeSleep, clockTime, elapsed, type LogEntry } from './logs'
import * as db from '@/lib/supabase/data'

// Step 9 — Care Handoff on the client.
//
// Care responsibility is an ACTIVE PERIOD of responsibility for a care subject (the
// family's baby), NOT a to-do. A proposed handoff does NOT transfer responsibility;
// the current holder changes only when the receiving caregiver explicitly accepts.
// Same identity doctrine as Tasks: the holder is a HouseholdPerson; the acting
// account is an authenticated user linked to that person.
//
// Requires an authenticated family (care state is shared household state, and only
// persisted logs/baby are safe to summarize).

export interface CareHandoff {
  id: string
  fromPersonId: string | null
  toPersonId: string
  proposedByUserId: string | null
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
  context: CareContext
  createdAt: string
  resolvedAt: string | null
}

// A DETERMINISTIC operational summary, built only from real persisted data. Every
// field is optional — if MamaHQ hasn't logged it, it's simply absent (never faked).
export interface CareContext {
  lastFeed?: { at: string; detail?: string }
  lastDiaper?: { at: string; detail?: string }
  // Nap: start is always known; end only when the sleep is completed (ended_at set).
  // An in-progress nap reports asleepSince and no end — we never invent a wake time.
  lastNap?: { start: string; end?: string; durationLabel?: string; inProgress?: boolean }
  // Intentionally NO "next feed / next bottle" — MamaHQ has no schedule or
  // prediction, and fabricating one would violate the deterministic-only rule.
}

interface CareCtx {
  hydrated: boolean
  available: boolean
  /** Current care holder (HouseholdPerson id), or null if not yet established. */
  holderPersonId: string | null
  /** The single pending handoff, if any. */
  pending: CareHandoff | null
  /** Build a deterministic summary from currently-logged care data. */
  buildContext: () => CareContext
  /** Propose handing off to a connected HouseholdPerson (does NOT transfer). */
  propose: (toPersonId: string) => Promise<{ ok: boolean; error?: string }>
  /** Recipient accepts (becomes holder). */
  accept: (handoffId: string) => Promise<{ ok: boolean; error?: string }>
  /** Recipient declines (holder unchanged). */
  decline: (handoffId: string) => Promise<{ ok: boolean; error?: string }>
  /** Sender cancels a pending handoff (holder unchanged; stale accept impossible). */
  cancel: (handoffId: string) => Promise<{ ok: boolean; error?: string }>
  /** Manually re-fetch care state (no realtime in Step 9). */
  refresh: () => Promise<void>
}

const Ctx = createContext<CareCtx>({
  hydrated: false,
  available: false,
  holderPersonId: null,
  pending: null,
  buildContext: () => ({}),
  propose: async () => ({ ok: false }),
  accept: async () => ({ ok: false }),
  decline: async () => ({ ok: false }),
  cancel: async () => ({ ok: false }),
  refresh: async () => {},
})

export function useCare() {
  return useContext(Ctx)
}

// Build the deterministic care context from the current logs (reuses the exact
// selectors the Baby/Today screens trust). Never fabricates.
export function careContextFromLogs(logs: LogEntry[]): CareContext {
  const ctx: CareContext = {}

  const feed = lastOfKind(logs, 'feed')
  if (feed) ctx.lastFeed = { at: feed.createdAt, detail: feed.amount ?? feed.side ?? undefined }

  const diaper = lastOfKind(logs, 'diaper')
  if (diaper) ctx.lastDiaper = { at: diaper.createdAt, detail: diaper.diaperType }

  const active = activeSleep(logs)
  if (active) {
    // In-progress nap: only the start is known; do NOT invent a wake time.
    ctx.lastNap = { start: active.createdAt, inProgress: true }
  } else {
    const nap = lastOfKind(logs, 'sleep')
    if (nap) {
      ctx.lastNap = nap.endedAt
        ? { start: nap.createdAt, end: nap.endedAt, durationLabel: elapsed(nap.createdAt, nap.endedAt) }
        : { start: nap.createdAt, inProgress: true }
    }
  }

  return ctx
}

// Human-readable lines for a context (used by the handoff preview + pending card).
// Deterministic; omits anything not logged.
export function careContextLines(ctx: CareContext): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = []
  if (ctx.lastFeed) {
    lines.push({ label: 'Last feed', value: clockTime(ctx.lastFeed.at) + (ctx.lastFeed.detail ? ` · ${ctx.lastFeed.detail}` : '') })
  }
  if (ctx.lastDiaper) {
    lines.push({ label: 'Last diaper', value: clockTime(ctx.lastDiaper.at) + (ctx.lastDiaper.detail ? ` · ${ctx.lastDiaper.detail}` : '') })
  }
  if (ctx.lastNap) {
    if (ctx.lastNap.inProgress) {
      lines.push({ label: 'Sleeping since', value: clockTime(ctx.lastNap.start) })
    } else if (ctx.lastNap.end) {
      lines.push({ label: 'Last nap', value: `${clockTime(ctx.lastNap.start)}–${clockTime(ctx.lastNap.end)}${ctx.lastNap.durationLabel ? ` · ${ctx.lastNap.durationLabel}` : ''}` })
    }
  }
  return lines
}

function fromHandoffRow(r: db.DbCareHandoff): CareHandoff {
  return {
    id: r.id,
    fromPersonId: r.from_person_id,
    toPersonId: r.to_person_id,
    proposedByUserId: r.proposed_by_user_id,
    status: r.status,
    context: (r.context as CareContext) ?? {},
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  }
}

export function CareProvider({ children }: { children: ReactNode }) {
  const { familyId, status } = useAuth()
  const { me } = useHousehold()
  const { logs } = useLogs()
  const [holderPersonId, setHolderPersonId] = useState<string | null>(null)
  const [handoffs, setHandoffs] = useState<CareHandoff[]>([])
  const [hydrated, setHydrated] = useState(false)

  const load = async (fid: string) => {
    // Ensure the responsibility row exists (first caller becomes initial holder),
    // then read current holder + handoffs.
    try {
      await db.ensureCareResponsibilityRpc(fid)
    } catch (e) {
      console.warn('care ensure', e)
    }
    const [resp, hs] = await Promise.allSettled([
      db.fetchCareResponsibility(fid),
      db.fetchCareHandoffs(fid),
    ])
    if (resp.status === 'fulfilled') setHolderPersonId(resp.value?.holder_person_id ?? null)
    if (hs.status === 'fulfilled') setHandoffs(hs.value.map(fromHandoffRow))
  }

  useEffect(() => {
    let alive = true
    setHydrated(false)
    if (familyId) {
      load(familyId)
        .catch((e) => console.warn('care load', e))
        .finally(() => {
          if (alive) setHydrated(true)
        })
      return () => {
        alive = false
      }
    }
    if (status !== 'loading') {
      setHolderPersonId(null)
      setHandoffs([])
      setHydrated(true)
    }
    return () => {
      alive = false
    }
  }, [familyId, status])

  const refresh = async () => {
    if (familyId) await load(familyId).catch(() => {})
  }

  const buildContext = () => careContextFromLogs(logs)

  const propose: CareCtx['propose'] = async (toPersonId) => {
    if (!familyId) return { ok: false, error: 'not signed in' }
    try {
      await db.proposeCareHandoffRpc(familyId, toPersonId, buildContext() as Record<string, unknown>)
      await load(familyId)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'could not propose' }
    }
  }

  const wrap = (fn: (id: string) => Promise<void>): CareCtx['accept'] => async (handoffId) => {
    if (!familyId) return { ok: false, error: 'not signed in' }
    try {
      await fn(handoffId)
      await load(familyId)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'action failed' }
    }
  }

  const accept = wrap(db.acceptCareHandoffRpc)
  const decline = wrap(db.declineCareHandoffRpc)
  const cancel = wrap(db.cancelCareHandoffRpc)

  const pending = useMemo(() => handoffs.find((h) => h.status === 'pending') ?? null, [handoffs])

  const value = useMemo<CareCtx>(
    () => ({
      hydrated,
      available: Boolean(familyId),
      holderPersonId,
      pending,
      buildContext,
      propose,
      accept,
      decline,
      cancel,
      refresh,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydrated, familyId, holderPersonId, pending, logs, me],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
