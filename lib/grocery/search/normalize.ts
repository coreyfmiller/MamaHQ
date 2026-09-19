// MamaHQ Grocery Search — deterministic normalization.
//
// Every query and every catalog string passes through the SAME normalizer, so
// matching is consistent. Deterministic, no locale branching, no AI. Kept
// conservative: we fold case/diacritics/whitespace/punctuation but do NOT destroy
// distinctions that may matter later (e.g. we keep %, and internal digits).

/** Fold to a stable comparable form: lowercase, strip diacritics, tidy punctuation. */
export function normalize(input: string): string {
  return (
    input
      .normalize('NFKD')
      // strip combining diacritical marks (é → e, ñ → n) — generic, not per-word
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      // unify apostrophe variants then drop them (confectioner's → confectioners)
      .replace(/[\u2018\u2019\u02bc'`]/g, '')
      // hyphens/underscores/slashes → space (half-and-half, all-purpose)
      .replace(/[-_/]+/g, ' ')
      // keep letters, numbers, %, and spaces; everything else → space
      .replace(/[^\p{L}\p{N}% ]+/gu, ' ')
      // collapse whitespace
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/** Split a normalized string into tokens. */
export function tokenize(normalized: string): string[] {
  return normalized ? normalized.split(' ').filter(Boolean) : []
}

/**
 * Conservative singular form of a token. Handles the ordinary English endings
 * (ies→y, es, s) with guards to avoid destroying short words. NOT a full stemmer;
 * it only aims to let "bananas"→"banana", "berries"→"berry", "tomatoes"→"tomato"
 * without turning "peas"→"pea" causing false hits (peas is its own concept, and we
 * keep BOTH forms in the index so exact still wins).
 */
export function singularize(token: string): string {
  if (token.length <= 3) return token // ham, egg, oil, tea — never strip
  if (token.endsWith('ies') && token.length > 4) return token.slice(0, -3) + 'y' // berries→berry
  if (token.endsWith('ses') || token.endsWith('xes') || token.endsWith('zes') || token.endsWith('ches') || token.endsWith('shes')) {
    return token.slice(0, -2) // boxes→box, dishes→dish
  }
  if (token.endsWith('oes') && token.length > 4) return token.slice(0, -2) // tomatoes→tomato, potatoes→potato
  if (token.endsWith('s') && !token.endsWith('ss') && token.length > 3) return token.slice(0, -1) // bananas→banana
  return token
}

/** Both the token and its conservative singular (deduped). */
export function tokenForms(token: string): string[] {
  const s = singularize(token)
  return s === token ? [token] : [token, s]
}
