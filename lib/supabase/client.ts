'use client'

import { createBrowserClient } from '@supabase/ssr'

// Browser-side Supabase client. Uses the public URL + anon key (safe to expose;
// row-level security is what actually protects data). Memoized so we reuse one
// client + one auth session across the app.
type BrowserClient = ReturnType<typeof createBrowserClient>
let client: BrowserClient | undefined

export function supabaseBrowser(): BrowserClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return client
}
