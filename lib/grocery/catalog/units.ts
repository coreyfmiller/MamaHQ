// MamaHQ Grocery — controlled unit ontology.
//
// Units carry a DIMENSION (count/weight/volume/package) and whether they're
// mathematically convertible. Package units (bag, box, …) are intentionally NOT
// convertible: "1 bag" does not inherently equal a known weight/volume. A canonical
// item declares default_unit + allowed_units[]; no auto-conversion is built here.

export const UNIT_DIMENSIONS = ['count', 'weight', 'volume', 'package'] as const
export type UnitDimension = (typeof UNIT_DIMENSIONS)[number]

export interface UnitDef {
  id: string
  label: string
  dimension: UnitDimension
  /** True only for units convertible within their dimension via a fixed factor. */
  convertible: boolean
  /** Locale hint for display; recognition is never locale-gated. */
  locales?: readonly ('en-CA' | 'en-US')[]
}

export const UNITS: readonly UnitDef[] = [
  // Count
  { id: 'each', label: 'each', dimension: 'count', convertible: true },
  { id: 'dozen', label: 'dozen', dimension: 'count', convertible: true },
  { id: 'pair', label: 'pair', dimension: 'count', convertible: true },

  // Weight (convertible within weight)
  { id: 'g', label: 'g', dimension: 'weight', convertible: true },
  { id: 'kg', label: 'kg', dimension: 'weight', convertible: true },
  { id: 'oz', label: 'oz', dimension: 'weight', convertible: true },
  { id: 'lb', label: 'lb', dimension: 'weight', convertible: true },

  // Volume (convertible within volume)
  { id: 'mL', label: 'mL', dimension: 'volume', convertible: true },
  { id: 'L', label: 'L', dimension: 'volume', convertible: true },
  { id: 'fl_oz', label: 'fl oz', dimension: 'volume', convertible: true },
  { id: 'cup', label: 'cup', dimension: 'volume', convertible: true },

  // Package (NOT convertible — a "bag" has no inherent weight/volume)
  { id: 'bag', label: 'bag', dimension: 'package', convertible: false },
  { id: 'box', label: 'box', dimension: 'package', convertible: false },
  { id: 'bottle', label: 'bottle', dimension: 'package', convertible: false },
  { id: 'can', label: 'can', dimension: 'package', convertible: false },
  { id: 'carton', label: 'carton', dimension: 'package', convertible: false },
  { id: 'case', label: 'case', dimension: 'package', convertible: false },
  { id: 'jar', label: 'jar', dimension: 'package', convertible: false },
  { id: 'pack', label: 'pack', dimension: 'package', convertible: false },
  { id: 'package', label: 'package', dimension: 'package', convertible: false },
  { id: 'pouch', label: 'pouch', dimension: 'package', convertible: false },
  { id: 'roll', label: 'roll', dimension: 'package', convertible: false },
  { id: 'tub', label: 'tub', dimension: 'package', convertible: false },
  { id: 'bunch', label: 'bunch', dimension: 'package', convertible: false },
  { id: 'loaf', label: 'loaf', dimension: 'package', convertible: false },
] as const

export const UNIT_IDS = UNITS.map((u) => u.id) as [string, ...string[]]
export const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]))
