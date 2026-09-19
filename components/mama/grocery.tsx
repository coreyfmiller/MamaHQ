'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { useHousehold } from './household'
import * as db from '@/lib/supabase/data'
import type { ProposedGroceryItem } from '@/lib/grocery/resolver/types'
import { resolveGroceryAction } from '@/lib/grocery/actions/resolve-action'
import { planGroceryAction } from '@/lib/grocery/actions/execute-action'
import type { ActiveGroceryItem, ValidatedGroceryAction } from '@/lib/grocery/actions/types'

/** Outcome of applying a resolved proposal, so the UI can give feedback / confirm. */
export type ApplyOutcome =
  | { kind: 'added'; displayName: string }
  | { kind: 'incremented'; displayName: string; resultingQuantity: number }
  | { kind: 'separate'; displayName: string }
  | { kind: 'confirm'; action: ValidatedGroceryAction }

// Grocery — the operational foundation (Step 2). A shared, family-scoped list.
// display_name is the source of truth; nothing here depends on a catalog, search,
// or AI. Completing an item is a STATUS change that also writes a purchase_event
// snapshot so history is retained. No deletion-as-completion.
export type GroceryStatus = 'active' | 'completed'

export interface GroceryItem {
  id: string
  displayName: string
  /** The catalog concept this item was matched to (Step 4). null = custom item. */
  canonicalItemId?: string | null
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
  // Step 5B operational detail (for duplicate identity + faithful display).
  resolvedAttributes?: { attribute_id: string; value: string | boolean }[]
  packageSize?: { value: number; unit: string } | null
  packageType?: string | null
  unmatchedModifiers?: string[]
}

const STORAGE_KEY = 'mamahq.proto.grocery.v1'

interface GroceryCtx {
  items: GroceryItem[]
  hydrated: boolean
  active: GroceryItem[]
  completed: GroceryItem[]
  /** Add an item. Pass canonicalItemId when it came from a catalog selection. */
  addItem: (displayName: string, opts?: { quantity?: number; unit?: string; note?: string; canonicalItemId?: string | null }) => void
  /** Step 5B: run Action Resolution over a resolved proposal + the active list, then
   *  execute the validated action (add / increment / add-separate) or return a
   *  confirmation for the UI. This is the seam manual + future AI entry converge on. */
  addResolved: (proposal: ProposedGroceryItem) => ApplyOutcome
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
  addResolved: () => ({ kind: 'added', displayName: '' }),
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
    canonicalItemId: r.canonical_item_id,
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
    resolvedAttributes: r.resolved_attributes ?? [],
    packageSize: r.package_size ?? null,
    packageType: r.package_type ?? null,
    unmatchedModifiers: r.unmatched_modifiers ?? [],
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
    // Autocomplete selection carries a canonical id; typed custom items don't.
    const canonicalItemId = opts?.canonicalItemId ?? null
    const item: GroceryItem = {
      id: newId(),
      displayName: name,
      canonicalItemId,
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
        canonical_item_id: canonicalItemId,
        quantity: item.quantity,
        unit: item.unit ?? null,
        note: item.note ?? null,
        added_by_person_id: item.addedByPersonId ?? null,
        source_type: canonicalItemId ? 'autocomplete' : 'manual',
        status: 'active',
      }).catch((e) => console.warn('grocery sync', e))
    }
  }

  // Step 5B: resolve what to do with the LIST for a proposal, then execute it.
  const addResolved: GroceryCtx['addResolved'] = (proposal) => {
    const activeView: ActiveGroceryItem[] = items
      .filter((it) => it.status === 'active')
      .map((it) => ({
        id: it.id,
        status: 'active',
        canonicalItemId: it.canonicalItemId ?? null,
        displayName: it.displayName,
        quantity: it.quantity,
        attributes: it.resolvedAttributes ?? [],
        packageSize: it.packageSize ?? null,
        packageType: it.packageType ?? null,
        unmatchedModifiers: it.unmatchedModifiers ?? [],
      }))

    const action = resolveGroceryAction(proposal, activeView, { source: 'manual' })
    const plan = planGroceryAction(action, { source: 'manual' })

    if (plan.op === 'confirm') return { kind: 'confirm', action }

    if (plan.op === 'increment') {
      // Optimistic bump, then atomic RPC (idempotent via clientActionId).
      setItems((list) => list.map((it) => (it.id === plan.targetItemId ? { ...it, quantity: plan.resultingQuantity } : it)))
      const target = items.find((it) => it.id === plan.targetItemId)
      if (familyId) {
        db.incrementGroceryItemRpc(plan.targetItemId, plan.incrementBy, plan.clientActionId).catch((e) => {
          console.warn('grocery increment failed', e)
          void rehydrateItem(plan.targetItemId)
        })
      }
      return { kind: 'incremented', displayName: target?.displayName ?? proposal.displayName, resultingQuantity: plan.resultingQuantity }
    }

    if (plan.op === 'insert') {
      const d = plan.detail
      const item: GroceryItem = {
        id: newId(),
        displayName: d.displayName,
        canonicalItemId: d.canonicalItemId,
        quantity: d.quantity,
        unit: d.quantityUnit ?? undefined,
        addedByPersonId: me?.id ?? null,
        assignedToPersonId: null,
        status: 'active',
        createdAt: new Date().toISOString(),
        completedAt: null,
        resolvedAttributes: d.attributes.map((a) => ({ attribute_id: a.attribute_id, value: a.value })),
        packageSize: d.packageSize,
        packageType: d.packageType,
        unmatchedModifiers: d.unmatchedModifiers,
      }
      setItems((list) => [item, ...list])
      if (familyId) {
        db.insertGroceryItem({
          id: item.id,
          family_id: familyId,
          display_name: item.displayName,
          canonical_item_id: item.canonicalItemId ?? null,
          quantity: item.quantity,
          unit: item.unit ?? null,
          added_by_person_id: item.addedByPersonId ?? null,
          source_type: d.canonicalItemId ? 'autocomplete' : 'manual',
          status: 'active',
          resolved_attributes: item.resolvedAttributes,
          package_size: item.packageSize,
          package_type: item.packageType,
          unmatched_modifiers: item.unmatchedModifiers,
          client_action_id: d.clientActionId,
        }).catch((e) => console.warn('grocery sync', e))
      }
      return action.type === 'ADD_SEPARATE'
        ? { kind: 'separate', displayName: d.displayName }
        : { kind: 'added', displayName: d.displayName }
    }

    return { kind: 'added', displayName: proposal.displayName }
  }

  const editItem: GroceryCtx['editItem'] = (id, patch) => {
    // EDIT-CLEARS-CANONICAL rule: manually changing the display name breaks the
    // catalog identity (e.g. "Milk" → "Chocolate milk"), so we clear the canonical
    // reference. A fresh catalog selection re-sets it via addItem. (Resolver-based
    // reclassification is a later step.)
    const clearsCanonical = patch.displayName !== undefined
    setItems((list) =>
      list.map((it) => (it.id === id ? { ...it, ...patch, ...(clearsCanonical ? { canonicalItemId: null } : {}) } : it)),
    )
    if (familyId) {
      const dbPatch: Partial<db.DbGroceryItem> = {}
      if (patch.displayName !== undefined) {
        dbPatch.display_name = patch.displayName
        dbPatch.canonical_item_id = null
      }
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
    () => ({ items, hydrated, active, completed, addItem, addResolved, editItem, completeItem, restoreItem, removeItem, clearGrocery }),
    [items, hydrated, active, completed, familyId, me],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
