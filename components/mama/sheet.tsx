'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[1px] animate-in fade-in"
      />
      <div className="relative rounded-t-[2rem] border-t border-border/60 bg-card px-5 pt-3 pb-9 shadow-[0_-12px_40px_-16px_rgba(38,50,56,0.35)] animate-in slide-in-from-bottom duration-300">
        <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-border" />
        {children}
      </div>
    </div>
  )
}

export function FullOverlay({
  open,
  children,
  dark = false,
}: {
  open: boolean
  children: ReactNode
  dark?: boolean
}) {
  if (!open) return null
  return (
    <div
      className={cn(
        'absolute inset-0 z-40 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300',
        dark ? 'bg-foreground' : 'bg-background',
      )}
    >
      {children}
    </div>
  )
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-28 z-50 flex justify-center px-6">
      <div className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-[13px] font-medium text-background shadow-lg animate-in fade-in slide-in-from-bottom-2">
        {message}
      </div>
    </div>
  )
}
