'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronRight, ChevronLeft, Moon, Play } from 'lucide-react'
import type { Category } from '@/lib/mama-data'
import { useNav } from '../context'
import { useLogs, activeSleep, elapsed, toLocalInput, fromLocalInput, type LogKind } from '../logs'
import { CategoryChip } from '../event-meta'

const options: { kind: LogKind; category: Category; title: string; sub: string }[] = [
  { kind: 'feed', category: 'feed', title: 'Feed', sub: 'Bottle \u00b7 Nursing \u00b7 Other' },
  { kind: 'sleep', category: 'sleep', title: 'Sleep', sub: 'Start now or log a past sleep' },
  { kind: 'diaper', category: 'diaper', title: 'Diaper', sub: 'Wet \u00b7 Dirty \u00b7 Mixed' },
  { kind: 'pumping', category: 'pumping', title: 'Pumping', sub: 'Track your session' },
  { kind: 'medication', category: 'medication', title: 'Medication', sub: 'For baby' },
]

const feedAmounts = ['2 oz', '3 oz', '4 oz', '5 oz', '6 oz']
const diaperTypes: { value: 'wet' | 'dirty' | 'mixed'; label: string }[] = [
  { value: 'wet', label: 'Wet' },
  { value: 'dirty', label: 'Dirty' },
  { value: 'mixed', label: 'Mixed' },
]

type Detail = 'feed' | 'diaper' | 'sleep' | null

export function QuickLogContent() {
  const { closeOverlay, showToast, quickLogKind } = useNav()
  const { logs, addLog, startSleep } = useLogs()
  // PR2 — Capture can deep-link a specific baby log. feed/diaper/sleep jump straight
  // to their detail step; a non-detail kind (pumping) is logged in one tap on open.
  // This reuses the SAME logging system (useLogs) — not a second implementation.
  const initialDetail: Detail =
    quickLogKind === 'feed' || quickLogKind === 'diaper' || quickLogKind === 'sleep' ? quickLogKind : null
  const [detail, setDetail] = useState<Detail>(initialDetail)
  const directLogged = useRef(false)

  const running = activeSleep(logs)

  // A direct (no-detail) kind from Capture — e.g. Pump — logs immediately and closes.
  useEffect(() => {
    if (directLogged.current) return
    if (quickLogKind === 'pumping') {
      directLogged.current = true
      addLog({ kind: 'pumping' })
      closeOverlay()
      showToast('Pumping logged')
    }
    // Run once on mount for the Capture-provided intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const done = (title: string) => {
    closeOverlay()
    showToast(`${title} logged`)
  }

  const pick = (o: (typeof options)[number]) => {
    // Feed, diaper, and sleep get a quick second step; the rest log in one tap.
    if (o.kind === 'feed' || o.kind === 'diaper' || o.kind === 'sleep') {
      setDetail(o.kind)
      return
    }
    addLog({ kind: o.kind })
    done(o.title)
  }

  const logFeed = (amount?: string) => {
    addLog({ kind: 'feed', amount })
    done(amount ? `Feed (${amount})` : 'Feed')
  }

  const logDiaper = (diaperType: 'wet' | 'dirty' | 'mixed') => {
    addLog({ kind: 'diaper', diaperType })
    done(`Diaper (${diaperType})`)
  }

  const startNow = () => {
    startSleep()
    closeOverlay()
    showToast('Sleep started')
  }

  const logPastSleep = (startISO: string, endISO: string) => {
    addLog({ kind: 'sleep', createdAt: startISO, endedAt: endISO })
    done(`Sleep (${elapsed(startISO, endISO)})`)
  }

  /* ---------------- Detail steps ---------------- */
  if (detail) {
    return (
      <div>
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => setDetail(null)}
            aria-label="Back"
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h2 className="font-serif text-[20px] font-semibold capitalize">{detail}</h2>
        </div>

        {detail === 'feed' && (
          <div>
            <p className="mb-2 px-1 text-[13px] font-medium text-muted-foreground">How much?</p>
            <div className="grid grid-cols-3 gap-2.5">
              {feedAmounts.map((a) => (
                <button
                  key={a}
                  onClick={() => logFeed(a)}
                  className="rounded-2xl border border-border/70 bg-card py-4 text-[15px] font-semibold transition-transform active:scale-[0.97]"
                >
                  {a}
                </button>
              ))}
              <button
                onClick={() => logFeed()}
                className="rounded-2xl border border-border/70 bg-card py-4 text-[15px] font-medium text-muted-foreground transition-transform active:scale-[0.97]"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {detail === 'diaper' && (
          <div>
            <p className="mb-2 px-1 text-[13px] font-medium text-muted-foreground">What kind?</p>
            <div className="space-y-2.5">
              {diaperTypes.map((d) => (
                <button
                  key={d.value}
                  onClick={() => logDiaper(d.value)}
                  className="flex w-full items-center justify-between rounded-2xl border border-border/70 bg-card px-4 py-3.5 text-left transition-transform active:scale-[0.99]"
                >
                  <span className="text-[16px] font-semibold">{d.label}</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}

        {detail === 'sleep' && (
          <SleepDetail running={!!running} onStartNow={startNow} onLogPast={logPastSleep} />
        )}
      </div>
    )
  }

  /* ---------------- Category picker ---------------- */
  return (
    <div>
      <h2 className="px-1 font-serif text-[20px] font-semibold">What would you like to log?</h2>
      <div className="mt-4 space-y-2">
        {options.map((o) => (
          <button
            key={o.kind}
            onClick={() => pick(o)}
            className="flex w-full items-center gap-3.5 rounded-2xl border border-border/70 bg-card p-3.5 text-left transition-transform active:scale-[0.99]"
          >
            <CategoryChip category={o.category} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-semibold leading-tight">{o.title}</p>
              <p className="text-[13px] text-muted-foreground">
                {o.kind === 'sleep' && running
                  ? `Sleeping now \u00b7 ${elapsed(running.createdAt)}`
                  : o.sub}
              </p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
        ))}
      </div>
      <button
        onClick={closeOverlay}
        className="mt-4 w-full rounded-full bg-muted py-3.5 text-[15px] font-semibold text-foreground transition-transform active:scale-[0.99]"
      >
        Cancel
      </button>
    </div>
  )
}

/* ---------------- Sleep detail (start now vs. log a past sleep) ---------------- */

function SleepDetail({
  running,
  onStartNow,
  onLogPast,
}: {
  running: boolean
  onStartNow: () => void
  onLogPast: (startISO: string, endISO: string) => void
}) {
  const [mode, setMode] = useState<'choose' | 'past'>('choose')
  // Sensible defaults: ended now, started about an hour ago.
  const now = new Date()
  const hourAgo = new Date(now.getTime() - 60 * 60_000)
  const [start, setStart] = useState(toLocalInput(hourAgo.toISOString()))
  const [end, setEnd] = useState(toLocalInput(now.toISOString()))

  const startISO = fromLocalInput(start)
  const endISO = fromLocalInput(end)
  const valid = new Date(startISO).getTime() < new Date(endISO).getTime()

  if (mode === 'past') {
    return (
      <div className="space-y-4">
        <p className="px-1 text-[13px] text-muted-foreground">
          Rough times are fine — just your best guess.
        </p>
        <label className="block">
          <span className="mb-1.5 block px-1 text-[13px] font-medium text-muted-foreground">Fell asleep</span>
          <input
            type="datetime-local"
            value={start}
            max={end}
            onChange={(e) => setStart(e.target.value)}
            className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-[16px] text-foreground outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block px-1 text-[13px] font-medium text-muted-foreground">Woke up</span>
          <input
            type="datetime-local"
            value={end}
            min={start}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-[16px] text-foreground outline-none focus:border-primary"
          />
        </label>
        <p className="px-1 text-[13px] font-medium text-foreground">
          {valid ? `Duration · ${elapsed(startISO, endISO)}` : 'Woke-up time must be after fell-asleep time.'}
        </p>
        <button
          onClick={() => valid && onLogPast(startISO, endISO)}
          disabled={!valid}
          className="w-full rounded-full bg-primary py-4 text-[15px] font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-40"
        >
          Save sleep
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {running ? (
        <p className="rounded-2xl bg-muted/60 px-4 py-3 text-[14px] text-muted-foreground">
          A sleep is already running. Stop it from the Today screen.
        </p>
      ) : (
        <button
          onClick={onStartNow}
          className="flex w-full items-center gap-3.5 rounded-2xl border border-primary bg-primary/5 p-4 text-left transition-transform active:scale-[0.99]"
        >
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Play className="size-5" strokeWidth={2} />
          </span>
          <span>
            <span className="block text-[16px] font-semibold">Start now</span>
            <span className="block text-[13px] text-muted-foreground">
              Baby&apos;s going down — track it live
            </span>
          </span>
        </button>
      )}

      <button
        onClick={() => setMode('past')}
        className="flex w-full items-center gap-3.5 rounded-2xl border border-border/70 bg-card p-4 text-left transition-transform active:scale-[0.99]"
      >
        <span className="flex size-11 items-center justify-center rounded-2xl bg-blue-soft text-blue">
          <Moon className="size-5" strokeWidth={1.75} />
        </span>
        <span>
          <span className="block text-[16px] font-semibold">Log a past sleep</span>
          <span className="block text-[13px] text-muted-foreground">Already happened — enter the times</span>
        </span>
      </button>
    </div>
  )
}
