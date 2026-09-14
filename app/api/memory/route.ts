// POST /api/memory — save a memory (RLS-enforced). Body: { babyId, memory }.
// DELETE /api/memory — remove a memory. Body: { id }.
import { NextResponse } from 'next/server'
import { insertMemory, deleteMemory, NotAuthedError } from '@/lib/db'
import { hasSupabase } from '@/lib/supabase-server'
import type { Memory } from '@/lib/types'

export const runtime = 'nodejs'

function authFail(e: unknown) {
  if (e instanceof NotAuthedError) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  console.error('[memory] failed:', e instanceof Error ? e.message : e)
  return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
}

export async function POST(req: Request) {
  if (!hasSupabase()) return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  try {
    const { babyId, memory } = (await req.json()) as { babyId?: string; memory?: Memory }
    if (!babyId || !memory || !memory.title?.trim()) {
      return NextResponse.json({ error: 'Missing data.' }, { status: 400 })
    }
    await insertMemory(babyId, memory)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return authFail(e)
  }
}

export async function DELETE(req: Request) {
  if (!hasSupabase()) return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  try {
    const { id } = (await req.json()) as { id?: string }
    if (!id) return NextResponse.json({ error: 'Missing data.' }, { status: 400 })
    await deleteMemory(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return authFail(e)
  }
}
