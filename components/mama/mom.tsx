'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import * as db from '@/lib/supabase/data'

export type Mood = 'tired' | 'okay' | 'good' | 'great'

export interface MomItem {
  id: string
  text: string
  done: boolean
  createdAt: string
}

/** Mom's own space: a per-day mood check-in plus her tasks and doctor questions. */
export interface MomState {
  /** Mood keyed by local calendar day (yyyy-mm-dd), so it resets daily. */
  moodByDay: Record<string, Mood>
  tasks: MomItem[]
  questions: MomItem[]
}

const STORAGE_KEY = 'mamahq.proto.mom.v1'
const empty: MomState = { moodByDay: {}, tasks: [], questions: [] }

interface MomCtx {
  state: MomState
  hydrated: boolean
  /** Set (or clear) today's mood. Passing the current mood again clears it. */
  setTodayMood: (mood: Mood | null) => void
  addTask: (text: string) => void
  addQuestion: (text: string) => void
  toggleTask: (id: string) => void
  toggleQuestion: (id: string) => void
  removeTask: (id: string) => void
  removeQuestion: (id: string) => void
  clearMom: () => void
}

const Ctx = createContext<MomCtx>({
  state: empty,
  hydrated: false,
  setTodayMood: () => {},
  addTask: () => {},
  addQuestion: () => {},
  toggleTask: () => {},
  toggleQuestion: () => {},
  removeTask: () => {},
  removeQuestion: () => {},
  clearMom: () => {},
})

export function useMom() {
  return useContext(Ctx)
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

/** Local calendar day key, e.g. "2026-09-14". */
export function dayKey(now: Date = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function readLocal(): MomState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? { ...empty, ...(JSON.parse(raw) as MomState) } : empty
  } catch {
    return empty
  }
}
function writeLocal(state: MomState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // non-fatal
  }
}

export function MomProvider({ children }: { children: ReactNode }) {
  const { familyId, status } = useAuth()
  const [state, setState] = useState<MomState>(empty)
  const [hydrated, setHydrated] = useState(false)

  // Load from cloud (moods + items) or local, when auth resolves.
  useEffect(() => {
    let alive = true
    setHydrated(false)

    if (familyId) {
      Promise.all([db.fetchMomMoods(familyId), db.fetchMomItems(familyId)])
        .then(([moods, items]) => {
          if (!alive) return
          setState({
            moodByDay: moods as Record<string, Mood>,
            tasks: items.filter((i) => i.kind === 'task').map((i) => ({ id: i.id, text: i.text, done: i.done, createdAt: i.created_at })),
            questions: items.filter((i) => i.kind === 'question').map((i) => ({ id: i.id, text: i.text, done: i.done, createdAt: i.created_at })),
          })
          setHydrated(true)
        })
        .catch(() => {
          if (!alive) return
          setState(readLocal())
          setHydrated(true)
        })
      return () => {
        alive = false
      }
    }

    if (status !== 'loading') {
      setState(readLocal())
      setHydrated(true)
    }
    return () => {
      alive = false
    }
  }, [familyId, status])

  useEffect(() => {
    if (!hydrated || familyId) return
    writeLocal(state)
  }, [state, hydrated, familyId])

  const setTodayMood: MomCtx['setTodayMood'] = (mood) => {
    const key = dayKey()
    setState((s) => {
      const next = { ...s.moodByDay }
      if (mood === null) delete next[key]
      else next[key] = mood
      return { ...s, moodByDay: next }
    })
    if (familyId) {
      if (mood === null) db.deleteMomMood(familyId, key).catch((e) => console.warn('mom sync', e))
      else db.upsertMomMood(familyId, key, mood).catch((e) => console.warn('mom sync', e))
    }
  }

  const addItem = (kind: 'task' | 'question', text: string) => {
    const t = text.trim()
    if (!t) return
    const item: MomItem = { id: newId(), text: t, done: false, createdAt: new Date().toISOString() }
    setState((s) => ({
      ...s,
      [kind === 'task' ? 'tasks' : 'questions']: [item, ...s[kind === 'task' ? 'tasks' : 'questions']],
    }))
    if (familyId) {
      db.insertMomItem({ id: item.id, family_id: familyId, kind, text: t, done: false, created_at: item.createdAt })
        .catch((e) => console.warn('mom sync', e))
    }
  }

  const addTask: MomCtx['addTask'] = (text) => addItem('task', text)
  const addQuestion: MomCtx['addQuestion'] = (text) => addItem('question', text)

  const toggleItem = (kind: 'tasks' | 'questions', id: string) => {
    let nextDone = false
    setState((s) => ({
      ...s,
      [kind]: s[kind].map((i) => {
        if (i.id !== id) return i
        nextDone = !i.done
        return { ...i, done: nextDone }
      }),
    }))
    if (familyId) db.updateMomItem(id, { done: nextDone }).catch((e) => console.warn('mom sync', e))
  }

  const toggleTask: MomCtx['toggleTask'] = (id) => toggleItem('tasks', id)
  const toggleQuestion: MomCtx['toggleQuestion'] = (id) => toggleItem('questions', id)

  const removeItem = (kind: 'tasks' | 'questions', id: string) => {
    setState((s) => ({ ...s, [kind]: s[kind].filter((i) => i.id !== id) }))
    if (familyId) db.deleteMomItem(id).catch((e) => console.warn('mom sync', e))
  }

  const removeTask: MomCtx['removeTask'] = (id) => removeItem('tasks', id)
  const removeQuestion: MomCtx['removeQuestion'] = (id) => removeItem('questions', id)

  const clearMom = () => {
    setState(empty)
    writeLocal(empty)
  }

  const value = useMemo(
    () => ({
      state,
      hydrated,
      setTodayMood,
      addTask,
      addQuestion,
      toggleTask,
      toggleQuestion,
      removeTask,
      removeQuestion,
      clearMom,
    }),
    [state, hydrated, familyId],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
