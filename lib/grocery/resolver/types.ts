// MamaHQ Grocery Resolver — contracts (Step 5A).
//
// The resolver UNDERSTANDS a grocery phrase and returns a structured PROPOSAL. It
// never executes anything (no DB, no household resolution, no duplicate handling —
// those are later steps). Search is the ONLY concept-candidate engine; the resolver
// does not implement a second matcher.

import type { SearchResult } from '../search/types.ts'

export type Confidence = 'high' | 'medium' | 'low'

/** A parsed quantity + unit/package understanding. All fields optional/absent when
 *  the phrase implies nothing (e.g. bare "milk" → { value: 1 }). */
export interface ParsedQuantity {
  /** Numeric count/amount, e.g. 2 (milks), 1.5 (kg), 796 (mL). Default 1 when the
   *  phrase names an item but no number. */
  value: number
  /** Canonical unit id from the catalog unit ontology (e.g. 'L','kg','can','dozen'),
   *  or undefined when no unit was stated. */
  unit?: string
  /** The unit's dimension: 'count' | 'weight' | 'volume' | 'package'. */
  unitKind?: 'count' | 'weight' | 'volume' | 'package'
  /** True when the unit is a package word (bag/can/box/…) rather than a measure. */
  packaged?: boolean
  /** For "two 4L milks": the size spec attached to each package/item, when present. */
  size?: { value: number; unit: string }
  /** The original text span the quantity/unit was parsed from (debug). */
  raw?: string
}

/** A concept-specific attribute value extracted from the phrase (only attributes the
 *  resolved concept declares are attached). */
export interface ExtractedAttribute {
  attribute_id: string
  value: string | boolean
  /** The phrase token(s) it came from. */
  matchedText: string
}

/** The structured proposal. A proposal is NEVER auto-committed. */
export interface ProposedGroceryItem {
  /** The user's original phrase, untouched. */
  rawPhrase: string
  /** What to show / store as the item's display name. For a matched concept this is
   *  the canonical display name; for a custom item it's the cleaned phrase. */
  displayName: string

  /** Resolved catalog concept id, or null for a custom (unmatched) item. */
  canonicalItemId: string | null
  canonicalName?: string
  shoppingCategory?: string

  quantity: ParsedQuantity
  extractedAttributes: ExtractedAttribute[]

  /** Ranked search candidates for the concept-candidate text (top few). Useful for
   *  a future disambiguation UI. Empty for a custom item. */
  candidates: SearchResult[]

  confidence: Confidence
  /** True when more than one candidate is plausibly the intended concept. */
  ambiguous: boolean
  /** True when a human should confirm (ambiguous, or low confidence, or a
   *  known-ambiguous alias). */
  needsReview: boolean
  /** True when no catalog concept matched → first-class custom item. */
  unmatched: boolean

  /** Development explainability. Never shown to users. */
  explain?: ResolveExplain
}

export interface ResolveExplain {
  normalizedPhrase: string
  quantityText?: string
  unitText?: string
  attributeText: string[]
  conceptCandidateText: string
  topCandidateScore?: number
  runnerUpScore?: number
  matchType?: string
  ambiguousAlias?: string
  reason: string
}

export interface ResolveOptions {
  /** Attach the explain trace. */
  debug?: boolean
  /** Max candidates to keep on the proposal (default 5). */
  maxCandidates?: number
}
