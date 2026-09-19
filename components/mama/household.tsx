'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import * as db from '@/lib/supabase/data'
import { generateInviteToken, sha256Hex, inviteUrl } from '@/lib/household/invite-token'

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
  /** Durable account state (Step 7) — NOT derived from display text.
   *   connected = linked to an auth user + active membership
   *   invited   = a pending invitation exists for this person
   *   none      = no account, no pending invite */
  accountStatus?: 'connected' | 'invited' | 'none'
  /** owner|member when this person is a connected authenticated member. */
  role?: 'owner' | 'member' | null
  /** The pending invitation id (for revoke), when accountStatus === 'invited'. */
  pendingInvitationId?: string | null
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
  // Step 7: invite an existing (account-less) person to join the household. Returns
  // the shareable invite link (the plaintext token lives only in this link).
  invitePerson: (personId: string, email?: string) => Promise<{ ok: boolean; url?: string; error?: string }>
  /** Revoke a pending invitation, making its token unusable. */
  revokeInvite: (invitationId: string) => Promise<void>
}

const Ctx = createContext<HouseholdCtx>({
  people: [],
  hydrated: false,
  me: null,
  savePerson: () => {},
  removePerson: () => {},
  clearHousehold: () => {},
  invitePerson: async () => ({ ok: false }),
  revokeInvite: async () => {},
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
  const [peopleRows, setPeopleRows] = useState<db.DbHouseholdPerson[]>([])
  const [members, setMembers] = useState<db.DbFamilyMember[]>([])
  const [invitations, setInvitations] = useState<db.DbHouseholdInvitation[]>([])
  const [localPeople, setLocalPeople] = useState<HouseholdPerson[]>([])
  const [hydrated, setHydrated] = useState(false)

  // Load people + membership + invitations together so account status is derived
  // from durable state, not display text.
  const loadHousehold = async (fid: string) => {
    const [peopleRes, membersRes, invitesRes] = await Promise.allSettled([
      db.fetchHouseholdPeople(fid),
      db.fetchFamilyMembers(fid),
      db.fetchHouseholdInvitations(fid),
    ])
    if (peopleRes.status === 'fulfilled') setPeopleRows(peopleRes.value)
    if (membersRes.status === 'fulfilled') setMembers(membersRes.value)
    if (invitesRes.status === 'fulfilled') setInvitations(invitesRes.value)
    return peopleRes.status === 'fulfilled'
  }

  useEffect(() => {
    let alive = true
    setHydrated(false)

    if (familyId) {
      loadHousehold(familyId)
        .then((ok) => {
          if (!alive) return
          if (!ok) setLocalPeople(readLocal())
          setHydrated(true)
        })
        .catch(() => {
          if (!alive) return
          setLocalPeople(readLocal())
          setHydrated(true)
        })
      return () => {
        alive = false
      }
    }

    if (status !== 'loading') {
      setLocalPeople(readLocal())
      setHydrated(true)
    }
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, status])

  // Derive people (+ account status) from the loaded rows/members/invitations, or
  // fall back to local (signed-out) people.
  const people = useMemo<HouseholdPerson[]>(() => {
    if (!familyId) return localPeople
    const pendingByPerson = new Map<string, string>() // person_id -> invitation id
    for (const inv of invitations) {
      if (inv.status === 'pending' && inv.household_person_id) {
        pendingByPerson.set(inv.household_person_id, inv.id)
      }
    }
    const roleByUser = new Map<string, 'owner' | 'member'>()
    for (const m of members) {
      if (m.status === 'active') roleByUser.set(m.user_id, m.role)
    }
    return peopleRows.map((r) => {
      const base = fromRow(r)
      let accountStatus: HouseholdPerson['accountStatus'] = 'none'
      let role: HouseholdPerson['role'] = null
      if (r.user_id && roleByUser.has(r.user_id)) {
        accountStatus = 'connected'
        role = roleByUser.get(r.user_id) ?? 'member'
      } else if (pendingByPerson.has(r.id)) {
        accountStatus = 'invited'
      }
      return { ...base, accountStatus, role, pendingInvitationId: pendingByPerson.get(r.id) ?? null }
    })
  }, [familyId, localPeople, peopleRows, members, invitations])

  // Mirror to localStorage only when signed out (cloud is source of truth otherwise).
  useEffect(() => {
    if (!hydrated || familyId) return
    writeLocal(localPeople)
  }, [localPeople, hydrated, familyId])

  const savePerson: HouseholdCtx['savePerson'] = (p) => {
    const id = p.id ?? newId()
    // NOTE: userId is intentionally NOT written from the client — account linkage
    // happens only through invitation acceptance (server-enforced). New people are
    // account-less.
    if (familyId) {
      const exists = peopleRows.some((x) => x.id === id)
      const displayName = p.displayName.trim() || 'Someone'
      const relationship = p.relationship?.trim() || null
      const phone = p.phone?.trim() || null
      const email = p.email?.trim() || null
      // Optimistic local update of the raw rows.
      setPeopleRows((rows) =>
        exists
          ? rows.map((x) => (x.id === id ? { ...x, display_name: displayName, relationship, phone, email } : x))
          : [
              ...rows,
              {
                id, family_id: familyId, display_name: displayName, relationship,
                user_id: null, phone, email, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
              } as db.DbHouseholdPerson,
            ],
      )
      const row = { id, family_id: familyId, display_name: displayName, relationship, phone, email }
      const op = exists ? db.updateHouseholdPerson(id, row) : db.insertHouseholdPerson(row)
      op.catch((e) => console.warn('household sync', e))
      return
    }
    // Signed out: local-only people.
    const full: HouseholdPerson = {
      id,
      displayName: p.displayName.trim() || 'Someone',
      relationship: p.relationship?.trim() || undefined,
      userId: null,
      phone: p.phone?.trim() || undefined,
      email: p.email?.trim() || undefined,
    }
    setLocalPeople((list) => (list.some((x) => x.id === id) ? list.map((x) => (x.id === id ? full : x)) : [...list, full]))
  }

  const removePerson: HouseholdCtx['removePerson'] = (id) => {
    if (familyId) {
      setPeopleRows((rows) => rows.filter((x) => x.id !== id))
      db.deleteHouseholdPerson(id).catch((e) => console.warn('household sync', e))
    } else {
      setLocalPeople((list) => list.filter((x) => x.id !== id))
    }
  }

  // Step 7: invite an account-less person. Generates a high-entropy token, sends
  // only its hash to the server, and returns the shareable link (token in the URL).
  const invitePerson: HouseholdCtx['invitePerson'] = async (personId, email) => {
    if (!familyId) return { ok: false, error: 'not signed in' }
    try {
      const token = generateInviteToken()
      const tokenHash = await sha256Hex(token)
      await db.createHouseholdInvitationRpc(personId, tokenHash, email?.trim() || null)
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      await loadHousehold(familyId) // refresh invitation state → person shows "invited"
      return { ok: true, url: inviteUrl(origin, token) }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'invite failed' }
    }
  }

  const revokeInvite: HouseholdCtx['revokeInvite'] = async (invitationId) => {
    try {
      await db.revokeHouseholdInvitationRpc(invitationId)
      if (familyId) await loadHousehold(familyId)
    } catch (e) {
      console.warn('revoke invite', e)
    }
  }

  const clearHousehold = () => {
    setLocalPeople([])
    writeLocal([])
  }

  const me = useMemo(
    () => (user ? people.find((p) => p.userId === user.id) ?? null : null),
    [people, user],
  )

  const value = useMemo(
    () => ({ people, hydrated, me, savePerson, removePerson, clearHousehold, invitePerson, revokeInvite }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [people, hydrated, me, familyId],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
