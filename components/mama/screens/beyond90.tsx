'use client'

import { ListChecks, CalendarDays, ShoppingCart, Sparkles, type LucideIcon } from 'lucide-react'
import { useNav } from '../context'
import { Screen, Scroll, StatusBar, TopBar } from '../ui'
import { LeafSprig } from '../decor'

// Beta Phase 4 — HONEST "beyond the first 90 days" screen.
//
// The previous version showed a six-stage roadmap (Newborn → Teen) that implied
// age-specific features MamaHQ does not have. That's a fake future roadmap inside the
// product. Replaced with the truthful message: the daily reads are a first-90-days
// thing, but the household tools you're already using keep working afterward — and we
// point at the REAL surfaces that exist today, nothing aspirational.

const realTools: { icon: LucideIcon; label: string; sub: string; overlay: 'tasks' | 'calendar' | 'grocery' }[] = [
  { icon: ListChecks, label: 'Tasks', sub: 'Who owns what', overlay: 'tasks' },
  { icon: CalendarDays, label: 'Calendar', sub: 'What’s happening, who’s handling it', overlay: 'calendar' },
  { icon: ShoppingCart, label: 'Grocery', sub: 'The shared list', overlay: 'grocery' },
]

export function Beyond90Screen() {
  const { closeOverlay, openOverlay } = useNav()
  return (
    <Screen className="relative">
      <StatusBar />
      <TopBar onBack={closeOverlay} />
      <LeafSprig className="pointer-events-none absolute -left-6 bottom-6 h-40 w-24 -rotate-12 opacity-50" />
      <Scroll className="px-6 pb-8">
        <div className="mt-2 text-center">
          <h1 className="font-serif text-[26px] leading-tight font-semibold tracking-tight">
            After the first 90 days
          </h1>
          <p className="mx-auto mt-3 max-w-[20rem] text-[15px] leading-relaxed text-muted-foreground">
            The daily reads walk you through your first 90 days. After that, they wrap up — but the
            parts of MamaHQ that carry your household don’t. They keep working for whatever comes
            next.
          </p>
        </div>

        <div className="mt-7 space-y-2.5">
          {realTools.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.overlay}
                onClick={() => openOverlay(t.overlay)}
                className="flex w-full items-center gap-3.5 rounded-2xl border border-border/70 bg-card p-3.5 text-left shadow-sm transition-transform active:scale-[0.99]"
              >
                <span className="flex size-10 items-center justify-center rounded-2xl bg-sage-soft text-sage">
                  <Icon className="size-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold leading-tight">{t.label}</p>
                  <p className="text-[13px] text-muted-foreground">{t.sub}</p>
                </div>
              </button>
            )
          })}
        </div>

        <button
          onClick={() => openOverlay('tell')}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
        >
          <Sparkles className="size-4" strokeWidth={2} /> Tell MamaHQ what’s on your mind
        </button>

        <p className="mt-6 text-center text-[13px] leading-relaxed text-muted-foreground">
          No new season to unlock, no roadmap to wait for — just the tools you already use.
        </p>
      </Scroll>
    </Screen>
  )
}
