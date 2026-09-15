'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

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

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // Read once on mount. localStorage isn't available during SSR, hence the effect.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) setProfile(JSON.parse(raw) as Profile)
    } catch {
      // Corrupt/blocked storage — start fresh rather than crash.
    }
    setHydrated(true)
  }, [])

  const saveProfile = (p: Profile) => {
    setProfile(p)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
    } catch (err) {
      // Most likely a QuotaExceededError from an oversized photo. The profile
      // still lives in memory for this session, but it won't survive reload.
      // Surface it rather than failing silently (which looked like "it forgot me").
      console.warn('MamaHQ: could not persist profile to localStorage', err)
    }
  }

  const clearProfile = () => {
    setProfile(null)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  const value = useMemo(
    () => ({ profile, hydrated, saveProfile, clearProfile }),
    [profile, hydrated],
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
