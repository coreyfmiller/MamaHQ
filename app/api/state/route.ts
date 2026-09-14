// GET /api/state — load the whole family state from Supabase (seeds a default baby on first run).
import { NextResponse } from 'next/server'
import { loadAppState } from '@/lib/db'
import { hasSupabase } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  if (!hasSupabase()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 })
  }
  try {
    const state = await loadAppState()
    return NextResponse.json(state)
  } catch (e) {
    console.error('[state] load failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Could not load your data.' }, { status: 500 })
  }
}
