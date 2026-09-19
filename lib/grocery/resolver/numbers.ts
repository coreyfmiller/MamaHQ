// MamaHQ Grocery Resolver — number parsing.
//
// Deterministic, bounded. Handles digit numbers ("2", "1.5"), simple English
// number words ("one".."twelve", "a"/"an"→1, "couple"→2, "half dozen"→6,
// "dozen"→12), and a compact "3x" / "3 x" multiplier. No locale magic, no big-number
// spelling ("two hundred"). Grocery quantities are small.

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, couple: 2,
}

/** Parse a single token as a number, or null. Accepts "2", "1.5", "one", "a". */
export function parseNumberToken(token: string): number | null {
  if (/^\d+(\.\d+)?$/.test(token)) return Number(token)
  if (token in WORD_NUMBERS) return WORD_NUMBERS[token]
  return null
}

export interface LeadingNumber {
  value: number
  /** How many tokens were consumed (e.g. "half dozen" = 2). */
  consumed: number
}

/**
 * Read a leading count from the front of a token list. Handles:
 *   ["2", ...]            → 2
 *   ["two", ...]          → 2
 *   ["a", ...]            → 1   (only when followed by a noun-ish token; caller decides)
 *   ["half", "dozen", ..] → 6
 *   ["dozen", ...]        → 12
 *   ["3x", ...] / ["3","x",..] handled by caller via `x` multiplier
 * Returns null if the front isn't a number.
 */
export function readLeadingNumber(tokens: string[]): LeadingNumber | null {
  if (tokens.length === 0) return null
  const t0 = tokens[0]

  // "half dozen" / "half a dozen"
  if (t0 === 'half') {
    if (tokens[1] === 'dozen') return { value: 6, consumed: 2 }
    if (tokens[1] === 'a' && tokens[2] === 'dozen') return { value: 6, consumed: 3 }
  }

  const n = parseNumberToken(t0)
  if (n !== null) {
    // "2 dozen" → 24 handled at the quantity layer (dozen is a unit); here we just
    // return the leading count 2 and let the unit layer see "dozen".
    return { value: n, consumed: 1 }
  }
  return null
}

/** Split a fused "3x" style token into ["3","x"] if applicable, else null. */
export function splitMultiplierToken(token: string): [string, string] | null {
  const m = token.match(/^(\d+(?:\.\d+)?)x$/)
  return m ? [m[1], 'x'] : null
}
