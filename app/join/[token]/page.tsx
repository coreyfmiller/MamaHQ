'use client'

import { useEffect, useState } from 'react'
import { use } from 'react'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase/client'
import { stashPendingInvite } from '@/components/mama/auth'
import { sha256Hex } from '@/lib/household/invite-token'
import * as db from '@/lib/supabase/data'

// Invite acceptance route: /join/<token>
//
// The token is a CREDENTIAL. We immediately hash it (SHA-256) and never send the
// plaintext to our own backend beyond the hash. Flow:
//   * Not signed in  → stash the token hash, send the visitor through the normal
//                      sign-in / create-account flow (/app). The auth bootstrap
//                      redeems the stashed invite right after authentication and
//                      lands them in the SHARED household (never a new personal one).
//   * Signed in      → redeem directly, then continue into the app.
//
// We do NOT log the full invite URL or the plaintext token.
type Phase = 'checking' | 'need-auth' | 'accepting' | 'done' | 'error'

export default function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [phase, setPhase] = useState<Phase>('checking')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      const tokenHash = await sha256Hex(token)
      const supabase = supabaseBrowser()
      const { data } = await supabase.auth.getSession()

      if (!data.session) {
        // Stash and route through sign-in; the auth bootstrap finishes redemption.
        stashPendingInvite(tokenHash)
        if (!alive) return
        setPhase('need-auth')
        return
      }

      // Already authenticated → redeem now.
      setPhase('accepting')
      try {
        await db.acceptHouseholdInvitationRpc(tokenHash)
        if (!alive) return
        setPhase('done')
      } catch (e) {
        if (!alive) return
        setMessage(e instanceof Error ? e.message : 'This invitation could not be accepted.')
        setPhase('error')
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="font-serif text-[24px] font-semibold tracking-tight">
          You&apos;ve been invited to join a household in MamaHQ
        </h1>

        {phase === 'checking' && <p className="text-muted-foreground">Checking your invitation…</p>}

        {phase === 'need-auth' && (
          <>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Sign in or create your own account to join the household. We&apos;ll connect you
              automatically once you&apos;re in.
            </p>
            <Link
              href="/app"
              className="inline-flex w-full items-center justify-center rounded-full bg-primary py-3 text-[15px] font-semibold text-primary-foreground"
            >
              Sign in / Create account
            </Link>
          </>
        )}

        {phase === 'accepting' && <p className="text-muted-foreground">Joining the household…</p>}

        {phase === 'done' && (
          <>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              You&apos;re in. Welcome to the household.
            </p>
            <Link
              href="/app"
              className="inline-flex w-full items-center justify-center rounded-full bg-primary py-3 text-[15px] font-semibold text-primary-foreground"
            >
              Open MamaHQ
            </Link>
          </>
        )}

        {phase === 'error' && (
          <>
            <p className="text-[15px] leading-relaxed text-destructive">{message}</p>
            <Link
              href="/app"
              className="inline-flex w-full items-center justify-center rounded-full bg-muted py-3 text-[15px] font-semibold text-foreground"
            >
              Go to MamaHQ
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
