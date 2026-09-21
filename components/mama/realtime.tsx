'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './auth'
import { supabaseBrowser } from '@/lib/supabase/client'

// Step 11 — Family Realtime Coordinator.
//
//   Authenticated Account → Active Family → ONE Family Realtime Coordinator →
//   Domain Invalidation → Domain Provider Refetch → UI
//
// A SINGLE, understandable lifecycle owns the raw Supabase channel. Domain providers
// (grocery, tasks, care, calendar) do NOT open their own channels; they register an
// invalidation listener for their domain and refetch canonical state when told.
//
// Design properties (Step 11 §3–§10):
//   * family-scoped: every postgres_changes subscription filters on family_id, and
//     RLS remains the authoritative boundary (filters are not the security boundary).
//   * auth-aware: the channel exists only while signed in with a family; it tears
//     down on logout and on family change (no duplicate subscriptions accumulate).
//   * invalidate → refetch (NOT state replay): a DB change maps to a domain to
//     invalidate; the domain refetches canonical truth. Idempotent, so a realtime
//     event that echoes the local actor's own optimistic mutation is safe.
//   * coalescing: a single logical operation can touch several rows (e.g. a calendar
//     event + participants + responsible person). We debounce invalidations per
//     domain so that becomes ONE refetch, not four.
//   * reconnect recovery: on (re)subscribe — including after sleep/background/drop —
//     we invalidate every domain so the client refetches anything it missed offline.
//     Realtime improves freshness; it never replaces canonical reads.
//
// Realtime is an enhancement: if the channel never establishes, domain mutations and
// manual refetches still work exactly as before. Nothing here is a prerequisite for a
// write.

export type RealtimeDomain = 'grocery' | 'tasks' | 'care' | 'calendar' | 'household'

// Which DB tables (in the realtime publication) map to which domain to invalidate.
// task_events + tasks both map to 'tasks' (one logical task change must not refetch
// the domain twice — the coalescer collapses them). Same for calendar_events +
// calendar_event_participants → 'calendar', and care_handoffs + care_responsibility →
// 'care'. notifications is handled by the NotificationsProvider's own subscription
// (recipient-scoped), not here.
const TABLE_TO_DOMAIN: Record<string, RealtimeDomain> = {
  grocery_items: 'grocery',
  tasks: 'tasks',
  task_events: 'tasks',
  care_responsibility: 'care',
  care_handoffs: 'care',
  calendar_events: 'calendar',
  calendar_event_participants: 'calendar',
}

const ALL_DOMAINS: RealtimeDomain[] = ['grocery', 'tasks', 'care', 'calendar', 'household']

type InvalidateHandler = () => void

interface RealtimeCtx {
  /** True while a family realtime channel is subscribed. Purely informational; the
   *  app never gates behavior on this (realtime is an enhancement). */
  connected: boolean
  /** Register a handler to run when a domain's canonical state may have changed.
   *  Returns an unsubscribe function. Handlers should be idempotent refetches. */
  onInvalidate: (domain: RealtimeDomain, handler: InvalidateHandler) => () => void
}

const Ctx = createContext<RealtimeCtx>({
  connected: false,
  onInvalidate: () => () => {},
})

export function useRealtime() {
  return useContext(Ctx)
}

/** Subscribe a domain provider to realtime invalidation. `refetch` MUST be an
 *  idempotent canonical reload; it will also be called on reconnect/resume. */
export function useRealtimeInvalidation(domain: RealtimeDomain, refetch: () => void) {
  const { onInvalidate } = useRealtime()
  // Keep the latest refetch without re-subscribing every render. The ref is updated
  // inside an effect (never during render) so the compiler's refs rule is satisfied.
  const ref = useRef(refetch)
  useEffect(() => {
    ref.current = refetch
  })
  useEffect(() => {
    return onInvalidate(domain, () => ref.current())
    // onInvalidate identity is stable for the life of the provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain])
}

const COALESCE_MS = 120

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { familyId, status } = useAuth()
  const [connected, setConnected] = useState(false)

  // Domain → set of handlers. A ref so registering a listener never re-runs the
  // channel effect (which is keyed only on the family identity).
  const handlersRef = useRef<Map<RealtimeDomain, Set<InvalidateHandler>>>(new Map())
  // Per-domain debounce timers, so a burst of row events becomes one refetch.
  const timersRef = useRef<Map<RealtimeDomain, ReturnType<typeof setTimeout>>>(new Map())

  const onInvalidate = useMemo<RealtimeCtx['onInvalidate']>(
    () => (domain, handler) => {
      let set = handlersRef.current.get(domain)
      if (!set) {
        set = new Set()
        handlersRef.current.set(domain, set)
      }
      set.add(handler)
      return () => {
        handlersRef.current.get(domain)?.delete(handler)
      }
    },
    [],
  )

  useEffect(() => {
    // Capture the timers map for this effect instance so cleanup clears exactly the
    // timers this effect created (avoids the changing-ref-in-cleanup lint pitfall).
    const timers = timersRef.current

    const fireDomain = (domain: RealtimeDomain) => {
      const set = handlersRef.current.get(domain)
      if (!set || set.size === 0) return
      for (const h of set) {
        try {
          h()
        } catch (e) {
          console.warn('realtime invalidate handler failed', domain, e)
        }
      }
    }

    // Debounced per-domain invalidation → coalesces a multi-row logical operation
    // into a single canonical refetch.
    const invalidate = (domain: RealtimeDomain) => {
      const existing = timers.get(domain)
      if (existing) clearTimeout(existing)
      timers.set(
        domain,
        setTimeout(() => {
          timers.delete(domain)
          fireDomain(domain)
        }, COALESCE_MS),
      )
    }

    const invalidateAll = () => {
      for (const d of ALL_DOMAINS) invalidate(d)
    }

    // Signed out or no family → ensure nothing is subscribed and bail.
    if (!familyId || status !== 'signed-in') {
      setConnected(false)
      return
    }

    const supabase = supabaseBrowser()
    // One channel per family. The name is family-scoped so switching families makes
    // a genuinely different channel (and this effect's cleanup removes the old one).
    const channel = supabase.channel(`family:${familyId}`)

    for (const table of Object.keys(TABLE_TO_DOMAIN)) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `family_id=eq.${familyId}` },
        (payload: { table: string }) => {
          const domain = TABLE_TO_DOMAIN[payload.table]
          if (domain) invalidate(domain)
        },
      )
    }

    channel.subscribe((state: string) => {
      // SUBSCRIBED fires on first connect AND on every reconnect (sleep/wake, network
      // drop, tab resume). On any (re)connection, refetch every domain so we recover
      // anything missed while the socket was down — canonical DB reads, not replayed
      // events.
      if (state === 'SUBSCRIBED') {
        setConnected(true)
        invalidateAll()
      } else if (state === 'CLOSED' || state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
        setConnected(false)
      }
    })

    return () => {
      // Tear down on logout / family change / unmount: remove the channel and clear
      // any pending coalesce timers so no duplicate subscription or stray refetch
      // survives into the next family.
      setConnected(false)
      for (const t of timers.values()) clearTimeout(t)
      timers.clear()
      supabase.removeChannel(channel)
    }
    // Re-run ONLY when the active family (or auth status) changes — never when a
    // domain registers a handler (those live in a ref).
  }, [familyId, status])

  const value = useMemo<RealtimeCtx>(() => ({ connected, onInvalidate }), [connected, onInvalidate])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
