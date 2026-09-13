'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AppState } from '@/lib/types'
import { loadState, saveState } from '@/lib/store'
import { BottomNav, type Tab } from '@/components/app/bottom-nav'
import { TodayTab } from '@/components/app/today-tab'
import { BabyTab } from '@/components/app/baby-tab'
import { InboxTab } from '@/components/app/inbox-tab'
import { StubTab } from '@/components/app/stub-tab'

export function MamaHqApp() {
  const [state, setState] = useState<AppState | null>(null)
  const [tab, setTab] = useState<Tab>('today')
  // tick every 30s so relative times ("1h 42m ago", active sleep timer) stay fresh
  const [, force] = useState(0)

  useEffect(() => setState(loadState()), [])
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  const update = useCallback((next: AppState) => {
    setState(next)
    saveState(next)
  }, [])

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
        {tab === 'today' && <TodayTab state={state} update={update} onGoInbox={() => setTab('inbox')} />}
        {tab === 'baby' && <BabyTab state={state} update={update} />}
        {tab === 'inbox' && <InboxTab state={state} update={update} />}
        {tab === 'plan' && <StubTab title="Plan" note="Tasks, appointments, and lists live here — coming next." />}
        {tab === 'memories' && <StubTab title="Memories" note="Photos and small moments you don’t want to lose — coming next." />}
      </main>
      <BottomNav tab={tab} onChange={setTab} />
    </div>
  )
}
