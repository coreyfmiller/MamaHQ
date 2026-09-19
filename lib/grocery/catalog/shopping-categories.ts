// MamaHQ Grocery — SHOPPING categories (the flat, store-aisle-oriented grouping).
//
// This is DISTINCT from taxonomy. Taxonomy = "what is this?"; shopping category =
// "where would I expect to find this while shopping?". These will later power list
// grouping and per-store aisle ordering. No UI grouping is built in this step.

export const SHOPPING_CATEGORIES = [
  'produce',
  'bakery',
  'meat_seafood',
  'deli',
  'dairy_eggs',
  'pantry',
  'breakfast',
  'snacks',
  'frozen',
  'beverages',
  'baby',
  'household',
  'personal_care',
  'health',
  'pet',
  'other',
] as const
export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number]
