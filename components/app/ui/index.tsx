'use client'

// Mama HQ — shared app UI primitives. Extracted from patterns repeated across tabs
// (log-sheet, plan-tab, today-tab, memories-tab) so the growing surface stays consistent.
// Behavior preserved from the originals; this is a refactor, not a redesign.

import { cn } from '@/lib/utils'
import { Check, X, Mic, Camera } from 'lucide-react'

// ---------- BottomSheet ----------
// The modal sheet pattern (was local to log-sheet). Backdrop dismiss + safe-area padding.
export function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md rounded-t-3xl border-t border-border bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl text-foreground">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ---------- Segmented control ----------
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { v: T; label: string }[]
  value: T
  onChange: (v: T) => void
  ariaLabel?: string
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex gap-1.5 rounded-2xl bg-muted p-1">
      {options.map((o) => {
        const active = value === o.v
        return (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            aria-pressed={active}
            className={cn(
              'flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors',
              active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------- AmountChips ----------
// Quick-tap amounts so a common bottle/pump amount is 1 tap, not typed (Flow B ~3s target).
export function AmountChips({
  values,
  selected,
  onSelect,
  unit = 'ml',
}: {
  values: number[]
  selected: number | null
  onSelect: (v: number) => void
  unit?: string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((v) => {
        const active = selected === v
        return (
          <button
            key={v}
            onClick={() => onSelect(v)}
            aria-pressed={active}
            className={cn(
              'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground',
            )}
          >
            {v} {unit}
          </button>
        )
      })}
    </div>
  )
}

// ---------- CheckToggle ----------
// Round check control (was local to plan-tab). Used by Plan, Partner tasks, etc.
export function CheckToggle({
  checked,
  onToggle,
  label,
}: {
  checked: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      onClick={onToggle}
      aria-label={label}
      aria-pressed={checked}
      className={cn(
        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors',
        checked
          ? 'border-secondary-foreground/40 bg-secondary text-secondary-foreground'
          : 'border-muted-foreground/40 text-transparent',
      )}
    >
      <Check className="size-3" />
    </button>
  )
}

// ---------- Section ----------
export function Section({
  title,
  icon,
  children,
  className,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={className}>
      <div className="mb-2 flex items-center gap-2">
        {icon && <span className="text-primary">{icon}</span>}
        <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">{title}</h2>
      </div>
      {children}
    </section>
  )
}

// ---------- Field ----------
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

// ---------- PrimaryButton ----------
export function PrimaryButton({
  onClick,
  disabled,
  children,
  className,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full rounded-2xl bg-primary py-3.5 text-base font-semibold text-primary-foreground transition-transform active:scale-95 disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  )
}

// ---------- Card (from the UI prototype) ----------
export function Card({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode
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

export function CardLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn('text-[13px] font-semibold tracking-wide text-muted-foreground', className)}>
      {children}
    </h3>
  )
}

// ---------- LiveDot ----------
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

// ---------- AIInputBar (the Inbox capture entry, from the prototype) ----------
export function AIInputBar({
  placeholder = 'Tell Mama HQ anything…',
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
      <button onClick={onOpen} className="flex-1 truncate py-1.5 text-left text-[15px] text-muted-foreground">
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
      {onMic && (
        <button
          onClick={onMic}
          aria-label="Speak to Mama HQ"
          className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
        >
          <Mic className="size-[19px]" strokeWidth={1.75} />
        </button>
      )}
    </div>
  )
}

// ---------- EmptyState ----------
export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
      {icon && (
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-accent/50 text-primary">
          {icon}
        </span>
      )}
      <p className={cn('font-serif text-lg text-foreground', icon && 'mt-3')}>{title}</p>
      {children && <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">{children}</p>}
    </div>
  )
}
