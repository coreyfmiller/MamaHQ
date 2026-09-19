// MamaHQ Grocery — catalog validator (Step 3).
//
// Nothing becomes production catalog truth just because it was authored/generated.
// This runs deterministic checks over the version-controlled catalog files and
// reports HARD ERRORS (block) and WARNINGS (advise). Runnable directly on Node 24+
// (native TS): `node lib/grocery/catalog/validate.ts` — exits non-zero on any hard
// error so it can gate CI/seeding later.

import { canonicalItemSchema, normalizeTerm, CANONICAL_ID_RE, type CanonicalItem } from './types.ts'
import { ITEMS } from './items.ts'
import { DEPARTMENTS, CATEGORIES_BY_DEPARTMENT, SUBCATEGORIES, type Department } from './taxonomy.ts'
import { SHOPPING_CATEGORIES } from './shopping-categories.ts'
import { UNIT_BY_ID } from './units.ts'
import { ATTRIBUTE_BY_ID, CONCEPT_ATTRIBUTE_IDS } from './attributes.ts'

export interface Finding {
  level: 'error' | 'warning'
  code: string
  canonical_id?: string
  message: string
}

// Heuristic brand/SKU contamination detector (§14). We can't know every brand, but
// we can catch the obvious shapes: known-brand tokens, trademark suffixes, embedded
// pack/size specs (SKU-like), and count/volume/weight numbers in the concept name.
// Brand tokens matched as WHOLE WORDS (word-boundary) to avoid false positives on
// ordinary words that happen to contain a brand substring (e.g. "French Fries" must
// NOT match the brand "French's"). Possessive/multi-word brands are listed in their
// distinctive form.
const KNOWN_BRAND_TOKENS = [
  'heinz', 'kraft', 'pampers', 'huggies', 'natrel', 'nestle', 'nestlé', 'kelloggs',
  'general mills', 'coca cola', 'coca-cola', 'pepsi', 'oreo', 'cheerios',
  "lay's", 'gatorade', 'tropicana', 'similac', 'enfamil', 'purina', 'iams', 'gerber',
  "campbell's", "hellmann's", "french's",
]
const BRAND_SUFFIX_RE = /(®|™)/u
// SKU-ish: a number immediately followed by a unit/size/count token in the NAME.
const SKU_SPEC_RE = /\b\d+\s?(ml|l|g|kg|oz|lb|ct|count|pack|pk|x)\b/i

function checkBrandContamination(it: CanonicalItem, out: Finding[]) {
  const name = it.canonical_name.toLowerCase()
  if (BRAND_SUFFIX_RE.test(it.canonical_name)) {
    out.push({ level: 'error', code: 'brand_trademark_symbol', canonical_id: it.canonical_id, message: `canonical_name contains a trademark symbol: "${it.canonical_name}"` })
  }
  for (const b of KNOWN_BRAND_TOKENS) {
    // Whole-word/phrase match so "French Fries" doesn't trip on "french's".
    const re = new RegExp(`(^|\\s)${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i')
    if (re.test(name)) {
      out.push({ level: 'error', code: 'brand_token', canonical_id: it.canonical_id, message: `canonical_name looks like a brand ("${b}"): "${it.canonical_name}"` })
      break
    }
  }
  if (SKU_SPEC_RE.test(it.canonical_name)) {
    out.push({ level: 'error', code: 'sku_spec_in_name', canonical_id: it.canonical_id, message: `canonical_name embeds a pack/size spec (SKU-like): "${it.canonical_name}"` })
  }
}

// Levenshtein for near-duplicate warnings (small catalog; cheap enough).
function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

export function validateCatalog(items: CanonicalItem[] = ITEMS): Finding[] {
  const out: Finding[] = []
  const ids = new Set<string>()
  const normalizedNames: { id: string; norm: string }[] = []
  // normalized alias -> set of canonical_ids that claim it
  const aliasOwners = new Map<string, Set<string>>()

  for (const raw of items) {
    // 1) Structural schema (hard). If this fails, skip deeper checks for the item.
    const parsed = canonicalItemSchema.safeParse(raw)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        out.push({ level: 'error', code: 'schema', canonical_id: (raw as CanonicalItem)?.canonical_id, message: `${issue.path.join('.')}: ${issue.message}` })
      }
      continue
    }
    const it = parsed.data

    // 2) canonical_id format + uniqueness (hard).
    if (!CANONICAL_ID_RE.test(it.canonical_id)) {
      out.push({ level: 'error', code: 'id_format', canonical_id: it.canonical_id, message: 'canonical_id is not a valid hierarchical id' })
    }
    if (ids.has(it.canonical_id)) {
      out.push({ level: 'error', code: 'duplicate_id', canonical_id: it.canonical_id, message: 'duplicate canonical_id' })
    }
    ids.add(it.canonical_id)

    // 3) Names present (hard — schema already requires min(1), but guard emptiness).
    if (!it.canonical_name.trim()) out.push({ level: 'error', code: 'missing_canonical_name', canonical_id: it.canonical_id, message: 'missing canonical_name' })
    if (!it.default_display_name.trim()) out.push({ level: 'error', code: 'missing_display_name', canonical_id: it.canonical_id, message: 'missing default_display_name' })

    // 4) Taxonomy references (hard).
    const dept = it.department as Department
    if (!DEPARTMENTS.includes(dept)) {
      out.push({ level: 'error', code: 'bad_department', canonical_id: it.canonical_id, message: `unknown department "${it.department}"` })
    } else if (!CATEGORIES_BY_DEPARTMENT[dept].includes(it.category)) {
      out.push({ level: 'error', code: 'bad_category', canonical_id: it.canonical_id, message: `category "${it.category}" not valid for department "${it.department}"` })
    } else if (it.subcategory) {
      const key = `${it.department}.${it.category}`
      const subs = SUBCATEGORIES[key]
      if (subs && !subs.includes(it.subcategory)) {
        out.push({ level: 'error', code: 'bad_subcategory', canonical_id: it.canonical_id, message: `subcategory "${it.subcategory}" not valid for ${key}` })
      }
    }

    // 5) Shopping category (hard).
    if (!SHOPPING_CATEGORIES.includes(it.shopping_category)) {
      out.push({ level: 'error', code: 'bad_shopping_category', canonical_id: it.canonical_id, message: `unknown shopping_category "${it.shopping_category}"` })
    }

    // 6) Units (hard): every allowed unit exists; default is allowed.
    for (const u of it.allowed_units) {
      if (!UNIT_BY_ID[u]) out.push({ level: 'error', code: 'bad_unit', canonical_id: it.canonical_id, message: `allowed_units references unknown unit "${u}"` })
    }
    if (!UNIT_BY_ID[it.default_unit]) {
      out.push({ level: 'error', code: 'bad_default_unit', canonical_id: it.canonical_id, message: `default_unit "${it.default_unit}" is unknown` })
    } else if (!it.allowed_units.includes(it.default_unit)) {
      out.push({ level: 'error', code: 'default_unit_not_allowed', canonical_id: it.canonical_id, message: `default_unit "${it.default_unit}" is not in allowed_units` })
    }

    // 7) Attribute references (hard): must be defined CONCEPT-specific attributes.
    for (const a of it.attributes) {
      if (!ATTRIBUTE_BY_ID[a.attribute_id]) {
        out.push({ level: 'error', code: 'bad_attribute', canonical_id: it.canonical_id, message: `unknown attribute "${a.attribute_id}"` })
      } else if (!CONCEPT_ATTRIBUTE_IDS.includes(a.attribute_id)) {
        out.push({ level: 'error', code: 'universal_attribute_on_concept', canonical_id: it.canonical_id, message: `"${a.attribute_id}" is a universal attribute and must not be attached per-concept` })
      }
    }

    // 8) Deprecation contract (hard): deprecated must point at a replacement; a
    //    replacement pointer should not exist unless deprecated.
    if (it.status === 'deprecated' && !it.deprecation) {
      out.push({ level: 'error', code: 'deprecated_without_replacement', canonical_id: it.canonical_id, message: 'deprecated concept must set deprecation.replaced_by' })
    }
    if (it.deprecation && it.status !== 'deprecated') {
      out.push({ level: 'error', code: 'replacement_without_deprecated', canonical_id: it.canonical_id, message: 'deprecation set but status is not "deprecated"' })
    }

    // 9) Brand/SKU contamination (hard where detectable).
    checkBrandContamination(it, out)

    // Alias bookkeeping for cross-item checks.
    for (const a of it.aliases) {
      const norm = normalizeTerm(a.alias)
      if (!norm) {
        out.push({ level: 'error', code: 'empty_alias', canonical_id: it.canonical_id, message: 'alias normalizes to empty string' })
        continue
      }
      if (!aliasOwners.has(norm)) aliasOwners.set(norm, new Set())
      aliasOwners.get(norm)!.add(it.canonical_id)
    }

    // Warnings.
    if (it.aliases.length === 0) out.push({ level: 'warning', code: 'no_aliases', canonical_id: it.canonical_id, message: 'concept has no aliases' })
    if (it.aliases.length > 25) out.push({ level: 'warning', code: 'many_aliases', canonical_id: it.canonical_id, message: `unusually large alias set (${it.aliases.length})` })

    normalizedNames.push({ id: it.canonical_id, norm: normalizeTerm(it.canonical_name) })
  }

  // 10) Parent references (hard): parent must exist; no self/loop.
  for (const it of items) {
    if (!it.parent_concept_id) continue
    if (it.parent_concept_id === it.canonical_id) {
      out.push({ level: 'error', code: 'parent_self', canonical_id: it.canonical_id, message: 'concept is its own parent' })
      continue
    }
    if (!ids.has(it.parent_concept_id)) {
      out.push({ level: 'error', code: 'broken_parent', canonical_id: it.canonical_id, message: `parent_concept_id "${it.parent_concept_id}" does not exist` })
    }
  }
  // Loop detection across the parent chain.
  const parentOf = new Map(items.map((i) => [i.canonical_id, i.parent_concept_id ?? null]))
  for (const it of items) {
    const seen = new Set<string>()
    let cur: string | null = it.canonical_id
    while (cur) {
      if (seen.has(cur)) {
        out.push({ level: 'error', code: 'parent_loop', canonical_id: it.canonical_id, message: `parent chain loops at "${cur}"` })
        break
      }
      seen.add(cur)
      cur = parentOf.get(cur) ?? null
    }
  }

  // 11) Alias collisions (warning): the same alias claimed by >1 concept. This is
  //     the check that would catch an accidental cilantro↔coriander_seed merge.
  for (const [norm, owners] of aliasOwners) {
    if (owners.size > 1) {
      out.push({ level: 'warning', code: 'alias_collision', message: `alias "${norm}" is shared by: ${[...owners].join(', ')}` })
    }
  }

  // 12) Near-duplicate canonical names (warning).
  for (let i = 0; i < normalizedNames.length; i++) {
    for (let j = i + 1; j < normalizedNames.length; j++) {
      const a = normalizedNames[i], b = normalizedNames[j]
      if (a.norm === b.norm) {
        out.push({ level: 'warning', code: 'duplicate_name', message: `identical canonical_name across ${a.id} and ${b.id}` })
      } else if (Math.abs(a.norm.length - b.norm.length) <= 2 && editDistance(a.norm, b.norm) === 1) {
        out.push({ level: 'warning', code: 'near_duplicate_name', message: `very similar canonical_name: "${a.norm}" (${a.id}) vs "${b.norm}" (${b.id})` })
      }
    }
  }

  return out
}

export function summarize(findings: Finding[]) {
  const errors = findings.filter((f) => f.level === 'error')
  const warnings = findings.filter((f) => f.level === 'warning')
  return { errors, warnings }
}

// Direct-run entry (Node 24 native TS). Prints a report; exits 1 on hard errors.
// import.meta.main is set when the file is the entrypoint on recent Node.
const isMain = (() => {
  try {
    return (import.meta as unknown as { main?: boolean }).main === true ||
      (typeof process !== 'undefined' && process.argv[1]?.endsWith('validate.ts'))
  } catch {
    return false
  }
})()

if (isMain) {
  const findings = validateCatalog()
  const { errors, warnings } = summarize(findings)
  for (const w of warnings) console.warn(`⚠ [${w.code}] ${w.canonical_id ?? ''} ${w.message}`)
  for (const e of errors) console.error(`✗ [${e.code}] ${e.canonical_id ?? ''} ${e.message}`)
  console.log(`\nCatalog: ${ITEMS.length} concepts · ${errors.length} error(s) · ${warnings.length} warning(s)`)
  if (errors.length > 0) process.exit(1)
  console.log('✓ catalog valid')
}
