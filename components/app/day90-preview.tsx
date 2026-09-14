'use client'

// Day-90 Retrospective (PROTOTYPE). Full build is Step 14 (depends on Memories incl. photos).
// This assembles a warm retrospective from GENUINE recorded data — memories + describe-only
// counts. No invented milestones, no interpretation (SAFETY.md). Sparse data stays graceful.

import type { AppState } from '@/lib/types'
import { BottomSheet } from '@/components/app/ui'
import { dayNumber } from '@/lib/store'

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  return dt.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
}

export function Day90Preview({ state, onClose }: { state: AppState; onClose: () => void }) {
  const day = dayNumber(state.baby.birthDate)
  const feeds = state.logs.filter((l) => l.kind === 'feed').length
  const diapers = state.logs.filter((l) => l.kind === 'diaper').length
  const sleeps = state.logs.filter((l) => l.kind === 'sleep').length
  const memories = [...state.memories].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn))

  return (
    <BottomSheet title="Your First 90 Days" onClose={onClose}>
      <div className="space-y-6">
        <div className="rounded-2xl bg-accent/50 p-5 text-center">
          <p className="font-serif text-2xl leading-tight text-foreground">
            {state.baby.name}’s first {Math.min(day, 90)} days
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Look how far you’ve both come.
          </p>
        </div>

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
              As you save little moments in Memories, they’ll gather here into a keepsake of these
              first months.
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

        <p className="rounded-xl border border-dashed border-border bg-card/50 p-3 text-center text-xs text-muted-foreground">
          Preview — the full keepsake (with photos) arrives near Day 90.
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
