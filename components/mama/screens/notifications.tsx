'use client'

import { Bell, Calendar as CalIcon, CheckCheck, ListChecks, Baby as BabyIcon } from 'lucide-react'
import { useNav } from '../context'
import { useNotifications, type AppNotification, type NotificationDomain } from '../notifications'
import { timeAgo, useNow } from '../logs'
import { Card, Screen, Scroll, StatusBar, TopBar } from '../ui'

// Step 11 — the Notification Center. A minimal in-app surface: a newest-first list of
// the current user's durable notifications, unread emphasis, mark-one / mark-all
// read, and domain navigation (tap → the relevant MamaHQ surface). Notification text
// is human ("James has it"), never a technical event name. A notification POINTS AT
// truth — tapping/reading it never mutates task/care/calendar state.

const DOMAIN_ICON: Record<NotificationDomain, typeof ListChecks> = {
  task: ListChecks,
  care: BabyIcon,
  calendar: CalIcon,
}

// Where a notification navigates. Simple domain routing (no deep-link framework).
const DOMAIN_OVERLAY: Record<NotificationDomain, 'tasks' | 'careHandoff' | 'calendar'> = {
  task: 'tasks',
  care: 'careHandoff',
  calendar: 'calendar',
}

export function NotificationsScreen() {
  const { closeOverlay, openOverlay } = useNav()
  const { available, hydrated, notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const now = useNow(60_000)

  const open = (n: AppNotification) => {
    if (!n.readAt) void markRead(n.id)
    // Navigate to the relevant domain surface. Replace the notification overlay.
    openOverlay(DOMAIN_OVERLAY[n.domain])
  }

  return (
    <Screen>
      <StatusBar />
      <TopBar variant="close" title="Notifications" onBack={closeOverlay} />
      <Scroll className="space-y-4 px-6 pb-8">
        <header className="flex items-end justify-between pt-1">
          <div>
            <h1 className="flex items-center gap-2 font-serif text-[24px] font-semibold tracking-tight">
              Notifications <Bell className="size-5 text-sage" strokeWidth={1.75} />
            </h1>
            <p className="mt-1 text-[14px] text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : 'You’re all caught up.'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => void markAllRead()}
              className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[13px] font-semibold text-muted-foreground transition-transform active:scale-[0.98]"
            >
              <CheckCheck className="size-4" /> Mark all read
            </button>
          )}
        </header>

        {!available ? (
          <Card>
            <p className="text-[14px] text-muted-foreground">
              Notifications are tied to your account. Sign in to see when someone needs your
              attention.
            </p>
          </Card>
        ) : !hydrated ? (
          <p className="py-6 text-center text-[14px] text-muted-foreground">Loading…</p>
        ) : notifications.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-sage-soft">
              <Bell className="size-6 text-sage" strokeWidth={1.75} />
            </span>
            <p className="text-[15px] font-medium">Nothing needs you right now</p>
            <p className="text-[13px] text-muted-foreground">
              MamaHQ only tells you when another person actually needs your attention.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => {
              const Icon = DOMAIN_ICON[n.domain]
              const unread = !n.readAt
              return (
                <button
                  key={n.id}
                  onClick={() => open(n)}
                  className={`flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-transform active:scale-[0.99] ${
                    unread ? 'border-primary/40 bg-sage-soft/50' : 'border-border/70 bg-card'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${
                      unread ? 'bg-sage-soft text-sage' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon className="size-[18px]" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[15px] leading-snug ${unread ? 'font-semibold' : 'font-medium'}`}>
                      {n.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-muted-foreground">
                      {timeAgo(n.createdAt, now)}
                    </span>
                  </span>
                  {unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                </button>
              )
            })}
          </div>
        )}

        <p className="rounded-2xl bg-muted/60 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
          Notifications point you to what matters — they aren&apos;t the source of truth. Opening
          one takes you to Tasks, Care, or the Calendar, where the real state lives.
        </p>
      </Scroll>
    </Screen>
  )
}
