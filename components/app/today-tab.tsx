'use client'

import { useState } from 'react'
import type { AppState } from '@/lib/types'
import {
  activeSleep,
  addLog,
  clockTime,
  dayNumber,
  elapsed,
  greeting,
  isSameDay,
  lastOfKind,
  newId,
  timeAgo,
  updateLog,
} from '@/lib/store'
import { Droplet, Milk, Moon, Baby as BabyIcon } from 'lucide-react'
import { LogSheet } from '@/components/app/log-sheet'

type SheetKind = 'feed' | 'diaper' | 'pump' | null

export function TodayTab({
  state,
  update,
  onGoInbox,
}: {
  state: AppState
  update: (s: AppState) => void
  onGoInbox: () => void
}) {
  const [sheet, setSheet] = useState<SheetKind>(null)
  const now = new Date()

  const lastFeed = lastOfKind(state.logs, 'feed')
  const lastDiaper = lastOfKind(state.logs, 'diaper')
  const sleeping = activeSleep(state.logs)

  // Sleep is a direct toggle from Today (start/stop) — no sheet needed, keeps it 1 tap.
  function toggleSleep() {
    if (sleeping) {
      update(updateLog(state, sleeping.id, { endedAt: new Date().toISOString() }))
    } else {
      update(
        addLog(state, { id: newId(), kind: 'sleep', createdAt: new Date().toISOString(), endedAt: null }),
      )
    }
  }

  const openQuestions = state.plan.filter((p) => p.kind === 'question' && !p.answered)
  const todaysAppointments = state.plan.filter(
    (p) => p.kind === 'appointment' && (p.whenText || isSameDay(p.createdAt, now)),
  )
  const openTasks = state.plan.filter((p) => p.kind === 'task' && !p.done)

  return (
    <div className="px-5 pt-10">
      <header>
        <h1 className="font-serif text-2xl leading-tight text-foreground">
          {greeting(now)}, {state.baby.name === 'Emma' ? 'Emma' : state.baby.name}.
        </h1>
        <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Day {dayNumber(state.baby.birthDate, now)}
        </p>
      </header>

      {/* BABY — the recent status cards */}
      <section className="mt-6">
        <h2 className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">
          Baby
        </h2>
        <div className="grid grid-cols-3 gap-2.5">
          <StatusCard
            icon={<Milk className="h-4 w-4" />}
            label="Last feed"
            value={lastFeed ? timeAgo(lastFeed.createdAt, now) : '—'}
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

      {/* QUICK ACTIONS */}
      <section className="mt-5">
        <div className="grid grid-cols-4 gap-2.5">
          <QuickAction label="Feed" icon={<Milk className="h-6 w-6" />} onClick={() => setSheet('feed')} />
          <QuickAction
            label={sleeping ? 'End sleep' : 'Sleep'}
            icon={<Moon className="h-6 w-6" />}
            onClick={toggleSleep}
            active={!!sleeping}
          />
          <QuickAction label="Diaper" icon={<Droplet className="h-6 w-6" />} onClick={() => setSheet('diaper')} />
          <QuickAction label="Pump" icon={<BabyIcon className="h-6 w-6" />} onClick={() => setSheet('pump')} />
        </div>
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

      {/* DON'T FORGET */}
      {(openTasks.length > 0 || openQuestions.length > 0) && (
        <Section title="Don't forget">
          <ul className="space-y-2 text-sm text-foreground">
            {openTasks.map((t) =>
              t.kind === 'task' ? (
                <li key={t.id} className="flex items-start gap-2">
                  <Circle />
                  <span>
                    {t.title}
                    {t.assignee ? <span className="text-muted-foreground"> · {t.assignee}</span> : null}
                  </span>
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

      {/* FOR YOU — gentle, supportive, never evaluative */}
      <section className="mb-4 mt-6 rounded-2xl bg-accent/50 p-4">
        <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-accent-foreground">
          For you
        </h2>
        <ul className="mt-2 space-y-2 text-sm text-foreground">
          <li className="flex items-start gap-2"><Circle /> Drink some water</li>
          <li className="flex items-start gap-2"><Circle /> Eat something</li>
          <li className="flex items-start gap-2"><Circle /> Take ten minutes for yourself</li>
        </ul>
      </section>

      {sheet && (
        <LogSheet
          kind={sheet}
          babyName={state.baby.name}
          onClose={() => setSheet(null)}
          onLog={(entry) => {
            update(addLog(state, entry))
            setSheet(null)
          }}
        />
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
