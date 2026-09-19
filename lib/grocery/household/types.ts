// MamaHQ Grocery — Household Memory contracts (Step 6).
//
// Household memory is a DISTINCT layer between the global Resolver and the Action
// Resolver. It answers a different question than either:
//
//   Global Catalog   → "what is this thing generally?"
//   Global Resolver  → "what did the user explicitly ask for?"
//   Household Memory  → "what does THIS household usually mean when info is omitted?"
//   Action Resolver  → "given the enriched proposal + list, what should happen?"
//
// CENTRAL RULE: household memory FILLS what the user did not say; it NEVER overrides
// explicit input. Precedence, field by field:
//   explicit current input  >  explicit household preference (user_set)
//                           >  established learned memory  >  global/default
//
// This module is PURE: no DB, no React, no AI. The store loads a family's household
// memory (materialized `household_items`) and passes it in.

import type { ExtractedAttribute } from '../resolver/types.ts'

/** Conservative evidence tiers (mirrors the SQL household_evidence_state). */
export type EvidenceState = 'observed' | 'emerging' | 'established' | 'user_set'

/** One household variant of a canonical (or custom) concept — CURRENT knowledge. */
export interface HouseholdVariant {
  id: string
  canonicalItemId: string | null
  /** Deterministic identity signature (see identity.ts). */
  variantKey: string
  displayName: string
  brand?: string | null
  variant?: string | null
  packageSize?: { value: number; unit: string } | null
  packageUnit?: string | null
  packageType?: string | null
  resolvedAttributes: ExtractedAttribute[]
  store?: string | null
  evidenceState: EvidenceState
  observationCount: number
  isUserSet: boolean
  isDefault: boolean
  lastObservedAt?: string | null
}

/** A family's materialized household memory, indexed for fast lookup. */
export interface HouseholdMemory {
  /** All variants, grouped by canonical concept id. */
  byCanonical: Map<string, HouseholdVariant[]>
  /** Custom variants (canonicalItemId null), keyed by normalized variant key. */
  customByKey: Map<string, HouseholdVariant>
}

/** Where a field's final value came from, for provenance/explainability. */
export type FieldSource = 'explicit' | 'household_explicit' | 'household_learned' | 'none'

export interface FieldProvenance {
  packageSize: FieldSource
  packageType: FieldSource
  attributes: FieldSource
  brand: FieldSource
  store: FieldSource
}

/** The output of enrichment. Carries the (possibly) filled values PLUS provenance,
 *  so nothing is silently mutated and the Action layer / UI can explain choices. */
export interface HouseholdEnrichedProposal {
  /** The proposal to feed the existing Action Resolver — same shape as the
   *  resolver's ProposedGroceryItem, with blanks possibly filled from memory. */
  proposal: import('../resolver/types.ts').ProposedGroceryItem
  /** Per-field origin of the FINAL values. */
  provenance: FieldProvenance
  /** The household variant that supplied filled values, if any. */
  appliedVariant?: HouseholdVariant | null
  /** True when household memory contributed at least one filled field. */
  enriched: boolean
  /** True when the household had multiple plausible defaults and we declined to
   *  fill (ambiguity preserved — "I don't know yet" over a wrong guess). */
  ambiguousHousehold: boolean
  /** Human/debug explanation. Never required by callers. */
  reason: string
}
