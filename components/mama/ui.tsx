'use client'

import { useRef, useState, type ReactNode } from 'react'
import { AlertCircle, Camera, Check, ChevronLeft, ChevronRight, Mic, Plus, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Baby, House, LayoutGrid, User } from 'lucide-react'
import { useNav, type Tab } from './context'

/* ---------------- Status bar ---------------- */

export function StatusBar({ dark = false }: { dark?: boolean }) {
  const color = dark ? 'text-white' : 'text-foreground'
  const bar = dark ? 'bg-white' : 'bg-foreground'
  return (
    <div className={cn('flex items-center justify-between px-7 pt-4 pb-2', color)}>
      <span className="text-[15px] font-semibold tracking-tight">9:41</span>
      <div className="flex items-center gap-1.5">
        <div className="flex items-end gap-[2px]">
          {[3, 5, 7, 9].map((h) => (
            <span key={h} className={cn('w-[3px] rounded-full', bar)} style={{ height: h }} />
          ))}
        </div>
        <svg viewBox="0 0 16 12" className="h-3 w-4" fill="none" aria-hidden="true">
          <path
            d="M8 3.2c1.7 0 3.2.7 4.3 1.8M8 6.4c.9 0 1.7.4 2.3 1M3.7 5C4.8 3.9 6.3 3.2 8 3.2M5.7 7.4c.6-.6 1.4-1 2.3-1"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            className={color}
          />
          <circle cx="8" cy="9.4" r="0.9" className={cn(dark ? 'fill-white' : 'fill-foreground')} />
        </svg>
        <div className={cn('flex h-3 w-6 items-center rounded-[3px] border px-[2px]', dark ? 'border-white/70' : 'border-foreground/60')}>
          <div className={cn('h-[6px] w-full rounded-[1px]', bar)} />
        </div>
      </div>
    </div>
  )
}

/* ---------------- Layout ---------------- */

export function Screen({
  children,
  dark = false,
  className,
}: {
  children: ReactNode
  dark?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex h-full flex-col overflow-hidden', dark ? 'bg-foreground' : 'bg-background', className)}>
      {children}
    </div>
  )
}

export function Scroll({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('no-scrollbar flex-1 overflow-y-auto', className)}>{children}</div>
}

/* ---------------- Top bar (overlays) ---------------- */

export function TopBar({
  title,
  onBack,
  variant = 'back',
  right,
  dark = false,
}: {
  title?: string
  onBack?: () => void
  variant?: 'back' | 'close'
  right?: ReactNode
  dark?: boolean
}) {
  const Icon = variant === 'close' ? X : ChevronLeft
  const tone = dark ? 'text-white' : 'text-foreground'
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <button
        onClick={onBack}
        aria-label={variant === 'close' ? 'Close' : 'Back'}
        className={cn(
          'flex size-10 items-center justify-center rounded-full transition-colors active:bg-foreground/5',
          tone,
          dark && 'active:bg-white/10',
        )}
      >
        <Icon className="size-6" strokeWidth={1.9} />
      </button>
      {title && <span className={cn('text-[16px] font-semibold', tone)}>{title}</span>}
      <div className="flex min-w-10 justify-end">{right}</div>
    </div>
  )
}

/* ---------------- Card ---------------- */

export function Card({
  children,
  className,
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'rounded-3xl border border-border/70 bg-card p-5 text-left shadow-[0_1px_2px_rgba(38,50,56,0.04),0_10px_30px_-18px_rgba(38,50,56,0.18)]',
        onClick && 'w-full transition-transform active:scale-[0.99]',
        className,
      )}
    >
      {children}
    </Comp>
  )
}

export function CardLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={cn('text-[13px] font-semibold tracking-wide text-muted-foreground', className)}>
      {children}
    </h3>
  )
}

/* ---------------- Segmented control ---------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string; badge?: number }[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cn('flex rounded-full bg-muted p-1', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
              active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            {o.label}
            {o.badge != null && (
              <span
                className={cn(
                  'flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[11px] font-semibold',
                  active ? 'bg-primary text-primary-foreground' : 'bg-foreground/10 text-muted-foreground',
                )}
              >
                {o.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ---------------- Checkbox + task row ---------------- */

export function CheckBox({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-[22px] shrink-0 items-center justify-center rounded-lg border transition-colors',
        checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card',
        className,
      )}
    >
      {checked && <Check className="size-3.5" strokeWidth={3} />}
    </span>
  )
}

export function TaskRow({
  label,
  defaultChecked = false,
  className,
}: {
  label: string
  defaultChecked?: boolean
  className?: string
}) {
  const [checked, setChecked] = useState(defaultChecked)
  return (
    <button
      onClick={() => setChecked((c) => !c)}
      className={cn('flex w-full items-center gap-3 py-2 text-left', className)}
    >
      <CheckBox checked={checked} />
      <span className={cn('text-[15px] text-foreground transition-colors', checked && 'text-muted-foreground line-through')}>
        {label}
      </span>
    </button>
  )
}

/* ---------------- AI input bar ---------------- */

export function AIInputBar({
  placeholder = 'Tell MamaHQ anything\u2026',
  onOpen,
  onMic,
  onCamera,
  className,
}: {
  placeholder?: string
  onOpen?: () => void
  onMic?: () => void
  onCamera?: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full border border-border/80 bg-card py-2 pr-2 pl-5 shadow-[0_6px_20px_-10px_rgba(38,50,56,0.25)]',
        className,
      )}
    >
      <button
        onClick={onOpen}
        className="flex-1 truncate py-1.5 text-left text-[15px] text-muted-foreground"
      >
        {placeholder}
      </button>
      {onCamera && (
        <button
          onClick={onCamera}
          aria-label="Capture a photo"
          className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted"
        >
          <Camera className="size-[20px]" strokeWidth={1.75} />
        </button>
      )}
      <button
        onClick={onMic}
        aria-label="Speak to MamaHQ"
        className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
      >
        <Mic className="size-[19px]" strokeWidth={1.75} />
      </button>
    </div>
  )
}

/* ---------------- Bottom navigation ---------------- */

// Two destinations on each side of the raised center capture button.
const leftNav: { tab: Tab; label: string; Icon: typeof House }[] = [
  { tab: 'today', label: 'Today', Icon: House },
  { tab: 'baby', label: 'Baby', Icon: Baby },
]
// MamaHQ 2.0 nav: Today · Baby · + · Home · Me. Home takes the slot Tell used to
// occupy. Tell is NOT gone — it remains reachable via the Capture sheet (+) and its
// overlay; the `tell` Tab value stays resolvable for existing callers until PR2.
const rightNav: { tab: Tab; label: string; Icon: typeof House }[] = [
  { tab: 'home', label: 'Home', Icon: LayoutGrid },
  { tab: 'me', label: 'Me', Icon: User },
]

function NavTab({ tab, label, Icon, active }: { tab: Tab; label: string; Icon: typeof House; active: boolean }) {
  const { setTab } = useNav()
  return (
    <button
      onClick={() => setTab(tab)}
      className={cn(
        'flex flex-1 flex-col items-center gap-1 rounded-2xl py-1 transition-colors',
        active ? 'text-primary' : 'text-muted-foreground',
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className="size-[22px]" strokeWidth={active ? 2.1 : 1.7} />
      <span className={cn('text-[11px]', active ? 'font-semibold' : 'font-medium')}>{label}</span>
    </button>
  )
}

/**
 * Capture-first bottom navigation: four destinations split around a raised center
 * button. The button is the app's primary action — "get it out of my head." It
 * opens the capture sheet on tap, and a short swipe-up (touch or trackpad/wheel)
 * does the same, so it feels reachable one-handed.
 */
export function BottomNav({ active }: { active: Tab }) {
  const { openOverlay } = useNav()

  const openCapture = () => openOverlay('capture')

  // Swipe-up on the center button. We track a small upward travel on touch, and
  // an upward wheel gesture on trackpads, then open capture once past a threshold.
  const touchStartY = useRef<number | null>(null)
  const wheelAccum = useRef(0)

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? null
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current == null) return
    const dy = touchStartY.current - (e.touches[0]?.clientY ?? touchStartY.current)
    if (dy > 36) {
      touchStartY.current = null
      openCapture()
    }
  }
  const onWheel = (e: React.WheelEvent) => {
    // Upward scroll is negative deltaY; accumulate so a small flick triggers once.
    wheelAccum.current += e.deltaY
    if (wheelAccum.current < -40) {
      wheelAccum.current = 0
      openCapture()
    } else if (wheelAccum.current > 0) {
      wheelAccum.current = 0
    }
  }

  return (
    <nav
      className="relative flex items-center justify-around border-t border-border/70 bg-card/80 px-2 pt-3 backdrop-blur"
      // Respect the iOS home-indicator safe area so the bar isn't cut off / cramped.
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      {/* Soft fade so scrolling content dissolves into the bar instead of a hard cut. */}
      <div className="pointer-events-none absolute -top-6 inset-x-0 h-6 bg-gradient-to-t from-background to-transparent" />

      {leftNav.map((n) => (
        <NavTab key={n.tab} {...n} active={n.tab === active} />
      ))}

      {/* Center capture button. It's the tallest item in the bar (not overhanging
          with a negative margin, which got clipped on phones) so it can't be cut off. */}
      <div className="flex flex-1 justify-center">
        <button
          onClick={openCapture}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onWheel={onWheel}
          aria-label="Capture — speak, snap, type or log"
          className="flex size-16 shrink-0 touch-none flex-col items-center justify-center gap-0.5 rounded-full bg-primary text-primary-foreground shadow-[0_12px_28px_-8px_var(--primary)] transition-transform active:scale-95"
        >
          <Plus className="size-6" strokeWidth={2.25} />
          <span className="text-[10px] font-semibold leading-none">Capture</span>
        </button>
      </div>

      {rightNav.map((n) => (
        <NavTab key={n.tab} {...n} active={n.tab === active} />
      ))}
    </nav>
  )
}

/* ---------------- Live dot ---------------- */

export function LiveDot({ label = 'Live' }: { label?: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[12px] font-medium text-live">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-live" />
      </span>
      {label}
    </span>
  )
}

/* ============================================================================
 * MamaHQ 2.0 — Summary primitives
 *
 * The visual grammar for information-first surfaces (Home first; Baby/Me/Today
 * follow in later PRs). Deliberately NOT another pile of identical big white
 * cards: a summary is a titled surface with a header row (icon + title + count +
 * optional action), a scannable body (stat row / preview rows), and an optional
 * footer action. Hierarchy comes from weight + grouping, not from stacking cards.
 * ==========================================================================*/

/** A small section heading with an optional right-aligned action link. */
export function SectionHeader({
  title,
  icon: Icon,
  action,
  className,
}: {
  title: string
  icon?: LucideIcon
  action?: { label: string; onClick: () => void }
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between px-1', className)}>
      <div className="flex items-center gap-2">
        {Icon && (
          <span className="flex size-6 items-center justify-center rounded-lg bg-sage-soft text-sage">
            <Icon className="size-[15px]" strokeWidth={2} />
          </span>
        )}
        <h2 className="font-serif text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-0.5 text-[13px] font-medium text-primary transition-transform active:scale-[0.98]"
        >
          {action.label}
          <ChevronRight className="size-3.5" />
        </button>
      )}
    </div>
  )
}

/**
 * A composed summary surface. Header (icon + title + optional count/right slot),
 * a body (children), and an optional footer action that opens the canonical
 * full-feature screen. `onOpen` makes the whole surface tappable while keeping an
 * explicit, labelled footer for discoverability + accessibility.
 */
export function SummarySection({
  title,
  icon: Icon,
  count,
  right,
  onOpen,
  openLabel = 'Open',
  children,
  className,
}: {
  title: string
  icon?: LucideIcon
  /** A short count/status shown next to the title (e.g. "8 items", "3 today"). */
  count?: string
  /** Optional custom right-side element in the header (overrides `count`). */
  right?: ReactNode
  onOpen?: () => void
  openLabel?: string
  children?: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-3xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(38,50,56,0.04),0_10px_30px_-20px_rgba(38,50,56,0.18)]',
        className,
      )}
    >
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
        {Icon && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-sage-soft text-sage">
            <Icon className="size-[18px]" strokeWidth={1.9} />
          </span>
        )}
        <h2 className="flex-1 font-serif text-[16px] font-semibold tracking-tight">{title}</h2>
        {right ?? (count && <span className="text-[13px] font-medium text-muted-foreground">{count}</span>)}
      </div>

      {children != null && <div className="px-4 pb-2">{children}</div>}

      {onOpen && (
        <button
          onClick={onOpen}
          className="flex w-full items-center justify-between border-t border-border/60 px-4 py-3 text-left transition-colors active:bg-muted/60"
        >
          <span className="text-[13px] font-semibold text-primary">{openLabel}</span>
          <ChevronRight className="size-4 text-primary" />
        </button>
      )}
    </section>
  )
}

/** A compact row of labelled numbers, e.g. "3 today · 5 open". Uses a middot
 *  separator rather than boxes so it reads as a sentence of facts, not a grid. */
export function StatRow({
  stats,
  className,
}: {
  stats: { value: string | number; label: string }[]
  className?: string
}) {
  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[13px] text-muted-foreground', className)}>
      {stats.map((s, i) => (
        <span key={i} className="inline-flex items-baseline gap-1">
          {i > 0 && <span aria-hidden className="mr-1 text-muted-foreground/50">·</span>}
          <span className="font-semibold tabular-nums text-foreground">{s.value}</span>
          <span>{s.label}</span>
        </span>
      ))}
    </p>
  )
}

/** A single scannable preview line (e.g. a task or event). Optional leading mark
 *  (checkbox-like circle, time, or icon) and optional trailing meta. */
export function PreviewRow({
  lead,
  label,
  meta,
  muted = false,
  className,
}: {
  lead?: ReactNode
  label: string
  meta?: string
  muted?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2.5 py-1', className)}>
      {lead != null && <span className="flex shrink-0 items-center justify-center">{lead}</span>}
      <span className={cn('min-w-0 flex-1 truncate text-[14px]', muted ? 'text-muted-foreground' : 'text-foreground')}>
        {label}
      </span>
      {meta && <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{meta}</span>}
    </div>
  )
}

/** Status chip that never relies on colour alone — always icon + text. */
export function StatusChip({
  label,
  tone = 'neutral',
  icon: Icon,
  className,
}: {
  label: string
  tone?: 'neutral' | 'positive' | 'attention' | 'info'
  icon?: LucideIcon
  className?: string
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-muted text-muted-foreground',
    positive: 'bg-sage-soft text-sage',
    attention: 'bg-peach-soft text-peach',
    info: 'bg-blush-soft text-blush',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium',
        tones[tone],
        className,
      )}
    >
      {Icon && <Icon className="size-3" strokeWidth={2.5} />}
      {label}
    </span>
  )
}

/* ---- Honest data states: Loading ≠ Empty ≠ Failed ---- */

/** Data not known yet. Never rendered as an empty/zero state. */
export function SummaryLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <p className="flex items-center gap-2 py-1 text-[13px] text-muted-foreground">
      <span className="size-3 animate-pulse rounded-full bg-muted-foreground/40" aria-hidden />
      {label}
    </p>
  )
}

/** Data loaded successfully and there is genuinely nothing. Calm + optionally
 *  actionable — never presented as an error. */
export function SummaryEmpty({
  label,
  action,
}: {
  label: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-1 text-[13px] font-medium text-primary transition-transform active:scale-[0.98]"
        >
          <Plus className="size-3.5" strokeWidth={2.25} />
          {action.label}
        </button>
      )}
    </div>
  )
}

/** The load failed. Truthful, not alarming; offers a retry when possible. Never
 *  collapses into a "0 items" empty state. */
export function SummaryError({
  label = "Couldn't load this right now.",
  onRetry,
}: {
  label?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <AlertCircle className="size-3.5 shrink-0 text-peach" strokeWidth={2} />
        {label}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 text-[13px] font-medium text-primary transition-transform active:scale-[0.98]"
        >
          Try again
        </button>
      )}
    </div>
  )
}
