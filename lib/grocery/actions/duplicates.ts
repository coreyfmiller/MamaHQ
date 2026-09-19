// MamaHQ Grocery — duplicate classification (Step 5B).
//
// Compares a resolved proposal against the ACTIVE list only (never completed rows,
// never purchase history). Returns the strongest relationship found. Pure + no DB.

import type { ProposedGroceryItem } from '../resolver/types.ts'
import type { ActiveGroceryItem } from './types.ts'
import { proposalIdentity, activeIdentity, identitySignature, sameConcept, type IdentityView } from './identity.ts'

export type DuplicateKind =
  | 'exact' // same identity signature → the same operational item
  | 'attribute_conflict' // same concept, different meaningful attributes
  | 'package_conflict' // same concept, different package size/type
  | 'modifier_conflict' // same concept, different unmatched modifiers (e.g. Natrel)
  | 'none'

export interface DuplicateFinding {
  kind: DuplicateKind
  /** The matched active item, when kind !== 'none'. */
  item?: ActiveGroceryItem
}

function attrsDiffer(a: IdentityView, b: IdentityView): boolean {
  const key = (v: IdentityView) => v.attributes.map((x) => `${x.attribute_id}=${String(x.value)}`).sort().join('|')
  return key(a) !== key(b)
}
function packageDiffers(a: IdentityView, b: IdentityView): boolean {
  const size = (v: IdentityView) => (v.packageSize ? `${v.packageSize.value}${v.packageSize.unit}` : '')
  const type = (v: IdentityView) => v.packageType ?? ''
  return size(a) !== size(b) || type(a) !== type(b)
}
function modifiersDiffer(a: IdentityView, b: IdentityView): boolean {
  const key = (v: IdentityView) => [...v.unmatchedModifiers].map((m) => m.toLowerCase()).sort().join('|')
  return key(a) !== key(b)
}

/** Find the strongest duplicate relationship of `proposal` against active items. */
export function classifyDuplicate(proposal: ProposedGroceryItem, active: ActiveGroceryItem[]): DuplicateFinding {
  const pv = proposalIdentity(proposal)
  const activeOnly = active.filter((it) => it.status === 'active')

  // Custom (canonical-null): only normalized-label equality counts as duplicate.
  if (!pv.canonicalItemId) {
    const pSig = identitySignature(pv)
    for (const it of activeOnly) {
      if (it.canonicalItemId) continue
      if (identitySignature(activeIdentity(it)) === pSig) return { kind: 'exact', item: it }
    }
    return { kind: 'none' }
  }

  // Matched concept: look for the same concept, then rank the relationship.
  const pSig = identitySignature(pv)
  let conceptMatch: { it: ActiveGroceryItem; av: IdentityView } | null = null
  for (const it of activeOnly) {
    const av = activeIdentity(it)
    if (!sameConcept(pv, av)) continue
    if (identitySignature(av) === pSig) return { kind: 'exact', item: it } // exact wins immediately
    if (!conceptMatch) conceptMatch = { it, av } // remember first same-concept-but-different
  }

  if (conceptMatch) {
    const { it, av } = conceptMatch
    if (attrsDiffer(pv, av)) return { kind: 'attribute_conflict', item: it }
    if (packageDiffers(pv, av)) return { kind: 'package_conflict', item: it }
    if (modifiersDiffer(pv, av)) return { kind: 'modifier_conflict', item: it }
    // Same concept, no meaningful difference we can name → treat as exact.
    return { kind: 'exact', item: it }
  }

  return { kind: 'none' }
}
