'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export interface ApptQuestion {
  id: string
  text: string
  asked: boolean
}

export interface Appointment {
  id: string
  title: string
  /** ISO timestamp of the appointment start. */
  whenISO: string
  location?: string
  remindersOn: boolean
  questions: ApptQuestion[]
  createdAt: string
}

/** Fields the composer supplies when creating/editing (id/questions managed separately). */
export type ApptDraft = {
  title: string
  whenISO: string
  location?: string
  remindersOn: boolean
}

const STORAGE_KEY = 'mamahq.proto.appointments.v1'

interface ApptCtx {
  appointments: Appointment[]
  hydrated: boolean
  addAppointment: (draft: ApptDraft) => Appointment
  updateAppointment: (id: string, patch: Partial<ApptDraft>) => void
  removeAppointment: (id: string) => void
  addQuestion: (apptId: string, text: string) => void
  toggleQuestion: (apptId: string, qId: string) => void
  removeQuestion: (apptId: string, qId: string) => void
  clearAppointments: () => void
}

const Ctx = createContext<ApptCtx>({
  appointments: [],
  hydrated: false,
  addAppointment: () => ({ id: '', title: '', whenISO: '', remindersOn: false, questions: [], createdAt: '' }),
  updateAppointment: () => {},
  removeAppointment: () => {},
  addQuestion: () => {},
  toggleQuestion: () => {},
  removeQuestion: () => {},
  clearAppointments: () => {},
})

export function useAppointments() {
  return useContext(Ctx)
}

function newId(prefix = 'appt'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function AppointmentsProvider({ children }: { children: ReactNode }) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) setAppointments(JSON.parse(raw) as Appointment[])
    } catch {
      // ignore corrupt/blocked storage
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments))
    } catch {
      // non-fatal
    }
  }, [appointments, hydrated])

  const addAppointment: ApptCtx['addAppointment'] = (draft) => {
    const appt: Appointment = {
      id: newId(),
      title: draft.title.trim() || 'Appointment',
      whenISO: draft.whenISO,
      location: draft.location?.trim() || undefined,
      remindersOn: draft.remindersOn,
      questions: [],
      createdAt: new Date().toISOString(),
    }
    setAppointments((prev) => [...prev, appt])
    return appt
  }

  const updateAppointment: ApptCtx['updateAppointment'] = (id, patch) =>
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              ...patch,
              title: patch.title !== undefined ? patch.title.trim() || 'Appointment' : a.title,
              location:
                patch.location !== undefined ? patch.location.trim() || undefined : a.location,
            }
          : a,
      ),
    )

  const removeAppointment = (id: string) =>
    setAppointments((prev) => prev.filter((a) => a.id !== id))

  const addQuestion: ApptCtx['addQuestion'] = (apptId, text) => {
    const t = text.trim()
    if (!t) return
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === apptId
          ? { ...a, questions: [...a.questions, { id: newId('q'), text: t, asked: false }] }
          : a,
      ),
    )
  }

  const toggleQuestion: ApptCtx['toggleQuestion'] = (apptId, qId) =>
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === apptId
          ? { ...a, questions: a.questions.map((q) => (q.id === qId ? { ...q, asked: !q.asked } : q)) }
          : a,
      ),
    )

  const removeQuestion: ApptCtx['removeQuestion'] = (apptId, qId) =>
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === apptId ? { ...a, questions: a.questions.filter((q) => q.id !== qId) } : a,
      ),
    )

  const clearAppointments = () => {
    setAppointments([])
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  const value = useMemo(
    () => ({
      appointments,
      hydrated,
      addAppointment,
      updateAppointment,
      removeAppointment,
      addQuestion,
      toggleQuestion,
      removeQuestion,
      clearAppointments,
    }),
    [appointments, hydrated],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/* ---------------- Selectors & formatting ---------------- */

/** Upcoming appointments (now or later), soonest first. */
export function upcomingAppointments(list: Appointment[], now: Date = new Date()): Appointment[] {
  return list
    .filter((a) => new Date(a.whenISO).getTime() >= now.getTime() - 60 * 60_000) // keep the last hour
    .sort((a, b) => new Date(a.whenISO).getTime() - new Date(b.whenISO).getTime())
}

/** The single next upcoming appointment, if any. */
export function nextAppointment(list: Appointment[], now: Date = new Date()): Appointment | undefined {
  return upcomingAppointments(list, now)[0]
}

/** Count of not-yet-asked questions on an appointment. */
export function openQuestionCount(a: Appointment): number {
  return a.questions.filter((q) => !q.asked).length
}

/** "Thursday, Apr 11" */
export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

/** "11:00 AM" */
export function shortTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** Relative day grouping label: Today / Tomorrow / weekday / date. */
export function relativeDay(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays > 1 && diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'long' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Whether an appointment is within the next 7 days. */
export function isThisWeek(iso: string, now: Date = new Date()): boolean {
  const ms = new Date(iso).getTime() - now.getTime()
  return ms < 7 * 86_400_000
}
