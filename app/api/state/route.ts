// GET /api/state — load the signed-in family's state (RLS-enforced). 401 if not signed in.
import { NextResponse } from 'next/server'
import { loadAppState, NotAuthedError } from '@/lib/db'
import { hasSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  if (!hasSupabase()) return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  try {
    const state = await loadAppState()
    return NextResponse.json(state)
  } catch (e) {
    if (e instanceof NotAuthedError) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    console.error('[state] load failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Could not load your data.' }, { status: 500 })
  }
}
