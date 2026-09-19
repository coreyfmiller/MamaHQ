// MamaHQ Grocery — deterministic catalog seed/sync.
//
// Projects the version-controlled TS catalog (lib/grocery/catalog) into the
// Supabase `canonical_items` table. The FILES are the source of truth; this script
// is a one-way sync. It REFUSES to seed if catalog validation finds any hard error,
// so generated/broken data can never reach production.
//
// Upserts by canonical_id (stable key), so re-running is idempotent and safe.
// Uses the service role key (bypasses RLS; the table has no client write policy).
//
// Run: node scripts/seed-catalog.ts   (Node 24+, native TS)
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { ITEMS } from '../lib/grocery/catalog/items.ts'
import { validateCatalog, summarize } from '../lib/grocery/catalog/validate.ts'

function loadEnv(): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync('.env.local', 'utf8')
        .split(/\r?\n/)
        .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
        .map((l) => {
          const i = l.indexOf('=')
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
        }),
    )
  } catch {
    return {}
  }
}

async function main() {
  // 1) Validate first — never seed an invalid catalog.
  const { errors, warnings } = summarize(validateCatalog())
  if (warnings.length) console.warn(`(${warnings.length} warning(s) — proceeding)`)
  if (errors.length) {
    console.error(`✗ Refusing to seed: ${errors.length} hard error(s) in catalog.`)
    for (const e of errors) console.error(`  [${e.code}] ${e.canonical_id ?? ''} ${e.message}`)
    process.exit(1)
  }

  const env = { ...loadEnv(), ...process.env }
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local).')
    process.exit(1)
  }

  const admin = createClient(url, key, { auth: { persistSession: false } })

  // 2) Project each concept to the table row shape.
  const rows = ITEMS.map((it) => ({
    canonical_id: it.canonical_id,
    canonical_name: it.canonical_name,
    default_display_name: it.default_display_name,
    department: it.department,
    category: it.category,
    subcategory: it.subcategory ?? null,
    shopping_category: it.shopping_category,
    concept_level: it.concept_level,
    parent_concept_id: it.parent_concept_id ?? null,
    default_unit: it.default_unit,
    allowed_units: it.allowed_units,
    storage_type: it.storage_type,
    search_priority: it.search_priority,
    catalog_tier: it.catalog_tier,
    status: it.status,
    version: it.version,
    added_in: it.added_in,
    deprecated_replaced_by: it.deprecation?.replaced_by ?? null,
    aliases: it.aliases,
    tags: it.tags,
    attributes: it.attributes,
    synced_at: new Date().toISOString(),
  }))

  // 3) Upsert by the stable key.
  const { error } = await admin.from('canonical_items').upsert(rows, { onConflict: 'canonical_id' })
  if (error) {
    console.error('✗ Seed failed:', error.message)
    process.exit(1)
  }

  // 4) Prune: remove rows whose canonical_id is no longer in the files, so the
  //    projection is an exact mirror of the source of truth. Safe because the
  //    catalog is global read-only data with no user references.
  const wanted = new Set(rows.map((r) => r.canonical_id))
  const { data: existing } = await admin.from('canonical_items').select('canonical_id')
  const orphaned = (existing ?? [])
    .map((r) => (r as { canonical_id: string }).canonical_id)
    .filter((id) => !wanted.has(id))
  if (orphaned.length) {
    const { error: delErr } = await admin.from('canonical_items').delete().in('canonical_id', orphaned)
    if (delErr) {
      console.error('✗ Prune failed:', delErr.message)
      process.exit(1)
    }
    console.log(`  pruned ${orphaned.length} retired concept id(s).`)
  }

  const { count } = await admin.from('canonical_items').select('*', { count: 'exact', head: true })
  console.log(`✓ Seeded ${rows.length} concept(s). Table now holds ${count ?? '?'} row(s).`)
  process.exit(0)
}

main()
