'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

// MamaHQ 2.0 nav: Today · Baby · + · Home · Me. Tell is NOT a primary destination —
// it is a capability launched from Capture (+) and rendered as the `tell` OVERLAY.
// (PR2 removed the `tell` Tab value; every former setTab('tell') caller now uses
// openOverlay('tell').)
export type Tab = 'today' | 'baby' | 'home' | 'me'

export type Overlay =
  | 'capture'
  | 'quicklog'
  | 'voice'
  | 'photo'
  | 'memories'
  | 'partner'
  | 'beyond90'
  | 'settings'
  | 'reset'
  | 'read'
  | 'grocery'
  | 'people'
  | 'tasks'
  | 'careHandoff'
  | 'calendar'
  | 'calendarCompose'
  | 'notifications'
  | 'tell'
  | null

interface PrototypeCtx {
  phase: 'onboarding' | 'app'
  setPhase: (p: 'onboarding' | 'app') => void
  /** Beta Phase 2 — set once the current onboarding/partner-join flow hands off to
   *  the app. Onboarding routing is driven by authoritative household state
   *  (useHousehold().firstRun), but once a first-run flow is actively underway it
   *  owns the screen until it explicitly finishes — so a mid-flow identity write
   *  (which flips firstRun to 'done') doesn't yank the remaining optional steps out
   *  from under the user. Session-only; resets next load. */
  onboardingDismissed: boolean
  dismissOnboarding: () => void
  tab: Tab
  setTab: (t: Tab) => void
  overlay: Overlay
  openOverlay: (o: Overlay) => void
  closeOverlay: () => void
  toast: string | null
  showToast: (msg: string) => void
  /** Which calendar event the compose screen edits (null = composing new). */
  selectedEventId: string | null
  setSelectedEventId: (id: string | null) => void
  /** Convenience: open the calendar composer to create (null) or edit an event. */
  composeEvent: (id?: string | null) => void
  /** PR2 — the baby log kind Capture wants Quick Log to open straight into
   *  (feed/diaper/sleep jump to their detail step; others log directly). null = show
   *  the normal Quick Log picker. Consumed by QuickLogContent, cleared on close. */
  quickLogKind: QuickLogKind | null
  /** Open the existing Quick Log baby-logging sheet, optionally pre-targeting a kind. */
  openQuickLog: (kind?: QuickLogKind | null) => void
}

/** The baby log kinds Capture can deep-link into. Mirrors the existing log kinds
 *  used by QuickLogContent / useLogs (note: pumping, not "pump"). */
export type QuickLogKind = 'feed' | 'diaper' | 'sleep' | 'pumping'

const noop = () => {}

const defaultCtx: PrototypeCtx = {
  phase: 'app',
  setPhase: noop,
  onboardingDismissed: false,
  dismissOnboarding: noop,
  tab: 'today',
  setTab: noop,
  overlay: null,
  openOverlay: noop,
  closeOverlay: noop,
  toast: null,
  showToast: noop,
  selectedEventId: null,
  setSelectedEventId: noop,
  composeEvent: noop,
  quickLogKind: null,
  openQuickLog: noop,
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
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)
  const [tab, setTab] = useState<Tab>(initialTab)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [quickLogKind, setQuickLogKind] = useState<QuickLogKind | null>(null)

  const composeEvent = (id: string | null = null) => {
    setSelectedEventId(id)
    setOverlay('calendarCompose')
  }

  const openQuickLog = (kind: QuickLogKind | null = null) => {
    setQuickLogKind(kind)
    setOverlay('quicklog')
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
        onboardingDismissed,
        dismissOnboarding: () => setOnboardingDismissed(true),
        tab,
        setTab,
        overlay,
        openOverlay: setOverlay,
        closeOverlay: () => setOverlay(null),
        toast,
        showToast,
        selectedEventId,
        setSelectedEventId,
        composeEvent,
        quickLogKind,
        openQuickLog,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}
