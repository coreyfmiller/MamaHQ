// MamaHQ Grocery Resolver — quantity + unit/package peeling.
//
// Reads a leading count and an optional unit/package from the front of the token
// list, plus any fused size spec ("4L") wherever it appears. Returns the parsed
// quantity and the REMAINING tokens (the concept-candidate text). Package handling
// lives here rather than a separate module — recognizeUnit() already classifies
// package vs measure units, so a second file would just re-wrap it.
//
// Design decisions (documented in docs/GROCERY_RESOLVER.md):
//  * "2 milk" / "2 milks"      → value 2, no unit (a plain count of the item).
//  * "3 cans tomato soup"      → value 3, unit 'can', packaged true.
//  * "1.5 kg ground beef"      → value 1.5, unit 'kg' (weight).
//  * "2 dozen eggs"            → value 2, unit 'dozen' (NOT auto-multiplied to 24;
//                                dozen is preserved as the stated unit — expansion
//                                is a display/execution concern, not resolution).
//  * "two 4L milks"            → value 2 (count), size { value 4, unit 'L' } per item.

import type { ParsedQuantity } from './types.ts'
import { readLeadingNumber, splitMultiplierToken } from './numbers.ts'
import { recognizeUnit, parseFusedSize } from './units.ts'

export interface QuantityParse {
  quantity: ParsedQuantity
  /** Tokens left after removing the quantity/unit/size spans. */
  rest: string[]
}

export function parseQuantity(tokensIn: string[]): QuantityParse {
  // Expand fused "3x" at the front into ["3","x"] for uniform handling.
  let tokens = [...tokensIn]
  if (tokens.length) {
    const split = splitMultiplierToken(tokens[0])
    if (split) tokens = [split[0], ...tokens.slice(1)]
  }

  const qty: ParsedQuantity = { value: 1 }
  let idx = 0

  // 1) Leading count.
  const lead = readLeadingNumber(tokens.slice(idx))
  if (lead) {
    qty.value = lead.value
    idx += lead.consumed
    qty.raw = tokens.slice(0, idx).join(' ')
    // Optional "x" separator after a count ("3 x ...").
    if (tokens[idx] === 'x') idx += 1
  }

  // 2) A fused size spec at the current position ("4L", "796mL", "1.5kg").
  //    If it directly follows a count and precedes the item, it's the per-item size.
  if (tokens[idx]) {
    const fused = parseFusedSize(tokens[idx])
    if (fused) {
      if (lead) {
        // count + size → "two 4L milks": keep count as value, size per item.
        qty.size = { value: fused.value, unit: fused.unit }
      } else {
        // no leading count → "4L milk": the size IS the quantity.
        qty.value = fused.value
        qty.unit = fused.unit
        qty.unitKind = fused.unitKind
        qty.packaged = false
      }
      idx += 1
    }
  }

  // 3) A standalone unit word at the current position ("kg", "cans", "dozen").
  if (tokens[idx]) {
    const u = recognizeUnit(tokens[idx])
    if (u) {
      // Don't overwrite a size-derived unit unless none set yet.
      if (!qty.unit) {
        qty.unit = u.unit
        qty.unitKind = u.unitKind
        qty.packaged = u.packaged
      } else if (qty.size) {
        // "two 4L milks": a trailing measure unit is unusual; ignore gracefully.
      }
      idx += 1
    }
  }

  // 4) A separate number+unit like "1.5 kg" where the number was the lead and the
  //    next token is a bare unit — already handled by (1)+(3). But handle the case
  //    where the lead was actually a measure amount, e.g. "500 g flour": lead=500,
  //    then unit 'g' → treat as weight quantity, not a count.
  if (lead && qty.unit && (qty.unitKind === 'weight' || qty.unitKind === 'volume') && !qty.size) {
    // value already = the number; unit already set. Good.
  }

  const rest = tokens.slice(idx)
  return { quantity: qty, rest }
}
