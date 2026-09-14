// POST /api/plan — commit an approved capture: create plan items + store capture (RLS-enforced).
// Body: { babyId, items, capture }.
// PATCH /api/plan — update a plan item (done/answered). Body: { id, patch }.
import { NextResponse } from 'next/server'
import { commitCapture, patchPlanItem, addPlanItem, editPlanItem, deletePlanItem, NotAuthedError } from '@/lib/db'
import { hasSupabase } from '@/lib/supabase-server'
import type { InboxCapture, PlanItem } from '@/lib/types'

export const runtime = 'nodejs'

function authFail(e: unknown) {
  if (e instanceof NotAuthedError) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  console.error('[plan] failed:', e instanceof Error ? e.message : e)
  return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
}

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
    await commitCapture(babyId, items, capture)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return authFail(e)
  }
}

// PATCH — toggle a status column (done/answered/appointment_id): raw column patch.
// If `edit` is true, patch is a field edit (title/whenText/assignee/etc.) mapped in editPlanItem.
export async function PATCH(req: Request) {
  if (!hasSupabase()) return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  try {
    const { id, patch, edit } = (await req.json()) as {
      id?: string
      patch?: Record<string, unknown>
      edit?: boolean
    }
    if (!id || !patch) return NextResponse.json({ error: 'Missing data.' }, { status: 400 })
    if (edit) await editPlanItem(id, patch)
    else await patchPlanItem(id, patch)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return authFail(e)
  }
}

// PUT — manually add a plan item (no AI). Body: { babyId, item }.
export async function PUT(req: Request) {
  if (!hasSupabase()) return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  try {
    const { babyId, item } = (await req.json()) as { babyId?: string; item?: PlanItem }
    if (!babyId || !item) return NextResponse.json({ error: 'Missing data.' }, { status: 400 })
    await addPlanItem(babyId, item)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return authFail(e)
  }
}

// DELETE — remove a plan item. Body: { id }.
export async function DELETE(req: Request) {
  if (!hasSupabase()) return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  try {
    const { id } = (await req.json()) as { id?: string }
    if (!id) return NextResponse.json({ error: 'Missing data.' }, { status: 400 })
    await deletePlanItem(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return authFail(e)
  }
}
