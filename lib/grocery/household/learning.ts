// MamaHQ Grocery — Household learning/derivation (Step 6).
//
// Deterministic, conservative. Mirrors the SQL derivation so the client and the DB
// agree on what "established" and "the default variant" mean. NO ML / embeddings /
// scoring infrastructure.
//
// Evidence tiers by consistent observation count:
//   0            → (not yet a variant)
//   1            → observed
//   2            → emerging
//   3+           → established
//   explicit     → user_set (strongest; does not need 3 buys)
//
// Default selection for a canonical concept (no fake certainty):
//   * a user_set variant is the default;
//   * else if exactly ONE established (>=3) variant exists → it is the default;
//   * else (zero established, OR >=2 established and none explicit) → NO default
//     (ambiguity preserved). Recency is only a tie-breaker we intentionally DECLINE
//     to use to invent a default among multiple established variants.

import type { HouseholdVariant, EvidenceState } from './types.ts'

export const ESTABLISHED_THRESHOLD = 3
export const EMERGING_THRESHOLD = 2

export function evidenceStateFor(count: number, userSet: boolean): EvidenceState {
  if (userSet) return 'user_set'
  if (count >= ESTABLISHED_THRESHOLD) return 'established'
  if (count === EMERGING_THRESHOLD) return 'emerging'
  return 'observed'
}

export interface DefaultSelection {
  /** The chosen default variant, or null when the household state is ambiguous or
   *  has no established/explicit preference yet. */
  variant: HouseholdVariant | null
  ambiguous: boolean
  reason: string
}

/** Choose the default/usual variant among a concept's variants, conservatively. */
export function selectDefaultVariant(variants: HouseholdVariant[]): DefaultSelection {
  if (variants.length === 0) return { variant: null, ambiguous: false, reason: 'no household variants' }

  const userSet = variants.filter((v) => v.isUserSet)
  if (userSet.length >= 1) {
    // Only one user_set is allowed by the DB; if somehow more, most-recent wins.
    const chosen = userSet.slice().sort(byRecencyDesc)[0]
    return { variant: chosen, ambiguous: false, reason: 'explicit household preference (user_set)' }
  }

  const established = variants.filter((v) => v.observationCount >= ESTABLISHED_THRESHOLD)
  if (established.length === 1) {
    return { variant: established[0], ambiguous: false, reason: 'single established household variant' }
  }
  if (established.length >= 2) {
    return { variant: null, ambiguous: true, reason: 'multiple established variants and none explicit — ambiguous' }
  }
  return { variant: null, ambiguous: false, reason: 'no established household variant yet' }
}

function byRecencyDesc(a: HouseholdVariant, b: HouseholdVariant): number {
  const ta = a.lastObservedAt ? Date.parse(a.lastObservedAt) : 0
  const tb = b.lastObservedAt ? Date.parse(b.lastObservedAt) : 0
  return tb - ta
}
