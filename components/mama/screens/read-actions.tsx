'use client'

import { useState } from 'react'
import { Sparkles, HelpCircle, Check } from 'lucide-react'
import { useNav } from '../context'
import { useMom } from '../mom'
import { useAuth } from '../auth'
import type { DailyRead } from '@/lib/daily-reads'

/**
 * Beta Phase 4 — turn a read into ACTION through EXISTING trusted systems.
 *
 * Two honest routes, both user-initiated; NEITHER lets editorial content silently
 * create anything:
 *   1. "Tell MamaHQ" — opens the real Step 12 Tell surface. Nothing is interpreted
 *      or executed until the user types, sorts, and CONFIRMS. We do not pre-fill a
 *      fabricated task; the sentence stays hers.
 *   2. "Save a question for my doctor" — the user explicitly taps to add a note to
 *      their existing doctor-questions list (the same trusted store as the Me screen).
 *      It is reversible there. We never generate or interpret a medical question.
 *
 * Only shown when signed in (these route into shared household state). When signed
 * out there is nowhere trustworthy to route, so we show nothing.
 */
export function ReadActions({ read }: { read: DailyRead }) {
  const { openOverlay, showToast } = useNav()
  const { addQuestion } = useMom()
  const { familyId } = useAuth()
  const [saved, setSaved] = useState(false)

  if (!familyId) return null

  return (
    <div className="mt-7 rounded-3xl border border-border/70 bg-card p-4">
      <p className="text-[13px] font-medium text-muted-foreground">Want to act on this?</p>
      <div className="mt-3 space-y-2">
        <button
          onClick={() => openOverlay('tell')}
          className="flex w-full items-center gap-3 rounded-2xl bg-primary/10 px-4 py-3 text-left transition-transform active:scale-[0.99]"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Sparkles className="size-[18px]" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold leading-tight">Tell MamaHQ</span>
            <span className="block text-[13px] text-muted-foreground">
              Turn a thought into a task, a calendar item, or groceries — you approve it first.
            </span>
          </span>
        </button>

        <button
          onClick={() => {
            // The read's closing prompt is the most "askable" line when present;
            // otherwise seed with the title as a starting point the user can rename
            // in the Me screen. This is a user-initiated save, not auto-creation.
            const seed = read.prompt ? `About "${read.title}"` : read.title
            addQuestion(seed)
            setSaved(true)
            showToast('Saved to your questions — edit it in Me')
          }}
          disabled={saved}
          className="flex w-full items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3 text-left transition-transform active:scale-[0.99] disabled:opacity-60"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {saved ? <Check className="size-[18px] text-sage" strokeWidth={2.5} /> : <HelpCircle className="size-[18px]" strokeWidth={1.75} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold leading-tight">
              {saved ? 'Saved to your questions' : 'Save a question for my doctor'}
            </span>
            <span className="block text-[13px] text-muted-foreground">
              {saved ? 'Find and edit it under Me → Questions.' : 'Keep it with your other questions to ask at a visit.'}
            </span>
          </span>
        </button>
      </div>
    </div>
  )
}
