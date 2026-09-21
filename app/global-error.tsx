'use client'

// MamaHQ — global error boundary (Beta Phase 1).
//
// Last-resort boundary for errors thrown in the root layout itself (where `error.tsx`
// can't render because it lives inside the layout). Must render its own <html>/<body>.
// Kept dependency-free and inline-styled so it works even if app chunks failed to load.

import { useEffect } from 'react'
import { reportError } from '@/lib/monitoring'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportError(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'oklch(0.93 0.018 82)',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 404,
            width: '100%',
            background: '#fff',
            borderRadius: 32,
            padding: 32,
            textAlign: 'center',
            boxShadow: '0 40px 80px -30px rgba(38,50,56,0.4)',
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: '#263238' }}>
            Something went sideways
          </h1>
          <p style={{ marginTop: 12, fontSize: 15, lineHeight: 1.5, color: '#5f6b70' }}>
            MamaHQ hit an unexpected hiccup. Your information is safe. Let&apos;s try again.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 24,
              width: '100%',
              border: 'none',
              borderRadius: 9999,
              padding: '14px 0',
              fontSize: 15,
              fontWeight: 600,
              color: '#fff',
              background: 'oklch(0.55 0.06 155)',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
