'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'

// Auth callback that completes sign-in for EVERY Supabase redirect shape:
//  - PKCE email links land with ?code=...          → exchangeCodeForSession
//  - verify / OTP links land with ?token_hash&type  → verifyOtp
//  - implicit links land with #access_token=...     → detectSessionInUrl (client)
// Runs client-side so it can read the URL hash (a server route cannot). Once a
// session exists, it forwards into the app.
export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = supabaseBrowser()
    const url = new URL(window.location.href)
    const params = url.searchParams
    const next = params.get('next') ?? '/app'

    const finish = () => {
      window.location.replace(next)
    }

    async function run() {
      try {
        // Already have a session (e.g. hash auto-detected by the client)? Go.
        const { data: pre } = await supabase.auth.getSession()
        if (pre.session) return finish()

        const code = params.get('code')
        const tokenHash = params.get('token_hash')
        const type = params.get('type')

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
          return finish()
        }

        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            type: type as any,
          })
          if (error) throw error
          return finish()
        }

        // Give the client a beat to process a hash-based session, then re-check.
        await new Promise((r) => setTimeout(r, 400))
        const { data: post } = await supabase.auth.getSession()
        if (post.session) return finish()

        setError('This sign-in link didn’t work. It may have expired — request a new one.')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Sign-in failed. Try requesting a new link.')
      }
    }

    run()
  }, [])

  return (
    <div className="grid min-h-dvh place-items-center bg-background px-8 text-center">
      {error ? (
        <div>
          <p className="font-serif text-xl text-foreground">Couldn’t finish signing in</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <a href="/app" className="mt-6 inline-block text-sm font-medium text-primary underline underline-offset-4">
            Back to sign in
          </a>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      )}
    </div>
  )
}
