// MamaHQ Grocery — Search benchmark (dev only).
//
// Measures index build time and per-query latency (avg + p95) against the real
// 417-concept catalog, then against synthetic clones (~2.5k / 5k / 10k) held ONLY
// in benchmark memory to show the architecture scales. Does not touch production
// data. Node 24 native TS.
//
//   node scripts/bench-grocery-search.ts   (or: npm run bench:grocery-search)

import { buildSearchIndex } from '../lib/grocery/search/index.ts'
import { search } from '../lib/grocery/search/search.ts'
import { ACTIVE_ITEMS } from '../lib/grocery/catalog/index.ts'
import type { CanonicalItem } from '../lib/grocery/catalog/types.ts'

const QUERIES = [
  'mil', 'milk', 'ban', 'banana', 'ground b', 'hamburger', 'chicken br', 'scallion',
  'icing sugar', 'pop', 'coriander seed', 'ham', 'pear', 'toilet paper', 'bananna',
  'mozarella', 'baby w', 'dish det', 'whole whe', 'eggs', 'tomatoes', 'cheddar',
  'brocoli', 'diappers', 'strawbery', 'garbanzo', 'zzzzzzzzz',
]

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

function clone(items: readonly CanonicalItem[], targetCount: number): CanonicalItem[] {
  const out: CanonicalItem[] = []
  let n = 0
  while (out.length < targetCount) {
    for (const it of items) {
      if (out.length >= targetCount) break
      // Unique ids/names so the index behaves like a larger distinct catalog.
      out.push({ ...it, canonical_id: `${it.canonical_id}.c${n}`, canonical_name: `${it.canonical_name} ${n}`, default_display_name: `${it.default_display_name} ${n}` })
    }
    n++
  }
  return out
}

function measure(label: string, items: readonly CanonicalItem[]) {
  const t0 = performance.now()
  const index = buildSearchIndex(items)
  const buildMs = performance.now() - t0

  // Warm up.
  for (const q of QUERIES) search(q, { limit: 8 }, index)

  const timings: number[] = []
  const ITER = 40
  for (let i = 0; i < ITER; i++) {
    for (const q of QUERIES) {
      const s = performance.now()
      search(q, { limit: 8 }, index)
      timings.push(performance.now() - s)
    }
  }
  timings.sort((a, b) => a - b)
  const avg = timings.reduce((a, b) => a + b, 0) / timings.length
  console.log(
    `${label.padEnd(22)} entries=${String(index.entries.length).padStart(6)}  build=${buildMs.toFixed(1).padStart(7)}ms  ` +
      `avg=${avg.toFixed(3).padStart(7)}ms  p95=${percentile(timings, 95).toFixed(3).padStart(7)}ms  ` +
      `(n=${timings.length})`,
  )
}

console.log('MamaHQ Grocery Search — benchmark\n')
measure('real (417)', ACTIVE_ITEMS)
measure('synthetic ~2,500', clone(ACTIVE_ITEMS, 2500))
measure('synthetic ~5,000', clone(ACTIVE_ITEMS, 5000))
measure('synthetic ~10,000', clone(ACTIVE_ITEMS, 10000))
process.exit(0)
