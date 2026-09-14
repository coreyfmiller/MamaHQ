// Mama HQ — SERVER Supabase clients (Route Handlers / Server Components / Server Actions).
// Imports next/headers — must never be imported into a client component.

import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export function hasSupabase(): boolean {
  return Boolean(url && anonKey)
}

// Server client bound to the request's cookies — RLS runs as the signed-in user.
export async function supabaseServerAuthed(): Promise<SupabaseClient> {
  if (!url || !anonKey) throw new Error('Supabase is not configured.')
  const cookieStore = await cookies()
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Read-only cookies in a Server Component — the proxy refreshes the session instead.
        }
      },
    },
  })
}

// Service-role client — SERVER ONLY, bypasses RLS. Use sparingly.
let _admin: SupabaseClient | null = null
export function supabaseAdmin(): SupabaseClient {
  if (!url || !serviceKey) throw new Error('Service role not configured.')
  if (!_admin) {
    _admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  }
  return _admin
}
