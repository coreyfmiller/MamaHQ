'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { fetchBaby, upsertBaby } from '@/lib/supabase/data'

export type Feeding = 'breast' | 'bottle' | 'both'

export interface Profile {
  momName: string
  babyName: string
  /** ISO date string (yyyy-mm-dd) of the baby's birth. */
  birthDate: string
  feeding: Feeding
  /** Optional data URL of an uploaded photo. When absent we show a name avatar. */
  photo?: string
}

const STORAGE_KEY = 'mamahq.proto.profile.v1'

interface ProfileCtx {
  profile: Profile | null
  /** True until we've read localStorage, so we don't flash onboarding on reload. */
  hydrated: boolean
  saveProfile: (p: Profile) => void
  clearProfile: () => void
}

const Ctx = createContext<ProfileCtx>({
  profile: null,
  hydrated: false,
  saveProfile: () => {},
  clearProfile: () => {},
})

export function useProfile() {
  return useContext(Ctx)
}

function readLocal(): Profile | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Profile) : null
  } catch {
    return null
  }
}
function writeLocal(p: Profile | null) {
  try {
    if (p) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.warn('MamaHQ: could not persist profile to localStorage', err)
  }
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { familyId, status } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // Load the profile from the right source: cloud when we have a family, local
  // otherwise. Re-runs when auth resolves so signing in swaps to the cloud copy.
  useEffect(() => {
    let alive = true
    setHydrated(false)

    // Signed in with a family → read the baby row from Supabase.
    if (familyId) {
      fetchBaby(familyId)
        .then((baby) => {
          if (!alive) return
          if (baby) {
            // momName isn't on the baby row; preserve it from the local copy if we
            // have one (same device), else a friendly default.
            const localMom = readLocal()?.momName
            setProfile({
              momName: localMom ?? 'Mama',
              babyName: baby.name,
              birthDate: baby.birth_date,
              feeding: (baby.feeding ?? 'both') as Feeding,
              photo: baby.photo ?? undefined,
            })
          } else {
            // No cloud baby yet — surface local (used by first-sign-in import) or null.
            setProfile(readLocal())
          }
          setHydrated(true)
        })
        .catch(() => {
          if (!alive) return
          setProfile(readLocal())
          setHydrated(true)
        })
      return () => {
        alive = false
      }
    }

    // Signed out (or auth still resolving as signed-out) → local only.
    if (status !== 'loading') {
      setProfile(readLocal())
      setHydrated(true)
    }
    return () => {
      alive = false
    }
  }, [familyId, status])

  const saveProfile = (p: Profile) => {
    setProfile(p)
    // Always keep a local copy (offline + signed-out). When signed in, also write cloud.
    writeLocal(p)
    if (familyId) {
      upsertBaby({
        family_id: familyId,
        name: p.babyName,
        birth_date: p.birthDate,
        feeding: p.feeding,
        photo: p.photo ?? null,
      }).catch((err) => console.warn('MamaHQ: could not save baby to cloud', err))
    }
  }

  const clearProfile = () => {
    setProfile(null)
    writeLocal(null)
    // Cloud baby rows are cleared by the reset flow (deletes family data) separately.
  }

  const value = useMemo(
    () => ({ profile, hydrated, saveProfile, clearProfile }),
    [profile, hydrated, familyId],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/* ---------------- Derived helpers ---------------- */

/** Whole days since birth (day of birth = Day 1, matching the shipped app's feel). */
export function dayNumber(birthDate: string, now: Date = new Date()): number {
  const birth = new Date(birthDate)
  if (isNaN(birth.getTime())) return 1
  const ms = now.setHours(0, 0, 0, 0) - new Date(birth).setHours(0, 0, 0, 0)
  return Math.max(1, Math.floor(ms / 86_400_000) + 1)
}

/** Human age label like "3 weeks old" / "5 days old" / "4 months old". */
export function ageLabel(birthDate: string, now: Date = new Date()): string {
  const days = dayNumber(birthDate, now) - 1
  if (days < 1) return 'Newborn'
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} old`
  if (days < 60) {
    const w = Math.floor(days / 7)
    return `${w} week${w === 1 ? '' : 's'} old`
  }
  const m = Math.floor(days / 30)
  return `${m} month${m === 1 ? '' : 's'} old`
}

/** First initial for the name-avatar fallback. */
export function initialOf(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase()
}
