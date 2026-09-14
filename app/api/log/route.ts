// POST /api/log — insert a baby log (RLS-enforced). Body: { babyId, entry }.
// PATCH /api/log — patch a log (end active sleep). Body: { id, patch }.
import { NextResponse } from 'next/server'
import { insertLog, patchLog, NotAuthedError } from '@/lib/db'
import { hasSupabase } from '@/lib/supabase-server'
import type { LogEntry } from '@/lib/types'

export const runtime = 'nodejs'

function authFail(e: unknown) {
  if (e instanceof NotAuthedError) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  console.error('[log] failed:', e instanceof Error ? e.message : e)
  return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
}

export async function POST(req: Request) {
  if (!hasSupabase()) return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  try {
    const { babyId, entry } = (await req.json()) as { babyId?: string; entry?: LogEntry }
    if (!babyId || !entry) return NextResponse.json({ error: 'Missing data.' }, { status: 400 })
    await insertLog(babyId, entry)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return authFail(e)
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
    return authFail(e)
  }
}
