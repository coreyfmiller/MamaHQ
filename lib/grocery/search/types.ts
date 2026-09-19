// MamaHQ Grocery Search — public contracts.
//
// The result shape is designed to serve the autocomplete UI now AND the future
// Grocery Resolver / Tell MamaHQ / household ranking without change. Search is
// PURE: it never mutates catalog or app state.

import type { CanonicalItem } from '../catalog/types.ts'

// Match classes, ordered strongest → weakest. Search always knows WHY it matched.
export const MATCH_CLASSES = [
  'exact_canonical',
  'exact_display',
  'exact_alias',
  'prefix_canonical',
  'prefix_display',
  'prefix_alias',
  'token_prefix', // all query tokens are prefixes of distinct entry tokens (any order)
  'substring',
  'fuzzy',
] as const
export type MatchClass = (typeof MATCH_CLASSES)[number]

export interface SearchResult {
  canonicalId: string
  canonicalName: string
  displayName: string

  department: string
  category: string
  subcategory?: string
  shoppingCategory: string

  /** Final numeric score (higher = better). For ranking/debug; not shown to users. */
  score: number
  matchType: MatchClass
  /** The normalized query text that produced the match. */
  matchedText: string
  /** When the winning match was via an alias, the alias's original text. */
  matchedAlias?: string

  attributes: CanonicalItem['attributes']
  defaultUnit: string
  allowedUnits: string[]
}

export interface SearchOptions {
  /** Max results (default 8, hard-capped at 25). */
  limit?: number
  /** When true, attach an `explain` trace to each result. */
  debug?: boolean
}

/** Per-result explainability trace (development only; never shown in the UI). */
export interface SearchExplain {
  normalizedQuery: string
  matchClass: MatchClass
  matchedField: 'canonical_name' | 'display_name' | 'alias' | 'tokens'
  matchedAlias?: string
  baseScore: number
  tieBreakers: Record<string, number>
  fuzzyDistance?: number
  finalScore: number
}

export type SearchResultWithExplain = SearchResult & { explain?: SearchExplain }
