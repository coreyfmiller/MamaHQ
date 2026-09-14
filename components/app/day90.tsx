'use client'

// "Your First 90 Days" (Step 14) — an emotional keepsake assembled ONLY from genuine recorded
// data: the moments Mom saved, plus describe-only counts of what she logged. No invented
// milestones, no interpretation, no scores (SAFETY.md). Stays warm and graceful when data is sparse.

import type { AppState } from '@/lib/types'
import { BottomSheet } from '@/components/app/ui'
import { dayNumber } from '@/lib/store'

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  return dt.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
}

export function Day90({ state, onClose }: { state: AppState; onClose: () => void }) {
  const day = dayNumber(state.baby.birthDate)
  const capped = Math.min(day, 90)
  const feeds = state.logs.filter((l) => l.kind === 'feed').length
  const diapers = state.logs.filter((l) => l.kind === 'diaper').length
  const sleeps = state.logs.filter((l) => l.kind === 'sleep').length
  const memories = [...state.memories].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn))
  const reachedNinety = day >= 90

  return (
    <BottomSheet title="Your First 90 Days" onClose={onClose}>
      <div className="space-y-6">
        <div className="rounded-2xl bg-accent/50 p-5 text-center">
          <p className="font-serif text-2xl leading-tight text-foreground">
            {state.baby.name}’s first {capped} days
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {reachedNinety
              ? 'Ninety days. Look how far you’ve both come.'
              : 'A keepsake, growing with every day you’re in it together.'}
          </p>
        </div>

        {/* Describe-only tallies — what was recorded, never a judgment. */}
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <Stat n={feeds} label="feeds logged" />
          <Stat n={diapers} label="diapers logged" />
          <Stat n={sleeps} label="sleeps logged" />
        </div>

        <div>
          <h3 className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">
            Moments you saved
          </h3>
          {memories.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card/50 p-5 text-center text-sm text-muted-foreground">
              As you save little moments in Memories, they gather here into a keepsake of these first
              months — the first smile, the tiny sounds, the ordinary afternoons.
            </p>
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-5">
              {memories.map((m) => (
                <li key={m.id} className="relative">
                  <span className="absolute -left-[1.4rem] top-1.5 size-2 rounded-full bg-primary" />
                  <p className="text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground">
                    {formatDate(m.occurredOn)}
                  </p>
                  <p className="font-serif text-lg leading-snug text-foreground">{m.title}</p>
                  {m.note && <p className="mt-1 text-sm text-muted-foreground">{m.note}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Made from what you chose to keep. 💛
        </p>
      </div>
    </BottomSheet>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="font-serif text-2xl leading-none text-foreground">{n}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}
