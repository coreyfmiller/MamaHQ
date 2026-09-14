'use client'

import { useState } from 'react'
import type { AppState, Memory } from '@/lib/types'
import type { Actions } from '@/components/app/mama-hq-app'
import { newId } from '@/lib/store'
import { Camera, Plus, Trash2, X } from 'lucide-react'

// Memories: the tiny moments hiding inside the chaos. V1 is text — a dated moment
// you don't want to forget. Photos are a planned follow-up (Supabase Storage).

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso: string): string {
  // iso is YYYY-MM-DD; render as a warm, short date without timezone drift.
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  return dt.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

export function MemoriesTab({ state, actions }: { state: AppState; actions: Actions }) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [when, setWhen] = useState(todayISO())

  function reset() {
    setTitle('')
    setNote('')
    setWhen(todayISO())
    setAdding(false)
  }

  function save() {
    const t = title.trim()
    if (!t) return
    const memory: Memory = {
      id: newId(),
      createdAt: new Date().toISOString(),
      occurredOn: when || todayISO(),
      title: t,
      note: note.trim() || null,
    }
    actions.addMemory(memory)
    reset()
  }

  const memories = state.memories

  return (
    <div className="px-5 pt-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl text-foreground">Memories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The little moments you don’t want to lose.
          </p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="mt-1 flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        )}
      </div>

      {/* Composer */}
      {adding && (
        <div className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              A new moment
            </p>
            <button onClick={reset} aria-label="Cancel" className="rounded-full p-1 text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="First real smile"
            maxLength={200}
            autoFocus
            className="mt-3 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Anything you want to remember about it… (optional)"
            maxLength={4000}
            className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
          <div className="mt-2 flex items-center gap-2">
            <label className="text-xs text-muted-foreground" htmlFor="mem-date">
              When
            </label>
            <input
              id="mem-date"
              type="date"
              value={when}
              max={todayISO()}
              onChange={(e) => setWhen(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </div>

          <button
            onClick={save}
            disabled={!title.trim()}
            className="mt-4 w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
          >
            Save this moment
          </button>
        </div>
      )}

      {/* List */}
      {memories.length === 0 && !adding ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-accent/50 text-primary">
            <Camera className="h-5 w-5" />
          </span>
          <p className="mt-3 font-serif text-lg text-foreground">No moments yet</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
            The days are long, but they go fast. Jot down the first smile, the tiny sounds, the ordinary
            afternoons you’ll want back.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3 pb-4">
          {memories.map((m) => (
            <MemoryRow key={m.id} memory={m} onDelete={() => actions.deleteMemory(m.id)} />
          ))}
        </ul>
      )}
    </div>
  )
}

function MemoryRow({ memory, onDelete }: { memory: Memory; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <li className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {formatDate(memory.occurredOn)}
          </p>
          <p className="mt-1 font-serif text-lg leading-snug text-foreground">{memory.title}</p>
          {memory.note && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{memory.note}</p>}
        </div>
        {confirming ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={onDelete}
              className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-full px-2 py-1 text-xs text-muted-foreground"
            >
              Keep
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            aria-label="Delete memory"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground/60 transition-colors hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </li>
  )
}
