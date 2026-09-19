// MamaHQ Grocery — catalog aggregator + deterministic lookups.
//
// The catalog is the version-controlled TS files in this directory. This module is
// the read API over them. No search/ranking/resolver here — just direct lookups
// (Step 3 is the knowledge layer only).

import type { CanonicalItem, Locale } from './types.ts'
import { normalizeTerm } from './types.ts'
import { ITEMS } from './items.ts'
import type { Department } from './taxonomy.ts'
import type { ShoppingCategory } from './shopping-categories.ts'

export * from './types.ts'
export { DEPARTMENTS, CATEGORIES_BY_DEPARTMENT, SUBCATEGORIES } from './taxonomy.ts'
export { SHOPPING_CATEGORIES } from './shopping-categories.ts'
export { UNITS, UNIT_BY_ID } from './units.ts'
export { UNIVERSAL_ATTRIBUTES, CONCEPT_ATTRIBUTES, ATTRIBUTE_BY_ID } from './attributes.ts'

/** All catalog concepts (any status). */
export const ALL_ITEMS: readonly CanonicalItem[] = ITEMS

/** Only concepts that are live for use. */
export const ACTIVE_ITEMS: readonly CanonicalItem[] = ITEMS.filter(
  (i) => i.status === 'active' || i.status === 'approved',
)

const byId = new Map<string, CanonicalItem>(ITEMS.map((i) => [i.canonical_id, i]))

/** Look up a concept by its stable canonical_id. Follows a deprecation redirect. */
export function getCanonical(id: string): CanonicalItem | undefined {
  const it = byId.get(id)
  if (it && it.status === 'deprecated' && it.deprecation) {
    return byId.get(it.deprecation.replaced_by) ?? it
  }
  return it
}

// Deterministic alias/name → concept map, built once. Case/space-insensitive.
// (This is a direct exact-match lookup only; fuzzy/ranked resolution is a LATER step.)
const termIndex = (() => {
  const m = new Map<string, string>() // normalized term -> canonical_id
  for (const it of ACTIVE_ITEMS) {
    m.set(normalizeTerm(it.canonical_name), it.canonical_id)
    m.set(normalizeTerm(it.default_display_name), it.canonical_id)
    for (const a of it.aliases) m.set(normalizeTerm(a.alias), it.canonical_id)
  }
  return m
})()

/** Exact (normalized) term match to a concept, if any. Not fuzzy. */
export function matchTermExact(term: string, _locale?: Locale): CanonicalItem | undefined {
  const id = termIndex.get(normalizeTerm(term))
  return id ? byId.get(id) : undefined
}

export function itemsByDepartment(dept: Department): CanonicalItem[] {
  return ACTIVE_ITEMS.filter((i) => i.department === dept)
}
export function itemsByShoppingCategory(sc: ShoppingCategory): CanonicalItem[] {
  return ACTIVE_ITEMS.filter((i) => i.shopping_category === sc)
}
export function childrenOf(parentId: string): CanonicalItem[] {
  return ACTIVE_ITEMS.filter((i) => i.parent_concept_id === parentId)
}
