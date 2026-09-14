// Mama HQ — BROWSER Supabase client (client components only: auth sign in/out, session).
// No server-only imports here, so it is safe to bundle for the client.

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

export function supabaseBrowser(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Supabase is not configured (URL / anon key missing).')
  return createBrowserClient(url, anonKey)
}
