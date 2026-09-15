'use client'

import { Mic, Camera, PenLine, ListPlus, type LucideIcon } from 'lucide-react'
import { useNav } from '../context'

type Choice = {
  key: string
  Icon: LucideIcon
  title: string
  sub: string
  tone: string
  onPick: () => void
}

/**
 * The single "get it out of my head" entry point. Opened from the raised center
 * button in the bottom nav (tap or swipe-up). Every option routes to a screen
 * that already exists — this sheet is just the calm front door to capture.
 */
export function CaptureContent() {
  const { openOverlay, setTab, closeOverlay } = useNav()

  const choices: Choice[] = [
    {
      key: 'speak',
      Icon: Mic,
      title: 'Speak',
      sub: 'Say it out loud, MamaHQ sorts it',
      tone: 'bg-sage-soft text-sage',
      onPick: () => openOverlay('voice'),
    },
    {
      key: 'photo',
      Icon: Camera,
      title: 'Photo',
      sub: 'Snap a note, label or schedule',
      tone: 'bg-blue-soft text-blue',
      onPick: () => openOverlay('photo'),
    },
    {
      key: 'type',
      Icon: PenLine,
      title: 'Type',
      sub: 'Write a quick brain dump',
      tone: 'bg-peach-soft text-peach',
      onPick: () => {
        closeOverlay()
        setTab('inbox')
      },
    },
    {
      key: 'quicklog',
      Icon: ListPlus,
      title: 'Quick log',
      sub: 'Feed, sleep, diaper in a tap',
      tone: 'bg-blush-soft text-blush',
      onPick: () => openOverlay('quicklog'),
    },
  ]

  return (
    <div>
      <h2 className="px-1 font-serif text-[20px] font-semibold">What&apos;s on your mind?</h2>
      <p className="mt-0.5 px-1 text-[13px] text-muted-foreground">
        However it comes out — MamaHQ will make sense of it.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {choices.map(({ key, Icon, title, sub, tone, onPick }) => (
          <button
            key={key}
            onClick={onPick}
            className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card p-4 text-left shadow-sm transition-transform active:scale-[0.98]"
          >
            <span className={`flex size-10 items-center justify-center rounded-2xl ${tone}`}>
              <Icon className="size-[20px]" strokeWidth={1.75} />
            </span>
            <span className="text-[15px] font-semibold leading-tight">{title}</span>
            <span className="text-[12px] leading-snug text-muted-foreground">{sub}</span>
          </button>
        ))}
      </div>

      <button
        onClick={closeOverlay}
        className="mt-4 w-full rounded-full bg-muted py-3.5 text-[15px] font-semibold text-foreground transition-transform active:scale-[0.99]"
      >
        Cancel
      </button>
    </div>
  )
}
