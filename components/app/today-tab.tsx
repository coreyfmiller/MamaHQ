'use client'

import { useEffect, useState } from 'react'
import type { AppState, LogEntry, Side } from '@/lib/types'
import {
  activeFeed,
  activeSleep,
  clockTime,
  dayNumber,
  elapsed,
  greeting,
  isSameDay,
  lastBottle,
  lastOfKind,
  newId,
  timeAgo,
} from '@/lib/store'
import { Droplet, Milk, Moon, Baby as BabyIcon, RotateCcw, MoreHorizontal } from 'lucide-react'
import { LogSheet } from '@/components/app/log-sheet'
import { CheckToggle } from '@/components/app/ui'
import type { Actions } from '@/components/app/mama-hq-app'

type SheetKind = 'feed' | 'diaper' | 'pump' | null

export function TodayTab({
  state,
  actions,
  onGoInbox,
  onSignOut,
  onOpenPartner,
  onOpenDay90,
  onOpenMemories,
}: {
  state: AppState
  actions: Actions
  onGoInbox: () => void
  onSignOut: () => void
  onOpenPartner: () => void
  onOpenDay90: () => void
  onOpenMemories: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [sheet, setSheet] = useState<SheetKind>(null)
  // Last just-logged entry, for a brief Undo (Step 7).
  const [undoable, setUndoable] = useState<{ id: string; label: string } | null>(null)
  const now = new Date()

  // Auto-dismiss the Undo toast after a few seconds.
  useEffect(() => {
    if (!undoable) return
    const t = setTimeout(() => setUndoable(null), 6000)
    return () => clearTimeout(t)
  }, [undoable])

  function logWithUndo(entry: LogEntry, label: string) {
    actions.addLog(entry)
    setUndoable({ id: entry.id, label })
  }

  const lastFeed = lastOfKind(state.logs, 'feed')
  const lastDiaper = lastOfKind(state.logs, 'diaper')
  const sleeping = activeSleep(state.logs)
  const feeding = activeFeed(state.logs)
  const repeatable = lastBottle(state.logs)

  // Sleep is a direct toggle from Today (start/stop) — no sheet needed, keeps it 1 tap.
  function toggleSleep() {
    if (sleeping) {
      actions.endSleep(sleeping.id)
    } else {
      actions.addLog({ id: newId(), kind: 'sleep', createdAt: new Date().toISOString(), endedAt: null })
    }
  }

  // Flow A: breast feeding is a running session (start → switch side → stop), like sleep.
  // Elapsed is derived from timestamps so it survives reload.
  function startBreastFeed(side: Side) {
    actions.addLog({
      id: newId(),
      kind: 'feed',
      createdAt: new Date().toISOString(),
      method: 'breast',
      side,
      endedAt: null,
    })
    setSheet(null)
  }
  function toggleFeed() {
    if (feeding) actions.endFeed(feeding.id)
    else setSheet('feed')
  }
  function switchSide() {
    if (!feeding) return
    const next: Side = feeding.side === 'left' ? 'right' : 'left'
    actions.updateFeedSide(feeding.id, next)
  }

  // Flow B: one-tap repeat of the last bottle (no typing).
  function repeatBottle() {
    if (!repeatable) return
    logWithUndo(
      {
        id: newId(),
        kind: 'feed',
        createdAt: new Date().toISOString(),
        method: 'bottle',
        contents: repeatable.contents,
        amountMl: repeatable.amountMl,
      },
      `Bottle logged${repeatable.amountMl ? ` · ${repeatable.amountMl} ml` : ''}`,
    )
  }

  const day = dayNumber(state.baby.birthDate, now)
  const nearNinety = day >= 80

  // Today shows BABY-scoped plan items (Mom's own live in the Me tab). Calm and prioritized:
  // each section only renders when it has something worth surfacing.
  const babyPlan = state.plan.filter((p) => p.scope !== 'mom')
  const openQuestions = babyPlan.filter((p) => p.kind === 'question' && !p.answered)
  const todaysAppointments = babyPlan.filter(
    (p) => p.kind === 'appointment' && (p.whenText || isSameDay(p.createdAt, now)),
  )
  const openTasks = babyPlan.filter((p) => p.kind === 'task' && !p.done)
  // Tasks handed to someone else — the partner-handoff glance.
  const handedOff = openTasks.filter((t) => t.kind === 'task' && t.assignee)
  const myTasks = openTasks.filter((t) => t.kind === 'task' && !t.assignee)
  // An Inbox capture left in 'proposed' (not yet committed) — nudge to finish it.
  const unresolvedCaptures = state.captures.filter((c) => c.status === 'proposed').length

  return (
    <div className="px-5 pt-10">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl leading-tight text-foreground">
            {greeting(now)}, {state.baby.name}.
          </h1>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Day {day}
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="More"
            aria-expanded={menuOpen}
            className="mt-1 rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {menuOpen && (
            <>
              <button
                aria-hidden
                tabIndex={-1}
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
                <MenuItem
                  label="Memories"
                  onClick={() => {
                    setMenuOpen(false)
                    onOpenMemories()
                  }}
                />
                <MenuItem
                  label="Partner"
                  onClick={() => {
                    setMenuOpen(false)
                    onOpenPartner()
                  }}
                />
                <MenuItem
                  label="Your First 90 Days"
                  onClick={() => {
                    setMenuOpen(false)
                    onOpenDay90()
                  }}
                />
                <div className="border-t border-border" />
                <MenuItem
                  label="Sign out"
                  onClick={() => {
                    setMenuOpen(false)
                    onSignOut()
                  }}
                />
              </div>
            </>
          )}
        </div>
      </header>

      {/* BABY — the recent status cards */}
      <section className="mt-6">
        <h2 className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">
          Baby
        </h2>
        <div className="grid grid-cols-3 gap-2.5">
          <StatusCard
            icon={<Milk className="h-4 w-4" />}
            label={feeding ? `Feeding · ${feeding.side ?? ''}`.trim() : 'Last feed'}
            value={feeding ? elapsed(feeding.createdAt, now) : lastFeed ? timeAgo(lastFeed.createdAt, now) : '—'}
            highlight={!!feeding}
          />
          <StatusCard
            icon={<Droplet className="h-4 w-4" />}
            label="Last diaper"
            value={lastDiaper ? timeAgo(lastDiaper.createdAt, now) : '—'}
          />
          <StatusCard
            icon={<Moon className="h-4 w-4" />}
            label={sleeping ? 'Sleeping' : 'Last sleep'}
            value={
              sleeping
                ? elapsed(sleeping.createdAt, now)
                : (() => {
                    const s = lastOfKind(state.logs, 'sleep')
                    return s?.endedAt ? timeAgo(s.endedAt, now) : '—'
                  })()
            }
            highlight={!!sleeping}
          />
        </div>
      </section>

      {/* Near Day 90: gently offer the keepsake. Not intrusive; disappears otherwise. */}
      {nearNinety && (
        <button
          onClick={onOpenDay90}
          className="mt-5 flex w-full items-center justify-between rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-left transition-transform active:scale-95"
        >
          <span>
            <span className="block font-serif text-base text-foreground">
              {day >= 90 ? 'Your First 90 Days' : `Day ${day} — your keepsake is filling up`}
            </span>
            <span className="block text-xs text-muted-foreground">
              The moments you’ve saved, gathered together.
            </span>
          </span>
          <span className="text-primary">→</span>
        </button>
      )}

      {/* QUICK ACTIONS */}
      <section className="mt-5">
        <div className="grid grid-cols-4 gap-2.5">
          <QuickAction
            label={feeding ? 'End feed' : 'Feed'}
            icon={<Milk className="h-6 w-6" />}
            onClick={toggleFeed}
            active={!!feeding}
          />
          <QuickAction
            label={sleeping ? 'End sleep' : 'Sleep'}
            icon={<Moon className="h-6 w-6" />}
            onClick={toggleSleep}
            active={!!sleeping}
          />
          <QuickAction label="Diaper" icon={<Droplet className="h-6 w-6" />} onClick={() => setSheet('diaper')} />
          <QuickAction label="Pump" icon={<BabyIcon className="h-6 w-6" />} onClick={() => setSheet('pump')} />
        </div>

        {/* While feeding: one-tap switch side. Otherwise: one-tap repeat last bottle (Flow B). */}
        {feeding ? (
          <button
            onClick={switchSide}
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl border border-secondary bg-secondary/40 py-2.5 text-sm font-medium text-secondary-foreground transition-transform active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
            Switch side{feeding.side ? ` (now ${feeding.side})` : ''}
          </button>
        ) : repeatable ? (
          <button
            onClick={repeatBottle}
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-2.5 text-sm font-medium text-foreground transition-transform active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
            Repeat last bottle{repeatable.amountMl ? ` · ${repeatable.amountMl} ml` : ''}
          </button>
        ) : null}
      </section>

      {/* TODAY items */}
      {todaysAppointments.length > 0 && (
        <Section title="Today">
          <ul className="space-y-2 text-sm">
            {todaysAppointments.map((a) =>
              a.kind === 'appointment' ? (
                <li key={a.id} className="flex gap-2 text-foreground">
                  <span className="tabular-nums text-muted-foreground">{a.whenText ?? clockTime(a.createdAt)}</span>
                  {a.title}
                </li>
              ) : null,
            )}
          </ul>
        </Section>
      )}

      {/* Unfinished Inbox capture — gently nudge Mom to finish reviewing it. */}
      {unresolvedCaptures > 0 && (
        <button
          onClick={onGoInbox}
          className="mt-5 flex w-full items-center justify-between rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-left transition-transform active:scale-95"
        >
          <span className="text-sm text-foreground">
            You have {unresolvedCaptures} capture{unresolvedCaptures === 1 ? '' : 's'} to review
          </span>
          <span className="text-primary">→</span>
        </button>
      )}

      {/* DON'T FORGET — tap a task to check it off right here. */}
      {(myTasks.length > 0 || openQuestions.length > 0) && (
        <Section title="Don't forget">
          <ul className="space-y-1.5">
            {myTasks.map((t) =>
              t.kind === 'task' ? (
                <li key={t.id} className="flex items-start gap-2.5">
                  <CheckToggle
                    checked={false}
                    onToggle={() => actions.updatePlanItem(t.id, { done: true }, { done: true })}
                    label={`Mark done: ${t.title}`}
                  />
                  <span className="text-sm text-foreground">{t.title}</span>
                </li>
              ) : null,
            )}
          </ul>
          {openQuestions.length > 0 && (
            <button
              onClick={onGoInbox}
              className="mt-2 text-sm text-primary underline decoration-primary/30 underline-offset-4"
            >
              {openQuestions.length} question{openQuestions.length === 1 ? '' : 's'} saved to ask
            </button>
          )}
        </Section>
      )}

      {/* PARTNER HANDOFF — what someone else is taking off Mom's plate. */}
      {handedOff.length > 0 && (
        <Section title="Handed off">
          <ul className="space-y-1.5 text-sm text-foreground">
            {handedOff.map((t) =>
              t.kind === 'task' ? (
                <li key={t.id} className="flex items-center gap-2">
                  <Circle />
                  <span>
                    {t.title}
                    <span className="text-muted-foreground"> · {t.assignee}</span>
                  </span>
                </li>
              ) : null,
            )}
          </ul>
        </Section>
      )}

      {/* Mom's gentle check-in now lives in the Me tab. A soft nudge to it stays here. */}
      <section className="mb-4 mt-6 rounded-2xl bg-accent/50 p-4">
        <p className="text-sm text-foreground">
          There’s a mom in there too.{' '}
          <span className="text-muted-foreground">Your own check-in and things live in the Me tab.</span>
        </p>
      </section>

      {sheet && (
        <LogSheet
          kind={sheet}
          babyName={state.baby.name}
          lastBottle={repeatable}
          onStartBreastFeed={startBreastFeed}
          onClose={() => setSheet(null)}
          onLog={(entry) => {
            logWithUndo(entry, logLabel(entry))
            setSheet(null)
          }}
        />
      )}

      {/* Undo toast — brief window to remove a just-logged entry (Step 7). */}
      {undoable && (
        <div className="fixed inset-x-0 bottom-24 z-30 mx-auto flex max-w-md items-center justify-between gap-3 px-5">
          <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-xl">
            <span className="text-sm text-foreground">{undoable.label}</span>
            <button
              onClick={() => {
                actions.deleteLog(undoable.id)
                setUndoable(null)
              }}
              className="shrink-0 text-sm font-semibold text-primary"
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusCard({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-3 shadow-sm ${
        highlight ? 'border-secondary bg-secondary/40' : 'border-border bg-card'
      }`}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">{icon}</div>
      <p className="mt-2 font-serif text-lg leading-none text-foreground">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}

function QuickAction({
  label,
  icon,
  onClick,
  active = false,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-2xl border py-3.5 shadow-sm transition-transform active:scale-95 ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-foreground'
      }`}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">{title}</h2>
      {children}
    </section>
  )
}

function Circle() {
  return <span className="mt-1 size-4 shrink-0 rounded-full border-[1.5px] border-muted-foreground/50" />
}



function logLabel(e: LogEntry): string {
  switch (e.kind) {
    case 'feed':
      return e.method === 'breast'
        ? 'Feed logged'
        : `Bottle logged${e.amountMl ? ` · ${e.amountMl} ml` : ''}`
    case 'diaper':
      return `Diaper logged · ${e.diaper}`
    case 'pump':
      return `Pump logged${e.amountMl ? ` · ${e.amountMl} ml` : ''}`
    case 'sleep':
      return 'Sleep logged'
  }
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="block w-full px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-muted"
    >
      {label}
    </button>
  )
}
