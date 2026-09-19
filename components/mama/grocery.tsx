'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { useHousehold } from './household'
import * as db from '@/lib/supabase/data'

// Grocery — the operational foundation (Step 2). A shared, family-scoped list.
// display_name is the source of truth; nothing here depends on a catalog, search,
// or AI. Completing an item is a STATUS change that also writes a purchase_event
// snapshot so history is retained. No deletion-as-completion.
export type GroceryStatus = 'active' | 'completed'

export interface GroceryItem {
  id: string
  displayName: string
  quantity: number
  unit?: string
  note?: string
  category?: string
  store?: string
  addedByPersonId?: string | null
  assignedToPersonId?: string | null
  status: GroceryStatus
  createdAt: string
  completedAt?: string | null
}

const STORAGE_KEY = 'mamahq.proto.grocery.v1'

interface GroceryCtx {
  items: GroceryItem[]
  hydrated: boolean
  active: GroceryItem[]
  completed: GroceryItem[]
  addItem: (displayName: string, opts?: { quantity?: number; unit?: string; note?: string }) => void
  editItem: (id: string, patch: Partial<Pick<GroceryItem, 'displayName' | 'quantity' | 'unit' | 'note' | 'category' | 'store' | 'assignedToPersonId'>>) => void
  /** Mark bought: sets status=completed, stamps completed_at, writes a purchase_event. */
  completeItem: (id: string) => void
  /** Undo a completion: back to active. */
  restoreItem: (id: string) => void
  /** Hard remove (rare; completion is the normal path). */
  removeItem: (id: string) => void
  clearGrocery: () => void
}

const Ctx = createContext<GroceryCtx>({
  items: [],
  hydrated: false,
  active: [],
  completed: [],
  addItem: () => {},
  editItem: () => {},
  completeItem: () => {},
  restoreItem: () => {},
  removeItem: () => {},
  clearGrocery: () => {},
})

export function useGrocery() {
  return useContext(Ctx)
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

function fromRow(r: db.DbGroceryItem): GroceryItem {
  return {
    id: r.id,
    displayName: r.display_name,
    quantity: Number(r.quantity) || 1,
    unit: r.unit ?? undefined,
    note: r.note ?? undefined,
    category: r.category ?? undefined,
    store: r.store ?? undefined,
    addedByPersonId: r.added_by_person_id,
    assignedToPersonId: r.assigned_to_person_id,
    status: r.status,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  }
}

function readLocal(): GroceryItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as GroceryItem[]) : []
  } catch {
    return []
  }
}
function writeLocal(items: GroceryItem[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // non-fatal
  }
}

export function GroceryProvider({ children }: { children: ReactNode }) {
  const { familyId, status } = useAuth()
  const { me } = useHousehold()
  const [items, setItems] = useState<GroceryItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let alive = true
    setHydrated(false)

    if (familyId) {
      db.fetchGroceryItems(familyId)
        .then((rows) => {
          if (!alive) return
          setItems(rows.map(fromRow))
          setHydrated(true)
        })
        .catch(() => {
          if (!alive) return
          setItems(readLocal())
          setHydrated(true)
        })
      return () => {
        alive = false
      }
    }

    if (status !== 'loading') {
      setItems(readLocal())
      setHydrated(true)
    }
    return () => {
      alive = false
    }
  }, [familyId, status])

  // Mirror to localStorage only when signed out (cloud is source of truth otherwise).
  useEffect(() => {
    if (!hydrated || familyId) return
    writeLocal(items)
  }, [items, hydrated, familyId])

  const addItem: GroceryCtx['addItem'] = (displayName, opts) => {
    const name = displayName.trim()
    if (!name) return
    const item: GroceryItem = {
      id: newId(),
      displayName: name,
      quantity: opts?.quantity && opts.quantity > 0 ? opts.quantity : 1,
      unit: opts?.unit?.trim() || undefined,
      note: opts?.note?.trim() || undefined,
      addedByPersonId: me?.id ?? null,
      assignedToPersonId: null,
      status: 'active',
      createdAt: new Date().toISOString(),
      completedAt: null,
    }
    setItems((list) => [item, ...list])
    if (familyId) {
      db.insertGroceryItem({
        id: item.id,
        family_id: familyId,
        display_name: item.displayName,
        quantity: item.quantity,
        unit: item.unit ?? null,
        note: item.note ?? null,
        added_by_person_id: item.addedByPersonId ?? null,
        source_type: 'manual',
        status: 'active',
      }).catch((e) => console.warn('grocery sync', e))
    }
  }

  const editItem: GroceryCtx['editItem'] = (id, patch) => {
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)))
    if (familyId) {
      const dbPatch: Partial<db.DbGroceryItem> = {}
      if (patch.displayName !== undefined) dbPatch.display_name = patch.displayName
      if (patch.quantity !== undefined) dbPatch.quantity = patch.quantity
      if (patch.unit !== undefined) dbPatch.unit = patch.unit || null
      if (patch.note !== undefined) dbPatch.note = patch.note || null
      if (patch.category !== undefined) dbPatch.category = patch.category || null
      if (patch.store !== undefined) dbPatch.store = patch.store || null
      if (patch.assignedToPersonId !== undefined) dbPatch.assigned_to_person_id = patch.assignedToPersonId
      db.updateGroceryItem(id, dbPatch).catch((e) => console.warn('grocery sync', e))
    }
  }

  // Re-read one item from the cloud and reconcile local state, so a failed atomic
  // op never leaves the UI showing a false success (or a false failure).
  const rehydrateItem = async (id: string) => {
    if (!familyId) return
    try {
      const row = await db.fetchGroceryItem(id)
      setItems((list) => {
        if (!row) return list.filter((it) => it.id !== id)
        return list.map((it) => (it.id === id ? fromRow(row) : it))
      })
    } catch (e) {
      console.warn('grocery rehydrate', e)
    }
  }

  // Completion is a SINGLE atomic server operation (mark completed + write the
  // purchase snapshot, commit-both-or-neither, idempotent). We update optimistically
  // for snappy UI, then reconcile from the cloud if the transaction fails.
  const completeItem: GroceryCtx['completeItem'] = (id) => {
    const item = items.find((it) => it.id === id)
    if (!item || item.status === 'completed') return
    const completedAt = new Date().toISOString()
    setItems((list) => list.map((it) => (it.id === id ? { ...it, status: 'completed', completedAt } : it)))
    if (familyId) {
      db.completeGroceryItemRpc(id).catch((e) => {
        console.warn('grocery complete failed', e)
        // The atomic op did not commit — undo the optimistic change from truth.
        void rehydrateItem(id)
      })
    }
  }

  const restoreItem: GroceryCtx['restoreItem'] = (id) => {
    const item = items.find((it) => it.id === id)
    if (!item || item.status !== 'completed') return
    setItems((list) => list.map((it) => (it.id === id ? { ...it, status: 'active', completedAt: null } : it)))
    if (familyId) {
      db.restoreGroceryItemRpc(id).catch((e) => {
        console.warn('grocery restore failed', e)
        void rehydrateItem(id)
      })
    }
  }

  const removeItem: GroceryCtx['removeItem'] = (id) => {
    setItems((list) => list.filter((it) => it.id !== id))
    if (familyId) db.deleteGroceryItem(id).catch((e) => console.warn('grocery sync', e))
  }

  const clearGrocery = () => {
    setItems([])
    writeLocal([])
  }

  const active = useMemo(() => items.filter((i) => i.status === 'active'), [items])
  const completed = useMemo(() => items.filter((i) => i.status === 'completed'), [items])

  const value = useMemo(
    () => ({ items, hydrated, active, completed, addItem, editItem, completeItem, restoreItem, removeItem, clearGrocery }),
    [items, hydrated, active, completed, familyId, me],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
