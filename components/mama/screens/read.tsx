'use client'

import { BookOpen, Heart } from 'lucide-react'
import { useNav } from '../context'
import { useProfile, dayNumber } from '../profile'
import { Screen, Scroll, StatusBar, TopBar } from '../ui'
import { pickDailyRead, readMinutes } from '@/lib/daily-reads'

/**
 * The full daily read — the piece behind the small "Today's read" button on
 * Today. Content is the audited editorial collection (lib/daily-reads.ts),
 * selected by the baby's day number. No AI/personalization yet; the day number
 * is sequencing metadata and is shown subtly.
 */
export function ReadScreen() {
  const { closeOverlay } = useNav()
  const { profile } = useProfile()

  const day = profile ? dayNumber(profile.birthDate) : 1
  const read = pickDailyRead(day)
  const mins = readMinutes(read)

  return (
    <Screen>
      <StatusBar />
      <TopBar onBack={closeOverlay} />
      <Scroll className="px-6 pb-10">
        {/* Category + read time — quiet metadata, day number kept subtle. */}
        <div className="mt-1 flex items-center gap-2 text-[13px] font-medium text-sage">
          <span className="flex items-center gap-1.5 rounded-full bg-sage-soft px-3 py-1">
            <BookOpen className="size-3.5" strokeWidth={1.75} />
            {read.category}
          </span>
          <span className="text-muted-foreground">
            {mins} min read{day >= 1 && day <= 90 ? ` \u00b7 Day ${day}` : ''}
          </span>
        </div>

        <h1 className="mt-4 font-serif text-[27px] leading-tight font-semibold tracking-tight text-balance">
          {read.title}
        </h1>

        <div className="mt-5 space-y-4">
          {read.body.map((p, i) => (
            <p key={i} className="text-[16px] leading-relaxed text-foreground/90">
              {p}
            </p>
          ))}
        </div>

        {read.prompt && (
          <div className="mt-7 rounded-3xl bg-sage-soft/50 p-5">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-sage">For today</p>
            <p className="mt-1.5 text-[16px] leading-relaxed text-foreground/90">{read.prompt}</p>
          </div>
        )}

        <p className="mt-8 flex items-center justify-center gap-1.5 font-serif text-[15px] font-medium text-muted-foreground">
          One day at a time <Heart className="size-4 fill-blush text-blush" />
        </p>
      </Scroll>
    </Screen>
  )
}
