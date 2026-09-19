'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabaseBrowser } from '@/lib/supabase/client'

type AuthStatus = 'loading' | 'signed-out' | 'signed-in'

interface AuthCtx {
  status: AuthStatus
  user: User | null
  /** The family this user belongs to (created on first sign-in). */
  familyId: string | null
  /** True while we're ensuring the family row exists after sign-in. */
  bootstrapping: boolean
  /** Send a 6-digit sign-in code to the email (works on web + native, no redirect). */
  sendCode: (email: string) => Promise<{ ok: boolean; error?: string }>
  /** Verify the 6-digit code and establish the session in-app. */
  verifyCode: (email: string, token: string) => Promise<{ ok: boolean; error?: string }>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  status: 'loading',
  user: null,
  familyId: null,
  bootstrapping: false,
  sendCode: async () => ({ ok: false }),
  verifyCode: async () => ({ ok: false }),
  signOut: async () => {},
})

export function useAuth() {
  return useContext(Ctx)
}

// Where a pending invitation token-hash is stashed between "open invite link" and
// "finish authenticating". sessionStorage (not localStorage) so it doesn't linger.
const PENDING_INVITE_KEY = 'mamahq.pendingInviteHash'

/** Stash the SHA-256 hash of an invite token to redeem right after sign-in. */
export function stashPendingInvite(tokenHash: string) {
  try {
    window.sessionStorage.setItem(PENDING_INVITE_KEY, tokenHash)
  } catch {
    // non-fatal
  }
}
function readPendingInvite(): string | null {
  try {
    return window.sessionStorage.getItem(PENDING_INVITE_KEY)
  } catch {
    return null
  }
}
function clearPendingInvite() {
  try {
    window.sessionStorage.removeItem(PENDING_INVITE_KEY)
  } catch {
    // non-fatal
  }
}

/**
 * Resolve the signed-in user's household. INVITATION-AWARE (Step 7 §18):
 *
 *   * If a pending invitation is stashed (the user arrived via an invite link),
 *     REDEEM IT FIRST via accept_household_invitation. That transactionally joins
 *     the EXISTING household and links the existing person — and, crucially, we do
 *     NOT call ensure_family, so an invited user never gets an accidental personal
 *     household created before/instead of joining the invited one.
 *   * Otherwise (a normal independent user), ensure_family creates/returns their
 *     own household + owner membership, exactly as before.
 *
 * Both paths are SECURITY DEFINER + idempotent. Returns the resolved family id.
 */
async function resolveHousehold(): Promise<string | null> {
  const supabase = supabaseBrowser()

  const pendingHash = readPendingInvite()
  if (pendingHash) {
    try {
      const { data, error } = await supabase.rpc('accept_household_invitation', {
        p_token_hash: pendingHash,
      })
      if (!error && data) {
        clearPendingInvite()
        return (data as { family_id: string }).family_id ?? null
      }
      // Invitation invalid/expired/revoked/already-used-by-another: drop it and fall
      // through to normal bootstrap so the user still gets a usable (own) household.
      console.warn('MamaHQ: invitation redemption failed', error)
      clearPendingInvite()
    } catch (e) {
      console.warn('MamaHQ: invitation redemption threw', e)
      clearPendingInvite()
    }
  }

  const { data, error } = await supabase.rpc('ensure_family')
  if (error) {
    console.warn('MamaHQ: ensure_family failed', error)
    return null
  }
  return (data as string) ?? null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [bootstrapping, setBootstrapping] = useState(false)

  useEffect(() => {
    const supabase = supabaseBrowser()
    let alive = true

    const apply = async (session: Session | null) => {
      if (!alive) return
      if (!session) {
        setUser(null)
        setFamilyId(null)
        setStatus('signed-out')
        return
      }
      setUser(session.user)
      setStatus('signed-in')
      setBootstrapping(true)
      // Invitation-aware: redeem a stashed invite (join existing household) or
      // ensure the user's own household. Never both.
      const fid = await resolveHousehold()
      if (!alive) return
      setFamilyId(fid)
      setBootstrapping(false)
    }

    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => apply(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e: string, session: Session | null) =>
      apply(session),
    )
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // Email OTP: send a 6-digit code. No emailRedirectTo → Supabase sends a code
  // (not a magic link), which the user types back into the app. This works the
  // same on web and in a native (Capacitor) shell — no browser redirect, no
  // PKCE/callback fragility.
  const sendCode = async (email: string) => {
    const supabase = supabaseBrowser()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    return error ? { ok: false, error: error.message } : { ok: true }
  }

  // Verify the 6-digit code and establish the session in-app.
  const verifyCode = async (email: string, token: string) => {
    const supabase = supabaseBrowser()
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: 'email',
    })
    return error ? { ok: false, error: error.message } : { ok: true }
    // onAuthStateChange (above) picks up the new session and bootstraps the family.
  }

  const signOut = async () => {
    await supabaseBrowser().auth.signOut()
    setUser(null)
    setFamilyId(null)
    setStatus('signed-out')
  }

  const value = useMemo(
    () => ({ status, user, familyId, bootstrapping, sendCode, verifyCode, signOut }),
    [status, user, familyId, bootstrapping],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
