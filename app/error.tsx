'use client'

// MamaHQ — route-level error boundary (Beta Phase 1).
//
// Catches render/runtime errors within the app segment so a failure never becomes a
// blank screen or a raw stack trace. Calm and practical: it does NOT claim anything
// was or wasn't saved (we can't know here), offers a retry, and a safe way home. No
// technical detail is shown to the user; the digest is logged for support only.

import { useEffect } from 'react'
import { reportError } from '@/lib/monitoring'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Send to error monitoring (no household content is included — see lib/monitoring).
    reportError(error)
  }, [error])

  return (
    <main className="flex min-h-[100dvh] w-full items-center justify-center bg-[oklch(0.93_0.018_82)] p-6">
      <div className="w-full max-w-[404px] rounded-[2rem] border border-black/5 bg-background p-8 text-center shadow-[0_40px_80px_-30px_rgba(38,50,56,0.4)]">
        <h1 className="font-serif text-[22px] font-semibold tracking-tight text-foreground">
          Something went sideways
        </h1>
        <p className="mx-auto mt-3 max-w-[18rem] text-[15px] leading-relaxed text-muted-foreground">
          MamaHQ hit an unexpected hiccup. Your household information is safe — this was a display
          problem, not your data. Let&apos;s try again.
        </p>
        <div className="mt-7 space-y-2.5">
          <button
            onClick={() => reset()}
            className="w-full rounded-full bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
          >
            Try again
          </button>
          <a
            href="/app"
            className="block w-full rounded-full bg-muted py-3.5 text-[15px] font-semibold text-foreground transition-transform active:scale-[0.99]"
          >
            Back to MamaHQ
          </a>
        </div>
      </div>
    </main>
  )
}
