// MamaHQ Grocery Search — in-memory search index.
//
// Built ONCE from the version-controlled catalog. Precomputes normalized forms so
// no per-keystroke normalization of catalog data happens. Tiny for 417 concepts;
// linear scan is comfortably within the perf target and stays fine into the
// thousands (see the benchmark). No network, no DB.

import type { CanonicalItem } from '../catalog/types.ts'
import { ACTIVE_ITEMS } from '../catalog/index.ts'
import { normalize, tokenize, tokenForms } from './normalize.ts'

export interface IndexedAlias {
  /** Original alias text (for matchedAlias in results). */
  raw: string
  /** Normalized alias. */
  norm: string
}

export interface SearchIndexEntry {
  item: CanonicalItem
  canonicalId: string
  /** Normalized canonical_name. */
  normCanonical: string
  /** Normalized default_display_name. */
  normDisplay: string
  aliases: IndexedAlias[]
  /** Distinct normalized tokens drawn from name + display + aliases. */
  tokens: string[]
  /** tokens plus their conservative singular forms, for plural-tolerant matching. */
  tokenForms: string[]
  /** Length of the shortest "target" string (used as a completion-distance tiebreak). */
  shortestTargetLen: number
}

export interface SearchIndex {
  entries: SearchIndexEntry[]
  builtAtMs: number
}

export function buildSearchIndex(items: readonly CanonicalItem[] = ACTIVE_ITEMS): SearchIndex {
  const entries: SearchIndexEntry[] = items.map((item) => {
    const normCanonical = normalize(item.canonical_name)
    const normDisplay = normalize(item.default_display_name)
    const aliases: IndexedAlias[] = item.aliases.map((a) => ({ raw: a.alias, norm: normalize(a.alias) }))

    const tokenSet = new Set<string>()
    for (const src of [normCanonical, normDisplay, ...aliases.map((a) => a.norm)]) {
      for (const t of tokenize(src)) tokenSet.add(t)
    }
    const tokens = [...tokenSet]
    const formsSet = new Set<string>()
    for (const t of tokens) for (const f of tokenForms(t)) formsSet.add(f)

    const targetLens = [normCanonical.length, normDisplay.length, ...aliases.map((a) => a.norm.length)].filter((n) => n > 0)

    return {
      item,
      canonicalId: item.canonical_id,
      normCanonical,
      normDisplay,
      aliases,
      tokens,
      tokenForms: [...formsSet],
      shortestTargetLen: targetLens.length ? Math.min(...targetLens) : normCanonical.length,
    }
  })

  return { entries, builtAtMs: Date.now() }
}

/** The default index over the live active catalog, built lazily once. */
let _default: SearchIndex | undefined
export function defaultIndex(): SearchIndex {
  if (!_default) _default = buildSearchIndex()
  return _default
}
