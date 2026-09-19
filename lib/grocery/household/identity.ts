// MamaHQ Grocery — Household variant identity (Step 6).
//
// Household variants are distinguished by the SAME structured identity Step 5B uses
// for duplicate handling, so "2% 4L milk" and "1% 2L milk" are different variants
// and insignificant metadata never forks a new one. We deliberately reuse the
// Step 5B signature shape so the TypeScript layer and the SQL RPC agree byte-for-byte
// on what a variant key looks like:
//
//   canonical → c:<id>;a:<sorted attrs>;ps:<value+unit>;pt:<type>;m:<sorted mods>
//   custom    → custom:<normalized display name>
//
// (The SQL in 0008_household_memory.sql builds the identical string server-side.)

import type { ExtractedAttribute } from '../resolver/types.ts'
import { identitySignature, normalizeLabel, type IdentityView } from '../actions/identity.ts'
import type { HouseholdVariant } from './types.ts'

export { normalizeLabel }

/** Build the canonical variant key from structured identity fields. */
export function variantKeyFromIdentity(v: IdentityView): string {
  // identitySignature already encodes exactly c:…;a:…;ps:…;pt:…;m:… / custom:…
  return identitySignature(v)
}

/** Build an IdentityView from a HouseholdVariant (for comparison/keying). */
export function variantIdentityView(hv: HouseholdVariant): IdentityView {
  return {
    canonicalItemId: hv.canonicalItemId,
    attributes: hv.resolvedAttributes ?? [],
    packageSize: hv.packageSize ?? null,
    packageType: hv.packageType ?? null,
    unmatchedModifiers: [],
    displayName: hv.displayName,
  }
}

/** Convenience: does a variant carry a given attribute id already? */
export function hasAttribute(attrs: ExtractedAttribute[], attributeId: string): boolean {
  return attrs.some((a) => a.attribute_id === attributeId)
}
