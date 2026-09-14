// Mama HQ — server-side data layer. Runs as the SIGNED-IN USER via the authed server client,
// so deny-by-default owner-scoped RLS is enforced on every query (database-standard.md).
// Maps typed app shapes (lib/types.ts) to/from the hardened columns in migration 0001.

import { supabaseServerAuthed } from './supabase-server'
import type { AppState, Baby, InboxCapture, LogEntry, Memory, PlanItem } from './types'
import type { SupabaseClient } from '@supabase/supabase-js'

const BABY_NAME_DEFAULT = 'Baby'

export class NotAuthedError extends Error {
  constructor() {
    super('Not signed in')
    this.name = 'NotAuthedError'
  }
}

async function authedUser(supa: SupabaseClient): Promise<string> {
  const { data, error } = await supa.auth.getUser()
  if (error || !data.user) throw new NotAuthedError()
  return data.user.id
}

// ---------- row <-> app mappers ----------

function rowToLog(r: Record<string, unknown>): LogEntry {
  const base = { id: r.id as string, createdAt: r.occurred_at as string }
  switch (r.kind) {
    case 'feed':
      return {
        ...base,
        kind: 'feed',
        method: (r.feed_method as 'breast' | 'bottle') ?? 'bottle',
        side: (r.feed_side as LogEntry extends { side: infer S } ? S : never) ?? undefined,
        contents: (r.bottle_contents as 'breast-milk' | 'formula' | 'unspecified') ?? undefined,
        amountMl: (r.amount_ml as number) ?? null,
        note: (r.note as string) ?? null,
      } as LogEntry
    case 'sleep':
      return { ...base, kind: 'sleep', endedAt: (r.ended_at as string) ?? null, note: (r.note as string) ?? null } as LogEntry
    case 'diaper':
      return { ...base, kind: 'diaper', diaper: (r.diaper_kind as 'wet' | 'dirty' | 'both') ?? 'wet', note: (r.note as string) ?? null } as LogEntry
    case 'pump':
      return { ...base, kind: 'pump', side: (r.pump_side as 'left' | 'right' | 'both') ?? 'both', amountMl: (r.amount_ml as number) ?? null, note: (r.note as string) ?? null } as LogEntry
    default:
      return { ...base, kind: 'diaper', diaper: 'wet' } as LogEntry
  }
}

function logToRow(e: LogEntry, babyId: string): Record<string, unknown> {
  const row: Record<string, unknown> = { id: e.id, baby_id: babyId, kind: e.kind, occurred_at: e.createdAt }
  if (e.kind === 'feed') {
    row.feed_method = e.method
    if (e.method === 'breast') row.feed_side = e.side ?? null
    else {
      row.bottle_contents = e.contents ?? null
      row.amount_ml = e.amountMl ?? null
    }
  } else if (e.kind === 'sleep') {
    row.ended_at = e.endedAt ?? null
  } else if (e.kind === 'diaper') {
    row.diaper_kind = e.diaper
  } else if (e.kind === 'pump') {
    row.pump_side = e.side
    row.amount_ml = e.amountMl ?? null
  }
  return row
}

function rowToPlan(r: Record<string, unknown>): PlanItem {
  const base = { id: r.id as string, createdAt: r.created_at as string }
  switch (r.kind) {
    case 'task':
      return { ...base, kind: 'task', title: r.title as string, dueText: (r.due_text as string) ?? null, assignee: (r.assignee as string) ?? null, done: !!r.done, note: (r.note as string) ?? null }
    case 'appointment':
      return { ...base, kind: 'appointment', title: r.title as string, whenText: (r.when_text as string) ?? null, location: (r.location as string) ?? null, who: (r.who as string) ?? null, note: (r.note as string) ?? null, questionIds: [] }
    case 'question':
      return { ...base, kind: 'question', text: r.title as string, appointmentId: (r.appointment_id as string) ?? null, answered: !!r.answered }
    case 'shopping':
      return { ...base, kind: 'shopping', item: r.title as string, list: (r.list as 'shopping' | 'supplies' | 'general') ?? 'shopping', done: !!r.done }
    default:
      return { ...base, kind: 'task', title: (r.title as string) ?? '', dueText: null, assignee: null, done: false, note: null }
  }
}

function planToRow(p: PlanItem, babyId: string): Record<string, unknown> {
  const row: Record<string, unknown> = { id: p.id, baby_id: babyId, kind: p.kind, created_at: p.createdAt }
  switch (p.kind) {
    case 'task':
      row.title = p.title; row.due_text = p.dueText ?? null; row.assignee = p.assignee ?? null; row.done = p.done; row.note = p.note ?? null
      break
    case 'appointment':
      row.title = p.title; row.when_text = p.whenText ?? null; row.location = p.location ?? null; row.who = p.who ?? null; row.note = p.note ?? null
      break
    case 'question':
      row.title = p.text; row.appointment_id = p.appointmentId ?? null; row.answered = p.answered
      break
    case 'shopping':
      row.title = p.item; row.list = p.list; row.done = p.done
      break
  }
  return row
}

function rowToCapture(r: Record<string, unknown>): InboxCapture {
  return {
    id: r.id as string,
    createdAt: r.created_at as string,
    originalInput: r.original_input as string,
    interpretation: (r.interpretation as string) ?? '',
    proposed: (r.proposed as InboxCapture['proposed']) ?? [],
    approved: (r.approved as InboxCapture['approved']) ?? [],
    status: (r.status as InboxCapture['status']) ?? 'committed',
  }
}

function rowToMemory(r: Record<string, unknown>): Memory {
  return {
    id: r.id as string,
    createdAt: r.created_at as string,
    occurredOn: r.occurred_on as string,
    title: r.title as string,
    note: (r.note as string) ?? null,
  }
}

// ---------- provisioning: family + baby for the signed-in user ----------

async function getOrCreateBaby(supa: SupabaseClient, userId: string): Promise<Baby> {
  // family
  let familyId: string
  const fam = await supa.from('families').select('id').eq('owner_id', userId).limit(1)
  if (fam.error) throw fam.error
  if (fam.data && fam.data.length > 0) {
    familyId = fam.data[0].id
  } else {
    const created = await supa.from('families').insert({ owner_id: userId }).select('id').single()
    if (created.error) throw created.error
    familyId = created.data.id
  }
  // baby
  const babyRes = await supa.from('babies').select('*').eq('family_id', familyId).order('created_at').limit(1)
  if (babyRes.error) throw babyRes.error
  if (babyRes.data && babyRes.data.length > 0) {
    const b = babyRes.data[0]
    return { id: b.id, name: b.name, birthDate: b.birth_date }
  }
  const birth = new Date()
  birth.setDate(birth.getDate() - 16)
  const madeBaby = await supa
    .from('babies')
    .insert({ family_id: familyId, name: BABY_NAME_DEFAULT, birth_date: birth.toISOString().slice(0, 10) })
    .select('*')
    .single()
  if (madeBaby.error) throw madeBaby.error
  return { id: madeBaby.data.id, name: madeBaby.data.name, birthDate: madeBaby.data.birth_date }
}

// Resolve the signed-in user's baby, or throw NotAuthedError.
async function currentBaby(supa: SupabaseClient): Promise<Baby> {
  const userId = await authedUser(supa)
  return getOrCreateBaby(supa, userId)
}

// ---------- public API (all authed, RLS-enforced) ----------

export async function loadAppState(): Promise<AppState> {
  const supa = await supabaseServerAuthed()
  const baby = await currentBaby(supa)
  const [logs, plan, caps, mems] = await Promise.all([
    supa.from('logs').select('*').eq('baby_id', baby.id).order('occurred_at', { ascending: false }).limit(500),
    supa.from('plan_items').select('*').eq('baby_id', baby.id).order('created_at', { ascending: false }).limit(500),
    supa.from('inbox_captures').select('*').eq('baby_id', baby.id).order('created_at', { ascending: false }).limit(200),
    supa.from('memories').select('*').eq('baby_id', baby.id).order('occurred_on', { ascending: false }).limit(500),
  ])
  if (logs.error) throw logs.error
  if (plan.error) throw plan.error
  if (caps.error) throw caps.error
  if (mems.error) throw mems.error
  return {
    baby,
    logs: (logs.data ?? []).map(rowToLog),
    plan: (plan.data ?? []).map(rowToPlan),
    captures: (caps.data ?? []).map(rowToCapture),
    memories: (mems.data ?? []).map(rowToMemory),
  }
}

export async function insertLog(babyId: string, entry: LogEntry): Promise<void> {
  const supa = await supabaseServerAuthed()
  await authedUser(supa)
  const { error } = await supa.from('logs').insert(logToRow(entry, babyId))
  if (error) throw error
}

export async function patchLog(id: string, patch: Partial<LogEntry>): Promise<void> {
  const supa = await supabaseServerAuthed()
  await authedUser(supa)
  const update: Record<string, unknown> = {}
  if ('endedAt' in patch) update.ended_at = (patch as { endedAt: string | null }).endedAt
  if (Object.keys(update).length === 0) return
  const { error } = await supa.from('logs').update(update).eq('id', id)
  if (error) throw error
}

export async function commitCapture(babyId: string, items: PlanItem[], capture: InboxCapture): Promise<void> {
  const supa = await supabaseServerAuthed()
  await authedUser(supa)
  if (items.length > 0) {
    const { error } = await supa.from('plan_items').insert(items.map((p) => planToRow(p, babyId)))
    if (error) throw error
  }
  const { error: capErr } = await supa.from('inbox_captures').insert({
    id: capture.id,
    baby_id: babyId,
    original_input: capture.originalInput,
    interpretation: capture.interpretation,
    proposed: capture.proposed,
    approved: capture.approved,
    status: capture.status,
  })
  if (capErr) throw capErr
}

export async function patchPlanItem(id: string, patch: Record<string, unknown>): Promise<void> {
  const supa = await supabaseServerAuthed()
  await authedUser(supa)
  const { error } = await supa.from('plan_items').update(patch).eq('id', id)
  if (error) throw error
}

// ---------- memories ----------

export async function insertMemory(babyId: string, memory: Memory): Promise<void> {
  const supa = await supabaseServerAuthed()
  await authedUser(supa)
  const { error } = await supa.from('memories').insert({
    id: memory.id,
    baby_id: babyId,
    occurred_on: memory.occurredOn,
    title: memory.title,
    note: memory.note ?? null,
  })
  if (error) throw error
}

export async function deleteMemory(id: string): Promise<void> {
  const supa = await supabaseServerAuthed()
  await authedUser(supa)
  const { error } = await supa.from('memories').delete().eq('id', id)
  if (error) throw error
}
