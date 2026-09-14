'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AppState, InboxCapture, LogEntry, PlanItem } from '@/lib/types'
import { BottomNav, type Tab } from '@/components/app/bottom-nav'
import { TodayTab } from '@/components/app/today-tab'
import { BabyTab } from '@/components/app/baby-tab'
import { InboxTab } from '@/components/app/inbox-tab'
import { StubTab } from '@/components/app/stub-tab'
import { SignIn } from '@/components/app/sign-in'
import { supabaseBrowser } from '@/lib/supabase-browser'

// Actions the tabs can perform. The app owns state + persistence; tabs stay declarative.
export type Actions = {
  addLog: (entry: LogEntry) => void
  endSleep: (id: string) => void
  commitCapture: (items: PlanItem[], capture: InboxCapture) => void
}

type AuthStatus = 'checking' | 'signed-out' | 'signed-in'

export function MamaHqApp() {
  const [state, setState] = useState<AppState | null>(null)
  const [tab, setTab] = useState<Tab>('today')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [auth, setAuth] = useState<AuthStatus>('checking')
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

  const actions: Actions = { addLog, endSleep, commitCapture }

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

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background">
      <main className="flex-1 pb-24">
        {tab === 'today' && (
          <TodayTab state={state} actions={actions} onGoInbox={() => setTab('inbox')} onSignOut={signOut} />
        )}
        {tab === 'baby' && <BabyTab state={state} />}
        {tab === 'inbox' && <InboxTab actions={actions} />}
        {tab === 'plan' && <StubTab title="Plan" note="Tasks, appointments, and lists live here — coming next." />}
        {tab === 'memories' && (
          <StubTab title="Memories" note="Photos and small moments you don’t want to lose — coming next." />
        )}
      </main>
      <BottomNav tab={tab} onChange={setTab} />
    </div>
  )
}
