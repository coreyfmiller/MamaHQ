// MamaHQ Grocery Search — orchestration.
//
//   raw query → normalize → scan index (score each entry) → sort → limit → results
//
// Pure + deterministic + local. One result per canonical concept (an entry can
// match via name/display/multiple aliases; we keep only its strongest match, so no
// duplicate rows). Empty query returns []. Default limit 8, hard-capped at 25.

import type { SearchOptions, SearchResult, SearchResultWithExplain } from './types.ts'
import { defaultIndex, type SearchIndex } from './index.ts'
import { normalize, tokenize } from './normalize.ts'
import { scoreEntry, type MatchOutcome } from './rank.ts'

const DEFAULT_LIMIT = 8
const MAX_LIMIT = 25

export function search(query: string, options: SearchOptions = {}, index: SearchIndex = defaultIndex()): SearchResultWithExplain[] {
  const q = normalize(query)
  if (!q) return [] // §23: empty query never dumps the catalog
  const limit = Math.min(Math.max(1, options.limit ?? DEFAULT_LIMIT), MAX_LIMIT)
  const qTokens = tokenize(q)

  type Scored = { entryIdx: number; outcome: MatchOutcome }
  const scored: Scored[] = []
  for (let i = 0; i < index.entries.length; i++) {
    const outcome = scoreEntry(q, qTokens, index.entries[i])
    if (outcome) scored.push({ entryIdx: i, outcome })
  }

  // Deterministic sort: score desc, then canonicalId asc for a stable total order.
  scored.sort((a, b) => {
    if (b.outcome.finalScore !== a.outcome.finalScore) return b.outcome.finalScore - a.outcome.finalScore
    return index.entries[a.entryIdx].canonicalId < index.entries[b.entryIdx].canonicalId ? -1 : 1
  })

  const top = scored.slice(0, limit)
  return top.map(({ entryIdx, outcome }) => {
    const it = index.entries[entryIdx].item
    const result: SearchResult = {
      canonicalId: it.canonical_id,
      canonicalName: it.canonical_name,
      displayName: it.default_display_name,
      department: it.department,
      category: it.category,
      subcategory: it.subcategory,
      shoppingCategory: it.shopping_category,
      score: Math.round(outcome.finalScore),
      matchType: outcome.matchClass,
      matchedText: q,
      matchedAlias: outcome.matchedAlias,
      attributes: it.attributes,
      defaultUnit: it.default_unit,
      allowedUnits: it.allowed_units,
    }
    if (options.debug) {
      return {
        ...result,
        explain: {
          normalizedQuery: q,
          matchClass: outcome.matchClass,
          matchedField: outcome.matchedField,
          matchedAlias: outcome.matchedAlias,
          baseScore: outcome.baseScore,
          tieBreakers: outcome.tieBreakers,
          fuzzyDistance: outcome.fuzzyDistance,
          finalScore: outcome.finalScore,
        },
      }
    }
    return result
  })
}

/** Convenience for the UI: results without the debug field. */
export function searchGrocery(query: string, limit = DEFAULT_LIMIT): SearchResult[] {
  return search(query, { limit })
}
