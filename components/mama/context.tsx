'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

export type Tab = 'today' | 'baby' | 'inbox' | 'me'

export type Overlay =
  | 'capture'
  | 'quicklog'
  | 'appointment'
  | 'apptCompose'
  | 'voice'
  | 'photo'
  | 'upcoming'
  | 'memories'
  | 'partner'
  | 'beyond90'
  | 'reminder'
  | 'settings'
  | 'reset'
  | 'read'
  | 'grocery'
  | 'people'
  | 'tasks'
  | 'careHandoff'
  | 'calendar'
  | 'calendarCompose'
  | null

interface PrototypeCtx {
  phase: 'onboarding' | 'app'
  setPhase: (p: 'onboarding' | 'app') => void
  tab: Tab
  setTab: (t: Tab) => void
  overlay: Overlay
  openOverlay: (o: Overlay) => void
  closeOverlay: () => void
  toast: string | null
  showToast: (msg: string) => void
  /** Which appointment the detail/compose screens act on (null = composing new). */
  selectedApptId: string | null
  setSelectedApptId: (id: string | null) => void
  /** Convenience: open an appointment's detail. */
  openAppointment: (id: string) => void
  /** Convenience: open the composer to create (id null) or edit an appointment. */
  composeAppointment: (id?: string | null) => void
  /** Which calendar event the compose screen edits (null = composing new). */
  selectedEventId: string | null
  setSelectedEventId: (id: string | null) => void
  /** Convenience: open the calendar composer to create (null) or edit an event. */
  composeEvent: (id?: string | null) => void
}

const noop = () => {}

const defaultCtx: PrototypeCtx = {
  phase: 'app',
  setPhase: noop,
  tab: 'today',
  setTab: noop,
  overlay: null,
  openOverlay: noop,
  closeOverlay: noop,
  toast: null,
  showToast: noop,
  selectedApptId: null,
  setSelectedApptId: noop,
  openAppointment: noop,
  composeAppointment: noop,
  selectedEventId: null,
  setSelectedEventId: noop,
  composeEvent: noop,
}

const Ctx = createContext<PrototypeCtx>(defaultCtx)

export function useNav() {
  return useContext(Ctx)
}

export function PrototypeProvider({
  children,
  initialPhase = 'onboarding',
  initialTab = 'today',
}: {
  children: ReactNode
  initialPhase?: 'onboarding' | 'app'
  initialTab?: Tab
}) {
  const [phase, setPhase] = useState<'onboarding' | 'app'>(initialPhase)
  const [tab, setTab] = useState<Tab>(initialTab)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const openAppointment = (id: string) => {
    setSelectedApptId(id)
    setOverlay('appointment')
  }
  const composeAppointment = (id: string | null = null) => {
    setSelectedApptId(id)
    setOverlay('apptCompose')
  }
  const composeEvent = (id: string | null = null) => {
    setSelectedEventId(id)
    setOverlay('calendarCompose')
  }

  const showToast = (msg: string) => {
    setToast(msg)
    window.clearTimeout((showToast as unknown as { _t?: number })._t)
    ;(showToast as unknown as { _t?: number })._t = window.setTimeout(
      () => setToast(null),
      2400,
    )
  }

  return (
    <Ctx.Provider
      value={{
        phase,
        setPhase,
        tab,
        setTab,
        overlay,
        openOverlay: setOverlay,
        closeOverlay: () => setOverlay(null),
        toast,
        showToast,
        selectedApptId,
        setSelectedApptId,
        openAppointment,
        composeAppointment,
        selectedEventId,
        setSelectedEventId,
        composeEvent,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}
