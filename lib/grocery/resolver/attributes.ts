// MamaHQ Grocery Resolver — concept-specific attribute extraction.
//
// Detects attribute values in a grocery phrase and (later) keeps only those the
// RESOLVED concept declares in the catalog attribute registry. Deterministic
// lexicon; no AI. Detectors return the attribute_id, the value, and the exact
// phrase tokens they consumed (so those tokens can be stripped from the
// concept-candidate text before search).

import { CONCEPT_ATTRIBUTE_IDS } from '../catalog/attributes.ts'
import type { ExtractedAttribute } from './types.ts'

// A detector inspects the token list and returns any hits it finds. Each hit
// records which token indices it consumed. `strip` = safe to remove from the
// concept-candidate text (a pure modifier like "red"/"lean"/"2%"/"size 4"), vs
// tokens that are frequently CONCEPT words too ("ground" coffee vs ground beef,
// "medium"/"white"/"green" etc.) which we detect but do NOT strip.
interface Hit {
  attribute_id: string
  value: string | boolean
  matchedText: string
  tokenIndices: number[]
  strip: boolean
}

// Detectors return hits without `strip`; scanAttributes assigns it centrally.
type RawHit = Omit<Hit, 'strip'>
type Detector = (tokens: string[]) => RawHit[]

// --- milk.fat_percentage: skim / 1% / 2% / whole ---
const milkFat: Detector = (tokens) => {
  const hits: RawHit[] = []
  tokens.forEach((t, i) => {
    if (t === 'skim' || t === 'nonfat') hits.push({ attribute_id: 'milk.fat_percentage', value: 'skim', matchedText: t, tokenIndices: [i] })
    else if (t === '1%') hits.push({ attribute_id: 'milk.fat_percentage', value: '1%', matchedText: t, tokenIndices: [i] })
    else if (t === '2%') hits.push({ attribute_id: 'milk.fat_percentage', value: '2%', matchedText: t, tokenIndices: [i] })
    else if (t === 'whole' || t === 'homo') hits.push({ attribute_id: 'milk.fat_percentage', value: 'whole', matchedText: t, tokenIndices: [i] })
  })
  return hits
}
const milkLactose: Detector = (tokens) => {
  const i = tokens.indexOf('lactose')
  if (i !== -1 && (tokens[i + 1] === 'free' || tokens[i + 1] === 'freed')) {
    return [{ attribute_id: 'milk.lactose_free', value: true, matchedText: 'lactose free', tokenIndices: [i, i + 1] }]
  }
  if (tokens.includes('lactosefree')) {
    const j = tokens.indexOf('lactosefree')
    return [{ attribute_id: 'milk.lactose_free', value: true, matchedText: 'lactosefree', tokenIndices: [j] }]
  }
  return []
}

// --- diapers.diaper_size: size 4 / sz 4 / newborn / preemie ---
const diaperSize: Detector = (tokens) => {
  const hits: RawHit[] = []
  tokens.forEach((t, i) => {
    if (t === 'newborn' || t === 'nb') hits.push({ attribute_id: 'diapers.diaper_size', value: 'newborn', matchedText: t, tokenIndices: [i] })
  })
  // "size 4" / "sz 4" / "size4"
  tokens.forEach((t, i) => {
    if ((t === 'size' || t === 'sz') && /^[1-7]$/.test(tokens[i + 1] ?? '')) {
      hits.push({ attribute_id: 'diapers.diaper_size', value: tokens[i + 1], matchedText: `${t} ${tokens[i + 1]}`, tokenIndices: [i, i + 1] })
    }
    const m = t.match(/^(?:size|sz)([1-7])$/)
    if (m) hits.push({ attribute_id: 'diapers.diaper_size', value: m[1], matchedText: t, tokenIndices: [i] })
  })
  return hits
}
const diaperStyle: Detector = (tokens) => {
  const hits: RawHit[] = []
  if (tokens.includes('pullup') || (tokens.includes('pull') && tokens.includes('ups'))) {
    hits.push({ attribute_id: 'diapers.style', value: 'pull_up', matchedText: 'pull-up', tokenIndices: [] })
  }
  return hits
}

// --- chicken.cut_bone + chicken.skin ---
const chickenBone: Detector = (tokens) => {
  const hits: RawHit[] = []
  tokens.forEach((t, i) => {
    if (t === 'boneless') hits.push({ attribute_id: 'chicken.cut_bone', value: 'boneless', matchedText: t, tokenIndices: [i] })
    if (t === 'skinless') hits.push({ attribute_id: 'chicken.skin', value: 'skinless', matchedText: t, tokenIndices: [i] })
  })
  // "bone in" / "bone-in" (hyphen already normalized to space upstream)
  const bi = tokens.indexOf('bone')
  if (bi !== -1 && tokens[bi + 1] === 'in') hits.push({ attribute_id: 'chicken.cut_bone', value: 'bone_in', matchedText: 'bone in', tokenIndices: [bi, bi + 1] })
  const si = tokens.indexOf('skin')
  if (si !== -1 && tokens[si + 1] === 'on') hits.push({ attribute_id: 'chicken.skin', value: 'skin_on', matchedText: 'skin on', tokenIndices: [si, si + 1] })
  return hits
}

// --- bell_pepper.colour ---
const pepperColour: Detector = (tokens) => {
  const hits: RawHit[] = []
  const colours: Record<string, string> = { red: 'red', green: 'green', yellow: 'yellow', orange: 'orange' }
  tokens.forEach((t, i) => {
    if (t in colours) hits.push({ attribute_id: 'bell_pepper.colour', value: colours[t], matchedText: t, tokenIndices: [i] })
  })
  return hits
}
// --- onion.colour ---
const onionColour: Detector = (tokens) => {
  const hits: RawHit[] = []
  const colours: Record<string, string> = { yellow: 'yellow', red: 'red', white: 'white', sweet: 'sweet' }
  tokens.forEach((t, i) => {
    if (t in colours) hits.push({ attribute_id: 'onion.colour', value: colours[t], matchedText: t, tokenIndices: [i] })
  })
  return hits
}
// --- grape.colour ---
const grapeColour: Detector = (tokens) => {
  const hits: RawHit[] = []
  const colours: Record<string, string> = { green: 'green', red: 'red', black: 'black' }
  tokens.forEach((t, i) => {
    if (t in colours) hits.push({ attribute_id: 'grape.colour', value: colours[t], matchedText: t, tokenIndices: [i] })
  })
  return hits
}

// --- ground_meat.lean: "extra lean" / "lean" / "medium" / "regular" / "NN%" ---
const groundLean: Detector = (tokens) => {
  const hits: RawHit[] = []
  const ei = tokens.indexOf('extra')
  if (ei !== -1 && tokens[ei + 1] === 'lean') {
    hits.push({ attribute_id: 'ground_meat.lean', value: 'extra_lean', matchedText: 'extra lean', tokenIndices: [ei, ei + 1] })
  } else {
    tokens.forEach((t, i) => {
      if (t === 'lean') hits.push({ attribute_id: 'ground_meat.lean', value: 'lean', matchedText: t, tokenIndices: [i] })
      else if (t === 'medium' && !hits.length) hits.push({ attribute_id: 'ground_meat.lean', value: 'medium', matchedText: t, tokenIndices: [i] })
      else if (t === 'regular') hits.push({ attribute_id: 'ground_meat.lean', value: 'regular', matchedText: t, tokenIndices: [i] })
    })
  }
  return hits
}

// --- coffee.roast + coffee.format ---
const coffeeRoast: Detector = (tokens) => {
  const hits: RawHit[] = []
  tokens.forEach((t, i) => {
    if (t === 'light' || t === 'medium' || t === 'dark') hits.push({ attribute_id: 'coffee.roast', value: t, matchedText: t, tokenIndices: [i] })
  })
  return hits
}
const coffeeFormat: Detector = (tokens) => {
  const hits: RawHit[] = []
  tokens.forEach((t, i) => {
    if (t === 'ground') hits.push({ attribute_id: 'coffee.format', value: 'ground', matchedText: t, tokenIndices: [i] })
    else if (t === 'instant') hits.push({ attribute_id: 'coffee.format', value: 'instant', matchedText: t, tokenIndices: [i] })
    else if (t === 'pods') hits.push({ attribute_id: 'coffee.format', value: 'pods', matchedText: t, tokenIndices: [i] })
  })
  return hits
}

// --- bread.style ---
const breadStyle: Detector = (tokens) => {
  const hits: RawHit[] = []
  const wi = tokens.indexOf('whole')
  if (wi !== -1 && tokens[wi + 1] === 'wheat') hits.push({ attribute_id: 'bread.style', value: 'whole_wheat', matchedText: 'whole wheat', tokenIndices: [wi, wi + 1] })
  tokens.forEach((t, i) => {
    if (t === 'white') hits.push({ attribute_id: 'bread.style', value: 'white', matchedText: t, tokenIndices: [i] })
    else if (t === 'multigrain') hits.push({ attribute_id: 'bread.style', value: 'multigrain', matchedText: t, tokenIndices: [i] })
    else if (t === 'sourdough') hits.push({ attribute_id: 'bread.style', value: 'sourdough', matchedText: t, tokenIndices: [i] })
    else if (t === 'rye') hits.push({ attribute_id: 'bread.style', value: 'rye', matchedText: t, tokenIndices: [i] })
  })
  return hits
}

// --- eggs.size ---
const eggSize: Detector = (tokens) => {
  const hits: RawHit[] = []
  const li = tokens.indexOf('large')
  if (tokens.includes('extra') && tokens[tokens.indexOf('extra') + 1] === 'large') {
    const ei = tokens.indexOf('extra')
    hits.push({ attribute_id: 'eggs.size', value: 'extra_large', matchedText: 'extra large', tokenIndices: [ei, ei + 1] })
  } else if (li !== -1) {
    hits.push({ attribute_id: 'eggs.size', value: 'large', matchedText: 'large', tokenIndices: [li] })
  } else if (tokens.includes('medium')) {
    hits.push({ attribute_id: 'eggs.size', value: 'medium', matchedText: 'medium', tokenIndices: [tokens.indexOf('medium')] })
  }
  return hits
}

// --- tea.type ---
const teaType: Detector = (tokens) => {
  const hits: RawHit[] = []
  tokens.forEach((t, i) => {
    if (t === 'black' || t === 'green' || t === 'herbal' || t === 'chai' || t === 'decaf') hits.push({ attribute_id: 'tea.type', value: t, matchedText: t, tokenIndices: [i] })
  })
  return hits
}

// --- rice.type ---
const riceType: Detector = (tokens) => {
  const hits: RawHit[] = []
  tokens.forEach((t, i) => {
    if (t === 'white' || t === 'brown' || t === 'basmati' || t === 'jasmine' || t === 'arborio') hits.push({ attribute_id: 'rice.type', value: t, matchedText: t, tokenIndices: [i] })
  })
  return hits
}

const DETECTORS: Detector[] = [
  milkFat, milkLactose, diaperSize, diaperStyle, chickenBone, pepperColour, onionColour,
  grapeColour, groundLean, coffeeRoast, coffeeFormat, breadStyle, eggSize, teaType, riceType,
]

// Attributes whose trigger words are PURE modifiers (never a concept head), so they
// are safe to strip from the concept-candidate text. Everything else (coffee format
// "ground", roast "medium", bread/egg/tea/rice values like "white"/"green"/"medium")
// is detected but NOT stripped, because those words are frequently the concept word
// itself (ground beef, white bread, green grapes, …).
const STRIPPABLE_ATTRS = new Set([
  'milk.fat_percentage', 'milk.lactose_free',
  'diapers.diaper_size', 'diapers.style',
  'chicken.cut_bone', 'chicken.skin',
  'bell_pepper.colour', 'onion.colour', 'grape.colour',
  'ground_meat.lean',
])

export interface AttributeScan {
  /** All hits detected in the phrase (before concept filtering). */
  hits: Hit[]
}

/** Run all detectors over the phrase tokens, assigning strip-safety centrally. */
export function scanAttributes(tokens: string[]): AttributeScan {
  const hits: Hit[] = []
  for (const d of DETECTORS) {
    for (const h of d(tokens)) hits.push({ ...h, strip: STRIPPABLE_ATTRS.has(h.attribute_id) })
  }
  return { hits }
}

/** Token indices safe to remove for the attribute-stripped concept search. */
export function strippableIndices(scan: AttributeScan): Set<number> {
  const s = new Set<number>()
  for (const h of scan.hits) if (h.strip) for (const i of h.tokenIndices) s.add(i)
  return s
}

/**
 * Given the raw scan and the resolved concept's declared attribute ids, keep only
 * hits whose attribute_id the concept supports. Returns the kept attributes plus the
 * set of token indices consumed (so callers can strip them before/around search).
 */
export function attributesForConcept(scan: AttributeScan, conceptAttributeIds: string[]): {
  attributes: ExtractedAttribute[]
  consumedIndices: Set<number>
} {
  const allowed = new Set(conceptAttributeIds.filter((id) => CONCEPT_ATTRIBUTE_IDS.includes(id)))
  const attributes: ExtractedAttribute[] = []
  const consumedIndices = new Set<number>()
  const seen = new Set<string>()
  for (const h of scan.hits) {
    if (!allowed.has(h.attribute_id)) continue
    if (seen.has(h.attribute_id)) continue // first hit per attribute wins
    seen.add(h.attribute_id)
    attributes.push({ attribute_id: h.attribute_id, value: h.value, matchedText: h.matchedText })
    for (const idx of h.tokenIndices) consumedIndices.add(idx)
  }
  return { attributes, consumedIndices }
}
