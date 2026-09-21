'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { useHousehold } from './household'
import { useNow } from './logs'
import { useRealtimeInvalidation } from './realtime'
import * as db from '@/lib/supabase/data'

// Step 10 — Shared Calendar & Household Commitments on the client.
//
// An EVENT says what is happening; PARTICIPANTS are who it's about; the RESPONSIBLE
// person is who's designated to handle it (a designation, NOT an acceptance).
// People are always HouseholdPerson ids. This provider owns calendar data; screens
// read from it and call its actions. Mutations are ATOMIC server-side (event + its
// participants in one transaction via RPC); the client updates optimistically and
// re-syncs for correctness. Requires an authenticated family.

export interface CalendarEvent {
  id: string
  title: string
  notes?: string
  location?: string
  allDay: boolean
  /** Timed model (allDay=false). */
  startsAt: string | null
  endsAt: string | null
  /** All-day model (allDay=true). */
  startDate: string | null
  endDate: string | null
  /** Designated responsible HouseholdPerson (≠ acceptance, ≠ creator). */
  responsiblePersonId: string | null
  createdByUserId: string | null
  participantIds: string[]
  createdAt: string
}

interface CreateEventInput {
  title: string
  allDay?: boolean
  startsAt?: string | null
  endsAt?: string | null
  startDate?: string | null
  endDate?: string | null
  location?: string | null
  notes?: string | null
  responsiblePersonId?: string | null
  participantIds?: string[]
}

interface UpdateEventInput {
  title?: string
  allDay?: boolean
  startsAt?: string | null
  endsAt?: string | null
  startDate?: string | null
  endDate?: string | null
  location?: string | null
  notes?: string | null
  responsiblePersonId?: string | null
  clearResponsible?: boolean
  participantIds?: string[]
  replaceParticipants?: boolean
}

interface CalendarCtx {
  events: CalendarEvent[]
  hydrated: boolean
  available: boolean
  /** True when the last load FAILED (so Today can show a truthful error, not empty). */
  loadError: boolean
  /** The current user's linked HouseholdPerson id (for "Mine"). */
  mePersonId: string | null
  /** Upcoming events (now or later), soonest first. */
  upcoming: CalendarEvent[]
  /** Events on a given local calendar day (YYYY-MM-DD). */
  onDay: (dayKey: string) => CalendarEvent[]
  /** Events happening today (local). */
  today: CalendarEvent[]
  /** "Mine" = events where I'm a participant OR the responsible person. */
  mine: CalendarEvent[]
  create: (input: CreateEventInput) => Promise<{ ok: boolean; error?: string }>
  update: (id: string, input: UpdateEventInput) => Promise<{ ok: boolean; error?: string }>
  remove: (id: string) => Promise<{ ok: boolean; error?: string }>
  refresh: () => Promise<void>
}

const Ctx = createContext<CalendarCtx>({
  events: [],
  hydrated: false,
  available: false,
  loadError: false,
  mePersonId: null,
  upcoming: [],
  onDay: () => [],
  today: [],
  mine: [],
  create: async () => ({ ok: false }),
  update: async () => ({ ok: false }),
  remove: async () => ({ ok: false }),
  refresh: async () => {},
})

export function useCalendar() {
  return useContext(Ctx)
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

function fromRow(r: db.DbCalendarEventWithParticipants): CalendarEvent {
  return {
    id: r.id,
    title: r.title,
    notes: r.notes ?? undefined,
    location: r.location ?? undefined,
    allDay: r.all_day,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    startDate: r.start_date,
    endDate: r.end_date,
    responsiblePersonId: r.responsible_person_id,
    createdByUserId: r.created_by_user_id,
    participantIds: r.participant_ids,
    createdAt: r.created_at,
  }
}

/** The instant an event "starts", for ordering. Timed → its instant; all-day →
 *  local midnight of its start_date. Used only for sorting/filtering. */
export function eventStartMs(e: CalendarEvent): number {
  if (!e.allDay && e.startsAt) return new Date(e.startsAt).getTime()
  if (e.allDay && e.startDate) {
    const [y, m, d] = e.startDate.split('-').map(Number)
    return new Date(y, (m ?? 1) - 1, d ?? 1).getTime()
  }
  return 0
}

/** The instant an event "ends" for the purpose of "is it still upcoming/today". */
function eventEndMs(e: CalendarEvent): number {
  if (!e.allDay) return e.endsAt ? new Date(e.endsAt).getTime() : eventStartMs(e)
  const dateStr = e.endDate ?? e.startDate
  if (!dateStr) return eventStartMs(e)
  const [y, m, d] = dateStr.split('-').map(Number)
  // End of that local day.
  return new Date(y, (m ?? 1) - 1, (d ?? 1), 23, 59, 59, 999).getTime()
}

function localDayKeyFor(now: Date): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

/** Does an event cover a given local calendar day (YYYY-MM-DD)? Handles multi-day. */
export function eventCoversDay(e: CalendarEvent, dayKey: string): boolean {
  const [y, m, d] = dayKey.split('-').map(Number)
  const dayStart = new Date(y, (m ?? 1) - 1, d ?? 1).getTime()
  const dayEnd = new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999).getTime()
  return eventStartMs(e) <= dayEnd && eventEndMs(e) >= dayStart
}

function sortEvents(list: CalendarEvent[]): CalendarEvent[] {
  return [...list].sort((a, b) => eventStartMs(a) - eventStartMs(b))
}

export function CalendarProvider({ children }: { children: ReactNode }) {
  const { familyId, status, user } = useAuth()
  const { me } = useHousehold()
  // A ticking clock (the sanctioned pure-in-render pattern from logs) so upcoming/
  // today stay fresh across midnight/hour boundaries without calling Date.now()
  // during render (which the React Compiler flags as impure).
  const now = useNow(60_000)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [hydrated, setHydrated] = useState(false)
  // Beta Phase 3 — expose a load failure so Today can show a truthful calendar error
  // instead of "nothing on the calendar" when the fetch actually failed.
  const [loadError, setLoadError] = useState(false)

  const reload = async (fid: string) => {
    const rows = await db.fetchCalendarEvents(fid)
    setEvents(sortEvents(rows.map(fromRow)))
  }

  useEffect(() => {
    let alive = true
    setHydrated(false)
    if (familyId) {
      setLoadError(false)
      reload(familyId)
        .catch((e) => {
          console.warn('calendar sync', e)
          if (alive) setLoadError(true)
        })
        .finally(() => {
          if (alive) setHydrated(true)
        })
      return () => {
        alive = false
      }
    }
    if (status !== 'loading') {
      setEvents([])
      setLoadError(false)
      setHydrated(true)
    }
    return () => {
      alive = false
    }
  }, [familyId, status])

  const refresh = async () => {
    if (familyId) await reload(familyId).catch(() => {})
  }

  // Realtime: another session created/edited/deleted an event or changed its
  // participants/responsible person → refetch canonical calendar. The coordinator
  // coalesces the event + participant row bursts into one refetch. Idempotent.
  useRealtimeInvalidation('calendar', () => {
    if (familyId) void reload(familyId).catch(() => {})
  })

  const create: CalendarCtx['create'] = async (input) => {
    if (!familyId) return { ok: false, error: 'not signed in' }
    const id = newId()
    // Optimistic insert.
    const optimistic: CalendarEvent = {
      id,
      title: input.title.trim(),
      notes: input.notes?.trim() || undefined,
      location: input.location?.trim() || undefined,
      allDay: input.allDay ?? false,
      startsAt: input.allDay ? null : input.startsAt ?? null,
      endsAt: input.allDay ? null : input.endsAt ?? null,
      startDate: input.allDay ? input.startDate ?? null : null,
      endDate: input.allDay ? input.endDate ?? null : null,
      responsiblePersonId: input.responsiblePersonId ?? null,
      createdByUserId: user?.id ?? null,
      participantIds: input.participantIds ?? [],
      createdAt: new Date().toISOString(),
    }
    setEvents((list) => sortEvents([...list, optimistic]))
    try {
      await db.createCalendarEventRpc({
        familyId,
        title: input.title.trim(),
        allDay: input.allDay ?? false,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        location: input.location ?? null,
        notes: input.notes ?? null,
        responsiblePersonId: input.responsiblePersonId ?? null,
        participantIds: input.participantIds ?? null,
        clientEventId: id,
      })
      await reload(familyId)
      return { ok: true }
    } catch (e) {
      await reload(familyId).catch(() => {}) // drop the optimistic row on failure
      return { ok: false, error: e instanceof Error ? e.message : 'could not create event' }
    }
  }

  const update: CalendarCtx['update'] = async (id, input) => {
    if (!familyId) return { ok: false, error: 'not signed in' }
    try {
      await db.updateCalendarEventRpc({ eventId: id, ...input })
      await reload(familyId)
      return { ok: true }
    } catch (e) {
      await reload(familyId).catch(() => {})
      return { ok: false, error: e instanceof Error ? e.message : 'could not update event' }
    }
  }

  const remove: CalendarCtx['remove'] = async (id) => {
    if (!familyId) return { ok: false, error: 'not signed in' }
    setEvents((list) => list.filter((e) => e.id !== id)) // optimistic
    try {
      await db.deleteCalendarEventRpc(id)
      return { ok: true }
    } catch (e) {
      await reload(familyId).catch(() => {})
      return { ok: false, error: e instanceof Error ? e.message : 'could not delete event' }
    }
  }

  const upcoming = useMemo(() => {
    const cutoff = now.getTime() - 60 * 60_000 // keep the last hour
    return events.filter((e) => eventEndMs(e) >= cutoff)
  }, [events, now])

  const today = useMemo(() => {
    const key = localDayKeyFor(now)
    return events.filter((e) => eventCoversDay(e, key))
  }, [events, now])

  const onDay = (dayKey: string) => events.filter((e) => eventCoversDay(e, dayKey))

  // "Mine" = events where I'm a participant OR the responsible person. Resolves
  // through the current user's linked HouseholdPerson (never created_by).
  const mine = useMemo(() => {
    if (!me) return []
    return events.filter(
      (e) => e.responsiblePersonId === me.id || e.participantIds.includes(me.id),
    )
  }, [events, me])

  const value = useMemo<CalendarCtx>(
    () => ({
      events,
      hydrated,
      available: Boolean(familyId),
      loadError,
      mePersonId: me?.id ?? null,
      upcoming,
      onDay,
      today,
      mine,
      create,
      update,
      remove,
      refresh,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, hydrated, familyId, loadError, me, upcoming, today, mine],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
