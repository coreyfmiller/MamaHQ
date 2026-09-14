// POST /api/log — insert a baby log entry. Body: { babyId, entry }.
// PATCH /api/log — patch a log (used to end an active sleep). Body: { id, patch }.
import { NextResponse } from 'next/server'
import { insertLog, patchLog } from '@/lib/db'
import { hasSupabase } from '@/lib/supabase'
import type { LogEntry } from '@/lib/types'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  if (!hasSupabase()) return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  try {
    const { babyId, entry } = (await req.json()) as { babyId?: string; entry?: LogEntry }
    if (!babyId || !entry) return NextResponse.json({ error: 'Missing data.' }, { status: 400 })
    await insertLog(babyId, entry)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[log] insert failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  if (!hasSupabase()) return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  try {
    const { id, patch } = (await req.json()) as { id?: string; patch?: Partial<LogEntry> }
    if (!id || !patch) return NextResponse.json({ error: 'Missing data.' }, { status: 400 })
    await patchLog(id, patch)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[log] patch failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Could not update that.' }, { status: 500 })
  }
}
