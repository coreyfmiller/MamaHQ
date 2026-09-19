'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import * as db from '@/lib/supabase/data'

// The Household Person foundation on the client. A Person participates in the
// household whether or not they have a MamaHQ account (`userId` null = no account).
// This is IDENTITY, not authorization — it never grants access; RLS + auth do.
//
// Step 1 scope: read the family's people (the owner's connected person is created
// server-side by ensure_family()), and support adding/editing/removing account-less
// people. No task/grocery assignment wiring yet — that comes with later steps.
export interface HouseholdPerson {
  id: string
  displayName: string
  relationship?: string
  /** Non-null when connected to an authenticated user. null = no account. */
  userId?: string | null
  phone?: string
  email?: string
}

const STORAGE_KEY = 'mamahq.proto.household.v1'

interface HouseholdCtx {
  people: HouseholdPerson[]
  hydrated: boolean
  /** The current user's connected person (owner-person), if resolved. */
  me: HouseholdPerson | null
  /** Add or update an account-less household person (helper/relative/etc.). */
  savePerson: (p: Omit<HouseholdPerson, 'id'> & { id?: string }) => void
  removePerson: (id: string) => void
  clearHousehold: () => void
}

const Ctx = createContext<HouseholdCtx>({
  people: [],
  hydrated: false,
  me: null,
  savePerson: () => {},
  removePerson: () => {},
  clearHousehold: () => {},
})

export function useHousehold() {
  return useContext(Ctx)
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

function fromRow(r: db.DbHouseholdPerson): HouseholdPerson {
  return {
    id: r.id,
    displayName: r.display_name,
    relationship: r.relationship ?? undefined,
    userId: r.user_id,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
  }
}

function readLocal(): HouseholdPerson[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as HouseholdPerson[]) : []
  } catch {
    return []
  }
}
function writeLocal(people: HouseholdPerson[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(people))
  } catch {
    // non-fatal
  }
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { familyId, status, user } = useAuth()
  const [people, setPeople] = useState<HouseholdPerson[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let alive = true
    setHydrated(false)

    if (familyId) {
      db.fetchHouseholdPeople(familyId)
        .then((rows) => {
          if (!alive) return
          setPeople(rows.map(fromRow))
          setHydrated(true)
        })
        .catch(() => {
          if (!alive) return
          setPeople(readLocal())
          setHydrated(true)
        })
      return () => {
        alive = false
      }
    }

    if (status !== 'loading') {
      setPeople(readLocal())
      setHydrated(true)
    }
    return () => {
      alive = false
    }
  }, [familyId, status])

  // Mirror to localStorage only when signed out (cloud is source of truth otherwise).
  useEffect(() => {
    if (!hydrated || familyId) return
    writeLocal(people)
  }, [people, hydrated, familyId])

  const savePerson: HouseholdCtx['savePerson'] = (p) => {
    const id = p.id ?? newId()
    const full: HouseholdPerson = {
      id,
      displayName: p.displayName.trim() || 'Someone',
      relationship: p.relationship?.trim() || undefined,
      // New people added from the UI are account-less by default.
      userId: p.userId ?? null,
      phone: p.phone?.trim() || undefined,
      email: p.email?.trim() || undefined,
    }
    const exists = people.some((x) => x.id === id)
    setPeople((list) => (exists ? list.map((x) => (x.id === id ? full : x)) : [...list, full]))

    if (familyId) {
      const row = {
        id: full.id,
        family_id: familyId,
        display_name: full.displayName,
        relationship: full.relationship ?? null,
        user_id: full.userId ?? null,
        phone: full.phone ?? null,
        email: full.email ?? null,
      }
      const op = exists
        ? db.updateHouseholdPerson(full.id, row)
        : db.insertHouseholdPerson(row)
      op.catch((e) => console.warn('household sync', e))
    }
  }

  const removePerson: HouseholdCtx['removePerson'] = (id) => {
    setPeople((list) => list.filter((x) => x.id !== id))
    if (familyId) db.deleteHouseholdPerson(id).catch((e) => console.warn('household sync', e))
  }

  const clearHousehold = () => {
    setPeople([])
    writeLocal([])
  }

  const me = useMemo(
    () => (user ? people.find((p) => p.userId === user.id) ?? null : null),
    [people, user],
  )

  const value = useMemo(
    () => ({ people, hydrated, me, savePerson, removePerson, clearHousehold }),
    [people, hydrated, me, familyId],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
