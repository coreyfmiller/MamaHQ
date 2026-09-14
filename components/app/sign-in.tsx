'use client'

import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { Loader2 } from 'lucide-react'

export function SignIn() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signInWithGoogle() {
    setBusy(true)
    setError(null)
    try {
      const supabase = supabaseBrowser()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) throw error
      // Redirects to Google; nothing more to do here.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start sign-in.')
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center bg-background px-8 text-center">
      <div className="w-full">
        <h1 className="font-serif text-3xl leading-tight text-foreground">Mama HQ</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your first 90 days. All in one place.
        </p>

        <button
          onClick={signInWithGoogle}
          disabled={busy}
          className="mt-10 flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card py-3.5 text-base font-semibold text-foreground shadow-sm transition-transform active:scale-95 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleMark />}
          Continue with Google
        </button>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <p className="mt-8 text-xs leading-relaxed text-muted-foreground/70">
          Your family’s information stays private to you.
        </p>
      </div>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  )
}
