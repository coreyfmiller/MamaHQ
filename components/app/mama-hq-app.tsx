'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AppState, InboxCapture, LogEntry, Memory, PlanItem } from '@/lib/types'
import { BottomNav, type Tab } from '@/components/app/bottom-nav'
import { TodayTab } from '@/components/app/today-tab'
import { BabyTab } from '@/components/app/baby-tab'
import { InboxTab } from '@/components/app/inbox-tab'
import { PlanTab } from '@/components/app/plan-tab'
import { MemoriesTab } from '@/components/app/memories-tab'
import { PartnerPreview } from '@/components/app/partner-preview'
import { Day90Preview } from '@/components/app/day90-preview'
import { Onboarding } from '@/components/app/onboarding'
import type { Baby } from '@/lib/types'
import { SignIn } from '@/components/app/sign-in'
import { supabaseBrowser } from '@/lib/supabase-browser'

// Actions the tabs can perform. The app owns state + persistence; tabs stay declarative.
export type Actions = {
  addLog: (entry: LogEntry) => void
  endSleep: (id: string) => void
  endFeed: (id: string) => void
  updateFeedSide: (id: string, side: 'left' | 'right' | 'both') => void
  // Edit a log (time correction/amount/diaper/note) or delete it (undo a mislog).
  patchLog: (id: string, local: Partial<LogEntry>, patch: Record<string, unknown>) => void
  deleteLog: (id: string) => void
  commitCapture: (items: PlanItem[], capture: InboxCapture) => void
  // Toggle/patch a plan item (check off a task/shopping item, mark a question answered).
  // `patch` uses the DB column names the API expects (e.g. { done: true }, { answered: true }).
  updatePlanItem: (id: string, local: Partial<PlanItem>, patch: Record<string, unknown>) => void
  // Manual plan management (Step 9): add / edit fields / delete.
  addPlanItem: (item: PlanItem) => void
  editPlanItem: (id: string, local: Partial<PlanItem>, patch: Record<string, unknown>) => void
  deletePlanItem: (id: string) => void
  addMemory: (memory: Memory) => void
  deleteMemory: (id: string) => void
  toggleCheckin: (item: 'water' | 'eat' | 'rest', done: boolean) => void
}

type AuthStatus = 'checking' | 'signed-out' | 'signed-in'

export function MamaHqApp() {
  const [state, setState] = useState<AppState | null>(null)
  const [tab, setTab] = useState<Tab>('today')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [auth, setAuth] = useState<AuthStatus>('checking')
  const [overlay, setOverlay] = useState<'partner' | 'day90' | null>(null)
  const [, force] = useState(0)

  // Watch the auth session. Signed-out shows the sign-in screen; signed-in loads state.
  useEffect(() => {
    const supabase = supabaseBrowser()
    supabase.auth.getSession().then(({ data }) => {
      setAuth(data.session ? 'signed-in' : 'signed-out')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuth(session ? 'signed-in' : 'signed-out')
      if (!session) setState(null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Load the family state once signed in.
  useEffect(() => {
    if (auth !== 'signed-in') return
    let alive = true
    fetch('/api/state')
      .then(async (r) => {
        const d = await r.json()
        if (r.status === 401) {
          setAuth('signed-out')
          return null
        }
        if (!r.ok) throw new Error(d.error || 'Could not load.')
        return d as AppState
      })
      .then((s) => alive && s && setState(s))
      .catch((e) => alive && setLoadError(e instanceof Error ? e.message : 'Could not load.'))
    return () => {
      alive = false
    }
  }, [auth])

  const signOut = useCallback(async () => {
    await supabaseBrowser().auth.signOut()
    setState(null)
    setAuth('signed-out')
    // Return to the public landing after signing out.
    window.location.href = '/'
  }, [])

  // keep relative times fresh
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  const babyId = state?.baby.id

  const addLog = useCallback(
    (entry: LogEntry) => {
      if (!babyId) return
      setState((s) => (s ? { ...s, logs: [entry, ...s.logs] } : s)) // optimistic
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ babyId, entry }),
      }).catch(() => {})
    },
    [babyId],
  )

  const endSleep = useCallback(
    (id: string) => {
      const endedAt = new Date().toISOString()
      setState((s) =>
        s ? { ...s, logs: s.logs.map((l) => (l.id === id ? ({ ...l, endedAt } as LogEntry) : l)) } : s,
      )
      fetch('/api/log', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, patch: { endedAt } }),
      }).catch(() => {})
    },
    [],
  )

  // End a running breastfeeding session (Flow A). Same shape as endSleep.
  const endFeed = useCallback((id: string) => {
    const endedAt = new Date().toISOString()
    setState((s) =>
      s ? { ...s, logs: s.logs.map((l) => (l.id === id ? ({ ...l, endedAt } as LogEntry) : l)) } : s,
    )
    fetch('/api/log', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, patch: { endedAt } }),
    }).catch(() => {})
  }, [])

  // Switch the active feeding side (Flow A).
  const updateFeedSide = useCallback((id: string, side: 'left' | 'right' | 'both') => {
    setState((s) =>
      s ? { ...s, logs: s.logs.map((l) => (l.id === id ? ({ ...l, side } as LogEntry) : l)) } : s,
    )
    fetch('/api/log', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, patch: { side } }),
    }).catch(() => {})
  }, [])

  // Edit a log (time correction, amount, diaper kind, note). Optimistic local + PATCH.
  const patchLog = useCallback((id: string, local: Partial<LogEntry>, patch: Record<string, unknown>) => {
    setState((s) =>
      s ? { ...s, logs: s.logs.map((l) => (l.id === id ? ({ ...l, ...local } as LogEntry) : l)) } : s,
    )
    fetch('/api/log', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, patch }),
    }).catch(() => {})
  }, [])

  // Delete a log (undo a mislog). Optimistic removal + DELETE.
  const deleteLog = useCallback((id: string) => {
    setState((s) => (s ? { ...s, logs: s.logs.filter((l) => l.id !== id) } : s))
    fetch('/api/log', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }, [])

  const commitCapture = useCallback(
    (items: PlanItem[], capture: InboxCapture) => {
      if (!babyId) return
      setState((s) => (s ? { ...s, plan: [...items, ...s.plan], captures: [capture, ...s.captures] } : s))
      fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ babyId, items, capture }),
      }).catch(() => {})
    },
    [babyId],
  )

  const updatePlanItem = useCallback(
    (id: string, local: Partial<PlanItem>, patch: Record<string, unknown>) => {
      setState((s) =>
        s
          ? { ...s, plan: s.plan.map((p) => (p.id === id ? ({ ...p, ...local } as PlanItem) : p)) }
          : s,
      )
      fetch('/api/plan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, patch }),
      }).catch(() => {})
    },
    [],
  )

  // Manually add a plan item (Step 9). Optimistic + PUT.
  const addPlanItem = useCallback(
    (item: PlanItem) => {
      if (!babyId) return
      setState((s) => (s ? { ...s, plan: [item, ...s.plan] } : s))
      fetch('/api/plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ babyId, item }),
      }).catch(() => {})
    },
    [babyId],
  )

  // Edit a plan item's fields (title/whenText/assignee/etc.). Optimistic + PATCH edit.
  const editPlanItem = useCallback((id: string, local: Partial<PlanItem>, patch: Record<string, unknown>) => {
    setState((s) =>
      s ? { ...s, plan: s.plan.map((p) => (p.id === id ? ({ ...p, ...local } as PlanItem) : p)) } : s,
    )
    fetch('/api/plan', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, patch, edit: true }),
    }).catch(() => {})
  }, [])

  const deletePlanItem = useCallback((id: string) => {
    setState((s) => (s ? { ...s, plan: s.plan.filter((p) => p.id !== id) } : s))
    fetch('/api/plan', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }, [])

  const addMemory = useCallback(
    (memory: Memory) => {
      if (!babyId) return
      setState((s) => (s ? { ...s, memories: [memory, ...s.memories] } : s))
      fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ babyId, memory }),
      }).catch(() => {})
    },
    [babyId],
  )

  const deleteMemory = useCallback((id: string) => {
    setState((s) => (s ? { ...s, memories: s.memories.filter((m) => m.id !== id) } : s))
    fetch('/api/memory', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }, [])

  // Mom self-care check-in (Today "For you"). Optimistic + POST.
  const toggleCheckin = useCallback(
    (item: 'water' | 'eat' | 'rest', done: boolean) => {
      if (!babyId) return
      setState((s) => (s ? { ...s, momCheckin: { ...s.momCheckin, [item]: done } } : s))
      fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ babyId, item, done }),
      }).catch(() => {})
    },
    [babyId],
  )

  const actions: Actions = {
    addLog,
    endSleep,
    endFeed,
    updateFeedSide,
    patchLog,
    deleteLog,
    commitCapture,
    updatePlanItem,
    addPlanItem,
    editPlanItem,
    deletePlanItem,
    addMemory,
    deleteMemory,
    toggleCheckin,
  }

  if (auth === 'checking') {
    return (
      <div className="grid min-h-dvh place-items-center bg-background text-muted-foreground">
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  if (auth === 'signed-out') {
    return <SignIn />
  }

  if (loadError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background px-8 text-center">
        <div>
          <p className="font-serif text-xl text-foreground">Couldn’t load your data</p>
          <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
          <button onClick={signOut} className="mt-6 text-sm text-primary underline underline-offset-4">
            Sign out
          </button>
        </div>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background text-muted-foreground">
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  // First run: short guided setup before the app (Step 6). Once onboarded, updates state in place.
  if (!state.baby.onboarded) {
    return (
      <Onboarding
        onDone={(baby: Baby) => setState((s) => (s ? { ...s, baby } : s))}
      />
    )
  }

  return (
    // On phones the app is full-bleed. On larger screens we center a phone-width
    // column with a soft frame so it reads as an intentional app, not stranded content.
    <div className="flex min-h-dvh justify-center bg-muted/30 sm:py-6">
      <div className="relative flex min-h-dvh w-full max-w-md flex-col bg-background sm:min-h-0 sm:h-[calc(100dvh-3rem)] sm:overflow-hidden sm:rounded-[2rem] sm:border sm:border-border sm:shadow-[0_30px_60px_-30px_rgba(80,55,40,0.35)]">
        <main className="flex-1 overflow-y-auto pb-24">
          {tab === 'today' && (
            <TodayTab
              state={state}
              actions={actions}
              onGoInbox={() => setTab('inbox')}
              onSignOut={signOut}
              onOpenPartner={() => setOverlay('partner')}
              onOpenDay90={() => setOverlay('day90')}
            />
          )}
          {tab === 'baby' && <BabyTab state={state} actions={actions} />}
          {tab === 'inbox' && <InboxTab actions={actions} />}
          {tab === 'plan' && <PlanTab state={state} actions={actions} />}
          {tab === 'memories' && <MemoriesTab state={state} actions={actions} />}
        </main>
        <BottomNav tab={tab} onChange={setTab} />
      </div>

      {overlay === 'partner' && <PartnerPreview onClose={() => setOverlay(null)} />}
      {overlay === 'day90' && <Day90Preview state={state} onClose={() => setOverlay(null)} />}
    </div>
  )
}
