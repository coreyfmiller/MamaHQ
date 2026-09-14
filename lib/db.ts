// Mama HQ — server-side data layer over Supabase. Maps typed app shapes (lib/types.ts)
// to/from the jsonb rows. SERVER-ONLY (uses the service client). All persistence flows through
// here so validation + provenance live in one place (supabase-standard.md).

import { supabaseServer } from './supabase'
import type {
  AppState,
  Baby,
  InboxCapture,
  LogEntry,
  PlanItem,
} from './types'

const FAMILY_NAME_DEFAULT = 'Emma'

// ---------- row <-> app mappers ----------

function rowToLog(r: Record<string, unknown>): LogEntry {
  const data = (r.data as Record<string, unknown>) ?? {}
  const base = { id: r.id as string, createdAt: r.created_at as string }
  switch (r.kind) {
    case 'feed':
      return { ...base, kind: 'feed', ...(data as object) } as LogEntry
    case 'sleep':
      return { ...base, kind: 'sleep', endedAt: (r.ended_at as string) ?? null, ...(data as object) } as LogEntry
    case 'diaper':
      return { ...base, kind: 'diaper', ...(data as object) } as LogEntry
    case 'pump':
      return { ...base, kind: 'pump', ...(data as object) } as LogEntry
    default:
      return { ...base, kind: 'diaper', diaper: 'wet' } as LogEntry
  }
}

// Split a LogEntry into (columns, data-jsonb). id/createdAt/kind/endedAt are columns; the rest jsonb.
function logToRow(e: LogEntry, babyId: string) {
  const { id, kind, createdAt, ...rest } = e as LogEntry & Record<string, unknown>
  const endedAt = kind === 'sleep' ? ((e as { endedAt: string | null }).endedAt ?? null) : null
  if (kind === 'sleep') delete (rest as Record<string, unknown>).endedAt
  return {
    id,
    baby_id: babyId,
    kind,
    created_at: createdAt,
    ended_at: endedAt,
    data: rest,
  }
}

function rowToPlan(r: Record<string, unknown>): PlanItem {
  const data = (r.data as Record<string, unknown>) ?? {}
  return { id: r.id as string, kind: r.kind as PlanItem['kind'], createdAt: r.created_at as string, ...(data as object) } as PlanItem
}

function planToRow(p: PlanItem, babyId: string) {
  const { id, kind, createdAt, ...rest } = p as PlanItem & Record<string, unknown>
  return { id, baby_id: babyId, kind, created_at: createdAt, data: rest }
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

// ---------- family bootstrap ----------

// Get the single family's baby, creating a default one on first run (Phase A: no auth).
export async function getOrCreateBaby(): Promise<Baby> {
  const supa = supabaseServer()
  const { data, error } = await supa
    .from('babies')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) throw error
  if (data && data.length > 0) {
    const b = data[0]
    return { id: b.id, name: b.name, birthDate: b.birth_date }
  }
  // seed a default newborn (~Day 17), matching the local-first default
  const birth = new Date()
  birth.setDate(birth.getDate() - 16)
  const { data: created, error: insErr } = await supa
    .from('babies')
    .insert({ name: FAMILY_NAME_DEFAULT, birth_date: birth.toISOString().slice(0, 10) })
    .select('*')
    .single()
  if (insErr) throw insErr
  return { id: created.id, name: created.name, birthDate: created.birth_date }
}

// ---------- load full state ----------

export async function loadAppState(): Promise<AppState> {
  const supa = supabaseServer()
  const baby = await getOrCreateBaby()

  const [logsRes, planRes, capRes] = await Promise.all([
    supa.from('logs').select('*').eq('baby_id', baby.id).order('created_at', { ascending: false }).limit(500),
    supa.from('plan_items').select('*').eq('baby_id', baby.id).order('created_at', { ascending: false }).limit(500),
    supa.from('inbox_captures').select('*').eq('baby_id', baby.id).order('created_at', { ascending: false }).limit(200),
  ])
  if (logsRes.error) throw logsRes.error
  if (planRes.error) throw planRes.error
  if (capRes.error) throw capRes.error

  return {
    baby,
    logs: (logsRes.data ?? []).map(rowToLog),
    plan: (planRes.data ?? []).map(rowToPlan),
    captures: (capRes.data ?? []).map(rowToCapture),
  }
}

// ---------- writes ----------

export async function insertLog(babyId: string, entry: LogEntry): Promise<void> {
  const supa = supabaseServer()
  const { error } = await supa.from('logs').insert(logToRow(entry, babyId))
  if (error) throw error
}

export async function patchLog(id: string, patch: Partial<LogEntry>): Promise<void> {
  const supa = supabaseServer()
  // Only sleep's endedAt is a column patch in practice.
  const update: Record<string, unknown> = {}
  if ('endedAt' in patch) update.ended_at = (patch as { endedAt: string | null }).endedAt
  if (Object.keys(update).length === 0) return
  const { error } = await supa.from('logs').update(update).eq('id', id)
  if (error) throw error
}

export async function insertPlanItems(babyId: string, items: PlanItem[]): Promise<void> {
  if (items.length === 0) return
  const supa = supabaseServer()
  const { error } = await supa.from('plan_items').insert(items.map((p) => planToRow(p, babyId)))
  if (error) throw error
}

export async function patchPlanItem(id: string, kind: PlanItem['kind'], patch: Record<string, unknown>): Promise<void> {
  const supa = supabaseServer()
  // Merge into the jsonb data (done/answered live there).
  const { data: existing, error: readErr } = await supa.from('plan_items').select('data').eq('id', id).single()
  if (readErr) throw readErr
  const merged = { ...(existing?.data ?? {}), ...patch }
  const { error } = await supa.from('plan_items').update({ data: merged }).eq('id', id)
  if (error) throw error
}

export async function insertCapture(babyId: string, capture: InboxCapture): Promise<void> {
  const supa = supabaseServer()
  const { error } = await supa.from('inbox_captures').insert({
    id: capture.id,
    baby_id: babyId,
    created_at: capture.createdAt,
    original_input: capture.originalInput,
    interpretation: capture.interpretation,
    proposed: capture.proposed,
    approved: capture.approved,
    status: capture.status,
  })
  if (error) throw error
}
