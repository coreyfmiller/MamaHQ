import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Server-side Supabase client (Route Handlers / Server Components). Reads and
// writes the auth session via cookies so the user's identity flows to the DB and
// row-level security applies. Uses the anon key — RLS enforces access.
export async function supabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Called from a Server Component where cookies are read-only — safe to
            // ignore; the middleware/route handler refreshes the session instead.
          }
        },
      },
    },
  )
}
