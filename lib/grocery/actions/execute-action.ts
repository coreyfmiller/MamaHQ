// MamaHQ Grocery — action execution planning (Step 5B).
//
// Turns a ValidatedGroceryAction into a concrete, side-effect-free PLAN that the
// Grocery store executes (optimistic local update + the matching DB op). Keeping
// this pure means the same seam serves manual entry now and Tell MamaHQ / voice /
// AI later — they all produce a ValidatedGroceryAction and run the same plan.
//
// REQUIRES_CONFIRMATION produces no plan (the UI must resolve the choice first).

import type { ValidatedGroceryAction, NewItemDetail, ExecutionContext } from './types.ts'

export type ExecutionPlan =
  | { op: 'insert'; detail: NewItemDetail }
  | { op: 'increment'; targetItemId: string; incrementBy: number; resultingQuantity: number; clientActionId: string }
  | { op: 'confirm'; action: ValidatedGroceryAction }
  | { op: 'noop' }

/** Build the execution plan for a validated action. Pure. */
export function planGroceryAction(action: ValidatedGroceryAction, ctx: ExecutionContext = {}): ExecutionPlan {
  const p = action.proposal
  const source = ctx.source ?? 'manual'

  switch (action.type) {
    case 'REQUIRES_CONFIRMATION':
      return { op: 'confirm', action }

    case 'INCREMENT_EXISTING':
      if (!action.targetItemId || action.incrementBy == null) return { op: 'noop' }
      return {
        op: 'increment',
        targetItemId: action.targetItemId,
        incrementBy: action.incrementBy,
        resultingQuantity: action.resultingQuantity ?? action.incrementBy,
        clientActionId: action.clientActionId,
      }

    case 'ADD_NEW':
    case 'ADD_SEPARATE':
    case 'ADD_CUSTOM': {
      const detail: NewItemDetail = {
        displayName: p.displayName,
        canonicalItemId: p.canonicalItemId,
        // For a new item, the count to create as its quantity. Measure quantities
        // (kg/L) describe size, so the row count is 1; count quantities carry over.
        quantity: p.quantity.unitKind === 'weight' || p.quantity.unitKind === 'volume' ? 1 : Math.max(1, p.quantity.value),
        quantityUnit: p.quantity.unit,
        attributes: p.extractedAttributes,
        packageSize: p.quantity.size ? { value: p.quantity.size.value, unit: p.quantity.size.unit } : null,
        packageType: p.quantity.packaged && p.quantity.unit ? p.quantity.unit : null,
        unmatchedModifiers: p.unmatchedModifiers ?? [],
        source: p.canonicalItemId ? source : source, // provenance stays as ctx.source (never AI here)
        clientActionId: action.clientActionId,
      }
      return { op: 'insert', detail }
    }

    default:
      return { op: 'noop' }
  }
}
