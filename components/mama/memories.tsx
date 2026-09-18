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
  addMemory: (photo: string, caption: string) => void
  removeMemory: (id: string) => void
  clearMemories: () => void
}

const Ctx = createContext<MemoriesCtx>({
  memories: [],
  hydrated: false,
  addMemory: () => {},
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

  useEffect(() => {
    let alive = true
    setHydrated(false)

    if (familyId) {
      db.fetchMemories(familyId)
        .then((rows) => {
          if (!alive) return
          setMemories(rows.map((r) => ({ id: r.id, photo: r.photo, caption: r.caption ?? '', createdAt: r.created_at })))
          setHydrated(true)
        })
        .catch(() => {
          if (!alive) return
          setMemories(readLocal())
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

  const addMemory: MemoriesCtx['addMemory'] = (photo, caption) => {
    const m: Memory = { id: newId(), photo, caption: caption.trim(), createdAt: new Date().toISOString() }
    setMemories((prev) => [m, ...prev])
    if (familyId) {
      db.insertMemory({
        id: m.id,
        family_id: familyId,
        photo: m.photo,
        caption: m.caption || null,
        created_at: m.createdAt,
      }).catch((e) => console.warn('memory sync', e))
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
    () => ({ memories, hydrated, addMemory, removeMemory, clearMemories }),
    [memories, hydrated, familyId],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
