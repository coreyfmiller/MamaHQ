'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { useHousehold } from './household'
import * as db from '@/lib/supabase/data'

// Step 8 — Tasks / Ownership on the client.
//
// A Task is a durable household RESPONSIBILITY. Ownership points at a
// HouseholdPerson (who may have no account), and is distinct from who CREATED it
// and who COMPLETED it. This provider is the single owner of task data; screens
// read from it and call its actions. Mutations are ATOMIC server-side (task + its
// history event in one transaction via RPC); the client updates optimistically and
// re-syncs from the server for correctness.
//
// Requires an authenticated family (tasks are shared household state — there is no
// signed-out local task store; that would be a private per-device list, which is
// exactly the mental-load trap Tasks exists to avoid).

export interface Task {
  id: string
  title: string
  notes?: string
  status: 'open' | 'completed'
  /** OWNERSHIP → HouseholdPerson id (may be account-less). null = unassigned. */
  assignedToPersonId: string | null
  /** CREATOR → the auth user who captured it. */
  createdByUserId: string | null
  source: db.DbTask['source']
  dueAt: string | null
  completedAt: string | null
  /** COMPLETER → the auth user who completed it (≠ owner). */
  completedByUserId: string | null
  createdAt: string
}

export interface TaskEvent {
  id: string
  taskId: string
  type: db.DbTaskEvent['event_type']
  actorUserId: string | null
  prevPersonId: string | null
  newPersonId: string | null
  createdAt: string
}

interface CreateTaskInput {
  title: string
  assignedToPersonId?: string | null
  dueAt?: string | null
  notes?: string | null
}

interface TasksCtx {
  tasks: Task[]
  hydrated: boolean
  /** True only when signed in with a family (tasks are shared, not local). */
  available: boolean
  /** Open tasks (status = open). */
  open: Task[]
  /** Completed tasks. */
  completed: Task[]
  /** "Mine" = tasks owned by the HouseholdPerson linked to the current account.
   *  NOT tasks the current user created. */
  mine: Task[]
  create: (input: CreateTaskInput) => Promise<void>
  assign: (taskId: string, personId: string | null) => Promise<void>
  complete: (taskId: string) => Promise<void>
  reopen: (taskId: string) => Promise<void>
  remove: (taskId: string) => Promise<void>
  /** Load a task's history timeline (oldest → newest). */
  history: (taskId: string) => Promise<TaskEvent[]>
}

const Ctx = createContext<TasksCtx>({
  tasks: [],
  hydrated: false,
  available: false,
  open: [],
  completed: [],
  mine: [],
  create: async () => {},
  assign: async () => {},
  complete: async () => {},
  reopen: async () => {},
  remove: async () => {},
  history: async () => [],
})

export function useTasks() {
  return useContext(Ctx)
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

function fromRow(r: db.DbTask): Task {
  return {
    id: r.id,
    title: r.title,
    notes: r.notes ?? undefined,
    status: r.status,
    assignedToPersonId: r.assigned_to_person_id,
    createdByUserId: r.created_by_user_id,
    source: r.source,
    dueAt: r.due_at,
    completedAt: r.completed_at,
    completedByUserId: r.completed_by_user_id,
    createdAt: r.created_at,
  }
}

// Client-side ordering that mirrors the server's fetch order: open before
// completed, then by due date (undated last), then newest first.
function sortTasks(list: Task[]): Task[] {
  return [...list].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1
    if (a.dueAt && b.dueAt && a.dueAt !== b.dueAt) return a.dueAt < b.dueAt ? -1 : 1
    if (a.dueAt && !b.dueAt) return -1
    if (!a.dueAt && b.dueAt) return 1
    return a.createdAt < b.createdAt ? 1 : -1
  })
}

export function TasksProvider({ children }: { children: ReactNode }) {
  const { familyId, status } = useAuth()
  const { me } = useHousehold()
  const [tasks, setTasks] = useState<Task[]>([])
  const [hydrated, setHydrated] = useState(false)

  const reload = async (fid: string) => {
    const rows = await db.fetchTasks(fid)
    setTasks(sortTasks(rows.map(fromRow)))
  }

  useEffect(() => {
    let alive = true
    setHydrated(false)

    if (familyId) {
      reload(familyId)
        .catch((e) => console.warn('tasks sync', e))
        .finally(() => {
          if (alive) setHydrated(true)
        })
      return () => {
        alive = false
      }
    }

    // Signed out: no shared family → no tasks. Mark hydrated so the UI can render
    // an appropriate empty/sign-in state rather than a spinner.
    if (status !== 'loading') {
      setTasks([])
      setHydrated(true)
    }
    return () => {
      alive = false
    }
  }, [familyId, status])

  const create: TasksCtx['create'] = async (input) => {
    if (!familyId) return
    const title = input.title.trim()
    if (!title) return
    const id = newId()
    // Optimistic insert.
    const optimistic: Task = {
      id,
      title,
      notes: input.notes?.trim() || undefined,
      status: 'open',
      assignedToPersonId: input.assignedToPersonId ?? null,
      createdByUserId: null,
      source: 'manual',
      dueAt: input.dueAt ?? null,
      completedAt: null,
      completedByUserId: null,
      createdAt: new Date().toISOString(),
    }
    setTasks((list) => sortTasks([optimistic, ...list]))
    try {
      await db.createTaskRpc({
        familyId,
        title,
        assignedToPersonId: input.assignedToPersonId ?? null,
        dueAt: input.dueAt ?? null,
        notes: input.notes?.trim() || null,
        clientTaskId: id, // stable id → idempotent under retry
      })
      await reload(familyId) // reconcile with server truth (createdBy, ordering)
    } catch (e) {
      console.warn('tasks create', e)
      if (familyId) await reload(familyId).catch(() => {}) // drop the optimistic row on failure
    }
  }

  const assign: TasksCtx['assign'] = async (taskId, personId) => {
    setTasks((list) => list.map((t) => (t.id === taskId ? { ...t, assignedToPersonId: personId } : t)))
    try {
      await db.assignTaskRpc(taskId, personId)
    } catch (e) {
      console.warn('tasks assign', e)
    }
    if (familyId) await reload(familyId).catch(() => {})
  }

  const complete: TasksCtx['complete'] = async (taskId) => {
    const now = new Date().toISOString()
    setTasks((list) =>
      sortTasks(list.map((t) => (t.id === taskId ? { ...t, status: 'completed', completedAt: now } : t))),
    )
    try {
      await db.completeTaskRpc(taskId)
    } catch (e) {
      console.warn('tasks complete', e)
    }
    if (familyId) await reload(familyId).catch(() => {})
  }

  const reopen: TasksCtx['reopen'] = async (taskId) => {
    setTasks((list) =>
      sortTasks(
        list.map((t) =>
          t.id === taskId ? { ...t, status: 'open', completedAt: null, completedByUserId: null } : t,
        ),
      ),
    )
    try {
      await db.reopenTaskRpc(taskId)
    } catch (e) {
      console.warn('tasks reopen', e)
    }
    if (familyId) await reload(familyId).catch(() => {})
  }

  const remove: TasksCtx['remove'] = async (taskId) => {
    setTasks((list) => list.filter((t) => t.id !== taskId))
    try {
      await db.deleteTask(taskId)
    } catch (e) {
      console.warn('tasks remove', e)
    }
  }

  const history: TasksCtx['history'] = async (taskId) => {
    if (!familyId) return []
    try {
      const rows = await db.fetchTaskEvents(familyId, taskId)
      return rows.map((r) => ({
        id: r.id,
        taskId: r.task_id,
        type: r.event_type,
        actorUserId: r.actor_user_id,
        prevPersonId: r.prev_person_id,
        newPersonId: r.new_person_id,
        createdAt: r.created_at,
      }))
    } catch (e) {
      console.warn('tasks history', e)
      return []
    }
  }

  const open = useMemo(() => tasks.filter((t) => t.status === 'open'), [tasks])
  const completed = useMemo(() => tasks.filter((t) => t.status === 'completed'), [tasks])
  // "Mine" resolves through the current user's linked HouseholdPerson (ownership),
  // never through created_by. If the account isn't linked to a person, Mine is empty.
  const mine = useMemo(
    () => (me ? tasks.filter((t) => t.assignedToPersonId === me.id) : []),
    [tasks, me],
  )

  const value = useMemo<TasksCtx>(
    () => ({
      tasks,
      hydrated,
      available: Boolean(familyId),
      open,
      completed,
      mine,
      create,
      assign,
      complete,
      reopen,
      remove,
      history,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, hydrated, familyId, open, completed, mine],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
