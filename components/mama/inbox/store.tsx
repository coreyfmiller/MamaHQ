'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CaptureSourceKind, ProposedItem } from './types'
import { localExtractor } from './local-extractor'
import { useAuth } from '../auth'
import * as db from '@/lib/supabase/data'

export type CaptureStatus = 'proposed' | 'committed' | 'dismissed'

export interface Capture {
  id: string
  source: CaptureSourceKind
  rawText: string
  createdAt: string
  status: CaptureStatus
  items: ProposedItem[]
}

const STORAGE_KEY = 'mamahq.proto.captures.v1'

// The active extractor. Swapping this for a Gemini-backed one later is the only
// change needed to move from rule-based to AI extraction.
const extractor = localExtractor

interface InboxCtx {
  captures: Capture[]
  hydrated: boolean
  /** Run extraction on raw text and enqueue a capture for review. Returns it. */
  addCapture: (rawText: string, source: CaptureSourceKind) => Promise<Capture>
  /** Toggle whether a proposed item will be committed. */
  toggleItem: (captureId: string, itemId: string) => void
  /** Edit fields on a proposed item (label + payload). */
  editItem: (captureId: string, itemId: string, patch: Partial<ProposedItem>) => void
  /** Mark a capture committed (after its items were written to real stores). */
  markCommitted: (captureId: string) => void
  dismissCapture: (captureId: string) => void
  clearInbox: () => void
}

const Ctx = createContext<InboxCtx>({
  captures: [],
  hydrated: false,
  addCapture: async () => ({ id: '', source: 'type', rawText: '', createdAt: '', status: 'proposed', items: [] }),
  toggleItem: () => {},
  editItem: () => {},
  markCommitted: () => {},
  dismissCapture: () => {},
  clearInbox: () => {},
})

export function useInbox() {
  return useContext(Ctx)
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

function readLocal(): Capture[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Capture[]) : []
  } catch {
    return []
  }
}
function writeLocal(captures: Capture[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(captures))
  } catch {
    // non-fatal
  }
}

export function InboxProvider({ children }: { children: ReactNode }) {
  const { familyId, status } = useAuth()
  const [captures, setCaptures] = useState<Capture[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let alive = true
    setHydrated(false)

    if (familyId) {
      db.fetchCaptures(familyId)
        .then((rows) => {
          if (!alive) return
          setCaptures(
            rows.map((r) => ({
              id: r.id,
              source: r.source,
              rawText: r.raw_text,
              createdAt: r.created_at,
              status: r.status,
              items: (r.items as ProposedItem[]) ?? [],
            })),
          )
          setHydrated(true)
        })
        .catch(() => {
          if (!alive) return
          setCaptures(readLocal())
          setHydrated(true)
        })
      return () => {
        alive = false
      }
    }

    if (status !== 'loading') {
      setCaptures(readLocal())
      setHydrated(true)
    }
    return () => {
      alive = false
    }
  }, [familyId, status])

  useEffect(() => {
    if (!hydrated || familyId) return
    writeLocal(captures)
  }, [captures, hydrated, familyId])

  // Persist a single capture's current state to the cloud (upsert-style via update
  // after insert). Used by the mutation helpers below.
  const syncCapture = (c: Capture) => {
    if (!familyId) return
    db.updateCapture(c.id, {
      status: c.status,
      items: c.items,
    }).catch((e) => console.warn('capture sync', e))
  }

  const addCapture: InboxCtx['addCapture'] = async (rawText, source) => {
    const items = await extractor.extract(rawText)
    const capture: Capture = {
      id: newId(),
      source,
      rawText,
      createdAt: new Date().toISOString(),
      status: 'proposed',
      items,
    }
    setCaptures((prev) => [capture, ...prev])
    if (familyId) {
      db.insertCapture({
        id: capture.id,
        family_id: familyId,
        source: capture.source,
        raw_text: capture.rawText,
        status: capture.status,
        items: capture.items,
        created_at: capture.createdAt,
      }).catch((e) => console.warn('capture sync', e))
    }
    return capture
  }

  const toggleItem: InboxCtx['toggleItem'] = (captureId, itemId) =>
    setCaptures((prev) => {
      const next = prev.map((c) =>
        c.id === captureId
          ? { ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, include: !i.include } : i)) }
          : c,
      )
      const changed = next.find((c) => c.id === captureId)
      if (changed) syncCapture(changed)
      return next
    })

  const editItem: InboxCtx['editItem'] = (captureId, itemId, patch) =>
    setCaptures((prev) => {
      const next = prev.map((c) =>
        c.id === captureId
          ? { ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }
          : c,
      )
      const changed = next.find((c) => c.id === captureId)
      if (changed) syncCapture(changed)
      return next
    })

  const markCommitted: InboxCtx['markCommitted'] = (captureId) =>
    setCaptures((prev) => {
      const next = prev.map((c) => (c.id === captureId ? { ...c, status: 'committed' as CaptureStatus } : c))
      const changed = next.find((c) => c.id === captureId)
      if (changed) syncCapture(changed)
      return next
    })

  const dismissCapture: InboxCtx['dismissCapture'] = (captureId) =>
    setCaptures((prev) => {
      const next = prev.map((c) => (c.id === captureId ? { ...c, status: 'dismissed' as CaptureStatus } : c))
      const changed = next.find((c) => c.id === captureId)
      if (changed) syncCapture(changed)
      return next
    })

  const clearInbox = () => {
    setCaptures([])
    writeLocal([])
  }

  const value = useMemo(
    () => ({
      captures,
      hydrated,
      addCapture,
      toggleItem,
      editItem,
      markCommitted,
      dismissCapture,
      clearInbox,
    }),
    [captures, hydrated, familyId],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
