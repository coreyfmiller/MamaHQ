// MamaHQ Grocery — attribute registry.
//
// Two kinds of attributes:
//  * UNIVERSAL — apply to (almost) everything, so they are NOT repeated on each
//    canonical concept. Defined once here; the future product/household layers read
//    them globally.
//  * CONCEPT-SPECIFIC — meaningful only for certain concepts (milk fat %, coffee
//    roast, diaper size). A concept lists the concept-specific attribute ids it
//    supports via its `attributes[]`. This keeps us from building combinatorial
//    canonical concepts ("Boneless Skinless Chicken Breast" is Chicken Breast +
//    attributes, not its own concept).
//
// This is the SMALLEST useful attribute foundation for Tier A — not a giant
// product-specification framework.

export type AttributeValueType = 'enum' | 'boolean' | 'number' | 'text'

export interface AttributeDef {
  id: string
  label: string
  value_type: AttributeValueType
  /** For enum attributes, the allowed values. */
  values?: readonly string[]
  unit?: string
}

// Universal — global, not attached per concept.
export const UNIVERSAL_ATTRIBUTES: readonly AttributeDef[] = [
  { id: 'brand', label: 'Brand', value_type: 'text' },
  { id: 'organic', label: 'Organic', value_type: 'boolean' },
  { id: 'package_size', label: 'Package size', value_type: 'text' },
  { id: 'package_count', label: 'Package count', value_type: 'number' },
] as const

// Concept-specific — referenced by a concept's attributes[].
export const CONCEPT_ATTRIBUTES: readonly AttributeDef[] = [
  { id: 'milk.fat_percentage', label: 'Fat %', value_type: 'enum', values: ['skim', '1%', '2%', 'whole'] },
  { id: 'milk.lactose_free', label: 'Lactose-free', value_type: 'boolean' },
  { id: 'coffee.roast', label: 'Roast', value_type: 'enum', values: ['light', 'medium', 'dark'] },
  { id: 'coffee.format', label: 'Format', value_type: 'enum', values: ['whole_bean', 'ground', 'pods', 'instant'] },
  { id: 'diapers.diaper_size', label: 'Diaper size', value_type: 'enum', values: ['newborn', '1', '2', '3', '4', '5', '6', '7'] },
  { id: 'diapers.style', label: 'Style', value_type: 'enum', values: ['tab', 'pull_up'] },
  { id: 'apple.variety', label: 'Variety', value_type: 'text' },
  { id: 'bell_pepper.colour', label: 'Colour', value_type: 'enum', values: ['green', 'red', 'yellow', 'orange'] },
  { id: 'chicken.cut_bone', label: 'Bone', value_type: 'enum', values: ['bone_in', 'boneless'] },
  { id: 'chicken.skin', label: 'Skin', value_type: 'enum', values: ['skin_on', 'skinless'] },
  { id: 'bread.style', label: 'Style', value_type: 'enum', values: ['white', 'whole_wheat', 'multigrain', 'sourdough', 'rye'] },
  { id: 'eggs.size', label: 'Egg size', value_type: 'enum', values: ['medium', 'large', 'extra_large'] },
  { id: 'potato.variety', label: 'Variety', value_type: 'text' },
  { id: 'onion.colour', label: 'Colour', value_type: 'enum', values: ['yellow', 'red', 'white', 'sweet'] },
  { id: 'grape.colour', label: 'Colour', value_type: 'enum', values: ['green', 'red', 'black'] },
  { id: 'yogurt.style', label: 'Style', value_type: 'enum', values: ['regular', 'greek', 'skyr', 'drinkable'] },
  { id: 'tea.type', label: 'Type', value_type: 'enum', values: ['black', 'green', 'herbal', 'chai', 'decaf'] },
  { id: 'juice.flavour', label: 'Flavour', value_type: 'text' },
  { id: 'rice.type', label: 'Type', value_type: 'enum', values: ['white', 'brown', 'basmati', 'jasmine', 'arborio'] },
  { id: 'pasta.shape', label: 'Shape', value_type: 'text' },
  { id: 'tortilla.type', label: 'Type', value_type: 'enum', values: ['flour', 'corn', 'whole_wheat'] },
  { id: 'ground_meat.lean', label: 'Lean %', value_type: 'text' },
] as const

export const UNIVERSAL_ATTRIBUTE_IDS = UNIVERSAL_ATTRIBUTES.map((a) => a.id)
export const CONCEPT_ATTRIBUTE_IDS = CONCEPT_ATTRIBUTES.map((a) => a.id)
export const ATTRIBUTE_IDS = [...UNIVERSAL_ATTRIBUTE_IDS, ...CONCEPT_ATTRIBUTE_IDS]

export const ATTRIBUTE_BY_ID: Record<string, AttributeDef> = Object.fromEntries(
  [...UNIVERSAL_ATTRIBUTES, ...CONCEPT_ATTRIBUTES].map((a) => [a.id, a]),
)
