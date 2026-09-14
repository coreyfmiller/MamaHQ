// GET /api/account — export all of the signed-in family's data as JSON (RLS-enforced).
// DELETE /api/account — delete the signed-in user's family and all its data (cascades). 401 if
// not signed in. (SAFETY.md: families can export and delete their own data.)
import { NextResponse } from 'next/server'
import { exportFamilyData, deleteAccount, NotAuthedError } from '@/lib/db'
import { hasSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'

function fail(e: unknown, verb: string) {
  if (e instanceof NotAuthedError) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  console.error(`[account] ${verb} failed:`, e instanceof Error ? e.message : e)
  return NextResponse.json({ error: `Could not ${verb}.` }, { status: 500 })
}

export async function GET() {
  if (!hasSupabase()) return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  try {
    const data = await exportFamilyData()
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="mama-hq-export.json"',
      },
    })
  } catch (e) {
    return fail(e, 'export your data')
  }
}

export async function DELETE() {
  if (!hasSupabase()) return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  try {
    await deleteAccount()
    return NextResponse.json({ ok: true })
  } catch (e) {
    return fail(e, 'delete your account')
  }
}
