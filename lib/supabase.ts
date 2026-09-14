// Mama HQ — Supabase clients (supabase-standard.md).
// Writes/reads go through the SERVER using the service-role key, which never reaches the
// browser. The anon (publishable) client is available for future client-side use; for now all
// data access is via server API routes so we control validation + provenance.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function hasSupabase(): boolean {
  return Boolean(url && serviceKey)
}

let _server: SupabaseClient | null = null

// SERVER-ONLY. Never import this into a client component.
export function supabaseServer(): SupabaseClient {
  if (!url || !serviceKey) {
    throw new Error('Supabase is not configured (missing URL or SUPABASE_SERVICE_ROLE_KEY).')
  }
  if (!_server) {
    _server = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return _server
}

// Public config for potential client use (safe to expose; RLS protects data).
export const supabasePublicConfig = { url: url ?? '', anonKey: anonKey ?? '' }
