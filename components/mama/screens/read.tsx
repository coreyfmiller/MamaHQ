'use client'

import { BookOpen, Heart, Sparkles } from 'lucide-react'
import { useNav } from '../context'
import { useProfile } from '../profile'
import { useNow } from '../logs'
import { firstNinetyState } from '@/lib/first90'
import { pickDailyRead, readMinutes } from '@/lib/daily-reads'
import { ReadActions } from './read-actions'
import { Screen, Scroll, StatusBar, TopBar } from '../ui'

/**
 * The full daily read — the piece behind the small "Today's read" button on Today.
 * Content is the audited editorial collection (lib/daily-reads.ts), selected by the
 * baby's journey day. No AI/personalization; the day number is sequencing metadata.
 *
 * Beta Phase 4 — HONEST Day 90+ transition: the collection covers Days 1–90 only, so
 * after Day 90 we do NOT keep showing the Day 90 piece as "today's read". We show a
 * short, truthful graduation note instead (MamaHQ keeps working for household life).
 */
export function ReadScreen() {
  const { closeOverlay } = useNav()
  const { profile } = useProfile()
  const now = useNow(60_000)
  const j = firstNinetyState(profile?.birthDate, now)

  if (!j.hasReadToday) {
    return (
      <Screen>
        <StatusBar />
        <TopBar onBack={closeOverlay} />
        <Scroll className="px-6 pb-10">
          <div className="mt-8 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-sage-soft text-sage">
              <Sparkles className="size-7" strokeWidth={1.75} />
            </span>
            <h1 className="mt-4 text-balance font-serif text-[24px] leading-tight font-semibold tracking-tight">
              You&apos;ve reached the end of the First 90 Days.
            </h1>
            <p className="mx-auto mt-3 max-w-[20rem] text-[15px] leading-relaxed text-muted-foreground">
              The daily reads covered your first 90 days. There&apos;s no new one today — and that&apos;s
              okay. MamaHQ keeps working for the rest of household life: tasks, the calendar, care,
              groceries, and getting things out of your head with Tell MamaHQ.
            </p>
          </div>
          <p className="mt-8 flex items-center justify-center gap-1.5 font-serif text-[15px] font-medium text-muted-foreground">
            Still here for you <Heart className="size-4 fill-blush text-blush" />
          </p>
        </Scroll>
      </Screen>
    )
  }

  const read = pickDailyRead(j.day)
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
            {mins} min read · Day {j.day}
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

        {/* Beta Phase 4 — content can become action, through EXISTING trusted systems.
            These only pre-fill / navigate; they never write domain state directly. */}
        <ReadActions read={read} />

        <p className="mt-8 flex items-center justify-center gap-1.5 font-serif text-[15px] font-medium text-muted-foreground">
          One day at a time <Heart className="size-4 fill-blush text-blush" />
        </p>
      </Scroll>
    </Screen>
  )
}
