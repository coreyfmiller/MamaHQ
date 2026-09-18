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
  sendMagicLink: (email: string) => Promise<{ ok: boolean; error?: string }>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  status: 'loading',
  user: null,
  familyId: null,
  bootstrapping: false,
  sendMagicLink: async () => ({ ok: false }),
  signOut: async () => {},
})

export function useAuth() {
  return useContext(Ctx)
}

/**
 * Ensure the signed-in user has a family. On first sign-in there's no family, so
 * we create one and add the user as its owner. Returns the family id.
 */
async function ensureFamily(userId: string): Promise<string | null> {
  const supabase = supabaseBrowser()

  // 1) Already a member of a family? Use it.
  const { data: existing } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  if (existing?.family_id) return existing.family_id as string

  // 2) A family this user OWNS but has no membership row for (e.g. created by an
  //    earlier version). Adopt it by creating the missing membership.
  const { data: owned } = await supabase
    .from('families')
    .select('id')
    .eq('owner_id', userId)
    .limit(1)
    .maybeSingle()

  let familyId = owned?.id as string | undefined

  // 3) No family at all → create one.
  if (!familyId) {
    const { data: fam, error: famErr } = await supabase
      .from('families')
      .insert({ owner_id: userId })
      .select('id')
      .single()
    if (famErr || !fam) {
      console.warn('MamaHQ: could not create family', famErr)
      return null
    }
    familyId = fam.id as string
  }

  // Ensure the owner membership exists (idempotent via upsert on the composite PK).
  const { error: memErr } = await supabase
    .from('family_members')
    .upsert(
      { family_id: familyId, user_id: userId, role: 'owner' },
      { onConflict: 'family_id,user_id' },
    )
  if (memErr) {
    console.warn('MamaHQ: could not create family membership', memErr)
    // Still return the family id — reads may work; but flag it loudly.
  }

  return familyId
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

  const sendMagicLink = async (email: string) => {
    const supabase = supabaseBrowser()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // The link lands on our callback route, which exchanges the code for a
        // session (cookies) and then forwards into the app.
        emailRedirectTo:
          typeof window !== 'undefined'
            ? `${window.location.origin}/auth/callback?next=/app`
            : undefined,
      },
    })
    return error ? { ok: false, error: error.message } : { ok: true }
  }

  const signOut = async () => {
    await supabaseBrowser().auth.signOut()
    setUser(null)
    setFamilyId(null)
    setStatus('signed-out')
  }

  const value = useMemo(
    () => ({ status, user, familyId, bootstrapping, sendMagicLink, signOut }),
    [status, user, familyId, bootstrapping],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
