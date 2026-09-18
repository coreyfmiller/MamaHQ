'use client'

import { useState } from 'react'
import { ChevronRight, Moon, Plus, Square } from 'lucide-react'
import { useNav } from '../context'
import { useProfile, dayNumber } from '../profile'
import {
  useLogs,
  useNow,
  lastOfKind,
  activeSleep,
  timeAgo,
  elapsed,
  toLocalInput,
  fromLocalInput,
  type LogKind,
} from '../logs'
import {
  useAppointments,
  upcomingAppointments,
  openQuestionCount,
  relativeDay,
  shortTime,
} from '../appointments'
import { NameAvatar } from '../name-avatar'
import { CategoryChip } from '../event-meta'
import type { Category } from '@/lib/mama-data'
import { pickAffirmation } from '@/lib/affirmations'
import { BottomNav, Card, CardLabel, LiveDot, Screen, Scroll, StatusBar } from '../ui'

// After this long, a running sleep is more likely a forgotten timer than a real
// sleep — so we ask instead of silently counting up.
const RUNAWAY_HOURS = 10

// Right now derives its lines from the most recent real logs, and shows a live
// running-sleep timer when one is active.
function RightNow() {
  const { logs } = useLogs()
  const now = useNow() // ticks so the live timer and relative times stay fresh
  const sleeping = activeSleep(logs)

  const rows: { category: Category; label: string; kind: LogKind }[] = [
    { category: 'feed', label: 'Last feed', kind: 'feed' },
    { category: 'sleep', label: sleeping ? 'Sleeping' : 'Last sleep', kind: 'sleep' },
    { category: 'diaper', label: 'Last diaper', kind: 'diaper' },
  ]

  const hasAny = logs.length > 0

  const sleepValue = (last: ReturnType<typeof lastOfKind>) => {
    if (sleeping) return `${elapsed(sleeping.createdAt, null, now)} so far`
    if (last?.endedAt) return `${elapsed(last.createdAt, last.endedAt)} · ${timeAgo(last.endedAt, now)}`
    return last ? timeAgo(last.createdAt, now) : 'Nothing logged yet'
  }

  return (
    <>
      <Card className="mt-2 space-y-1">
        <div className="mb-2 flex items-center justify-between">
          <CardLabel className="text-foreground">Right now</CardLabel>
          {(hasAny || sleeping) && <LiveDot />}
        </div>
        <div className="divide-y divide-border/60">
          {rows.map((row) => {
            const last = lastOfKind(logs, row.kind)
            const value =
              row.kind === 'sleep'
                ? sleepValue(last)
                : last
                  ? timeAgo(last.createdAt, now)
                  : 'Nothing logged yet'
            return (
              <div key={row.label} className="flex items-center gap-3.5 py-2.5">
                <CategoryChip category={row.category} />
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold leading-tight">{row.label}</p>
                  <p className="text-[13px] text-muted-foreground">{value}</p>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {sleeping && <SleepControl sleepId={sleeping.id} startISO={sleeping.createdAt} now={now} />}
    </>
  )
}

// Live control for a running sleep: shows elapsed, a Stop that lets you correct
// the wake time, and a gentle "still asleep?" prompt once it's run unusually long.
function SleepControl({ sleepId, startISO, now }: { sleepId: string; startISO: string; now: Date }) {
  const { endSleep } = useLogs()
  const { profile } = useProfile()
  const [confirming, setConfirming] = useState(false)
  const [wake, setWake] = useState(() => toLocalInput(new Date().toISOString()))

  const hours = (now.getTime() - new Date(startISO).getTime()) / 3_600_000
  const runaway = hours >= RUNAWAY_HOURS
  const babyName = profile?.babyName ?? 'Baby'

  if (confirming) {
    const wakeISO = fromLocalInput(wake)
    const valid = new Date(wakeISO).getTime() > new Date(startISO).getTime()
    return (
      <Card className="mt-3 space-y-3 border-primary/30 bg-primary/5">
        <p className="text-[15px] font-semibold">When did {babyName} wake up?</p>
        <input
          type="datetime-local"
          value={wake}
          min={toLocalInput(startISO)}
          onChange={(e) => setWake(e.target.value)}
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-[15px] text-foreground outline-none focus:border-primary"
        />
        <p className="text-[13px] font-medium text-muted-foreground">
          {valid ? `Slept ${elapsed(startISO, wakeISO)}` : 'Wake time must be after they fell asleep.'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirming(false)}
            className="flex-1 rounded-full bg-muted py-3 text-[14px] font-semibold text-foreground transition-transform active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            onClick={() => valid && endSleep(sleepId, wakeISO)}
            disabled={!valid}
            className="flex-1 rounded-full bg-primary py-3 text-[14px] font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </Card>
    )
  }

  if (runaway) {
    return (
      <Card className="mt-3 space-y-3 border-peach/40 bg-peach-soft/40">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-2xl bg-peach-soft text-peach">
            <Moon className="size-[18px]" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-[15px] font-semibold leading-tight">Is {babyName} still asleep?</p>
            <p className="text-[13px] text-muted-foreground">
              This sleep has been running {elapsed(startISO, null, now)}.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirming(true)}
            className="flex-1 rounded-full bg-primary py-3 text-[14px] font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
          >
            They woke up
          </button>
          <button
            onClick={() => {
              /* keep counting */
            }}
            className="flex-1 rounded-full bg-card py-3 text-[14px] font-semibold text-foreground ring-1 ring-border transition-transform active:scale-[0.98]"
          >
            Still asleep
          </button>
        </div>
      </Card>
    )
  }

  return (
    <button
      onClick={() => {
        setWake(toLocalInput(new Date().toISOString()))
        setConfirming(true)
      }}
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3.5 text-[15px] font-semibold text-foreground shadow-sm transition-transform active:scale-[0.99]"
    >
      <Square className="size-4 fill-current" strokeWidth={0} />
      Stop sleep · {elapsed(startISO, null, now)}
    </button>
  )
}

function greeting(now: Date): string {
  const h = now.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function Header() {
  const { profile } = useProfile()
  const { openOverlay } = useNav()
  // Drive the greeting off the shared ticker so it stays current if the app is
  // left open across a time-of-day boundary (e.g. late morning → afternoon).
  const now = useNow(60_000)
  const momName = profile?.momName ?? 'Mama'
  const babyName = profile?.babyName ?? 'Baby'
  const day = profile ? dayNumber(profile.birthDate) : null

  return (
    <header className="flex items-start justify-between px-6 pt-1">
      <div>
        <h1 className="font-serif text-[26px] leading-tight font-semibold tracking-tight">
          {greeting(now)}, {momName}
        </h1>
        <p className="mt-1 max-w-[15rem] text-[14px] leading-snug text-muted-foreground">
          {day ? `${babyName} · Day ${day}. ` : ''}Here&apos;s what matters today.
        </p>
      </div>
      <button
        onClick={() => openOverlay('settings')}
        aria-label="Settings"
        className="rounded-full transition-transform active:scale-95"
      >
        <NameAvatar name={babyName} photo={profile?.photo} className="size-10 text-[15px]" />
      </button>
    </header>
  )
}

// A quiet daily affirmation, keyed to the baby's day number + time of day. The
// emotional heart of Today — understated on purpose, not a banner or a modal.
function AffirmationCard() {
  const { profile } = useProfile()
  const now = useNow(60_000)
  if (!profile) return null
  const day = dayNumber(profile.birthDate, now)
  const text = pickAffirmation(day, now)
  return (
    <div className="mt-2 rounded-3xl bg-sage-soft/50 px-5 py-4">
      <p className="whitespace-pre-line font-serif text-[16px] leading-relaxed text-foreground/90">
        {text}
      </p>
    </div>
  )
}

function Footer() {
  return <BottomNav active="today" />
}

const suggestions = ['Log a feed', 'Add an appointment', 'Remember something', 'Ask me to remind you']

export function TodayScreen({ empty = false }: { empty?: boolean }) {
  const { openOverlay } = useNav()

  if (empty) {
    return (
      <Screen>
        <StatusBar />
        <Scroll className="px-6">
          <Header />
          <p className="mt-8 font-serif text-[22px] leading-snug font-medium">
            Nothing urgent right now.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
            Tell MamaHQ anything you don&apos;t want to keep in your head.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                className="rounded-full border border-border bg-card px-4 py-2 text-[14px] font-medium text-foreground shadow-sm transition-transform active:scale-95"
              >
                {s}
              </button>
            ))}
          </div>
        </Scroll>
        <Footer />
      </Screen>
    )
  }

  return (
    <Screen>
      <StatusBar />
      <Scroll className="space-y-4 px-6 pb-4">
        <Header />

        {/* A gentle word for the moment */}
        <AffirmationCard />

        {/* Right now */}
        <RightNow />

        {/* Coming up */}
        <ComingUp />
      </Scroll>
      <Footer />
    </Screen>
  )
}

// Today's appointment glance — the next upcoming appointment with its open-question count.
function ComingUp() {
  const { openOverlay, openAppointment, composeAppointment } = useNav()
  const { appointments } = useAppointments()
  const now = useNow()
  const upcoming = upcomingAppointments(appointments, now)
  const next = upcoming[0]

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <CardLabel className="text-foreground">Coming up</CardLabel>
        {upcoming.length > 0 && (
          <button
            onClick={() => openOverlay('upcoming')}
            className="flex items-center gap-0.5 text-[13px] font-medium text-primary"
          >
            See all <ChevronRight className="size-3.5" />
          </button>
        )}
      </div>

      {next ? (
        <button
          onClick={() => openAppointment(next.id)}
          className="flex w-full items-start gap-3.5 rounded-2xl bg-blue-soft/40 p-3 text-left transition-transform active:scale-[0.99]"
        >
          <CategoryChip category="appointment" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold">{next.title}</p>
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
            <p className="text-[13px] text-muted-foreground">
              {relativeDay(next.whenISO, now)} · {shortTime(next.whenISO)}
            </p>
            {openQuestionCount(next) > 0 && (
              <p className="mt-1 text-[13px] font-medium text-primary">
                {openQuestionCount(next)} thing{openQuestionCount(next) === 1 ? '' : 's'} to ask
              </p>
            )}
          </div>
        </button>
      ) : (
        <button
          onClick={() => composeAppointment(null)}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 p-3 text-left text-muted-foreground transition-colors active:bg-muted"
        >
          <span className="flex size-9 items-center justify-center rounded-2xl bg-muted">
            <Plus className="size-[18px]" strokeWidth={1.75} />
          </span>
          <span className="text-[14px] font-medium">Add an appointment</span>
        </button>
      )}
    </Card>
  )
}
