'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import * as db from '@/lib/supabase/data'

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

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

function readLocal(): Appointment[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Appointment[]) : []
  } catch {
    return []
  }
}
function writeLocal(appointments: Appointment[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments))
  } catch {
    // non-fatal
  }
}

export function AppointmentsProvider({ children }: { children: ReactNode }) {
  const { familyId, status } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [hydrated, setHydrated] = useState(false)

  // Load appointments + their questions (two tables) and stitch together.
  useEffect(() => {
    let alive = true
    setHydrated(false)

    if (familyId) {
      Promise.all([db.fetchAppointments(familyId), db.fetchApptQuestions(familyId)])
        .then(([appts, questions]) => {
          if (!alive) return
          setAppointments(
            appts.map((a) => ({
              id: a.id,
              title: a.title,
              whenISO: a.when_at,
              location: a.location ?? undefined,
              remindersOn: a.reminders_on,
              createdAt: a.created_at,
              questions: questions
                .filter((q) => q.appointment_id === a.id)
                .map((q) => ({ id: q.id, text: q.text, asked: q.asked })),
            })),
          )
          setHydrated(true)
        })
        .catch(() => {
          if (!alive) return
          setAppointments(readLocal())
          setHydrated(true)
        })
      return () => {
        alive = false
      }
    }

    if (status !== 'loading') {
      setAppointments(readLocal())
      setHydrated(true)
    }
    return () => {
      alive = false
    }
  }, [familyId, status])

  useEffect(() => {
    if (!hydrated || familyId) return
    writeLocal(appointments)
  }, [appointments, hydrated, familyId])

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
    if (familyId) {
      db.insertAppointment({
        id: appt.id,
        family_id: familyId,
        title: appt.title,
        when_at: appt.whenISO,
        location: appt.location ?? null,
        reminders_on: appt.remindersOn,
        created_at: appt.createdAt,
      }).catch((e) => console.warn('appt sync', e))
    }
    return appt
  }

  const updateAppointment: ApptCtx['updateAppointment'] = (id, patch) => {
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
    if (familyId) {
      const dbPatch: Partial<db.DbAppointment> = {}
      if (patch.title !== undefined) dbPatch.title = patch.title.trim() || 'Appointment'
      if (patch.whenISO !== undefined) dbPatch.when_at = patch.whenISO
      if (patch.location !== undefined) dbPatch.location = patch.location.trim() || null
      if (patch.remindersOn !== undefined) dbPatch.reminders_on = patch.remindersOn
      db.updateAppointment(id, dbPatch).catch((e) => console.warn('appt sync', e))
    }
  }

  const removeAppointment = (id: string) => {
    setAppointments((prev) => prev.filter((a) => a.id !== id))
    // Questions cascade-delete in the DB via the FK.
    if (familyId) db.deleteAppointment(id).catch((e) => console.warn('appt sync', e))
  }

  const addQuestion: ApptCtx['addQuestion'] = (apptId, text) => {
    const t = text.trim()
    if (!t) return
    const q = { id: newId(), text: t, asked: false }
    setAppointments((prev) =>
      prev.map((a) => (a.id === apptId ? { ...a, questions: [...a.questions, q] } : a)),
    )
    if (familyId) {
      db.insertApptQuestion({
        id: q.id,
        appointment_id: apptId,
        family_id: familyId,
        text: t,
        asked: false,
        created_at: new Date().toISOString(),
      }).catch((e) => console.warn('appt sync', e))
    }
  }

  const toggleQuestion: ApptCtx['toggleQuestion'] = (apptId, qId) => {
    let nextAsked = false
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === apptId
          ? {
              ...a,
              questions: a.questions.map((q) => {
                if (q.id !== qId) return q
                nextAsked = !q.asked
                return { ...q, asked: nextAsked }
              }),
            }
          : a,
      ),
    )
    if (familyId) db.updateApptQuestion(qId, { asked: nextAsked }).catch((e) => console.warn('appt sync', e))
  }

  const removeQuestion: ApptCtx['removeQuestion'] = (apptId, qId) => {
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === apptId ? { ...a, questions: a.questions.filter((q) => q.id !== qId) } : a,
      ),
    )
    if (familyId) db.deleteApptQuestion(qId).catch((e) => console.warn('appt sync', e))
  }

  const clearAppointments = () => {
    setAppointments([])
    writeLocal([])
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
    [appointments, hydrated, familyId],
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
