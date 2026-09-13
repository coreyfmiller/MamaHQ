'use client'

import { useState } from 'react'
import type { AppState, InboxCapture, PlanItem, ProposedAction } from '@/lib/types'
import { addCapture, addPlan, newId } from '@/lib/store'
import { CalendarClock, HelpCircle, ShoppingCart, CheckSquare, X, Loader2, Sparkles } from 'lucide-react'

const EXAMPLE =
  'Baby appointment Thursday at 10. Remind me to ask about her skin. We’re almost out of diapers and Matt needs to pick up formula tomorrow.'

export function InboxTab({ state, update }: { state: AppState; update: (s: AppState) => void }) {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The current proposal awaiting the user's approval. Nothing is committed until they act.
  const [proposal, setProposal] = useState<{
    originalInput: string
    interpretation: string
    actions: ProposedAction[]
  } | null>(null)

  async function extract() {
    const text = input.trim()
    if (!text || busy) return
    setBusy(true)
    setError(null)
    setProposal(null)
    try {
      const res = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not read that.')
      setProposal({ originalInput: text, interpretation: data.interpretation, actions: data.proposed })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  function removeAction(idx: number) {
    if (!proposal) return
    setProposal({ ...proposal, actions: proposal.actions.filter((_, i) => i !== idx) })
  }

  // Commit: only NOW do we create plan items — and we store the full provenance.
  function commit() {
    if (!proposal) return
    let next = state
    for (const a of proposal.actions) {
      next = addPlan(next, actionToPlanItem(a))
    }
    const capture: InboxCapture = {
      id: newId(),
      createdAt: new Date().toISOString(),
      originalInput: proposal.originalInput, // verbatim, immutable
      interpretation: proposal.interpretation,
      proposed: proposal.actions,
      approved: proposal.actions,
      status: 'committed',
    }
    next = addCapture(next, capture)
    update(next)
    setProposal(null)
    setInput('')
  }

  function dismiss() {
    setProposal(null)
  }

  return (
    <div className="px-5 pt-10">
      <h1 className="font-serif text-2xl text-foreground">Inbox</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Brain dump anything. I’ll sort it — you decide what to keep.
      </p>

      {/* Composer */}
      <div className="mt-5">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={4}
          placeholder="What’s on your mind?"
          className="w-full resize-none rounded-2xl border border-border bg-card px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
        />
        {!input && !proposal && (
          <button
            onClick={() => setInput(EXAMPLE)}
            className="mt-2 text-xs text-muted-foreground underline decoration-border underline-offset-4"
          >
            Try an example
          </button>
        )}
        <button
          onClick={extract}
          disabled={busy || !input.trim()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-base font-semibold text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
          {busy ? 'Reading…' : 'Sort this out'}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground">
          {error}
        </p>
      )}

      {/* PROPOSAL — nothing is saved until the user approves */}
      {proposal && (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground">{proposal.interpretation}</p>

          {proposal.actions.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-border bg-card/50 p-5 text-center text-sm text-muted-foreground">
              I didn’t find anything to add. Try rephrasing, or add it yourself later.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {proposal.actions.map((a, i) => (
                <ProposalRow key={i} action={a} onRemove={() => removeAction(i)} />
              ))}
            </ul>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={dismiss}
              className="flex-1 rounded-2xl border border-border bg-card py-3 text-sm font-semibold text-foreground"
            >
              Discard
            </button>
            <button
              onClick={commit}
              disabled={proposal.actions.length === 0}
              className="flex-[2] rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              Add {proposal.actions.length === 1 ? 'it' : 'everything'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ProposalRow({ action, onRemove }: { action: ProposedAction; onRemove: () => void }) {
  const { icon, kind, title, meta } = describeAction(action)
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm">
      <span className="mt-0.5 text-primary">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{kind}</p>
        <p className="text-sm text-foreground">{title}</p>
        {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
      </div>
      <button onClick={onRemove} aria-label="Remove" className="shrink-0 rounded-full p-1 text-muted-foreground">
        <X className="h-4 w-4" />
      </button>
    </li>
  )
}

function describeAction(a: ProposedAction): {
  icon: React.ReactNode
  kind: string
  title: string
  meta?: string
} {
  switch (a.type) {
    case 'appointment':
      return {
        icon: <CalendarClock className="h-5 w-5" />,
        kind: 'Appointment',
        title: a.title,
        meta: [a.whenText, a.who, a.location].filter(Boolean).join(' · ') || undefined,
      }
    case 'question':
      return { icon: <HelpCircle className="h-5 w-5" />, kind: 'Question', title: a.text }
    case 'shopping':
      return { icon: <ShoppingCart className="h-5 w-5" />, kind: 'Shopping', title: a.item, meta: a.list }
    case 'task':
      return {
        icon: <CheckSquare className="h-5 w-5" />,
        kind: 'Task',
        title: a.title,
        meta: [a.assignee, a.dueText].filter(Boolean).join(' · ') || undefined,
      }
  }
}

function actionToPlanItem(a: ProposedAction): PlanItem {
  const base = { id: newId(), createdAt: new Date().toISOString() }
  switch (a.type) {
    case 'appointment':
      return {
        ...base,
        kind: 'appointment',
        title: a.title,
        whenText: a.whenText ?? null,
        location: a.location ?? null,
        who: a.who ?? null,
        note: null,
        questionIds: [],
      }
    case 'question':
      return { ...base, kind: 'question', text: a.text, appointmentId: null, answered: false }
    case 'shopping':
      return { ...base, kind: 'shopping', item: a.item, list: a.list, done: false }
    case 'task':
      return { ...base, kind: 'task', title: a.title, dueText: a.dueText ?? null, assignee: a.assignee ?? null, done: false, note: null }
  }
}
