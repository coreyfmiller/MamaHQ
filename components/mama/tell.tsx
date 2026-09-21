'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { useHousehold } from './household'
import { useGrocery } from './grocery'
import { useCalendar } from './calendar'
import { useCare } from './care'
import { executeProposal, type ExecuteContext } from '@/lib/tell/execute'
import type {
  TellInterpretation,
  ResolvedProposal,
  ProposalIssue,
} from '@/lib/tell/contract'
import type { ActiveGroceryItem } from '@/lib/grocery/actions/types'

// Step 12 — Tell MamaHQ client provider.
//
//   AI proposes. MamaHQ validates. The user approves. Trusted domain services execute.
//
// This provider owns the Tell MamaHQ session: the raw note, the interpret call, the
// reviewable proposals, per-proposal edits/removal, and the confirmed execution. It
// NEVER interprets or executes on its own — interpretation is a server round-trip
// (read-only) and execution runs only when the user confirms. A proposal is not
// household truth until it succeeds.

export type TellPhase =
  | 'idle'
  | 'interpreting'
  | 'interpret_failed'
  | 'reviewing'
  | 'executing'
  | 'done'

export interface TellResultLine {
  proposalId: string
  ok: boolean
  message: string
}

interface TellCtx {
  phase: TellPhase
  /** The user's raw note — never lost, even on failure. */
  draft: string
  setDraft: (t: string) => void
  summary: string | null
  proposals: ResolvedProposal[]
  unsupported: { text: string; reason?: string }[]
  results: TellResultLine[]
  interpretError: string | null
  available: boolean
  /** Count of proposals with no blocking issues (ready to add). */
  readyCount: number
  /** Send the current draft for interpretation. */
  interpret: () => Promise<void>
  /** Remove a proposal from the review set. */
  removeProposal: (id: string) => void
  /** Edit a proposal's fields (user edit wins; revalidated deterministically). */
  editProposal: (id: string, patch: Partial<ResolvedProposal>) => void
  /** Resolve an ambiguous person by picking a candidate id for a field. */
  resolvePerson: (id: string, field: NonNullable<ProposalIssue['field']>, personId: string, displayName: string) => void
  /** Execute all READY proposals (independently; tracks each result). */
  confirmAll: () => Promise<void>
  /** Reset the session back to empty. */
  reset: () => void
}

const noopAsync = async () => {}
const Ctx = createContext<TellCtx>({
  phase: 'idle',
  draft: '',
  setDraft: () => {},
  summary: null,
  proposals: [],
  unsupported: [],
  results: [],
  interpretError: null,
  available: false,
  readyCount: 0,
  interpret: noopAsync,
  removeProposal: () => {},
  editProposal: () => {},
  resolvePerson: () => {},
  confirmAll: noopAsync,
  reset: () => {},
})

export function useTell() {
  return useContext(Ctx)
}

// Recompute a proposal's status from its issues after an edit (user edits can clear
// an issue). Deterministic — mirrors the server resolver's readiness rule.
function recomputeStatus(p: ResolvedProposal): ResolvedProposal {
  const status = p.issues.length === 0 ? 'ready' : 'needs_clarification'
  return { ...p, status }
}

export function TellProvider({ children }: { children: ReactNode }) {
  const { familyId, status } = useAuth()
  const { people } = useHousehold()
  const grocery = useGrocery()
  const calendar = useCalendar()
  const care = useCare()

  const [phase, setPhase] = useState<TellPhase>('idle')
  const [draft, setDraft] = useState('')
  const [summary, setSummary] = useState<string | null>(null)
  const [proposals, setProposals] = useState<ResolvedProposal[]>([])
  const [unsupported, setUnsupported] = useState<{ text: string; reason?: string }[]>([])
  const [results, setResults] = useState<TellResultLine[]>([])
  const [interpretError, setInterpretError] = useState<string | null>(null)

  const interpret = async () => {
    const text = draft.trim()
    if (!text || phase === 'interpreting') return
    setPhase('interpreting')
    setInterpretError(null)
    setResults([])
    try {
      const res = await fetch('/api/tell', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string }
        setInterpretError(data.message ?? 'I couldn’t sort that out right now. Your note is still here — try again.')
        setPhase('interpret_failed')
        return
      }
      const data = (await res.json()) as TellInterpretation
      setSummary(data.summary)
      setProposals(data.proposals.filter((p) => p.status !== 'removed'))
      setUnsupported(data.unsupported ?? [])
      setPhase('reviewing')
    } catch {
      // Network/parse failure — the draft is preserved so nothing is lost.
      setInterpretError('I couldn’t reach the network. Your note is still here — try again.')
      setPhase('interpret_failed')
    }
  }

  const removeProposal: TellCtx['removeProposal'] = (id) => {
    setProposals((list) => list.filter((p) => p.id !== id))
  }

  const editProposal: TellCtx['editProposal'] = (id, patch) => {
    setProposals((list) =>
      list.map((p) => (p.id === id ? recomputeStatus({ ...p, ...patch } as ResolvedProposal) : p)),
    )
  }

  // Resolve an ambiguous/unknown person locally: set the field's ref and clear the
  // matching issue. The user's choice is authoritative; it is re-validated against
  // the family at execution time (validPersonIds).
  const resolvePerson: TellCtx['resolvePerson'] = (id, field, personId, displayName) => {
    setProposals((list) =>
      list.map((p) => {
        if (p.id !== id) return p
        const issues = p.issues.filter((i) => i.field !== field)
        let next = { ...p, issues } as ResolvedProposal
        if (next.kind === 'TASK_CREATE' && field === 'assignee') {
          next = { ...next, assignee: { raw: displayName, personId, displayName } }
        } else if (next.kind === 'CALENDAR_CREATE' && field === 'responsible') {
          next = { ...next, responsible: { raw: displayName, personId, displayName } }
        } else if (next.kind === 'CARE_HANDOFF_PROPOSE' && field === 'recipient') {
          next = { ...next, recipient: { raw: displayName, personId, displayName } }
        }
        return recomputeStatus(next)
      }),
    )
  }

  const buildExecuteContext = (): ExecuteContext => {
    const activeGroceryItems: ActiveGroceryItem[] = grocery.active.map((it) => ({
      id: it.id,
      status: 'active',
      canonicalItemId: it.canonicalItemId ?? null,
      displayName: it.displayName,
      quantity: it.quantity,
      attributes: it.resolvedAttributes ?? [],
      packageSize: it.packageSize ?? null,
      packageType: it.packageType ?? null,
      unmatchedModifiers: it.unmatchedModifiers ?? [],
    }))
    return {
      familyId: familyId as string,
      activeGroceryItems,
      validPersonIds: new Set(people.map((p) => p.id)),
    }
  }

  const confirmAll = async () => {
    if (!familyId || phase === 'executing') return
    const ready = proposals.filter((p) => p.issues.length === 0 && p.status !== 'succeeded')
    if (ready.length === 0) return
    setPhase('executing')
    const ctx = buildExecuteContext()
    const lines: TellResultLine[] = []
    // Execute independently (domains are independent; this is not a distributed
    // transaction). Each proposal's stable id maps to a domain idempotency key, so a
    // retry cannot duplicate a successful action.
    for (const p of ready) {
      setProposals((list) => list.map((x) => (x.id === p.id ? { ...x, status: 'executing' } : x)))
      try {
        const r = await executeProposal(p, ctx)
        lines.push({ proposalId: p.id, ok: r.ok, message: r.message })
        setProposals((list) =>
          list.map((x) => (x.id === p.id ? { ...x, status: r.ok ? 'succeeded' : 'failed' } : x)),
        )
      } catch (e) {
        lines.push({ proposalId: p.id, ok: false, message: 'Something went wrong adding this.' })
        setProposals((list) => list.map((x) => (x.id === p.id ? { ...x, status: 'failed' } : x)))
        console.warn('tell execute', e)
      }
    }
    setResults(lines)
    setPhase('done')
    // Nudge the local actor's providers to reflect new truth immediately (other
    // sessions get it via Step 11 realtime; grocery/tasks also refetch on realtime).
    void calendar.refresh().catch(() => {})
    void care.refresh().catch(() => {})
  }

  const reset = () => {
    setPhase('idle')
    setDraft('')
    setSummary(null)
    setProposals([])
    setUnsupported([])
    setResults([])
    setInterpretError(null)
  }

  const readyCount = useMemo(
    () => proposals.filter((p) => p.issues.length === 0 && p.status !== 'removed').length,
    [proposals],
  )

  const value = useMemo<TellCtx>(
    () => ({
      phase,
      draft,
      setDraft,
      summary,
      proposals,
      unsupported,
      results,
      interpretError,
      available: Boolean(familyId) && status === 'signed-in',
      readyCount,
      interpret,
      removeProposal,
      editProposal,
      resolvePerson,
      confirmAll,
      reset,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, draft, summary, proposals, unsupported, results, interpretError, familyId, status, readyCount],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
