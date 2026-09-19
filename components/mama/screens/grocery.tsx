'use client'

import { useMemo, useRef, useState } from 'react'
import { Plus, Minus, ShoppingCart, RotateCcw, Trash2, Check } from 'lucide-react'
import { useNav } from '../context'
import { useGrocery, type GroceryItem, type ApplyOutcome } from '../grocery'
import { CheckBox, Screen, Scroll, StatusBar, TopBar } from '../ui'
import { searchGrocery } from '@/lib/grocery/search/search'
import { SHOPPING_CATEGORY_LABELS } from '@/lib/grocery/search/labels'
import { resolveGroceryPhrase } from '@/lib/grocery/resolver/resolve'
import { getCanonical } from '@/lib/grocery/catalog'
import type { ProposedGroceryItem } from '@/lib/grocery/resolver/types'
import type { ValidatedGroceryAction } from '@/lib/grocery/actions/types'

/**
 * Grocery — the operational shared list. Add items (now with deterministic catalog
 * autocomplete, Step 4), adjust quantity, tap to mark bought (retains purchase
 * history), restore or remove. Autocomplete is assistance, never a gatekeeper:
 * typing + Enter always adds — as a canonical item if selected, else custom.
 */
export function GroceryScreen() {
  const { closeOverlay, showToast } = useNav()
  const { active, completed, addResolved, editItem, completeItem, restoreItem, removeItem } = useGrocery()

  // Feedback for a resolved add outcome (toast for the common cases).
  const feedback = (o: ApplyOutcome) => {
    if (o.kind === 'added') showToast(`Added ${o.displayName}`)
    else if (o.kind === 'incremented') showToast(`${o.displayName} → ${o.resultingQuantity}`)
    else if (o.kind === 'separate') showToast(`Added ${o.displayName} separately`)
  }

  return (
    <Screen>
      <StatusBar />
      <TopBar variant="close" title="Grocery" onBack={closeOverlay} />
      <Scroll className="space-y-5 px-6 pb-8">
        <header className="pt-1">
          <h1 className="flex items-center gap-2 font-serif text-[24px] font-semibold tracking-tight">
            Grocery <ShoppingCart className="size-5 text-sage" strokeWidth={1.75} />
          </h1>
          <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
            One shared list. Anyone in the family can add — tick things off as you buy them.
          </p>
        </header>

        <AddRow addResolved={addResolved} onFeedback={feedback} />

        {/* Active list */}
        {active.length === 0 ? (
          <p className="pt-2 text-center text-[14px] text-muted-foreground">
            Nothing on the list right now.
          </p>
        ) : (
          <div className="space-y-2">
            {active.map((it) => (
              <ActiveRow
                key={it.id}
                item={it}
                onComplete={() => completeItem(it.id)}
                onQty={(q) => editItem(it.id, { quantity: q })}
              />
            ))}
          </div>
        )}

        {/* Bought (completed) */}
        {completed.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="px-1 text-[13px] font-semibold tracking-wide text-muted-foreground">
              Bought
            </p>
            {completed.map((it) => (
              <div
                key={it.id}
                className="flex items-center gap-3 rounded-2xl border border-border/40 bg-muted/40 p-3"
              >
                <span className="flex size-5 items-center justify-center rounded-full bg-sage text-white">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] text-muted-foreground line-through">
                  {it.displayName}
                  {it.quantity > 1 ? ` ×${it.quantity}` : ''}
                </span>
                <button
                  onClick={() => restoreItem(it.id)}
                  aria-label="Back to list"
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted"
                >
                  <RotateCcw className="size-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => removeItem(it.id)}
                  aria-label="Remove"
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors active:text-destructive"
                >
                  <Trash2 className="size-4" strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Scroll>
    </Screen>
  )
}

// The add input. Two paths converge on the same domain seam (resolve → action →
// execute): (A) pick an autocomplete result → a canonical proposal; (B) type a
// natural phrase ("2 milk", "red peppers", "size 4 diapers") + Enter → the Grocery
// Resolver. Keyboard ↑/↓/Enter/Escape; touch taps a result. Autocomplete never
// blocks entry. When the resolver needs confirmation (ambiguous / invalid unit) we
// show a compact inline choice instead of mutating.
function AddRow({
  addResolved,
  onFeedback,
}: {
  addResolved: (proposal: ProposedGroceryItem) => ApplyOutcome
  onFeedback: (o: ApplyOutcome) => void
}) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [confirm, setConfirm] = useState<ValidatedGroceryAction | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => (draft.trim() ? searchGrocery(draft, 8) : []), [draft])

  const reset = () => {
    setDraft('')
    setOpen(false)
    setHighlight(-1)
  }

  const handleOutcome = (o: ApplyOutcome) => {
    if (o.kind === 'confirm') {
      setConfirm(o.action)
      setOpen(false)
    } else {
      onFeedback(o)
      reset()
      inputRef.current?.focus()
    }
  }

  // Build a canonical proposal from a picked autocomplete result and apply it.
  const applyCanonical = (r: { canonicalId: string; canonicalName: string; displayName: string; shoppingCategory: string }) => {
    const proposal: ProposedGroceryItem = {
      rawPhrase: r.displayName,
      displayName: r.displayName,
      canonicalItemId: r.canonicalId,
      canonicalName: r.canonicalName,
      shoppingCategory: r.shoppingCategory,
      quantity: { value: 1 },
      extractedAttributes: [],
      unmatchedModifiers: [],
      candidates: [],
      confidence: 'high',
      ambiguous: false,
      needsReview: false,
      unmatched: false,
    }
    void getCanonical(r.canonicalId)
    handleOutcome(addResolved(proposal))
  }

  const applyTyped = () => {
    const text = draft.trim()
    if (!text) return
    handleOutcome(addResolved(resolveGroceryPhrase(text)))
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && results.length) {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => Math.min((h < 0 ? -1 : h) + 1, results.length - 1))
    } else if (e.key === 'ArrowUp' && results.length) {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && highlight >= 0 && results[highlight]) applyCanonical(results[highlight])
      else applyTyped()
    } else if (e.key === 'Escape') {
      setOpen(false)
      setHighlight(-1)
    }
  }

  const showList = open && !confirm && draft.trim().length > 0 && results.length > 0

  if (confirm) {
    const typed = confirm.proposal.rawPhrase.trim()
    return (
      <div className="rounded-2xl border border-border bg-card p-3">
        <p className="px-1 text-[14px] font-medium text-foreground">Did you mean…</p>
        <div className="mt-2 space-y-1.5">
          {(confirm.confirmationChoices ?? []).map((c, i) => (
            <button
              key={i}
              onClick={() => {
                if (c.kind === 'pick_candidate' && c.canonicalItemId) {
                  const cand = confirm.proposal.candidates.find((x) => x.canonicalId === c.canonicalItemId)
                  if (cand) applyCanonical(cand)
                } else {
                  const p: ProposedGroceryItem = {
                    ...confirm.proposal,
                    canonicalItemId: null,
                    unmatched: true,
                    ambiguous: false,
                    invalidStructure: false,
                    displayName: typed,
                  }
                  handleOutcome(addResolved(p))
                }
                setConfirm(null)
              }}
              className="flex w-full items-center justify-between rounded-xl border border-border/70 px-3 py-2.5 text-left text-[15px] transition-colors active:bg-muted"
            >
              {c.label}
            </button>
          ))}
        </div>
        <button onClick={() => { setConfirm(null); reset() }} className="mt-2 w-full py-2 text-[13px] font-medium text-muted-foreground">
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2 focus-within:border-primary">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setOpen(true)
            setHighlight(-1)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showList}
          aria-controls="grocery-ac-list"
          aria-autocomplete="list"
          placeholder="Add an item… e.g. 2 milk, red peppers, size 4 diapers"
          className="min-w-0 flex-1 bg-transparent px-2 text-[16px] text-foreground outline-none placeholder:text-muted-foreground/60"
        />
        <button
          onClick={applyTyped}
          disabled={!draft.trim()}
          aria-label="Add item"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
        >
          <Plus className="size-5" strokeWidth={2} />
        </button>
      </div>

      {showList && (
        <ul
          id="grocery-ac-list"
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
        >
          {results.map((r, i) => (
            <li key={r.canonicalId} role="option" aria-selected={i === highlight}>
              <button
                onMouseDown={(e) => {
                  e.preventDefault()
                  applyCanonical(r)
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                  i === highlight ? 'bg-sage-soft/60' : 'active:bg-muted'
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground">{r.displayName}</span>
                <span className="shrink-0 text-[12px] text-muted-foreground">
                  {SHOPPING_CATEGORY_LABELS[r.shoppingCategory] ?? r.shoppingCategory}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ActiveRow({
  item,
  onComplete,
  onQty,
}: {
  item: GroceryItem
  onComplete: () => void
  onQty: (q: number) => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3">
      <button onClick={onComplete} aria-label={`Mark ${item.displayName} bought`}>
        <CheckBox checked={false} />
      </button>
      <span className="min-w-0 flex-1 truncate text-[16px] font-medium text-foreground">
        {item.displayName}
        {item.unit ? <span className="text-muted-foreground"> · {item.unit}</span> : null}
      </span>

      {/* Quantity stepper */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onQty(Math.max(1, item.quantity - 1))}
          disabled={item.quantity <= 1}
          aria-label="Decrease quantity"
          className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground transition-transform active:scale-90 disabled:opacity-30"
        >
          <Minus className="size-3.5" strokeWidth={2} />
        </button>
        <span className="w-5 text-center text-[15px] font-semibold tabular-nums">{item.quantity}</span>
        <button
          onClick={() => onQty(item.quantity + 1)}
          aria-label="Increase quantity"
          className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground transition-transform active:scale-90"
        >
          <Plus className="size-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
