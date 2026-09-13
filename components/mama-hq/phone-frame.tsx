import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PhoneFrame({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative w-[280px] shrink-0 rounded-[2.75rem] bg-foreground/90 p-2.5 shadow-[0_40px_80px_-30px_rgba(80,55,40,0.55)]',
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-[2.25rem] bg-card">
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-foreground/90" />
        {children}
      </div>
    </div>
  )
}
