// MamaHQ Grocery Search — deterministic matching + scoring.
//
// Given a normalized query and one index entry, decide the strongest match class
// and a numeric score. Higher score = better. The class boundaries are wide bands
// so a stronger class ALWAYS beats a weaker one (exact > prefix > … > fuzzy);
// tie-breakers only reorder within a band.

import type { MatchClass } from './types.ts'
import type { SearchIndexEntry } from './index.ts'
import { tokenize, tokenForms } from './normalize.ts'

// Base score per class — separated by large gaps so classes never cross.
const CLASS_BASE: Record<MatchClass, number> = {
  exact_canonical: 10000,
  exact_display: 9800,
  exact_alias: 9500,
  prefix_canonical: 8000,
  prefix_display: 7800,
  prefix_alias: 7500,
  token_prefix: 6000,
  substring: 4000,
  fuzzy: 2000,
}

// Fuzzy is deliberately below everything textual, and gated hard by query length.
const FUZZY_MIN_QUERY_LEN = 5 // below this, no fuzzy at all (protects ham/yam/jam)
function maxFuzzyDistance(qlen: number): number {
  if (qlen < FUZZY_MIN_QUERY_LEN) return 0
  if (qlen <= 7) return 1
  return 2 // longer queries tolerate 2 edits (mozarella→mozzarella, diappers→diapers)
}

/** Damerau-Levenshtein (optimal string alignment) with an early-exit cap. */
export function damerau(a: string, b: string, cap: number): number {
  const al = a.length, bl = b.length
  if (Math.abs(al - bl) > cap) return cap + 1
  const prev2 = new Array<number>(bl + 1)
  let prev = new Array<number>(bl + 1)
  let cur = new Array<number>(bl + 1)
  for (let j = 0; j <= bl; j++) prev[j] = j
  for (let i = 1; i <= al; i++) {
    cur[0] = i
    let rowMin = cur[0]
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1)
      }
      cur[j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > cap) return cap + 1
    for (let j = 0; j <= bl; j++) prev2[j] = prev[j]
    const tmp = prev
    prev = cur
    cur = tmp
  }
  return prev[bl]
}

export interface MatchOutcome {
  matchClass: MatchClass
  matchedField: 'canonical_name' | 'display_name' | 'alias' | 'tokens'
  matchedAlias?: string
  baseScore: number
  tieBreakers: Record<string, number>
  fuzzyDistance?: number
  finalScore: number
}

/**
 * Best match of `q` (normalized) against one entry, or null. `qTokens` is the
 * pre-tokenized query (passed in to avoid recomputing per entry).
 */
export function scoreEntry(q: string, qTokens: string[], entry: SearchIndexEntry): MatchOutcome | null {
  const targets: { field: MatchOutcome['matchedField']; text: string; alias?: string }[] = [
    { field: 'canonical_name', text: entry.normCanonical },
    { field: 'display_name', text: entry.normDisplay },
    ...entry.aliases.map((a) => ({ field: 'alias' as const, text: a.norm, alias: a.raw })),
  ]

  let best: MatchOutcome | null = null
  const consider = (o: MatchOutcome) => {
    if (!best || o.finalScore > best.finalScore) best = o
  }

  // Tie-breakers shared across classes. Small, bounded contributions so they never
  // cross a class band. Priority is a TIE-BREAKER only (per spec §28).
  const priority = entry.item.search_priority // 0..100
  const tierBonus = entry.item.catalog_tier === 'A' ? 2 : entry.item.catalog_tier === 'B' ? 1 : 0
  const tb = (extra: Record<string, number> = {}) => ({ priority, tier: tierBonus, ...extra })
  const tbScore = (extra: Record<string, number> = {}) => priority * 0.5 + tierBonus + Object.values(extra).reduce((a, b) => a + b, 0)

  // ---- Exact + prefix over the primary fields ----
  for (const t of targets) {
    if (!t.text) continue
    if (q === t.text) {
      const cls: MatchClass = t.field === 'canonical_name' ? 'exact_canonical' : t.field === 'display_name' ? 'exact_display' : 'exact_alias'
      const extra = tb()
      consider({ matchClass: cls, matchedField: t.field, matchedAlias: t.alias, baseScore: CLASS_BASE[cls], tieBreakers: extra, finalScore: CLASS_BASE[cls] + tbScore() })
      continue
    }
    if (t.text.startsWith(q)) {
      const cls: MatchClass = t.field === 'canonical_name' ? 'prefix_canonical' : t.field === 'display_name' ? 'prefix_display' : 'prefix_alias'
      // Shorter completion distance ranks higher within the band.
      const completion = t.text.length - q.length
      const extra = { completion: -completion }
      consider({ matchClass: cls, matchedField: t.field, matchedAlias: t.alias, baseScore: CLASS_BASE[cls], tieBreakers: tb(extra), finalScore: CLASS_BASE[cls] + tbScore(extra) })
    }
  }

  // ---- Token-prefix (multi-word, order-independent) ----
  // Every query token must be a prefix of some DISTINCT entry token (or its
  // singular form). Rewards natural order + shorter completion.
  if (qTokens.length > 0 && (!best || (best as MatchOutcome).matchClass === 'substring' || (best as MatchOutcome).matchClass === 'fuzzy')) {
    const tokenMatch = matchTokens(qTokens, entry)
    if (tokenMatch) {
      const extra = { order: tokenMatch.inOrder ? 5 : 0, completion: -tokenMatch.completion / 10 }
      consider({ matchClass: 'token_prefix', matchedField: 'tokens', baseScore: CLASS_BASE.token_prefix, tieBreakers: tb(extra), finalScore: CLASS_BASE.token_prefix + tbScore(extra) })
    }
  }

  // ---- Substring (whole query appears inside a target) ----
  if (!best || (best as MatchOutcome).matchClass === 'fuzzy') {
    for (const t of targets) {
      if (t.text && t.text.includes(q)) {
        const extra = { position: -(t.text.indexOf(q)) / 100 }
        consider({ matchClass: 'substring', matchedField: t.field, matchedAlias: t.alias, baseScore: CLASS_BASE.substring, tieBreakers: tb(extra), finalScore: CLASS_BASE.substring + tbScore(extra) })
        break
      }
    }
  }

  // ---- Conservative fuzzy (only if nothing textual matched, and query long enough) ----
  // Single-token queries fuzzy-match against comparable-length full targets AND
  // against individual entry tokens (so "mozarella" reaches the "mozzarella" token
  // of "Mozzarella Cheese"). Multi-token queries only fuzzy-match full targets.
  if (!best) {
    const cap = maxFuzzyDistance(q.length)
    if (cap > 0) {
      let bestDist = cap + 1
      let bestField: MatchOutcome['matchedField'] = 'canonical_name'
      let bestAlias: string | undefined

      const tryTarget = (text: string, field: MatchOutcome['matchedField'], alias?: string) => {
        if (!text) return
        if (Math.abs(text.length - q.length) > cap) return
        const d = damerau(q, text, cap)
        if (d < bestDist) {
          bestDist = d
          bestField = field
          bestAlias = alias
        }
      }

      for (const t of targets) tryTarget(t.text, t.field, t.alias)

      // Single-token query: also compare to each entry token of comparable length.
      if (qTokens.length === 1) {
        for (const et of entry.tokens) tryTarget(et, 'tokens')
      }

      if (bestDist <= cap) {
        const extra = { distance: -bestDist * 100 }
        consider({ matchClass: 'fuzzy', matchedField: bestField, matchedAlias: bestAlias, baseScore: CLASS_BASE.fuzzy, tieBreakers: tb(extra), fuzzyDistance: bestDist, finalScore: CLASS_BASE.fuzzy + tbScore(extra) })
      }
    }
  }

  return best
}

interface TokenMatchInfo {
  inOrder: boolean
  completion: number
}

// Each query token must prefix a DISTINCT entry token (matched greedily). Returns
// null if any query token can't be placed.
function matchTokens(qTokens: string[], entry: SearchIndexEntry): TokenMatchInfo | null {
  const entryTokens = entry.tokenForms
  const used = new Array<boolean>(entryTokens.length).fill(false)
  let completion = 0
  const matchedIdx: number[] = []
  for (const rawQt of qTokens) {
    // consider the query token and its singular form as acceptable prefixes
    const forms = tokenForms(rawQt)
    let placed = -1
    for (let i = 0; i < entryTokens.length; i++) {
      if (used[i]) continue
      if (forms.some((f) => entryTokens[i].startsWith(f))) {
        placed = i
        break
      }
    }
    if (placed === -1) return null
    used[placed] = true
    matchedIdx.push(placed)
    // completion = how much of the entry token is left after the query prefix
    const shortestForm = forms.reduce((a, b) => (a.length <= b.length ? a : b))
    completion += Math.max(0, entryTokens[placed].length - shortestForm.length)
  }
  const inOrder = matchedIdx.every((v, i) => i === 0 || v > matchedIdx[i - 1])
  return { inOrder, completion }
}

// Re-export so search.ts can tokenize consistently.
export { tokenize }
