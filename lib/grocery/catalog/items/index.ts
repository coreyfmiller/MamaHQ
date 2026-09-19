// Deterministic aggregator of the per-category catalog files. Order here defines
// the default catalog order; concept identity is the canonical_id, so order is not
// semantically significant. Split by category purely for reviewability.

import type { CanonicalItem } from '../types.ts'
import { PRODUCE } from './produce.ts'
import { MEAT_SEAFOOD } from './meat-seafood.ts'
import { DAIRY_EGGS } from './dairy-eggs.ts'
import { BAKERY_DELI } from './bakery-deli.ts'
import { FROZEN } from './frozen.ts'
import { PANTRY } from './pantry.ts'
import { BREAKFAST_SNACKS } from './breakfast-snacks.ts'
import { CONDIMENTS_BAKING_SPICES } from './condiments-baking-spices.ts'
import { BEVERAGES } from './beverages.ts'
import { NONFOOD } from './nonfood.ts'

export const ITEMS: CanonicalItem[] = [
  ...PRODUCE,
  ...MEAT_SEAFOOD,
  ...DAIRY_EGGS,
  ...BAKERY_DELI,
  ...FROZEN,
  ...PANTRY,
  ...BREAKFAST_SNACKS,
  ...CONDIMENTS_BAKING_SPICES,
  ...BEVERAGES,
  ...NONFOOD,
]
