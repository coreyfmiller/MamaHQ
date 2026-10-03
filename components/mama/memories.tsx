'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import * as db from '@/lib/supabase/data'

export interface Memory {
  id: string
  /** Downscaled JPEG data URL. */
  photo: string
  caption: string
  createdAt: string
}

const STORAGE_KEY = 'mamahq.proto.memories.v1'

interface MemoriesCtx {
  memories: Memory[]
  hydrated: boolean
  /** PR6 — the signed-in cloud read failed (never shown as an empty album). */
  loadError: boolean
  retry: () => void
  /** Resolves ok only once the memory actually persisted (signed in) — so the UI
   *  never says "Saved" for a write that failed. On failure the optimistic row is
   *  rolled back. */
  addMemory: (photo: string, caption: string) => Promise<{ ok: boolean }>
  removeMemory: (id: string) => void
  clearMemories: () => void
}

const Ctx = createContext<MemoriesCtx>({
  memories: [],
  hydrated: false,
  loadError: false,
  retry: () => {},
  addMemory: async () => ({ ok: false }),
  removeMemory: () => {},
  clearMemories: () => {},
})

export function useMemories() {
  return useContext(Ctx)
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

function readLocal(): Memory[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Memory[]) : []
  } catch {
    return []
  }
}
function writeLocal(memories: Memory[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memories))
  } catch (err) {
    console.warn('MamaHQ: could not persist memories to localStorage', err)
  }
}

export function MemoriesProvider({ children }: { children: ReactNode }) {
  const { familyId, status } = useAuth()
  const [memories, setMemories] = useState<Memory[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const loadCloud = async (fid: string) => {
    const rows = await db.fetchMemories(fid)
    setMemories(rows.map((r) => ({ id: r.id, photo: r.photo, caption: r.caption ?? '', createdAt: r.created_at })))
  }

  useEffect(() => {
    let alive = true
    setHydrated(false)
    setLoadError(false)

    if (familyId) {
      loadCloud(familyId)
        .then(() => {
          if (!alive) return
          setHydrated(true)
        })
        .catch(() => {
          if (!alive) return
          // PR6 — do NOT present this device's local copy as the household album
          // after a failed cloud read; say "couldn't load" truthfully instead.
          setMemories([])
          setLoadError(true)
          setHydrated(true)
        })
      return () => {
        alive = false
      }
    }

    if (status !== 'loading') {
      setMemories(readLocal())
      setHydrated(true)
    }
    return () => {
      alive = false
    }
  }, [familyId, status])

  useEffect(() => {
    if (!hydrated || familyId) return
    writeLocal(memories)
  }, [memories, hydrated, familyId])

  const retry = () => {
    if (!familyId) return
    loadCloud(familyId)
      .then(() => setLoadError(false))
      .catch(() => setLoadError(true))
  }

  const addMemory: MemoriesCtx['addMemory'] = async (photo, caption) => {
    const m: Memory = { id: newId(), photo, caption: caption.trim(), createdAt: new Date().toISOString() }
    setMemories((prev) => [m, ...prev])
    if (!familyId) return { ok: true }
    try {
      await db.insertMemory({
        id: m.id,
        family_id: familyId,
        photo: m.photo,
        caption: m.caption || null,
        created_at: m.createdAt,
      })
      return { ok: true }
    } catch (e) {
      console.warn('memory sync', e)
      setMemories((prev) => prev.filter((x) => x.id !== m.id))
      return { ok: false }
    }
  }

  const removeMemory = (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id))
    if (familyId) db.deleteMemory(id).catch((e) => console.warn('memory sync', e))
  }

  const clearMemories = () => {
    setMemories([])
    writeLocal([])
  }

  const value = useMemo(
    () => ({ memories, hydrated, loadError, retry, addMemory, removeMemory, clearMemories }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [memories, hydrated, loadError, familyId],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
