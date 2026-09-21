'use client'

import { useState } from 'react'
import {
  Sparkles,
  ShoppingCart,
  ListChecks,
  Calendar as CalIcon,
  Baby as BabyIcon,
  X,
  Check,
  Loader2,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react'
import { useNav } from '../context'
import { useTell } from '../tell'
import type { ResolvedProposal, ProposalIssue } from '@/lib/tell/contract'
import { BottomNav, Card, Screen, Scroll, StatusBar, TopBar } from '../ui'

// Step 12 — the Tell MamaHQ surface. One calm input: get it out of your head.
// MamaHQ shows what it understood; the user approves; trusted domains execute.
// Never a "Done!" that hides a partial failure — each proposal shows its own state.

const KIND_ICON: Record<ResolvedProposal['kind'], LucideIcon> = {
  GROCERY_ADD: ShoppingCart,
  TASK_CREATE: ListChecks,
  CALENDAR_CREATE: CalIcon,
  CARE_HANDOFF_PROPOSE: BabyIcon,
}

const KIND_LABEL: Record<ResolvedProposal['kind'], string> = {
  GROCERY_ADD: 'Add to Grocery',
  TASK_CREATE: 'Add task',
  CALENDAR_CREATE: 'Add to Calendar',
  CARE_HANDOFF_PROPOSE: 'Ask to take over care',
}

export function TellScreen({ asTab = false }: { asTab?: boolean }) {
  const { closeOverlay } = useNav()
  const tell = useTell()

  return (
    <Screen>
      <StatusBar />
      {/* As a primary tab there's no "close"; as an overlay it keeps the close bar. */}
      {asTab ? (
        <div className="px-4 py-2" />
      ) : (
        <TopBar variant="close" title="Tell MamaHQ" onBack={closeOverlay} />
      )}
      <Scroll className="space-y-4 px-6 pb-8">
        <header className="pt-1">
          <h1 className="flex items-center gap-2 font-serif text-[24px] font-semibold tracking-tight">
            Tell MamaHQ <Sparkles className="size-5 text-sage" strokeWidth={1.75} />
          </h1>
          <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
            Get it out of your head. Groceries, a task, something on the calendar — say it however
            it comes out and MamaHQ will sort it. You approve everything.
          </p>
        </header>

        {!tell.available ? (
          <Card>
            <p className="text-[14px] text-muted-foreground">
              Tell MamaHQ organizes your shared household, so it lives in your account. Sign in to
              use it.
            </p>
          </Card>
        ) : (
          <>
            <Composer />
            {tell.phase === 'interpret_failed' && tell.interpretError && (
              <div className="flex items-start gap-2 rounded-2xl border border-peach/40 bg-peach-soft/50 px-4 py-3 text-[14px]">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-peach" />
                <span>{tell.interpretError}</span>
              </div>
            )}

            {(tell.phase === 'reviewing' || tell.phase === 'executing' || tell.phase === 'done') && (
              <ReviewList />
            )}
          </>
        )}
      </Scroll>
      {asTab && <BottomNav active="tell" />}
    </Screen>
  )
}

// A few example brain-dumps shown before the user has typed. EDUCATIONAL ONLY:
// tapping one populates the input; it never interprets or executes automatically —
// the user still presses "Sort this out" and then confirms (Step 12 invariant).
const EXAMPLE_PROMPTS = [
  'Add milk and diapers.',
  'Remind me to call the dentist tomorrow.',
  'James is taking Madelyn to soccer Thursday at 6.',
  'Add bananas and remind me to book the baby’s appointment.',
]

function Composer() {
  const tell = useTell()
  const busy = tell.phase === 'interpreting'
  const showExamples = tell.draft.trim().length === 0 && tell.phase !== 'reviewing' && tell.phase !== 'done'
  return (
    <div className="space-y-2">
      <label htmlFor="tell-input" className="sr-only">
        What&apos;s on your mind?
      </label>
      <textarea
        id="tell-input"
        value={tell.draft}
        onChange={(e) => tell.setDraft(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Need diapers, we're low on milk, James has soccer pickup Thursday at 6…"
        className="w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
      />
      {showExamples && (
        <div className="space-y-1.5">
          <p className="px-1 text-[12px] font-medium text-muted-foreground">Try something like</p>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_PROMPTS.map((ex) => (
              <button
                key={ex}
                // Populate the input only — never auto-interpret or execute.
                onClick={() => tell.setDraft(ex)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-left text-[13px] text-foreground transition-transform active:scale-[0.98]"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => void tell.interpret()}
        disabled={busy || tell.draft.trim().length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-40"
      >
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Making sense of it…
          </>
        ) : (
          <>
            <Sparkles className="size-4" /> Sort this out
          </>
        )}
      </button>
    </div>
  )
}

function ReviewList() {
  const tell = useTell()
  const done = tell.phase === 'done'

  return (
    <div className="space-y-3">
      {tell.summary && tell.phase === 'reviewing' && (
        <p className="px-1 text-[14px] font-medium text-foreground">Here&apos;s what I understood</p>
      )}

      {tell.proposals.length === 0 && tell.unsupported.length === 0 && (
        <Card>
          <p className="text-[14px] text-muted-foreground">
            I didn&apos;t find anything I can add yet. Try rephrasing, or add it directly.
          </p>
        </Card>
      )}

      <div className="space-y-2">
        {tell.proposals.map((p) => (
          <ProposalCard key={p.id} proposal={p} />
        ))}
      </div>

      {tell.unsupported.length > 0 && (
        <Card className="space-y-1.5">
          <p className="text-[13px] font-semibold text-muted-foreground">I can&apos;t do these yet</p>
          {tell.unsupported.map((u, i) => (
            <p key={i} className="text-[13px] text-muted-foreground">
              · {u.text}
              {u.reason ? ` — ${u.reason}` : ''}
            </p>
          ))}
        </Card>
      )}

      {done ? (
        <div className="space-y-2">
          <ResultSummary />
          <button
            onClick={() => tell.reset()}
            className="w-full rounded-full bg-muted py-3 text-[14px] font-semibold text-foreground transition-transform active:scale-[0.99]"
          >
            Tell MamaHQ something else
          </button>
        </div>
      ) : (
        tell.proposals.length > 0 && (
          <button
            onClick={() => void tell.confirmAll()}
            disabled={tell.phase === 'executing' || tell.readyCount === 0}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-40"
          >
            {tell.phase === 'executing' ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Adding…
              </>
            ) : tell.readyCount > 0 ? (
              `Add ${tell.readyCount} ${tell.readyCount === 1 ? 'thing' : 'things'}`
            ) : (
              'Resolve the questions above'
            )}
          </button>
        )
      )}
    </div>
  )
}

function ProposalCard({ proposal }: { proposal: ResolvedProposal }) {
  const tell = useTell()
  const Icon = KIND_ICON[proposal.kind]
  const blocking = proposal.issues.length > 0
  const state = proposal.status

  return (
    <Card className="space-y-2">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${
            state === 'succeeded'
              ? 'bg-sage-soft text-sage'
              : state === 'failed'
                ? 'bg-peach-soft text-peach'
                : 'bg-muted text-muted-foreground'
          }`}
        >
          {state === 'succeeded' ? (
            <Check className="size-[18px]" strokeWidth={2.5} />
          ) : state === 'executing' ? (
            <Loader2 className="size-[18px] animate-spin" />
          ) : (
            <Icon className="size-[18px]" strokeWidth={1.75} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            {KIND_LABEL[proposal.kind]}
          </p>
          <ProposalBody proposal={proposal} />
        </div>
        {state !== 'succeeded' && state !== 'executing' && tell.phase !== 'done' && (
          <button
            onClick={() => tell.removeProposal(proposal.id)}
            aria-label="Remove this"
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:text-destructive active:bg-muted"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {blocking && state !== 'succeeded' && <Clarification proposal={proposal} />}
    </Card>
  )
}

function ProposalBody({ proposal }: { proposal: ResolvedProposal }) {
  switch (proposal.kind) {
    case 'GROCERY_ADD':
      return <p className="text-[15px] font-semibold leading-tight">{proposal.displayName}</p>
    case 'TASK_CREATE':
      return (
        <div>
          <p className="text-[15px] font-semibold leading-tight">{proposal.title}</p>
          <p className="text-[13px] text-muted-foreground">
            {proposal.assignee?.displayName ? `For ${proposal.assignee.displayName}` : 'For you'}
            {proposal.dueLabel ? ` · ${proposal.dueLabel}` : ''}
          </p>
        </div>
      )
    case 'CALENDAR_CREATE':
      return (
        <div>
          <p className="text-[15px] font-semibold leading-tight">{proposal.title}</p>
          <p className="text-[13px] text-muted-foreground">
            {proposal.whenLabel ?? 'Time not set'}
            {proposal.participants.filter((p) => p.displayName).length > 0
              ? ` · ${proposal.participants.map((p) => p.displayName).filter(Boolean).join(', ')}`
              : ''}
          </p>
          {proposal.responsible?.displayName && (
            <p className="text-[13px] text-muted-foreground">{proposal.responsible.displayName} is handling it</p>
          )}
        </div>
      )
    case 'CARE_HANDOFF_PROPOSE':
      return (
        <p className="text-[15px] font-semibold leading-tight">
          {proposal.recipient?.displayName
            ? `Ask ${proposal.recipient.displayName} to take over`
            : 'Ask someone to take over'}
        </p>
      )
  }
}

function Clarification({ proposal }: { proposal: ResolvedProposal }) {
  const tell = useTell()
  return (
    <div className="space-y-2 rounded-xl bg-muted/60 px-3 py-2.5">
      {proposal.issues.map((issue, i) => (
        <div key={i}>
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
            <AlertCircle className="size-3.5 text-peach" /> {issue.message}
          </p>
          {issue.code === 'ambiguous_person' && issue.field && issue.candidates && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {issue.candidates.map((c) => (
                <button
                  key={c.personId}
                  onClick={() => tell.resolvePerson(proposal.id, issue.field!, c.personId, c.displayName)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-medium transition-transform active:scale-[0.98]"
                >
                  {c.displayName}
                </button>
              ))}
            </div>
          )}
          <IssueEditor proposal={proposal} issue={issue} />
        </div>
      ))}
    </div>
  )
}

// Minimal domain-appropriate editors for the common blocking issues (missing date/
// time). The user's edit is authoritative and revalidated deterministically.
function IssueEditor({ proposal, issue }: { proposal: ResolvedProposal; issue: ProposalIssue }) {
  const tell = useTell()
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  if (proposal.kind !== 'CALENDAR_CREATE') return null
  if (issue.code !== 'missing_date' && issue.code !== 'missing_time') return null

  const apply = () => {
    // Rebuild the timed instant from the current known parts + the edit.
    const existingDate = proposal.startDate ?? (proposal.startISO ? proposal.startISO.slice(0, 10) : '')
    const useDate = date || existingDate
    const useTime = time || '09:00'
    if (!useDate) return
    const [y, m, d] = useDate.split('-').map(Number)
    const [hh, mm] = useTime.split(':').map(Number)
    const iso = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0).toISOString()
    const remaining = proposal.issues.filter((i) => i.code !== 'missing_date' && i.code !== 'missing_time')
    tell.editProposal(proposal.id, {
      startISO: iso,
      allDay: false,
      whenLabel: new Date(iso).toLocaleString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
      issues: remaining,
    } as Partial<ResolvedProposal>)
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      {issue.code === 'missing_date' && (
        <input
          type="date"
          aria-label="Event date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-border bg-card px-2 py-1 text-[13px]"
        />
      )}
      <input
        type="time"
        aria-label="Event time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="rounded-lg border border-border bg-card px-2 py-1 text-[13px]"
      />
      <button
        onClick={apply}
        className="rounded-full bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
      >
        Set
      </button>
    </div>
  )
}

function ResultSummary() {
  const { results } = useTell()
  const okCount = results.filter((r) => r.ok).length
  const failCount = results.length - okCount
  return (
    <Card className="space-y-2">
      <p className="text-[15px] font-semibold">
        {okCount > 0 ? `Added ${okCount} ${okCount === 1 ? 'thing' : 'things'}` : 'Nothing was added'}
        {failCount > 0 ? ` · ${failCount} couldn’t be added` : ''}
      </p>
      <div className="space-y-1">
        {results.map((r) => (
          <p key={r.proposalId} className={`flex items-start gap-1.5 text-[13px] ${r.ok ? 'text-foreground' : 'text-peach'}`}>
            {r.ok ? <Check className="mt-0.5 size-3.5 shrink-0 text-sage" /> : <AlertCircle className="mt-0.5 size-3.5 shrink-0" />}
            {r.message}
          </p>
        ))}
      </div>
    </Card>
  )
}
