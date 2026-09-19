// Shared factory for catalog concept files. Fills the repetitive defaults so each
// concept reads as just its meaningful fields. Every concept is a real shopping-list
// CONCEPT — never a brand/SKU, never a combinatorial variant (use attributes).

import type { CanonicalItem } from '../types.ts'

export type Seed = Omit<
  CanonicalItem,
  'search_priority' | 'catalog_tier' | 'status' | 'version' | 'added_in' | 'aliases' | 'tags' | 'attributes' | 'concept_level' | 'parent_concept_id'
> &
  Partial<Pick<CanonicalItem, 'search_priority' | 'concept_level' | 'parent_concept_id' | 'aliases' | 'tags' | 'attributes'>>

export function item(s: Seed): CanonicalItem {
  return {
    concept_level: 'specific',
    parent_concept_id: null,
    search_priority: 50,
    catalog_tier: 'A',
    status: 'active',
    version: 1,
    added_in: 'tierA.v1',
    aliases: [],
    tags: [],
    attributes: [],
    ...s,
  }
}
