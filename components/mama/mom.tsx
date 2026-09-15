'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

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
  return `mom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/** Local calendar day key, e.g. "2026-09-14". */
export function dayKey(now: Date = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export function MomProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MomState>(empty)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) setState({ ...empty, ...(JSON.parse(raw) as MomState) })
    } catch {
      // ignore corrupt/blocked storage
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // non-fatal
    }
  }, [state, hydrated])

  const setTodayMood: MomCtx['setTodayMood'] = (mood) =>
    setState((s) => {
      const key = dayKey()
      const next = { ...s.moodByDay }
      if (mood === null) delete next[key]
      else next[key] = mood
      return { ...s, moodByDay: next }
    })

  const addTask: MomCtx['addTask'] = (text) => {
    const t = text.trim()
    if (!t) return
    setState((s) => ({
      ...s,
      tasks: [{ id: newId(), text: t, done: false, createdAt: new Date().toISOString() }, ...s.tasks],
    }))
  }

  const addQuestion: MomCtx['addQuestion'] = (text) => {
    const t = text.trim()
    if (!t) return
    setState((s) => ({
      ...s,
      questions: [{ id: newId(), text: t, done: false, createdAt: new Date().toISOString() }, ...s.questions],
    }))
  }

  const toggleTask: MomCtx['toggleTask'] = (id) =>
    setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }))

  const toggleQuestion: MomCtx['toggleQuestion'] = (id) =>
    setState((s) => ({
      ...s,
      questions: s.questions.map((q) => (q.id === id ? { ...q, done: !q.done } : q)),
    }))

  const removeTask: MomCtx['removeTask'] = (id) =>
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }))

  const removeQuestion: MomCtx['removeQuestion'] = (id) =>
    setState((s) => ({ ...s, questions: s.questions.filter((q) => q.id !== id) }))

  const clearMom = () => {
    setState(empty)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
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
    [state, hydrated],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
