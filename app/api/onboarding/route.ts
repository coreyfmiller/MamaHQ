// POST /api/onboarding — complete the guided setup (baby name + birth date + country/region).
// RLS-enforced; 401 if not signed in. Returns the updated baby.
import { NextResponse } from 'next/server'
import { completeOnboarding, NotAuthedError } from '@/lib/db'
import { hasSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  if (!hasSupabase()) return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  try {
    const body = (await req.json()) as {
      babyName?: string
      birthDate?: string
      country?: string | null
      region?: string | null
    }
    const babyName = (body.babyName ?? '').trim()
    const birthDate = (body.birthDate ?? '').trim()
    // Validate birth date is a real YYYY-MM-DD, not in the future.
    if (!babyName) return NextResponse.json({ error: 'A name is needed.' }, { status: 400 })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      return NextResponse.json({ error: 'A valid birth date is needed.' }, { status: 400 })
    }
    if (new Date(birthDate + 'T00:00:00') > new Date()) {
      return NextResponse.json({ error: 'Birth date cannot be in the future.' }, { status: 400 })
    }
    const baby = await completeOnboarding({
      babyName,
      birthDate,
      country: body.country ?? null,
      region: body.region ?? null,
    })
    return NextResponse.json({ baby })
  } catch (e) {
    if (e instanceof NotAuthedError) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    console.error('[onboarding] failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Could not save setup.' }, { status: 500 })
  }
}
