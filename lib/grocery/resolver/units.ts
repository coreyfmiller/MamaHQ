// MamaHQ Grocery Resolver — unit + package recognition.
//
// Maps spoken/typed unit words to the catalog's controlled unit ontology
// (lib/grocery/catalog/units.ts), including common aliases and plurals. Also parses
// fused size specs like "4L", "796mL", "1.5kg". Deterministic; no conversion math
// (package units aren't convertible — a "bag" has no inherent weight).

import { UNIT_BY_ID, type UnitDimension } from '../catalog/units.ts'

// alias/plural → canonical unit id
const UNIT_ALIASES: Record<string, string> = {
  // weight
  g: 'g', gram: 'g', grams: 'g', gr: 'g',
  kg: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  // volume
  ml: 'mL', milliliter: 'mL', milliliters: 'mL', millilitre: 'mL', millilitres: 'mL',
  l: 'L', liter: 'L', liters: 'L', litre: 'L', litres: 'L',
  floz: 'fl_oz', 'fl oz': 'fl_oz',
  cup: 'cup', cups: 'cup',
  // count
  each: 'each', ea: 'each', ct: 'each', count: 'each',
  dozen: 'dozen', dozens: 'dozen', doz: 'dozen',
  pair: 'pair', pairs: 'pair',
  // package
  bag: 'bag', bags: 'bag',
  box: 'box', boxes: 'box',
  bottle: 'bottle', bottles: 'bottle',
  can: 'can', cans: 'can', tin: 'can', tins: 'can',
  carton: 'carton', cartons: 'carton',
  case: 'case', cases: 'case',
  jar: 'jar', jars: 'jar',
  pack: 'pack', packs: 'pack', package: 'package', packages: 'package', pkg: 'pack',
  pouch: 'pouch', pouches: 'pouch',
  roll: 'roll', rolls: 'roll',
  tub: 'tub', tubs: 'tub',
  bunch: 'bunch', bunches: 'bunch',
  loaf: 'loaf', loaves: 'loaf',
}

export interface RecognizedUnit {
  unit: string
  unitKind: UnitDimension
  packaged: boolean
}

/** Recognize a token as a unit, or null. */
export function recognizeUnit(token: string): RecognizedUnit | null {
  const id = UNIT_ALIASES[token]
  if (!id) return null
  const def = UNIT_BY_ID[id]
  if (!def) return null
  return { unit: id, unitKind: def.dimension, packaged: def.dimension === 'package' }
}

export interface FusedSize {
  value: number
  unit: string
  unitKind: UnitDimension
}

/**
 * Parse a fused measure token like "4L", "796mL", "1.5kg", "500g", "2lb" into
 * { value, unit }. Returns null if it isn't a number+unit fusion. Only measure
 * units (weight/volume) are accepted here — "4bag" is not a size.
 */
export function parseFusedSize(token: string): FusedSize | null {
  const m = token.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/)
  if (!m) return null
  const value = Number(m[1])
  const u = recognizeUnit(m[2])
  if (!u) return null
  if (u.unitKind !== 'weight' && u.unitKind !== 'volume') return null
  return { value, unit: u.unit, unitKind: u.unitKind }
}
