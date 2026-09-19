// MamaHQ Grocery — Household memory index builder (Step 6).
//
// Turns the flat list of a family's `household_items` rows into the indexed
// HouseholdMemory the enrichment layer consumes. This is materialized CURRENT
// knowledge — NOT purchase history. The store loads it once at an appropriate
// boundary and caches it, so enrichment is effectively immediate and no network
// call happens per autocomplete keystroke.

import type { HouseholdMemory, HouseholdVariant } from './types.ts'
import { normalizeLabel } from './identity.ts'

export function buildHouseholdMemory(variants: HouseholdVariant[]): HouseholdMemory {
  const byCanonical = new Map<string, HouseholdVariant[]>()
  const customByKey = new Map<string, HouseholdVariant>()

  for (const v of variants) {
    if (v.canonicalItemId) {
      const arr = byCanonical.get(v.canonicalItemId)
      if (arr) arr.push(v)
      else byCanonical.set(v.canonicalItemId, [v])
    } else {
      // Custom variant keyed by normalized display name (exact-key only; never
      // merges vaguely similar names).
      const key = `custom:${normalizeLabel(v.displayName)}`
      // Prefer a user_set variant if duplicate keys somehow appear.
      const existing = customByKey.get(key)
      if (!existing || (v.isUserSet && !existing.isUserSet)) customByKey.set(key, v)
    }
  }

  return { byCanonical, customByKey }
}

/** An empty memory (used before load / signed out). */
export function emptyHouseholdMemory(): HouseholdMemory {
  return { byCanonical: new Map(), customByKey: new Map() }
}
