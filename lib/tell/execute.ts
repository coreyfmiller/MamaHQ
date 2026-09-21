// MamaHQ — Tell MamaHQ execution dispatcher (Step 12).
//
//   AI proposes. MamaHQ validates. The user approves. TRUSTED DOMAIN SERVICES EXECUTE.
//
// This is the ONLY place a confirmed proposal turns into real household state, and
// it does so ONLY by calling the existing trusted domain operations (the same *Rpc
// helpers every other feature uses) — never a bespoke AI insert path, never raw SQL,
// never a notification insert. Domains own their own side effects (history,
// realtime, notifications).
//
// Exhaustive dispatch on the discriminated `kind`. An unknown kind is rejected — we
// never dynamically execute a function named by the model.
//
// Idempotency: each proposal's stable `id` (assigned at the interpretation boundary,
// before execution) is mapped into the domain idempotency keys (clientTaskId /
// clientEventId / grocery client_action_id). A retry with the same proposal id is a
// domain no-op, so a double-click / timeout-retry cannot create duplicates.

import * as db from '@/lib/supabase/data'
import { resolveGroceryPhrase } from '@/lib/grocery/resolver/resolve'
import { resolveGroceryAction } from '@/lib/grocery/actions/resolve-action'
import { planGroceryAction } from '@/lib/grocery/actions/execute-action'
import type { ActiveGroceryItem } from '@/lib/grocery/actions/types'
import type { ResolvedProposal, ResolvedGroceryAdd, ResolvedTaskCreate, ResolvedCalendarCreate, ResolvedCareHandoff } from './contract.ts'
import { isReady } from './contract.ts'

export interface ExecuteResult {
  ok: boolean
  // Human, non-technical summary line for the results UI.
  message: string
  // 'needs_confirmation' means the grocery action resolver wants a human choice —
  // surfaced to the user; nothing was written.
  outcome?: 'created' | 'incremented' | 'needs_confirmation'
}

// The canonical family/actor context the dispatcher needs. Derived from trusted
// client state (auth + household), never from the proposal itself.
export interface ExecuteContext {
  familyId: string
  // For grocery: the current active list, so the deterministic action resolver can
  // decide add vs increment vs confirm exactly as the manual path does.
  activeGroceryItems: ActiveGroceryItem[]
  // Canonical family person ids for execution-time revalidation (a proposal may sit
  // on screen while the household changes).
  validPersonIds: Set<string>
}

// A namespaced, deterministic client id per (proposal, domain) so retries collide
// with the same DB key. Derived from the proposal's stable id.
function taskClientId(p: ResolvedProposal): string {
  return `tell-task-${p.id}`
}
function eventClientId(p: ResolvedProposal): string {
  return `tell-event-${p.id}`
}
function groceryActionId(p: ResolvedProposal): string {
  return `tell-grocery-${p.id}`
}

async function executeTask(p: ResolvedTaskCreate, ctx: ExecuteContext): Promise<ExecuteResult> {
  // Execution-time revalidation: the assignee must still be a person in THIS family.
  const assigneeId = p.assignee?.personId ?? null
  if (assigneeId && !ctx.validPersonIds.has(assigneeId)) {
    return { ok: false, message: `Couldn’t create "${p.title}" — the assigned person is no longer in this household.` }
  }
  // Trusted Task create (idempotent on clientTaskId). Provenance tagged tell_mamahq.
  // Creating/assigning NEVER records acceptance — only the assignee can accept later.
  await db.createTaskRpc({
    familyId: ctx.familyId,
    title: p.title,
    assignedToPersonId: assigneeId,
    dueAt: p.dueISO,
    notes: p.notes,
    source: 'tell_mamahq',
    clientTaskId: taskClientId(p),
  })
  const who = p.assignee?.displayName ? ` for ${p.assignee.displayName}` : ''
  return { ok: true, outcome: 'created', message: `“${p.title}” added to Tasks${who}` }
}

async function executeCalendar(p: ResolvedCalendarCreate, ctx: ExecuteContext): Promise<ExecuteResult> {
  const responsibleId = p.responsible?.personId ?? null
  const participantIds = p.participants.map((r) => r.personId).filter((x): x is string => Boolean(x))
  // Revalidate every referenced person against the current family.
  for (const pid of [responsibleId, ...participantIds]) {
    if (pid && !ctx.validPersonIds.has(pid)) {
      return { ok: false, message: `Couldn’t add "${p.title}" — a referenced person is no longer in this household.` }
    }
  }
  // Trusted Calendar create (idempotent on clientEventId). The RPC generates the
  // responsibility notification itself — Tell MamaHQ never inserts a notification.
  await db.createCalendarEventRpc({
    familyId: ctx.familyId,
    title: p.title,
    allDay: p.allDay,
    startsAt: p.allDay ? null : p.startISO,
    endsAt: null,
    startDate: p.allDay ? p.startDate : null,
    endDate: null,
    location: p.location,
    notes: p.notes,
    responsiblePersonId: responsibleId,
    participantIds: participantIds.length ? participantIds : null,
    clientEventId: eventClientId(p),
  })
  return { ok: true, outcome: 'created', message: `“${p.title}” added to the Calendar` }
}

async function executeCareHandoff(p: ResolvedCareHandoff, ctx: ExecuteContext): Promise<ExecuteResult> {
  const toId = p.recipient?.personId ?? null
  if (!toId || !ctx.validPersonIds.has(toId)) {
    return { ok: false, message: 'Couldn’t send the care handoff — that person is no longer in this household.' }
  }
  // Trusted propose only. It NEVER transfers care or marks acceptance; the recipient
  // must accept from their own account. The one-pending DB constraint makes a retry
  // safe. Context is intentionally empty here (a deterministic summary is added by
  // the care provider path when initiated from the Care screen).
  await db.proposeCareHandoffRpc(ctx.familyId, toId, {})
  const name = p.recipient?.displayName ?? 'them'
  return { ok: true, outcome: 'created', message: `Care handoff sent to ${name} — they still need to accept` }
}

// Dispatch one confirmed, ready proposal to its trusted domain operation.
export async function executeProposal(p: ResolvedProposal, ctx: ExecuteContext): Promise<ExecuteResult> {
  if (!isReady(p)) {
    return { ok: false, message: 'This still needs a bit more information before it can be added.' }
  }
  switch (p.kind) {
    case 'GROCERY_ADD':
      return executeGroceryWithFamily(p, ctx)
    case 'TASK_CREATE':
      return executeTask(p, ctx)
    case 'CALENDAR_CREATE':
      return executeCalendar(p, ctx)
    case 'CARE_HANDOFF_PROPOSE':
      return executeCareHandoff(p, ctx)
    default: {
      // Exhaustiveness guard: an unknown kind is never executed.
      const _never: never = p
      return { ok: false, message: 'Unsupported action.' }
    }
  }
}

// Grocery needs the familyId stamped onto the insert row; wrap so executeGrocery
// stays focused on the pipeline.
async function executeGroceryWithFamily(p: ResolvedGroceryAdd, ctx: ExecuteContext): Promise<ExecuteResult> {
  const proposal = resolveGroceryPhrase(p.phrase)
  const action = resolveGroceryAction(proposal, ctx.activeGroceryItems, { source: 'tell_mamahq' })
  const plan = planGroceryAction(action, { source: 'tell_mamahq' })

  if (plan.op === 'confirm') {
    return { ok: false, outcome: 'needs_confirmation', message: `"${p.displayName}" needs a quick confirmation on the grocery list.` }
  }
  if (plan.op === 'increment') {
    await db.incrementGroceryItemRpc(plan.targetItemId, plan.incrementBy, groceryActionId(p))
    return { ok: true, outcome: 'incremented', message: `${p.displayName} updated on the grocery list` }
  }
  if (plan.op === 'insert') {
    const d = plan.detail
    await db.insertGroceryItem({
      id: groceryActionId(p),
      family_id: ctx.familyId,
      display_name: d.displayName,
      canonical_item_id: d.canonicalItemId,
      quantity: d.quantity,
      unit: d.quantityUnit ?? null,
      source_type: 'tell_mamahq',
      status: 'active',
      resolved_attributes: d.attributes.map((a) => ({ attribute_id: a.attribute_id, value: a.value })),
      package_size: d.packageSize,
      package_type: d.packageType,
      unmatched_modifiers: d.unmatchedModifiers,
      client_action_id: d.clientActionId,
    })
    return { ok: true, outcome: 'created', message: `${d.displayName} added to Grocery` }
  }
  return { ok: false, message: `Couldn’t add "${p.displayName}".` }
}
