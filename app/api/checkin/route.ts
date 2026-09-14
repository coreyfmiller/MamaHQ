// POST /api/checkin — tick/untick a Mom self-care prompt for today. RLS-enforced; 401 if not
// signed in. Body: { babyId, item: 'water'|'eat'|'rest', done: boolean }.
import { NextResponse } from 'next/server'
import { setMomCheckin, NotAuthedError } from '@/lib/db'
import { hasSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  if (!hasSupabase()) return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  try {
    const { babyId, item, done } = (await req.json()) as {
      babyId?: string
      item?: 'water' | 'eat' | 'rest'
      done?: boolean
    }
    if (!babyId || !item || (item !== 'water' && item !== 'eat' && item !== 'rest')) {
      return NextResponse.json({ error: 'Missing data.' }, { status: 400 })
    }
    await setMomCheckin(babyId, item, !!done)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof NotAuthedError) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    console.error('[checkin] failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }
}
