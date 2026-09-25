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
import * as db from '@/lib/supabase/data'

// Step 11 — In-app Notifications on the client.
//
// A notification DIRECTS ATTENTION; it is NOT domain truth. This provider owns the
// current user's notification inbox: it fetches their durable records (RLS scopes to
// them), tracks unread count, marks read, and subscribes to a RECIPIENT-SCOPED
// realtime channel so a new notification lights up the badge live without a refresh.
//
// Recipient scoping (Step 11 §12/§19): notifications are addressed to an AUTH USER,
// not a HouseholdPerson. Privacy is recipient-scoped — even a family member cannot
// read another member's notifications. The realtime filter mirrors that
// (recipient_user_id = my uid), and RLS enforces it authoritatively.
//
// Reading/clearing a notification NEVER mutates task/care/calendar truth — the mark
// RPCs only touch read_at.

export type NotificationType = db.DbNotification['type']
export type NotificationDomain = db.DbNotification['domain']

export interface AppNotification {
  id: string
  type: NotificationType
  domain: NotificationDomain
  entityId: string | null
  title: string
  metadata: Record<string, unknown>
  createdAt: string
  readAt: string | null
}

interface NotificationsCtx {
  hydrated: boolean
  available: boolean
  notifications: AppNotification[]
  unreadCount: number
  /** Mark one of my notifications read (idempotent). */
  markRead: (id: string) => Promise<void>
  /** Mark all my unread notifications read. */
  markAllRead: () => Promise<void>
  /** Re-fetch my notifications from canonical truth. */
  refresh: () => Promise<void>
}

const Ctx = createContext<NotificationsCtx>({
  hydrated: false,
  available: false,
  notifications: [],
  unreadCount: 0,
  markRead: async () => {},
  markAllRead: async () => {},
  refresh: async () => {},
})

export function useNotifications() {
  return useContext(Ctx)
}

function fromRow(r: db.DbNotification): AppNotification {
  return {
    id: r.id,
    type: r.type,
    domain: r.domain,
    entityId: r.entity_id,
    title: r.title,
    metadata: r.metadata ?? {},
    createdAt: r.created_at,
    readAt: r.read_at,
  }
}

/** Optional: called when a brand-new notification arrives live, so the shell can
 *  surface a transient toast. Passed in by the provider host to avoid a hard
 *  dependency on the nav context here. */
export function NotificationsProvider({
  children,
  onArrive,
}: {
  children: ReactNode
  onArrive?: (n: AppNotification) => void
}) {
  const { user, familyId, status } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [hydrated, setHydrated] = useState(false)

  // Keep the latest onArrive without resubscribing the channel. Updated inside an
  // effect (never during render) so the compiler's refs rule is satisfied.
  const onArriveRef = useRef(onArrive)
  useEffect(() => {
    onArriveRef.current = onArrive
  })

  const load = async () => {
    const rows = await db.fetchNotifications()
    setNotifications(rows.map(fromRow))
  }

  // Fetch canonical inbox whenever the signed-in user (or their family) changes.
  useEffect(() => {
    let alive = true
    setHydrated(false)
    if (user && familyId) {
      load()
        .catch((e) => console.warn('notifications load', e))
        .finally(() => {
          if (alive) setHydrated(true)
        })
      return () => {
        alive = false
      }
    }
    if (status !== 'loading') {
      setNotifications([])
      setHydrated(true)
    }
    return () => {
      alive = false
    }
  }, [user, familyId, status])

  // Recipient-scoped realtime: a new row addressed to ME lights up the badge live.
  // Separate from the family realtime coordinator because this is per-USER, not
  // per-family (privacy boundary). Tears down on logout / user change.
  useEffect(() => {
    if (!user || status !== 'signed-in') return
    const supabase = supabaseBrowser()
    const channel = supabase.channel(`notifications:${user.id}`)
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_user_id=eq.${user.id}`,
      },
      (payload: { eventType: string; new: db.DbNotification | null }) => {
        // On any change to my notifications (insert of a new one, or read_at update
        // from another device), refetch canonical truth so multi-tab/multi-device
        // read state converges. Cheap (recipient-scoped, capped list).
        void load()
          .then(() => {
            if (payload.eventType === 'INSERT' && payload.new) {
              const arrived = fromRow(payload.new)
              // MamaHQ 2.0: care handoff is retired from the visible UX — never raise
              // an arrival toast for a care-domain notification (the row is still
              // stored; it's just not surfaced). Dormant, revivable post-beta.
              if (arrived.domain !== 'care') onArriveRef.current?.(arrived)
            }
          })
          .catch(() => {})
      },
    )
    channel.subscribe((state: string) => {
      // On (re)connect, recover anything missed while offline.
      if (state === 'SUBSCRIBED') void load().catch(() => {})
    })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, status])

  const markRead: NotificationsCtx['markRead'] = async (id) => {
    // Optimistic: flip read locally, then persist. On failure, refetch truth.
    setNotifications((list) =>
      list.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
    )
    try {
      await db.markNotificationReadRpc(id)
    } catch (e) {
      console.warn('notification markRead', e)
      await load().catch(() => {})
    }
  }

  const markAllRead: NotificationsCtx['markAllRead'] = async () => {
    const now = new Date().toISOString()
    setNotifications((list) => list.map((n) => (n.readAt ? n : { ...n, readAt: now })))
    try {
      await db.markAllNotificationsReadRpc()
    } catch (e) {
      console.warn('notification markAllRead', e)
      await load().catch(() => {})
    }
  }

  const refresh = async () => {
    await load().catch(() => {})
  }

  // MamaHQ 2.0: care handoff is retired from the visible UX. We still FETCH/STORE all
  // notifications (backend dormant, not deleted), but the provider only EXPOSES
  // non-care notifications so every consumer (Notification Center, the Me bell badge,
  // arrival toast) is consistently care-free. UI-layer filtering only — no backend or
  // schema change; care notifications revive by removing this one filter.
  const visibleNotifications = useMemo(
    () => notifications.filter((n) => n.domain !== 'care'),
    [notifications],
  )
  const unreadCount = useMemo(
    () => visibleNotifications.filter((n) => !n.readAt).length,
    [visibleNotifications],
  )

  const value = useMemo<NotificationsCtx>(
    () => ({
      hydrated,
      available: Boolean(user && familyId),
      notifications: visibleNotifications,
      unreadCount,
      markRead,
      markAllRead,
      refresh,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydrated, user, familyId, visibleNotifications, unreadCount],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
