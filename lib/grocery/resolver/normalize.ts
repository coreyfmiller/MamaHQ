// MamaHQ Grocery Resolver — phrase normalization.
//
// The resolver needs a tokenization that PRESERVES decimals ("1.5") and percents
// ("2%") — the search normalizer intentionally strips "." (splitting "1.5" into
// "1 5"), which is wrong for quantity parsing. So the resolver tokenizes with its
// own light normalizer, then hands the concept-candidate RESIDUE to search (which
// re-normalizes consistently on its side).

/** Light normalization that keeps digits, decimals, and %. */
export function normalizePhrase(phrase: string): { normalized: string; tokens: string[] } {
  const normalized = phrase
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc'`]/g, '') // drop apostrophes
    .replace(/[-_/]+/g, ' ') // hyphens/underscores/slashes → space
    // keep letters, numbers, '.', '%'; other punctuation → space
    .replace(/[^\p{L}\p{N}.% ]+/gu, ' ')
    // a '.' only survives BETWEEN digits (decimal); otherwise → space
    .replace(/(\D)\.(\D)/g, '$1 $2')
    .replace(/(\D)\.|\.(\D)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
  const tokens = normalized ? normalized.split(' ').filter(Boolean) : []
  return { normalized, tokens }
}
