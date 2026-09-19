'use client'

import { useState } from 'react'
import { Plus, Minus, ShoppingCart, RotateCcw, Trash2, Check } from 'lucide-react'
import { useNav } from '../context'
import { useGrocery, type GroceryItem } from '../grocery'
import { CheckBox, Screen, Scroll, StatusBar, TopBar } from '../ui'

/**
 * Grocery — the operational shared list (Step 2). Add items, adjust quantity,
 * tap to mark bought (which retains purchase history), and a "Bought" section to
 * restore or remove. Deliberately simple: no catalog, search, or AI.
 */
export function GroceryScreen() {
  const { closeOverlay } = useNav()
  const { active, completed, addItem, editItem, completeItem, restoreItem, removeItem } = useGrocery()
  const [draft, setDraft] = useState('')

  const add = () => {
    const text = draft.trim()
    if (!text) return
    addItem(text)
    setDraft('')
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

        {/* Add row */}
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2 focus-within:border-primary">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add()
            }}
            placeholder="Add an item… e.g. Milk, diapers, bananas"
            className="min-w-0 flex-1 bg-transparent px-2 text-[16px] text-foreground outline-none placeholder:text-muted-foreground/60"
          />
          <button
            onClick={add}
            disabled={!draft.trim()}
            aria-label="Add item"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
          >
            <Plus className="size-5" strokeWidth={2} />
          </button>
        </div>

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
