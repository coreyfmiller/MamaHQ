// MamaHQ Grocery — Catalog contracts (Step 3).
//
// The canonical concept answers "what is this thing?" — NOT a brand, SKU, or
// product. Identity is the stable, human-readable, hierarchical `canonical_id`
// (e.g. "food.produce.fruit.banana"), immutable after publication. Display text
// (`canonical_name` / `default_display_name`) may change without changing identity.
//
// These files are the SOURCE OF TRUTH for the global catalog (version-controlled,
// Git-reviewable, testable). Supabase holds a deterministic PROJECTION seeded from
// here — never the other way around.
//
// zod is the single definition: TS types are inferred from the schemas, so the
// compiler and the runtime validator can never drift.

import { z } from 'zod'
import { DEPARTMENTS } from './taxonomy.ts'
import { SHOPPING_CATEGORIES } from './shopping-categories.ts'
import { UNIT_IDS } from './units.ts'

/* ----------------------------- Controlled enums ----------------------------- */

// Locales we understand now. Locale affects ranking/display LATER; it never blocks
// recognition. (No ranking is built in this step.)
export const LOCALES = ['en-CA', 'en-US'] as const
export type Locale = (typeof LOCALES)[number]

// How a concept sits in the parent/child hierarchy. A "generic" concept (Cheese)
// can have "specific" children (Cheddar). Both are valid, addable concepts.
export const CONCEPT_LEVELS = ['generic', 'specific'] as const
export type ConceptLevel = (typeof CONCEPT_LEVELS)[number]

// Catalog build tiers. Tier A = the ~500 most common/strategic concepts.
export const CATALOG_TIERS = ['A', 'B', 'C'] as const
export type CatalogTier = (typeof CATALOG_TIERS)[number]

// Lifecycle. Nothing is production truth just because it was generated: only
// 'active' (and historically 'approved') concepts are live. 'deprecated' concepts
// keep their id and point at a replacement.
export const CATALOG_STATUSES = [
  'draft',
  'review_required',
  'approved',
  'active',
  'deprecated',
  'rejected',
] as const
export type CatalogStatus = (typeof CATALOG_STATUSES)[number]

// Where a concept is physically stored — a coarse hint, not a hard rule.
export const STORAGE_TYPES = ['ambient', 'refrigerated', 'frozen', 'nonfood'] as const
export type StorageType = (typeof STORAGE_TYPES)[number]

// Alias classification. Household-specific aliases ("Dad coffee") do NOT belong
// here — those are the future Household Item layer.
export const ALIAS_TYPES = [
  'synonym',
  'regional',
  'abbreviation',
  'common_misspelling',
  'colloquial',
] as const
export type AliasType = (typeof ALIAS_TYPES)[number]

/* ------------------------------- Sub-schemas -------------------------------- */

export const aliasSchema = z.object({
  /** The alternate term. Normalized (lowercased/trimmed) for matching later. */
  alias: z.string().min(1),
  type: z.enum(ALIAS_TYPES),
  /** Optional locale scoping; omitted = understood in all supported locales. */
  locale: z.enum(LOCALES).optional(),
  /** Optional matching confidence for future resolver ranking (0..1). */
  confidence: z.number().min(0).max(1).optional(),
})
export type Alias = z.infer<typeof aliasSchema>

// A concept-specific attribute VALUE slot: references an attribute definition id
// from the registry (e.g. "milk.fat_percentage") and optionally constrains it to
// this concept. Universal attributes (brand/organic/…) are NOT repeated per concept.
export const conceptAttributeSchema = z.object({
  /** Must reference a defined concept-specific attribute in attributes.ts. */
  attribute_id: z.string().min(1),
  /** If true, most items of this concept are expected to set it. */
  typical: z.boolean().optional(),
})
export type ConceptAttribute = z.infer<typeof conceptAttributeSchema>

export const deprecationSchema = z.object({
  /** The canonical_id that replaces this one. Ids are never deleted, only redirected. */
  replaced_by: z.string().min(1),
  reason: z.string().optional(),
})
export type Deprecation = z.infer<typeof deprecationSchema>

/* ---------------------------- Canonical item -------------------------------- */

// Stable id: lowercase ASCII, dot-separated hierarchy, snake_case components.
// e.g. food.produce.fruit.banana | baby.diapering.disposable_diapers
export const CANONICAL_ID_RE = /^[a-z0-9]+(_[a-z0-9]+)*(\.[a-z0-9]+(_[a-z0-9]+)*)+$/

export const canonicalItemSchema = z
  .object({
    canonical_id: z.string().regex(CANONICAL_ID_RE, 'invalid canonical_id format'),

    // Identity name vs. UI display name (Banana vs Bananas). Kept separate on purpose.
    canonical_name: z.string().min(1),
    default_display_name: z.string().min(1),

    // Taxonomy — "what is this?" (validated against the registries in validate.ts,
    // since cross-field enum checks are clearer there than in the base schema).
    department: z.enum(DEPARTMENTS),
    category: z.string().min(1),
    subcategory: z.string().min(1).optional(),

    // Shopping category — "where would I find it while shopping?" (distinct from taxonomy).
    shopping_category: z.enum(SHOPPING_CATEGORIES),

    // Hierarchy.
    concept_level: z.enum(CONCEPT_LEVELS),
    parent_concept_id: z.string().nullable().optional(),

    // Units. default must be a member of allowed (checked in validate.ts).
    default_unit: z.enum(UNIT_IDS),
    allowed_units: z.array(z.enum(UNIT_IDS)).min(1),

    storage_type: z.enum(STORAGE_TYPES),

    // Higher = surfaced sooner by a future resolver. No ranking is built now.
    search_priority: z.number().int().min(0).max(100).default(50),

    catalog_tier: z.enum(CATALOG_TIERS),
    status: z.enum(CATALOG_STATUSES),

    // Provenance / versioning (simple + deterministic).
    version: z.number().int().min(1),
    added_in: z.string().min(1), // catalog version tag when the concept entered, e.g. "tierA.v1"

    // Optional richer data.
    aliases: z.array(aliasSchema).default([]),
    tags: z.array(z.string().min(1)).default([]),
    attributes: z.array(conceptAttributeSchema).default([]),

    // Set only when status === 'deprecated'.
    deprecation: deprecationSchema.optional(),
  })
  .strict()

export type CanonicalItem = z.infer<typeof canonicalItemSchema>

/** Normalize a term for alias/name matching (lowercase, collapse whitespace, strip punctuation edges). */
export function normalizeTerm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s%-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
