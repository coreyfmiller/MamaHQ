// MamaHQ Grocery Resolver — confidence + ambiguity.
//
// Turns the search outcome into a confidence band and an ambiguity flag. Purely a
// function of the deterministic search results; no thresholds tuned to a model.

import type { SearchResult } from '../search/types.ts'
import type { Confidence } from './types.ts'

// Known globally-ambiguous aliases (a term legitimately owned by >1 concept). These
// are surfaced by the catalog/search tests; when the winning match is via one of
// these, the proposal is flagged for review.
export const AMBIGUOUS_TERMS = new Set(['turnip', 'gummies'])

/** How close the runner-up is counts as "ambiguous". Scores are large banded ints;
 *  within the SAME match class the gap is small, so a near-tie means two plausible
 *  concepts. */
// A near-tie within the SAME class. Kept tight: real ambiguity in this catalog is
// almost always a shared alias (handled explicitly above), not two independent
// concepts scoring within a few points. A wide gap here produced false ambiguity
// (e.g. "milks" → Milk vs Almond Milk, both token_prefix, ~20 pts apart).
const AMBIGUITY_GAP = 40

export interface ConfidenceOutcome {
  confidence: Confidence
  ambiguous: boolean
  ambiguousAlias?: string
}

export function assessConfidence(results: SearchResult[], normalizedConceptText: string): ConfidenceOutcome {
  if (results.length === 0) return { confidence: 'low', ambiguous: false }

  const top = results[0]
  const runner = results[1]

  // Ambiguous if the winning match is a known-ambiguous term, or the runner-up is a
  // near-tie in the SAME match class.
  let ambiguous = false
  let ambiguousAlias: string | undefined
  if (top.matchedAlias && AMBIGUOUS_TERMS.has(top.matchedAlias.toLowerCase())) {
    ambiguous = true
    ambiguousAlias = top.matchedAlias
  } else if (AMBIGUOUS_TERMS.has(normalizedConceptText)) {
    ambiguous = true
    ambiguousAlias = normalizedConceptText
  }
  // NOTE: we deliberately do NOT flag ambiguity purely from a near score gap. In
  // this catalog a near-tie is almost always a stronger concept just edging a weaker
  // sibling (e.g. "milks" → Milk over Almond Milk via priority), which is a correct
  // pick, not an ambiguity. Real ambiguity = a shared alias, handled above. `runner`
  // and AMBIGUITY_GAP are retained for a future context-aware tie-breaker.
  void runner
  void AMBIGUITY_GAP

  // Confidence from the winning match class.
  let confidence: Confidence
  switch (top.matchType) {
    case 'exact_canonical':
    case 'exact_display':
    case 'exact_alias':
    case 'prefix_canonical':
    case 'prefix_display':
    case 'prefix_alias':
      confidence = 'high'
      break
    case 'token_prefix':
    case 'substring':
      confidence = 'medium'
      break
    case 'fuzzy':
      confidence = 'medium'
      break
    default:
      confidence = 'low'
  }
  // Ambiguity caps confidence at medium (we're not sure WHICH concept).
  if (ambiguous && confidence === 'high') confidence = 'medium'

  return { confidence, ambiguous, ambiguousAlias }
}
