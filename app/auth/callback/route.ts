// GET /auth/callback — Supabase OAuth redirect target. Exchanges the ?code for a session
// (cookies are set by the SSR server client), then sends the user home.

import { NextResponse } from 'next/server'
import { supabaseServerAuthed } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/app'

  if (code) {
    const supabase = await supabaseServerAuthed()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }
  // On failure, land on the app route; it will show the sign-in screen.
  return NextResponse.redirect(`${origin}/app?auth_error=1`)
}
