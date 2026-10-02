'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { fetchBaby, upsertBaby } from '@/lib/supabase/data'
import { journeyDay } from '@/lib/first90'
import { babyRowFromProfile, profileFromBabyRow } from '@/lib/onboarding'

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
  /** True when signed in and the canonical Baby read FAILED, so we can't tell whether
   *  Baby exists. First-run routing must not re-ask for Baby in that state. */
  loadFailed: boolean
  /** Persist the Baby profile. When signed in this awaits the canonical `babies`
   *  write and only updates state on success, so callers (onboarding) can block on
   *  real persistence. Re-saves update the SAME row (never a duplicate Baby). */
  saveProfile: (p: Profile) => Promise<{ ok: boolean; error?: string }>
  clearProfile: () => void
}

const Ctx = createContext<ProfileCtx>({
  profile: null,
  hydrated: false,
  loadFailed: false,
  saveProfile: async () => ({ ok: false }),
  clearProfile: () => {},
})

function newBabyId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : // RFC4122-ish v4 fallback (the column is uuid-typed).
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })
}

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
  const [loadFailed, setLoadFailed] = useState(false)
  // The canonical babies row id, once known (read, or assigned on first save). Writes
  // carry it so a retry/re-save upserts the SAME row instead of inserting a duplicate.
  const babyIdRef = useRef<string | null>(null)

  // Load the profile from the right source: cloud when we have a family, local
  // otherwise. Re-runs when auth resolves so signing in swaps to the cloud copy.
  useEffect(() => {
    let alive = true
    setHydrated(false)
    setLoadFailed(false)
    babyIdRef.current = null

    // Signed in with a family → read the baby row from Supabase.
    if (familyId) {
      fetchBaby(familyId)
        .then((baby) => {
          if (!alive) return
          if (baby) {
            babyIdRef.current = baby.id
            // momName isn't on the baby row; preserve it from the local copy if we
            // have one (same device), else a friendly default.
            const localMom = readLocal()?.momName
            setProfile(profileFromBabyRow(baby, localMom ?? 'Mama'))
          } else {
            // Signed in with NO cloud baby → this is a genuine first run. The cloud
            // is the source of truth when signed in, so ignore any stale localStorage
            // (and clear it) rather than skipping onboarding on old local data.
            writeLocal(null)
            setProfile(null)
          }
          setHydrated(true)
        })
        .catch(() => {
          if (!alive) return
          // On a fetch error we can't confirm cloud state; fall back to local so the
          // app still works, but don't fabricate a profile. loadFailed tells first-run
          // routing not to re-ask for Baby (which could write a duplicate row).
          setProfile(readLocal())
          setLoadFailed(true)
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

  const saveProfile: ProfileCtx['saveProfile'] = async (p) => {
    if (familyId) {
      // Signed in: the canonical babies row is the source of truth. Await it and only
      // reflect the change once it persisted (truthful first-run completion).
      const id = babyIdRef.current ?? newBabyId()
      try {
        await upsertBaby(babyRowFromProfile(familyId, id, p))
      } catch (err) {
        console.warn('MamaHQ: could not save baby to cloud', err)
        return { ok: false, error: err instanceof Error ? err.message : 'could not save Baby' }
      }
      babyIdRef.current = id
      setLoadFailed(false)
    }
    setProfile(p)
    // Always keep a local copy (offline + signed-out).
    writeLocal(p)
    return { ok: true }
  }

  const clearProfile = () => {
    setProfile(null)
    writeLocal(null)
    babyIdRef.current = null
    // Cloud baby rows are cleared by the reset flow (deletes family data) separately.
  }

  const value = useMemo(
    () => ({ profile, hydrated, loadFailed, saveProfile, clearProfile }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, hydrated, loadFailed, familyId],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/* ---------------- Derived helpers ---------------- */

/** Whole days since birth (day of birth = Day 1, matching the shipped app's feel).
 *  Delegates to the shared `journeyDay` (lib/first90) so day calculation is defined
 *  ONCE and is timezone-safe: a 'YYYY-MM-DD' birth date is parsed as a LOCAL calendar
 *  day, not UTC (a UTC parse shifts the day by one in negative-offset timezones). */
export function dayNumber(birthDate: string, now: Date = new Date()): number {
  return journeyDay(birthDate, now)
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
