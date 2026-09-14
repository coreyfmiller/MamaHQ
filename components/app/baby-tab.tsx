'use client'

import { useState } from 'react'
import type { AppState, LogEntry } from '@/lib/types'
import { clockTime, elapsed, isSameDay, timeAgo } from '@/lib/store'
import { Droplet, Milk, Moon, Baby as BabyIcon, Pencil } from 'lucide-react'
import { LogEditSheet } from '@/components/app/log-edit-sheet'
import type { Actions } from '@/components/app/mama-hq-app'

// Baby = logs + history. Per data-and-ai-standard: this screen DESCRIBES recorded data
// (counts, times, durations). It never interprets the baby or scores anything.
export function BabyTab({ state, actions }: { state: AppState; actions: Actions }) {
  const now = new Date()
  const [editing, setEditing] = useState<LogEntry | null>(null)
  const today = state.logs.filter((l) => isSameDay(l.createdAt, now))
  const counts = {
    feed: today.filter((l) => l.kind === 'feed').length,
    diaper: today.filter((l) => l.kind === 'diaper').length,
    sleep: today.filter((l) => l.kind === 'sleep').length,
    pump: today.filter((l) => l.kind === 'pump').length,
  }

  return (
    <div className="px-5 pt-10">
      <h1 className="font-serif text-2xl text-foreground">{state.baby.name}</h1>

      {/* Today's recorded counts — purely descriptive ("you logged"), never a judgment. */}
      <section className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          You logged today
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <Count label="Feeds" value={counts.feed} />
          <Count label="Diapers" value={counts.diaper} />
          <Count label="Sleeps" value={counts.sleep} />
          <Count label="Pumps" value={counts.pump} />
        </div>
      </section>

      <h2 className="mb-2 mt-6 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">
        History
      </h2>
      {state.logs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
          Nothing logged yet. Use the quick actions on Today to log a feed, sleep, diaper, or pump.
        </p>
      ) : (
        <ul className="space-y-2 pb-4">
          {state.logs.slice(0, 60).map((l) => (
            <LogRow key={l.id} entry={l} now={now} onEdit={() => setEditing(l)} />
          ))}
        </ul>
      )}

      {editing && (
        <LogEditSheet
          entry={editing}
          onClose={() => setEditing(null)}
          onSave={actions.patchLog}
          onDelete={actions.deleteLog}
        />
      )}
    </div>
  )
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-serif text-2xl text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}

function LogRow({ entry, now, onEdit }: { entry: LogEntry; now: Date; onEdit: () => void }) {
  const { icon, title } = describe(entry, now)
  return (
    <li>
      <button
        onClick={onEdit}
        className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left shadow-sm transition-colors hover:border-primary/40"
      >
        <span className="flex items-center gap-2.5 text-sm text-foreground">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {clockTime(entry.createdAt)} · {timeAgo(entry.createdAt, now)}
          <Pencil className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
        </span>
      </button>
    </li>
  )
}

function describe(e: LogEntry, now: Date): { icon: React.ReactNode; title: string } {
  switch (e.kind) {
    case 'feed':
      if (e.method === 'breast') {
        return { icon: <Milk className="h-4 w-4" />, title: `Nursed${e.side ? ` · ${e.side}` : ''}` }
      }
      return {
        icon: <Milk className="h-4 w-4" />,
        title: `Bottle${e.amountMl ? ` · ${e.amountMl} ml` : ''}${
          e.contents === 'formula' ? ' · formula' : e.contents === 'breast-milk' ? ' · breast milk' : ''
        }`,
      }
    case 'sleep':
      return {
        icon: <Moon className="h-4 w-4" />,
        title: e.endedAt
          ? `Slept · ${elapsed(e.createdAt, new Date(e.endedAt))}`
          : `Sleeping · ${elapsed(e.createdAt, now)}`,
      }
    case 'diaper':
      return { icon: <Droplet className="h-4 w-4" />, title: `Diaper · ${e.diaper}` }
    case 'pump':
      return {
        icon: <BabyIcon className="h-4 w-4" />,
        title: `Pumped${e.amountMl ? ` · ${e.amountMl} ml` : ''} · ${e.side}`,
      }
  }
}
