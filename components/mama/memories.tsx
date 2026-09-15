'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

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
  return `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function MemoriesProvider({ children }: { children: ReactNode }) {
  const [memories, setMemories] = useState<Memory[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) setMemories(JSON.parse(raw) as Memory[])
    } catch {
      // ignore corrupt/blocked storage
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memories))
    } catch (err) {
      // Photos are the most likely thing to blow the ~5MB quota. Surface it.
      console.warn('MamaHQ: could not persist memories to localStorage', err)
    }
  }, [memories, hydrated])

  const addMemory: MemoriesCtx['addMemory'] = (photo, caption) => {
    setMemories((prev) => [
      { id: newId(), photo, caption: caption.trim(), createdAt: new Date().toISOString() },
      ...prev,
    ])
  }

  const removeMemory = (id: string) => setMemories((prev) => prev.filter((m) => m.id !== id))

  const clearMemories = () => {
    setMemories([])
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  const value = useMemo(
    () => ({ memories, hydrated, addMemory, removeMemory, clearMemories }),
    [memories, hydrated],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
