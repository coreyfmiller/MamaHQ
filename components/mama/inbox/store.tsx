'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CaptureSourceKind, ProposedItem } from './types'
import { localExtractor } from './local-extractor'

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
  return `cap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function InboxProvider({ children }: { children: ReactNode }) {
  const [captures, setCaptures] = useState<Capture[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) setCaptures(JSON.parse(raw) as Capture[])
    } catch {
      // ignore corrupt/blocked storage
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(captures))
    } catch {
      // non-fatal
    }
  }, [captures, hydrated])

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
    return capture
  }

  const toggleItem: InboxCtx['toggleItem'] = (captureId, itemId) =>
    setCaptures((prev) =>
      prev.map((c) =>
        c.id === captureId
          ? { ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, include: !i.include } : i)) }
          : c,
      ),
    )

  const editItem: InboxCtx['editItem'] = (captureId, itemId, patch) =>
    setCaptures((prev) =>
      prev.map((c) =>
        c.id === captureId
          ? { ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }
          : c,
      ),
    )

  const markCommitted: InboxCtx['markCommitted'] = (captureId) =>
    setCaptures((prev) => prev.map((c) => (c.id === captureId ? { ...c, status: 'committed' } : c)))

  const dismissCapture: InboxCtx['dismissCapture'] = (captureId) =>
    setCaptures((prev) => prev.map((c) => (c.id === captureId ? { ...c, status: 'dismissed' } : c)))

  const clearInbox = () => {
    setCaptures([])
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
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
    [captures, hydrated],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
