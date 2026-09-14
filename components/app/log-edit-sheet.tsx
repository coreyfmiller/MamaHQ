'use client'

import { useState } from 'react'
import type { LogEntry } from '@/lib/types'
import { BottomSheet, Segmented, Field, PrimaryButton } from '@/components/app/ui'
import { Trash2 } from 'lucide-react'

// Edit / correct a past log (Step 7): fix the time, amount, diaper kind, or delete a mislog.
// Time correction is the most common need ("I forgot to log the 3am feed until 5am").

// datetime-local wants "YYYY-MM-DDTHH:mm" in LOCAL time.
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromLocalInput(v: string): string {
  return new Date(v).toISOString()
}

export function LogEditSheet({
  entry,
  onClose,
  onSave,
  onDelete,
}: {
  entry: LogEntry
  onClose: () => void
  onSave: (id: string, local: Partial<LogEntry>, patch: Record<string, unknown>) => void
  onDelete: (id: string) => void
}) {
  const [when, setWhen] = useState(toLocalInput(entry.createdAt))
  const [amount, setAmount] = useState(
    entry.kind === 'feed' || entry.kind === 'pump' ? (entry.amountMl != null ? String(entry.amountMl) : '') : '',
  )
  const [diaper, setDiaper] = useState(entry.kind === 'diaper' ? entry.diaper : 'wet')
  const [confirmDelete, setConfirmDelete] = useState(false)

  function save() {
    const createdAt = fromLocalInput(when)
    const local: Partial<LogEntry> = { createdAt } as Partial<LogEntry>
    const patch: Record<string, unknown> = { createdAt }

    if (entry.kind === 'feed' && entry.method === 'bottle') {
      const n = amount ? Number(amount) : null
      ;(local as { amountMl?: number | null }).amountMl = n
      patch.amountMl = n
    }
    if (entry.kind === 'pump') {
      const n = amount ? Number(amount) : null
      ;(local as { amountMl?: number | null }).amountMl = n
      patch.amountMl = n
    }
    if (entry.kind === 'diaper') {
      ;(local as { diaper?: string }).diaper = diaper
      patch.diaper = diaper
    }
    onSave(entry.id, local, patch)
    onClose()
  }

  const title =
    entry.kind === 'feed'
      ? entry.method === 'breast'
        ? 'Edit nursing'
        : 'Edit bottle'
      : entry.kind === 'sleep'
        ? 'Edit sleep'
        : entry.kind === 'diaper'
          ? 'Edit diaper'
          : 'Edit pump'

  const showAmount =
    (entry.kind === 'feed' && entry.method === 'bottle') || entry.kind === 'pump'

  return (
    <BottomSheet title={title} onClose={onClose}>
      <div className="space-y-4">
        <Field label="When">
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-primary focus:outline-none"
          />
        </Field>

        {showAmount && (
          <Field label="Amount (ml) — optional">
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 120"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-primary focus:outline-none"
            />
          </Field>
        )}

        {entry.kind === 'diaper' && (
          <Field label="Type">
            <Segmented
              ariaLabel="Diaper type"
              options={[
                { v: 'wet', label: 'Wet' },
                { v: 'dirty', label: 'Dirty' },
                { v: 'both', label: 'Both' },
              ]}
              value={diaper}
              onChange={(v) => setDiaper(v as 'wet' | 'dirty' | 'both')}
            />
          </Field>
        )}

        <PrimaryButton onClick={save}>Save changes</PrimaryButton>

        {confirmDelete ? (
          <div className="flex items-center justify-between rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3">
            <span className="text-sm text-foreground">Delete this entry?</span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onDelete(entry.id)
                  onClose()
                }}
                className="rounded-full bg-destructive/10 px-3 py-1 text-sm font-semibold text-destructive"
              >
                Delete
              </button>
              <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 text-sm text-muted-foreground">
                Keep
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex w-full items-center justify-center gap-2 py-1 text-sm text-muted-foreground transition-colors hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete this entry
          </button>
        )}
      </div>
    </BottomSheet>
  )
}
