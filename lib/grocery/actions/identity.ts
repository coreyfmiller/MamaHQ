// MamaHQ Grocery — duplicate identity.
//
// Deterministic identity signature for comparing a proposal to active items. The
// signature intentionally includes MEANINGFUL distinctions so we never merge away
// what the user explicitly said:
//
//   canonical id + sorted attributes + package size (value+unit) + package type
//   + normalized unmatched modifiers
//
// For custom (canonical-null) items, identity is the normalized display name.

import type { ProposedGroceryItem, ExtractedAttribute } from '../resolver/types.ts'
import type { ActiveGroceryItem } from './types.ts'

/** Normalize a free-text label for custom-duplicate comparison. */
export function normalizeLabel(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc'`]/g, '')
    .replace(/[^\p{L}\p{N}% ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function attrsKey(attrs: ExtractedAttribute[]): string {
  return [...attrs]
    .map((a) => `${a.attribute_id}=${String(a.value)}`)
    .sort()
    .join('|')
}

function modifiersKey(mods: string[] | undefined): string {
  return (mods ?? []).map((m) => normalizeLabel(m)).filter(Boolean).sort().join('|')
}

/** A structural view both proposals and active items reduce to for comparison. */
export interface IdentityView {
  canonicalItemId: string | null
  attributes: ExtractedAttribute[]
  packageSize: { value: number; unit: string } | null
  packageType: string | null
  unmatchedModifiers: string[]
  displayName: string
}

/** Reduce a resolver proposal to the identity view. Package size comes from the
 *  parsed quantity's `size`; package TYPE is the unit when it's a package unit. */
export function proposalIdentity(p: ProposedGroceryItem): IdentityView {
  const q = p.quantity
  const packageSize = q.size ? { value: q.size.value, unit: q.size.unit } : null
  // package type = a package unit ('can','bag',...); a weight/volume unit is a
  // MEASURE, captured as packageSize instead when it's the item's own size.
  const packageType = q.packaged && q.unit ? q.unit : null
  return {
    canonicalItemId: p.canonicalItemId,
    attributes: p.extractedAttributes,
    packageSize,
    packageType,
    unmatchedModifiers: p.unmatchedModifiers ?? [],
    displayName: p.displayName,
  }
}

export function activeIdentity(it: ActiveGroceryItem): IdentityView {
  return {
    canonicalItemId: it.canonicalItemId,
    attributes: it.attributes ?? [],
    packageSize: it.packageSize ?? null,
    packageType: it.packageType ?? null,
    unmatchedModifiers: it.unmatchedModifiers ?? [],
    displayName: it.displayName,
  }
}

function packageSizeKey(ps: { value: number; unit: string } | null): string {
  return ps ? `${ps.value}${ps.unit}` : ''
}

/** Full identity signature. Two views with the same signature are the SAME item. */
export function identitySignature(v: IdentityView): string {
  if (v.canonicalItemId) {
    return [
      `c:${v.canonicalItemId}`,
      `a:${attrsKey(v.attributes)}`,
      `ps:${packageSizeKey(v.packageSize)}`,
      `pt:${v.packageType ?? ''}`,
      `m:${modifiersKey(v.unmatchedModifiers)}`,
    ].join(';')
  }
  // Custom item: identity is the normalized label only.
  return `custom:${normalizeLabel(v.displayName)}`
}

/** Do two views share the same canonical concept (ignoring detail)? */
export function sameConcept(a: IdentityView, b: IdentityView): boolean {
  return !!a.canonicalItemId && a.canonicalItemId === b.canonicalItemId
}
