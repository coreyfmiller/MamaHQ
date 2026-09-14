// POST /api/plan — commit an approved inbox capture: create plan items + store the capture
// (with immutable provenance). Body: { babyId, items: PlanItem[], capture: InboxCapture }.
// PATCH /api/plan — toggle a plan item (done/answered). Body: { id, kind, patch }.
import { NextResponse } from 'next/server'
import { insertCapture, insertPlanItems, patchPlanItem } from '@/lib/db'
import { hasSupabase } from '@/lib/supabase'
import type { InboxCapture, PlanItem } from '@/lib/types'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  if (!hasSupabase()) return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  try {
    const { babyId, items, capture } = (await req.json()) as {
      babyId?: string
      items?: PlanItem[]
      capture?: InboxCapture
    }
    if (!babyId || !Array.isArray(items) || !capture) {
      return NextResponse.json({ error: 'Missing data.' }, { status: 400 })
    }
    await insertPlanItems(babyId, items)
    await insertCapture(babyId, capture)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[plan] commit failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  if (!hasSupabase()) return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  try {
    const { id, kind, patch } = (await req.json()) as {
      id?: string
      kind?: PlanItem['kind']
      patch?: Record<string, unknown>
    }
    if (!id || !kind || !patch) return NextResponse.json({ error: 'Missing data.' }, { status: 400 })
    await patchPlanItem(id, kind, patch)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[plan] patch failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Could not update that.' }, { status: 500 })
  }
}
