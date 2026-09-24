'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import * as db from '@/lib/supabase/data'
import { usePartner } from './partner'
import { notifier, handoffMessage } from '@/lib/notify'

export type Mood = 'tired' | 'okay' | 'good' | 'great'

/** Who a task is handed off to. undefined = mom's own task. */
export type Assignee = 'partner'

export interface MomItem {
  id: string
  text: string
  done: boolean
  createdAt: string
  /** Set when the task was handed off to a helper (e.g. the partner). */
  assignee?: Assignee
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
  /** True when the last signed-in cloud READ failed (mood + items). Distinct from
   *  write failures. Lets Me show a truthful "couldn't load" instead of a false
   *  "empty" for Mom's mood/to-dos/questions. Mirrors Grocery/Logs/Tasks/Calendar/
   *  Care. Only meaningful when signed in; signed-out local mode never sets it. */
  loadError: boolean
  /** Set (or clear) today's mood. Passing the current mood again clears it. */
  setTodayMood: (mood: Mood | null) => void
  addTask: (text: string) => void
  /** Add a task handed off to a helper; fires the notifier (SMS/email) best-effort. */
  addTaskAssigned: (text: string, assignee: Assignee) => void
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
  loadError: false,
  setTodayMood: () => {},
  addTask: () => {},
  addTaskAssigned: () => {},
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
  const { partner } = usePartner()
  const [state, setState] = useState<MomState>(empty)
  const [hydrated, setHydrated] = useState(false)
  const [loadError, setLoadError] = useState(false)

  // Load from cloud (moods + items) or local, when auth resolves.
  useEffect(() => {
    let alive = true
    setHydrated(false)
    setLoadError(false)

    if (familyId) {
      Promise.all([db.fetchMomMoods(familyId), db.fetchMomItems(familyId)])
        .then(([moods, items]) => {
          if (!alive) return
          setState({
            moodByDay: moods as Record<string, Mood>,
            tasks: items.filter((i) => i.kind === 'task').map((i) => ({ id: i.id, text: i.text, done: i.done, createdAt: i.created_at, assignee: i.assignee ?? undefined })),
            questions: items.filter((i) => i.kind === 'question').map((i) => ({ id: i.id, text: i.text, done: i.done, createdAt: i.created_at })),
          })
          setLoadError(false)
          setHydrated(true)
        })
        .catch(() => {
          if (!alive) return
          // Signed-in cloud read failed. Do NOT present the signed-out localStorage
          // state as authoritative cloud truth (that would let a failure look like a
          // real/empty Mom space). Surface loadError so Me can say "couldn't load"
          // honestly rather than a reassuring empty state.
          setLoadError(true)
          setHydrated(true)
        })
      return () => {
        alive = false
      }
    }

    if (status !== 'loading') {
      // Signed out: local is the legitimate source of truth, not a failure.
      setState(readLocal())
      setLoadError(false)
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

  const addItem = (kind: 'task' | 'question', text: string, assignee?: Assignee) => {
    const t = text.trim()
    if (!t) return
    const item: MomItem = { id: newId(), text: t, done: false, createdAt: new Date().toISOString(), assignee }
    setState((s) => ({
      ...s,
      [kind === 'task' ? 'tasks' : 'questions']: [item, ...s[kind === 'task' ? 'tasks' : 'questions']],
    }))
    if (familyId) {
      db.insertMomItem({
        id: item.id,
        family_id: familyId,
        kind,
        text: t,
        done: false,
        created_at: item.createdAt,
        assignee: assignee ?? null,
      }).catch((e) => console.warn('mom sync', e))
    }
  }

  const addTask: MomCtx['addTask'] = (text) => addItem('task', text)
  const addQuestion: MomCtx['addQuestion'] = (text) => addItem('question', text)

  // Hand a task off to a helper: record it (assigned) and best-effort notify them.
  // Delivery is a no-op until Twilio/Resend are wired; the notifier reports that
  // gently and the UI already surfaces "delivery isn't on yet".
  const addTaskAssigned: MomCtx['addTaskAssigned'] = (text, assignee) => {
    const t = text.trim()
    if (!t) return
    addItem('task', t, assignee)

    if (assignee === 'partner' && partner) {
      const body = handoffMessage('Your partner', t)
      if (partner.notifySms && partner.phone) {
        notifier.sendSms(partner.phone, body).catch(() => {})
      }
      if (partner.notifyEmail && partner.email) {
        notifier.sendEmail(partner.email, 'A hand-off from MamaHQ', body).catch(() => {})
      }
    }
  }

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
      loadError,
      setTodayMood,
      addTask,
      addTaskAssigned,
      addQuestion,
      toggleTask,
      toggleQuestion,
      removeTask,
      removeQuestion,
      clearMom,
    }),
    [state, hydrated, loadError, familyId, partner],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
