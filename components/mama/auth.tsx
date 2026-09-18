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

/**
 * Ensure the signed-in user has a family. On first sign-in there's no family, so
 * we create one and add the user as its owner. Returns the family id.
 */
async function ensureFamily(_userId: string): Promise<string | null> {
  const supabase = supabaseBrowser()
  // A SECURITY DEFINER DB function creates the family + owner membership atomically
  // and returns the family id. This sidesteps the fragile families_insert RLS
  // policy (raw client inserts were being rejected), and is idempotent — repeat
  // calls just return the existing family.
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
      const fid = await ensureFamily(session.user.id)
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
