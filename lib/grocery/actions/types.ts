// MamaHQ Grocery — Action Resolution contracts (Step 5B).
//
// The Action Resolver answers "what should happen to the LIST?" given a resolved
// proposal + the current ACTIVE list. It produces a ValidatedGroceryAction; a
// separate executor performs the mutation. This is the seam manual entry, and
// (later) Tell MamaHQ / voice / AI all converge on.

import type { ProposedGroceryItem, ExtractedAttribute, ParsedQuantity } from '../resolver/types.ts'

export type GroceryActionType =
  | 'ADD_NEW' // matched concept, nothing comparable on the list
  | 'ADD_CUSTOM' // canonical-null custom item, not already on the list
  | 'INCREMENT_EXISTING' // same identity already active → bump quantity
  | 'ADD_SEPARATE' // same concept but a meaningful conflict (attr/package/modifier)
  | 'REQUIRES_CONFIRMATION' // ambiguous or structurally invalid → ask, never auto-mutate

/** A minimal view of an active grocery row the resolver needs. */
export interface ActiveGroceryItem {
  id: string
  status: 'active' | 'completed'
  canonicalItemId: string | null
  displayName: string
  quantity: number
  /** Concept-specific attributes stored on the item (snapshot). */
  attributes: ExtractedAttribute[]
  /** Package size snapshot, e.g. { value: 4, unit: 'L' } or null. */
  packageSize?: { value: number; unit: string } | null
  /** Package type / measure unit, e.g. 'can' | 'bag' | 'kg' or null. */
  packageType?: string | null
  /** Unmatched modifiers the user typed (e.g. ["natrel"]). */
  unmatchedModifiers?: string[]
}

export interface ExecutionContext {
  familyId?: string | null
  actorPersonId?: string | null
  /** Provenance for the item. Resolver use does NOT imply AI. */
  source?: string
}

/** A confirmation choice offered to the user (compact inline UI). */
export interface ConfirmationChoice {
  /** Machine label for the branch the UI should take if picked. */
  kind: 'pick_candidate' | 'add_separate' | 'add_as_typed'
  label: string
  /** For pick_candidate: the canonical id to resolve to. */
  canonicalItemId?: string
}

export interface ValidatedGroceryAction {
  type: GroceryActionType
  proposal: ProposedGroceryItem

  /** For INCREMENT_EXISTING: the row to update. */
  targetItemId?: string
  /** For INCREMENT_EXISTING: how much to add (ADD semantics). */
  incrementBy?: number
  /** For INCREMENT_EXISTING: existing + incrementBy (for optimistic UI/feedback). */
  resultingQuantity?: number

  /** Human/debug explanation of why this action was chosen. */
  reason: string
  confidence: ProposedGroceryItem['confidence']
  requiresConfirmation: boolean
  confirmationChoices?: ConfirmationChoice[]

  /** Stable per-attempt id so a retried execution can't double-apply. */
  clientActionId: string
}

/** The detail an executor writes onto a new grocery row (operational snapshot). */
export interface NewItemDetail {
  displayName: string
  canonicalItemId: string | null
  quantity: number
  quantityUnit?: string
  attributes: ExtractedAttribute[]
  packageSize?: { value: number; unit: string } | null
  packageType?: string | null
  unmatchedModifiers: string[]
  source: string
  clientActionId: string
}

export type { ProposedGroceryItem, ExtractedAttribute, ParsedQuantity }
