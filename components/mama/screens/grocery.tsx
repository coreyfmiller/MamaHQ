'use client'

import { useMemo, useRef, useState } from 'react'
import { Plus, Minus, ShoppingCart, RotateCcw, Trash2, Check } from 'lucide-react'
import { useNav } from '../context'
import { useGrocery, type GroceryItem } from '../grocery'
import { CheckBox, Screen, Scroll, StatusBar, TopBar } from '../ui'
import { searchGrocery } from '@/lib/grocery/search/search'
import { SHOPPING_CATEGORY_LABELS } from '@/lib/grocery/search/labels'

/**
 * Grocery — the operational shared list. Add items (now with deterministic catalog
 * autocomplete, Step 4), adjust quantity, tap to mark bought (retains purchase
 * history), restore or remove. Autocomplete is assistance, never a gatekeeper:
 * typing + Enter always adds — as a canonical item if selected, else custom.
 */
export function GroceryScreen() {
  const { closeOverlay } = useNav()
  const { active, completed, addItem, editItem, completeItem, restoreItem, removeItem } = useGrocery()

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

        <AddRow onAdd={addItem} />

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

// The add input with deterministic catalog autocomplete. Keyboard: ↑/↓ move,
// Enter selects the highlighted result (or adds the typed text as a custom item if
// none highlighted), Escape closes the list. Touch/mouse: tap a result. Typing +
// Enter with no highlight always adds fast — autocomplete never blocks entry.
function AddRow({
  onAdd,
}: {
  onAdd: (displayName: string, opts?: { canonicalItemId?: string | null }) => void
}) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1) // -1 = no selection (Enter adds custom)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => (draft.trim() ? searchGrocery(draft, 8) : []), [draft])

  const reset = () => {
    setDraft('')
    setOpen(false)
    setHighlight(-1)
  }

  const addCustom = () => {
    const text = draft.trim()
    if (!text) return
    onAdd(text)
    reset()
  }

  const addCanonical = (r: { displayName: string; canonicalId: string }) => {
    onAdd(r.displayName, { canonicalItemId: r.canonicalId })
    reset()
    inputRef.current?.focus()
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
      if (open && highlight >= 0 && results[highlight]) addCanonical(results[highlight])
      else addCustom()
    } else if (e.key === 'Escape') {
      setOpen(false)
      setHighlight(-1)
    }
  }

  const showList = open && draft.trim().length > 0 && results.length > 0

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
          onBlur={() => setTimeout(() => setOpen(false), 120)} // allow tap to register
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showList}
          aria-controls="grocery-ac-list"
          aria-autocomplete="list"
          placeholder="Add an item… e.g. Milk, diapers, bananas"
          className="min-w-0 flex-1 bg-transparent px-2 text-[16px] text-foreground outline-none placeholder:text-muted-foreground/60"
        />
        <button
          onClick={addCustom}
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
                // onMouseDown (not onClick) so it fires before input blur closes the list
                onMouseDown={(e) => {
                  e.preventDefault()
                  addCanonical(r)
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
