'use client'

import { useRef, useState, type ReactNode } from 'react'
import { Camera, Check, ChevronLeft, Mic, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Baby, House, Sparkles, User } from 'lucide-react'
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
const rightNav: { tab: Tab; label: string; Icon: typeof House }[] = [
  { tab: 'tell', label: 'Tell', Icon: Sparkles },
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
