'use client'

// Mama HQ — shared app UI primitives. Extracted from patterns repeated across tabs
// (log-sheet, plan-tab, today-tab, memories-tab) so the growing surface stays consistent.
// Behavior preserved from the originals; this is a refactor, not a redesign.

import { cn } from '@/lib/utils'
import { Check, X } from 'lucide-react'

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
