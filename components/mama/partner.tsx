'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import * as db from '@/lib/supabase/data'

// "Dad" (or any helper) as a notify-only contact — no login required. Tier 1 of
// the partner feature: mom saves their name + phone/email + which channels to use;
// later, hand-offs and reminders get sent to them via SMS/email.
export interface Partner {
  id: string
  name: string
  phone?: string
  email?: string
  notifySms: boolean
  notifyEmail: boolean
}

const STORAGE_KEY = 'mamahq.proto.partner.v1'

interface PartnerCtx {
  partner: Partner | null
  hydrated: boolean
  savePartner: (p: Omit<Partner, 'id'> & { id?: string }) => void
  removePartner: () => void
  clearPartner: () => void
}

const Ctx = createContext<PartnerCtx>({
  partner: null,
  hydrated: false,
  savePartner: () => {},
  removePartner: () => {},
  clearPartner: () => {},
})

export function usePartner() {
  return useContext(Ctx)
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

function readLocal(): Partner | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Partner) : null
  } catch {
    return null
  }
}
function writeLocal(p: Partner | null) {
  try {
    if (p) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // non-fatal
  }
}

export function PartnerProvider({ children }: { children: ReactNode }) {
  const { familyId, status } = useAuth()
  const [partner, setPartner] = useState<Partner | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let alive = true
    setHydrated(false)

    if (familyId) {
      db.fetchPartnerContact(familyId)
        .then((row) => {
          if (!alive) return
          setPartner(
            row
              ? {
                  id: row.id,
                  name: row.name,
                  phone: row.phone ?? undefined,
                  email: row.email ?? undefined,
                  notifySms: row.notify_sms,
                  notifyEmail: row.notify_email,
                }
              : null,
          )
          setHydrated(true)
        })
        .catch(() => {
          if (!alive) return
          setPartner(readLocal())
          setHydrated(true)
        })
      return () => {
        alive = false
      }
    }

    if (status !== 'loading') {
      setPartner(readLocal())
      setHydrated(true)
    }
    return () => {
      alive = false
    }
  }, [familyId, status])

  useEffect(() => {
    if (!hydrated || familyId) return
    writeLocal(partner)
  }, [partner, hydrated, familyId])

  const savePartner: PartnerCtx['savePartner'] = (p) => {
    const full: Partner = {
      id: p.id ?? partner?.id ?? newId(),
      name: p.name.trim() || 'Partner',
      phone: p.phone?.trim() || undefined,
      email: p.email?.trim() || undefined,
      notifySms: p.notifySms,
      notifyEmail: p.notifyEmail,
    }
    setPartner(full)
    if (familyId) {
      db.upsertPartnerContact({
        id: full.id,
        family_id: familyId,
        name: full.name,
        phone: full.phone ?? null,
        email: full.email ?? null,
        notify_sms: full.notifySms,
        notify_email: full.notifyEmail,
      }).catch((e) => console.warn('partner sync', e))
    }
  }

  const removePartner = () => {
    const id = partner?.id
    setPartner(null)
    writeLocal(null)
    if (familyId && id) db.deletePartnerContact(id).catch((e) => console.warn('partner sync', e))
  }

  const clearPartner = () => {
    setPartner(null)
    writeLocal(null)
  }

  const value = useMemo(
    () => ({ partner, hydrated, savePartner, removePartner, clearPartner }),
    [partner, hydrated, familyId],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
