// MamaHQ Grocery — Action Resolver (Step 5B).
//
// resolveGroceryAction(proposal, activeItems, ctx?) → ValidatedGroceryAction.
// Decides what should happen to the LIST. Pure + deterministic + no DB. A separate
// executor performs the mutation only AFTER this returns.
//
// Policy (documented in docs/GROCERY_ACTION_RESOLUTION.md):
//  * ambiguous proposal            → REQUIRES_CONFIRMATION (never auto-mutate)
//  * invalid structure (bad unit)  → REQUIRES_CONFIRMATION
//  * custom (canonical-null):
//      - exact normalized-text dup → INCREMENT_EXISTING
//      - otherwise                 → ADD_CUSTOM
//  * matched concept:
//      - exact identity dup        → INCREMENT_EXISTING (ADD semantics)
//      - attr/package/modifier conflict → ADD_SEPARATE (never silent merge)
//      - no comparable item        → ADD_NEW
// Quantity: ADD semantics — incrementBy = the proposal's stated quantity, or the
// operational default 1 when unspecified. resultingQuantity = existing + incrementBy.

import type { ProposedGroceryItem } from '../resolver/types.ts'
import type { ActiveGroceryItem, ValidatedGroceryAction, ExecutionContext } from './types.ts'
import { classifyDuplicate } from './duplicates.ts'

function newActionId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

/** The count to ADD for this proposal (never the size spec; that's package detail). */
function incomingCount(p: ProposedGroceryItem): number {
  // Package/weight/volume MEASURE quantities describe the item's size, not "how
  // many to add"; unless a count was clearly the leading number. We treat a bare
  // measure like "1 kg" as a single line item (increment by 1), and a count like
  // "2" / "2 cans" / "2 dozen" as that many.
  const q = p.quantity
  if (q.unitKind === 'weight' || q.unitKind === 'volume') return 1
  return q.value > 0 ? q.value : 1
}

export function resolveGroceryAction(
  proposal: ProposedGroceryItem,
  activeItems: ActiveGroceryItem[],
  _ctx: ExecutionContext = {},
): ValidatedGroceryAction {
  const clientActionId = newActionId()
  const base = { proposal, confidence: proposal.confidence, clientActionId }

  // 1) Ambiguous or structurally invalid → confirm, never auto-mutate.
  if (proposal.ambiguous) {
    const choices = proposal.candidates.slice(0, 3).map((c) => ({
      kind: 'pick_candidate' as const,
      label: c.displayName,
      canonicalItemId: c.canonicalId,
    }))
    return {
      ...base, type: 'REQUIRES_CONFIRMATION', requiresConfirmation: true,
      confirmationChoices: [...choices, { kind: 'add_as_typed', label: `Add "${proposal.displayName}" as typed` }],
      reason: 'ambiguous proposal — user must choose',
    }
  }
  if (proposal.invalidStructure) {
    return {
      ...base, type: 'REQUIRES_CONFIRMATION', requiresConfirmation: true,
      confirmationChoices: [
        { kind: 'add_as_typed', label: `Add "${proposal.rawPhrase.trim()}" as a note` },
      ],
      reason: 'stated unit conflicts with the concept — confirm before storing',
    }
  }

  // 2) Duplicate classification against the ACTIVE list.
  const dup = classifyDuplicate(proposal, activeItems)

  if (dup.kind === 'exact' && dup.item) {
    const incrementBy = incomingCount(proposal)
    return {
      ...base, type: 'INCREMENT_EXISTING', requiresConfirmation: false,
      targetItemId: dup.item.id, incrementBy, resultingQuantity: dup.item.quantity + incrementBy,
      reason: proposal.canonicalItemId
        ? 'same canonical identity and no conflicting detail'
        : 'same custom item already on the list',
    }
  }

  if (dup.kind === 'attribute_conflict' || dup.kind === 'package_conflict' || dup.kind === 'modifier_conflict') {
    return {
      ...base, type: 'ADD_SEPARATE', requiresConfirmation: false,
      reason: `same concept but ${dup.kind.replace('_', ' ')} — kept separate to preserve the distinction`,
    }
  }

  // 3) No comparable active item.
  if (proposal.unmatched) {
    return { ...base, type: 'ADD_CUSTOM', requiresConfirmation: false, reason: 'custom item, not on the list' }
  }
  return { ...base, type: 'ADD_NEW', requiresConfirmation: false, reason: 'matched concept, not on the list' }
}
