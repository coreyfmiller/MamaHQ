'use client'

import { useState } from 'react'
import { useLogs, elapsed, toLocalInput, fromLocalInput } from './logs'
import { useProfile } from './profile'
import { Card } from './ui'

// The ONE active-sleep control (PR6: extracted from Today so Baby can reuse it — not a
// second sleep system). Ends the running sleep through the existing logs provider
// (`endSleep`), either now or at a chosen wake time. Shared by Today's Baby glance and
// Baby → Right now.

/** A sleep running this long is probably a forgotten "End sleep" — offer "Fix time". */
export const RUNAWAY_HOURS = 10

export function SleepControl({ sleepId, startISO, now }: { sleepId: string; startISO: string; now: Date }) {
  const { endSleep } = useLogs()
  const { profile } = useProfile()
  const [confirming, setConfirming] = useState(false)
  const [wake, setWake] = useState(() => toLocalInput(new Date().toISOString()))

  const hours = (now.getTime() - new Date(startISO).getTime()) / 3_600_000
  const runaway = hours >= RUNAWAY_HOURS
  const babyName = profile?.babyName ?? 'Baby'

  if (confirming) {
    const wakeISO = fromLocalInput(wake)
    const valid = new Date(wakeISO).getTime() > new Date(startISO).getTime()
    return (
      <Card className="mt-2 space-y-3 border-primary/30 bg-primary/5">
        <label htmlFor={`wake-${sleepId}`} className="block text-[15px] font-semibold">
          When did {babyName} wake up?
        </label>
        <input
          id={`wake-${sleepId}`}
          type="datetime-local"
          value={wake}
          min={toLocalInput(startISO)}
          onChange={(e) => setWake(e.target.value)}
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-[16px] text-foreground outline-none focus:border-primary"
        />
        <p className="text-[13px] font-medium text-muted-foreground">
          {valid ? `Slept ${elapsed(startISO, wakeISO)}` : 'Wake time must be after they fell asleep.'}
        </p>
        <div className="flex gap-2">
          <button onClick={() => setConfirming(false)} className="flex-1 rounded-full bg-muted py-3 text-[14px] font-semibold text-foreground transition-transform active:scale-[0.98]">
            Cancel
          </button>
          <button onClick={() => valid && endSleep(sleepId, wakeISO)} disabled={!valid} className="flex-1 rounded-full bg-primary py-3 text-[14px] font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-40">
            Save
          </button>
        </div>
      </Card>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        onClick={() => endSleep(sleepId)}
        className="flex-1 rounded-full bg-primary py-2.5 text-[14px] font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
      >
        End sleep
      </button>
      <button
        onClick={() => setConfirming(true)}
        className="rounded-full bg-muted px-4 py-2.5 text-[14px] font-semibold text-foreground transition-transform active:scale-[0.99]"
      >
        {runaway ? 'Fix time' : 'Set wake time'}
      </button>
    </div>
  )
}
