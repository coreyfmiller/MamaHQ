// MamaHQ Grocery — Household enrichment (Step 6).
//
// enrichProposalWithHouseholdMemory(proposal, memory) → HouseholdEnrichedProposal.
//
// PURE. Sits AFTER the global Resolver and BEFORE the Action Resolver. It fills ONLY
// the fields the user did not explicitly state, from the household's default variant
// for that concept. It NEVER overrides explicit input, and it NEVER fills when the
// household state is ambiguous (prefer "I don't know yet").
//
// Explicit-input detection is structural: a field is "explicit" when the resolver
// actually parsed it from the phrase — e.g. packageSize present ⇒ the user said a
// size; an attribute present ⇒ the user stated it. Household memory then fills the
// remaining blanks.

import type { ProposedGroceryItem, ExtractedAttribute } from '../resolver/types.ts'
import type {
  HouseholdMemory, HouseholdVariant, HouseholdEnrichedProposal, FieldProvenance, FieldSource,
} from './types.ts'
import { selectDefaultVariant } from './learning.ts'
import { normalizeLabel } from './identity.ts'

function sourceForState(v: HouseholdVariant): FieldSource {
  return v.isUserSet ? 'household_explicit' : 'household_learned'
}

/** Look up the default household variant for a proposal's concept, if any. */
function defaultVariantFor(
  proposal: ProposedGroceryItem,
  memory: HouseholdMemory,
): { variant: HouseholdVariant | null; ambiguous: boolean } {
  if (proposal.canonicalItemId) {
    const variants = memory.byCanonical.get(proposal.canonicalItemId) ?? []
    const sel = selectDefaultVariant(variants)
    return { variant: sel.variant, ambiguous: sel.ambiguous }
  }
  // Custom item: match a single custom variant by normalized label. Custom items
  // never auto-default across "vaguely similar" names — exact normalized key only.
  const key = `custom:${normalizeLabel(proposal.displayName)}`
  const v = memory.customByKey.get(key) ?? null
  // A custom variant only fills when it's an explicit user preference (we don't
  // silently reshape a typed custom item from passive history).
  return { variant: v && v.isUserSet ? v : null, ambiguous: false }
}

export function enrichProposalWithHouseholdMemory(
  proposal: ProposedGroceryItem,
  memory: HouseholdMemory | null | undefined,
): HouseholdEnrichedProposal {
  const provenance: FieldProvenance = {
    packageSize: proposal.quantity.size ? 'explicit' : 'none',
    packageType: proposal.quantity.packaged && proposal.quantity.unit ? 'explicit' : 'none',
    attributes: proposal.extractedAttributes.length > 0 ? 'explicit' : 'none',
    brand: 'none',
    store: 'none',
  }

  // No memory, ambiguous concepts, or items needing review → pass through untouched.
  if (!memory || proposal.ambiguous || proposal.invalidStructure) {
    return { proposal, provenance, appliedVariant: null, enriched: false, ambiguousHousehold: false, reason: 'no enrichment (no memory or proposal needs review)' }
  }

  const { variant, ambiguous } = defaultVariantFor(proposal, memory)
  if (!variant) {
    return {
      proposal, provenance, appliedVariant: null, enriched: false,
      ambiguousHousehold: ambiguous,
      reason: ambiguous ? 'household has multiple established variants — not filling' : 'no household default for this concept',
    }
  }

  // Clone the proposal so we never mutate the caller's object / lose provenance.
  const next: ProposedGroceryItem = {
    ...proposal,
    quantity: { ...proposal.quantity },
    extractedAttributes: [...proposal.extractedAttributes],
  }
  let enriched = false
  const src = sourceForState(variant)

  // 1) Package size — fill only if the user gave none.
  if (!next.quantity.size && variant.packageSize) {
    next.quantity.size = { value: variant.packageSize.value, unit: variant.packageSize.unit }
    provenance.packageSize = src
    enriched = true
  }

  // 2) Package type — fill only if the user gave none and didn't state a package unit.
  const userStatedPackage = next.quantity.packaged && next.quantity.unit
  if (!userStatedPackage && variant.packageType) {
    // Represent household package type via the parsed-quantity contract.
    next.quantity.packaged = true
    next.quantity.unit = variant.packageType
    provenance.packageType = src
    enriched = true
  }

  // 3) Attributes — fill each attribute the user did NOT state. Explicit values for
  //    the same attribute_id are NEVER overwritten (e.g. user "1%" keeps 1% even if
  //    household usual is 2%).
  const explicitAttrIds = new Set(next.extractedAttributes.map((a) => a.attribute_id))
  const filledAttrs: ExtractedAttribute[] = []
  for (const a of variant.resolvedAttributes ?? []) {
    if (!explicitAttrIds.has(a.attribute_id)) {
      filledAttrs.push({ attribute_id: a.attribute_id, value: a.value })
    }
  }
  if (filledAttrs.length > 0) {
    next.extractedAttributes = [...next.extractedAttributes, ...filledAttrs]
    // attributes provenance: 'explicit' if the user stated any; else the fill source.
    provenance.attributes = explicitAttrIds.size > 0 ? 'explicit' : src
    enriched = true
  }

  return {
    proposal: next,
    provenance,
    appliedVariant: variant,
    enriched,
    ambiguousHousehold: false,
    reason: enriched ? `filled blanks from ${variant.isUserSet ? 'your usual' : 'household history'}` : 'household default matched but nothing to fill',
  }
}
