'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, Plus, MapPin, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNav } from '../context'
import { useHousehold } from '../household'
import { useCalendar, type CalendarEvent } from '../calendar'
import { Card, CardLabel, Screen, Scroll, Segmented, StatusBar, TopBar } from '../ui'

// Step 10 — the shared Calendar surface. Small but useful: Upcoming (chronological)
// and a selected Day agenda. The value is structured household commitments — what's
// happening, who it's about, and who's handling it — not calendar visualization.

type View = 'upcoming' | 'mine' | 'day'

export function CalendarScreen() {
  const { closeOverlay, composeEvent } = useNav()
  const { available, hydrated, upcoming, mine, onDay } = useCalendar()
  const { people, me } = useHousehold()
  const [view, setView] = useState<View>('upcoming')
  const [day, setDay] = useState<Date>(() => new Date())

  const personName = (id: string | null): string | null => {
    if (!id) return null
    const p = people.find((x) => x.id === id)
    if (!p) return null
    return me && p.id === me.id ? 'Me' : p.displayName
  }

  const dayKey = localDayKey(day)
  const list = useMemo<CalendarEvent[]>(() => {
    if (view === 'mine') return mine
    if (view === 'day') return onDay(dayKey)
    return upcoming
  }, [view, upcoming, mine, onDay, dayKey])

  return (
    <Screen>
      <StatusBar />
      <TopBar
        variant="close"
        title="Calendar"
        onBack={closeOverlay}
        right={
          <button onClick={() => composeEvent(null)} aria-label="Add event"
            className="flex size-9 items-center justify-center rounded-full text-primary transition-colors active:bg-muted">
            <Plus className="size-5" strokeWidth={2.25} />
          </button>
        }
      />
      <Scroll className="space-y-4 px-6 pb-8">
        <header className="pt-1">
          <h1 className="flex items-center gap-2 font-serif text-[24px] font-semibold tracking-tight">
            Calendar <CalendarDays className="size-5 text-sage" strokeWidth={1.75} />
          </h1>
          <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
            What&apos;s happening, who it&apos;s for, and who&apos;s handling it.
          </p>
        </header>

        {!available ? (
          <Card>
            <p className="text-[14px] text-muted-foreground">
              Your calendar is shared with your household, so it lives in your account. Sign in to
              use it.
            </p>
          </Card>
        ) : (
          <>
            <Segmented<View>
              value={view}
              onChange={setView}
              options={[
                { value: 'upcoming', label: 'Upcoming', badge: upcoming.length || undefined },
                { value: 'mine', label: 'Mine', badge: mine.length || undefined },
                { value: 'day', label: 'Day' },
              ]}
            />

            {view === 'day' && (
              <div className="flex items-center justify-between rounded-full bg-muted/60 px-2 py-1.5">
                <button onClick={() => setDay((d) => addDays(d, -1))} aria-label="Previous day"
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground active:bg-muted">
                  <ChevronLeft className="size-4" />
                </button>
                <span className="text-[14px] font-semibold">{fullDay(day)}</span>
                <button onClick={() => setDay((d) => addDays(d, 1))} aria-label="Next day"
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground active:bg-muted">
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}

            {!hydrated ? (
              <p className="py-6 text-center text-[14px] text-muted-foreground">Loading…</p>
            ) : list.length === 0 ? (
              <EmptyState view={view} onAdd={() => composeEvent(null)} />
            ) : (
              <div className="space-y-2">
                {list.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    participantNames={e.participantIds.map(personName).filter(Boolean) as string[]}
                    responsibleName={personName(e.responsiblePersonId)}
                    onOpen={() => composeEvent(e.id)}
                  />
                ))}
              </div>
            )}

            <p className="rounded-2xl bg-muted/60 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
              A shared household calendar. Naming who&apos;s handling something makes it clear whose
              plate it&apos;s on — without anyone having to ask.
            </p>
          </>
        )}
      </Scroll>
    </Screen>
  )
}

function EmptyState({ view, onAdd }: { view: View; onAdd: () => void }) {
  const copy: Record<View, string> = {
    upcoming: 'Nothing coming up. Add an event to get it on the shared calendar.',
    mine: "Nothing on your plate right now.",
    day: 'Nothing on this day.',
  }
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/60 px-5 py-8 text-center">
      <p className="text-[14px] text-muted-foreground">{copy[view]}</p>
      <button onClick={onAdd} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground">
        <Plus className="size-4" /> Add event
      </button>
    </div>
  )
}

// The deterministic event summary card: title · when · who it's for · who's handling
// it · location. All from structured data — no AI, nothing fabricated.
function EventCard({
  event,
  participantNames,
  responsibleName,
  onOpen,
}: {
  event: CalendarEvent
  participantNames: string[]
  responsibleName: string | null
  onOpen: () => void
}) {
  return (
    <Card onClick={onOpen} className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[15px] font-semibold leading-snug">{event.title}</p>
        <span className="shrink-0 text-[12px] font-medium text-muted-foreground">{whenLabel(event)}</span>
      </div>
      {participantNames.length > 0 && (
        <p className="text-[13px] text-foreground/80">{participantNames.join(', ')}</p>
      )}
      {responsibleName && (
        <p className="text-[13px] font-medium text-sage">
          {responsibleName === 'Me' ? "You're handling this" : `${responsibleName} is handling this`}
        </p>
      )}
      {event.location && (
        <p className="flex items-center gap-1 text-[13px] text-muted-foreground">
          <MapPin className="size-3" /> {event.location}
        </p>
      )}
    </Card>
  )
}

/* ---------------- formatters (deterministic, structured data only) ---------------- */

// "Thu · 2:00–3:00 PM" for timed; "Thu · All day" / "Jul 4–10 · All day" for all-day.
function whenLabel(e: CalendarEvent): string {
  if (e.allDay) {
    if (!e.startDate) return 'All day'
    const start = parseDateOnly(e.startDate)
    if (e.endDate && e.endDate !== e.startDate) {
      const end = parseDateOnly(e.endDate)
      return `${monthDay(start)}–${monthDay(end)} · All day`
    }
    return `${relDay(start)} · All day`
  }
  if (!e.startsAt) return ''
  const start = new Date(e.startsAt)
  const startStr = `${relDay(start)} · ${clock(start)}`
  if (e.endsAt) {
    const end = new Date(e.endsAt)
    // Same day → "Thu · 2:00–3:00 PM"; different day → append end date.
    if (sameLocalDay(start, end)) return `${relDay(start)} · ${clock(start)}–${clock(end)}`
    return `${startStr} → ${monthDay(end)} ${clock(end)}`
  }
  return startStr
}

function clock(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
function monthDay(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
function fullDay(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}
function relDay(d: Date, now: Date = new Date()): string {
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff > 1 && diff < 7) return d.toLocaleDateString(undefined, { weekday: 'short' })
  return monthDay(d)
}
function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
function localDayKey(now: Date): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}
