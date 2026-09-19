// MamaHQ Grocery — Household Memory public surface (Step 6).
//
// A distinct, pure layer between the global Resolver and the Action Resolver.
// Household memory fills what the user did not say; it never overrides explicit input.

export * from './types.ts'
export { enrichProposalWithHouseholdMemory } from './enrich.ts'
export { buildHouseholdMemory, emptyHouseholdMemory } from './memory.ts'
export {
  evidenceStateFor, selectDefaultVariant, ESTABLISHED_THRESHOLD, EMERGING_THRESHOLD,
} from './learning.ts'
export { variantKeyFromIdentity, variantIdentityView, normalizeLabel } from './identity.ts'
