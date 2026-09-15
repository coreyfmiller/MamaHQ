'use client'

import { Heart } from 'lucide-react'
import { useNav } from '../context'
import { reminders } from '@/lib/mama-data'
import { cn } from '@/lib/utils'

export function ReminderCard({
  title,
  body,
  primary,
  onPrimary,
  onSecondary,
}: {
  title: string
  body?: string
  primary: string
  onPrimary?: () => void
  onSecondary?: () => void
}) {
  return (
    <div className="rounded-[1.75rem] border border-border/50 bg-card/95 p-4 shadow-[0_18px_50px_-20px_rgba(38,50,56,0.4)] backdrop-blur">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Heart className="size-3.5 fill-current" />
        </span>
        <span className="text-[13px] font-semibold tracking-wide">MamaHQ</span>
      </div>
      <p className="text-[15px] font-medium leading-snug">{title}</p>
      {body && <p className="mt-1 text-[14px] leading-snug text-muted-foreground">{body}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={onPrimary}
          className="flex-1 rounded-full bg-primary py-2.5 text-[14px] font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
        >
          {primary}
        </button>
        <button
          onClick={onSecondary}
          className="rounded-full bg-muted px-5 py-2.5 text-[14px] font-semibold text-foreground transition-transform active:scale-[0.98]"
        >
          Done
        </button>
      </div>
    </div>
  )
}

export function ReminderScreen({ standalone = false }: { standalone?: boolean }) {
  const { closeOverlay, openOverlay } = useNav()
  return (
    <div
      className={cn(
        'flex h-full flex-col justify-center gap-3 px-5',
        standalone ? 'bg-foreground/10' : 'bg-foreground/55 backdrop-blur-[2px]',
      )}
    >
      {!standalone && <button aria-label="Dismiss" onClick={closeOverlay} className="absolute inset-0" />}
      <div className="relative space-y-3">
        <ReminderCard
          title={reminders[0].title}
          body={reminders[0].body}
          primary={reminders[0].primary}
          onPrimary={() => openOverlay('appointment')}
          onSecondary={closeOverlay}
        />
        <ReminderCard
          title={reminders[1].title}
          primary={reminders[1].primary}
          onPrimary={closeOverlay}
          onSecondary={closeOverlay}
        />
      </div>
    </div>
  )
}
