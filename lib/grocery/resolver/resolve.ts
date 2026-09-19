// MamaHQ Grocery Resolver — orchestration (Step 5A).
//
//   raw phrase → normalize → peel quantity/unit(/size) → residue tokens
//   → scan generic attribute modifiers → SEARCH (residue AND attribute-stripped
//     residue; take the stronger) → resolve concept → keep only attributes the
//     concept declares → confidence/ambiguity → ProposedGroceryItem
//
// Returns a PROPOSAL. Never executes. No DB, no household, no duplicate handling.
// Search is the ONLY concept matcher.

import type { ProposedGroceryItem, ResolveOptions } from './types.ts'
import type { SearchResult } from '../search/types.ts'
import { normalizePhrase } from './normalize.ts'
import { parseQuantity } from './quantity.ts'
import { scanAttributes, attributesForConcept, strippableIndices } from './attributes.ts'
import { assessConfidence } from './confidence.ts'
import { searchGrocery } from '../search/search.ts'
import { getCanonical } from '../catalog/index.ts'

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

// Rank of a match class for choosing between two search outcomes (higher = better).
const CLASS_RANK: Record<string, number> = {
  exact_canonical: 9, exact_display: 8, exact_alias: 7,
  prefix_canonical: 6, prefix_display: 5, prefix_alias: 4,
  token_prefix: 3, substring: 2, fuzzy: 1,
}
function betterOf(a: SearchResult[], b: SearchResult[]): SearchResult[] {
  if (a.length === 0) return b
  if (b.length === 0) return a
  const ra = CLASS_RANK[a[0].matchType] ?? 0
  const rb = CLASS_RANK[b[0].matchType] ?? 0
  if (ra !== rb) return ra >= rb ? a : b
  return a[0].score >= b[0].score ? a : b
}

export function resolveGroceryPhrase(phrase: string, options: ResolveOptions = {}): ProposedGroceryItem {
  const maxCandidates = options.maxCandidates ?? 5
  const { normalized, tokens } = normalizePhrase(phrase)

  if (tokens.length === 0) {
    return {
      rawPhrase: phrase, displayName: phrase.trim(), canonicalItemId: null,
      quantity: { value: 1 }, extractedAttributes: [], candidates: [],
      confidence: 'low', ambiguous: false, needsReview: false, unmatched: true,
      explain: options.debug ? { normalizedPhrase: normalized, attributeText: [], conceptCandidateText: '', reason: 'empty phrase' } : undefined,
    }
  }

  // 1) Peel quantity/unit/size off the front → residue tokens.
  const { quantity, rest } = parseQuantity(tokens)

  // 2) Scan generic attribute modifiers over the residue. These detectors are
  //    concept-independent (they recognize "red", "lean", "2%", "size 4",
  //    "boneless", …). We use the consumed token indices to build an
  //    attribute-stripped candidate.
  const scan = scanAttributes(rest)
  const consumed = strippableIndices(scan) // only strip PURE modifiers, never concept words
  const fullText = rest.join(' ')
  const strippedText = rest.filter((_, i) => !consumed.has(i)).join(' ')

  // 3) Search both forms; take the stronger match. Full text can win when the
  //    modifier is part of a concept name (e.g. "whole wheat bread"); stripped wins
  //    when the modifier is just an attribute (e.g. "red peppers" → "peppers").
  const resFull = fullText ? searchGrocery(fullText, maxCandidates) : []
  const resStripped = strippedText && strippedText !== fullText ? searchGrocery(strippedText, maxCandidates) : []
  const results = betterOf(resFull, resStripped)

  const conceptText = results === resStripped ? strippedText : fullText
  const conf = assessConfidence(results, conceptText)

  // 4) Unmatched → first-class custom item.
  if (results.length === 0) {
    const display = fullText ? titleCase(fullText) : phrase.trim()
    return {
      rawPhrase: phrase, displayName: display, canonicalItemId: null,
      quantity, extractedAttributes: [], candidates: [],
      confidence: 'low', ambiguous: false, needsReview: false, unmatched: true,
      explain: options.debug ? { normalizedPhrase: normalized, quantityText: quantity.raw, conceptCandidateText: fullText, attributeText: [], reason: 'no catalog match → custom item' } : undefined,
    }
  }

  // 5) Matched → resolve concept + keep only attributes the concept declares.
  const top = results[0]
  const concept = getCanonical(top.canonicalId)
  const declaredAttrIds = concept ? concept.attributes.map((a) => a.attribute_id) : []
  const { attributes } = attributesForConcept(scan, declaredAttrIds)

  const needsReview = conf.ambiguous || conf.confidence === 'low'

  return {
    rawPhrase: phrase,
    displayName: top.displayName,
    canonicalItemId: top.canonicalId,
    canonicalName: top.canonicalName,
    shoppingCategory: top.shoppingCategory,
    quantity,
    extractedAttributes: attributes,
    candidates: results.slice(0, maxCandidates),
    confidence: conf.confidence,
    ambiguous: conf.ambiguous,
    needsReview,
    unmatched: false,
    explain: options.debug
      ? {
          normalizedPhrase: normalized,
          quantityText: quantity.raw,
          unitText: quantity.unit,
          attributeText: attributes.map((a) => `${a.attribute_id}=${String(a.value)}`),
          conceptCandidateText: conceptText,
          topCandidateScore: top.score,
          runnerUpScore: results[1]?.score,
          matchType: top.matchType,
          ambiguousAlias: conf.ambiguousAlias,
          reason: 'resolved to catalog concept',
        }
      : undefined,
  }
}
