'use client'

import {
  PenLine,
  ShoppingCart,
  ListChecks,
  CalendarDays,
  Baby as BabyIcon,
  Droplet,
  Moon,
  Milk,
  Heart,
  type LucideIcon,
} from 'lucide-react'
import { useNav } from '../context'

// ── Capture (MamaHQ 2.0) ─────────────────────────────────────────────────────
//
// The universal input sheet behind the center +. Two intents:
//   • "I have something in my head" → Tell MamaHQ (the hero).
//   • "I know exactly what I want"   → a fast deterministic Quick Add / Baby log.
//
// AI is a CAPABILITY here, not a destination. Every action routes to a flow that
// ALREADY EXISTS — this sheet is a compact command palette, not a new feature and
// not four stacked cards. We never advertise an action without a real destination
// (see the PR2 report for deliberately-omitted actions: Note, Speak, Milestone,
// Journal, Photo — none have a truthful home yet).

type Action = {
  key: string
  Icon: LucideIcon
  label: string
  onPick: () => void
}

export function CaptureContent() {
  const { openOverlay, closeOverlay, composeEvent, openQuickLog } = useNav()

  // Route helper: pick an action → close the sheet → open its existing flow. Closing
  // first prevents the capture sheet from lingering stacked under the next overlay.
  const go = (fn: () => void) => {
    closeOverlay()
    fn()
  }

  // Deterministic creation — reuse the canonical screens/composers.
  const quickAdd: Action[] = [
    { key: 'grocery', Icon: ShoppingCart, label: 'Grocery', onPick: () => go(() => openOverlay('grocery')) },
    { key: 'task', Icon: ListChecks, label: 'Task', onPick: () => go(() => openOverlay('tasks')) },
    { key: 'calendar', Icon: CalendarDays, label: 'Calendar', onPick: () => go(() => composeEvent(null)) },
  ]

  // Baby logging — all four route into the SAME existing Quick Log system (useLogs),
  // deep-linked to the right step. 'Pump' maps to the existing 'pumping' log kind.
  const baby: Action[] = [
    { key: 'feed', Icon: Milk, label: 'Feed', onPick: () => go(() => openQuickLog('feed')) },
    { key: 'diaper', Icon: Droplet, label: 'Diaper', onPick: () => go(() => openQuickLog('diaper')) },
    { key: 'sleep', Icon: Moon, label: 'Sleep', onPick: () => go(() => openQuickLog('sleep')) },
    { key: 'pump', Icon: BabyIcon, label: 'Pump', onPick: () => go(() => openQuickLog('pumping')) },
  ]

  // Moments — only Memory has a real destination today (photo + caption). Milestone /
  // Journal / standalone Photo are intentionally omitted (no truthful model yet).
  const moments: Action[] = [
    { key: 'memory', Icon: Heart, label: 'Memory', onPick: () => go(() => openOverlay('memories')) },
  ]

  return (
    <div className="pb-1">
      <h2 className="px-1 font-serif text-[20px] font-semibold tracking-tight">Capture</h2>

      {/* Hero — Tell MamaHQ. The one interaction for an unorganized thought. */}
      <button
        onClick={() => go(() => openOverlay('tell'))}
        className="mt-3 flex w-full items-center gap-3.5 rounded-2xl bg-primary px-4 py-3.5 text-left text-primary-foreground shadow-[0_10px_30px_-14px_var(--primary)] transition-transform active:scale-[0.99]"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15">
          <PenLine className="size-5" strokeWidth={1.9} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold leading-tight">Tell MamaHQ</span>
          <span className="block text-[13px] leading-snug text-primary-foreground/80">
            What&apos;s on your mind? Type it and MamaHQ sorts it out.
          </span>
        </span>
      </button>

      {/* Quick Add — deterministic, fast, no AI required. */}
      <ActionGroup label="Quick add" actions={quickAdd} />

      {/* Baby — same logging system as the Baby screen. */}
      <ActionGroup label="Baby" actions={baby} />

      {/* Moments — only what has a real home. */}
      <ActionGroup label="Moments" actions={moments} />

      <button
        onClick={closeOverlay}
        className="mt-4 w-full rounded-full bg-muted py-3 text-[15px] font-semibold text-foreground transition-transform active:scale-[0.99]"
      >
        Cancel
      </button>
    </div>
  )
}

// A labelled row of compact square actions. Wraps to fit narrow widths; every tile
// is a generous one-handed touch target with an icon + text label.
function ActionGroup({ label, actions }: { label: string; actions: Action[] }) {
  return (
    <section className="mt-4">
      <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {actions.map(({ key, Icon, label: l, onPick }) => (
          <button
            key={key}
            onClick={onPick}
            className="flex min-w-[4.75rem] flex-1 basis-[calc(25%-0.5rem)] flex-col items-center gap-1.5 rounded-2xl bg-muted/50 py-3 ring-1 ring-border/50 transition-colors active:bg-muted"
          >
            <Icon className="size-[22px] text-sage" strokeWidth={1.8} />
            <span className="text-[12.5px] font-medium text-foreground">{l}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
