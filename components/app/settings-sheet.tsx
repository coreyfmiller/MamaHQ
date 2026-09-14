'use client'

import { useState } from 'react'
import { BottomSheet, Section } from '@/components/app/ui'
import { Download, Loader2, ShieldCheck } from 'lucide-react'

// Settings — beta essentials for a product holding a newborn's data (SAFETY.md privacy):
// export your data, delete your account, and a plain privacy note. Opened from Today's menu.

export function SettingsSheet({ onClose, onSignOut }: { onClose: () => void; onSignOut: () => void }) {
  const [exporting, setExporting] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function exportData() {
    setExporting(true)
    setError(null)
    try {
      const res = await fetch('/api/account')
      if (!res.ok) throw new Error('Could not export right now.')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'mama-hq-export.json'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setExporting(false)
    }
  }

  async function deleteAccount() {
    if (confirmText !== 'DELETE') return
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      if (!res.ok) throw new Error('Could not delete right now.')
      // Data is gone; sign out and return to the landing.
      onSignOut()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setDeleting(false)
    }
  }

  return (
    <BottomSheet title="Settings" onClose={onClose}>
      <div className="space-y-6">
        <Section title="Your data">
          <button
            onClick={exportData}
            disabled={exporting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3.5 text-sm font-semibold text-foreground transition-transform active:scale-95 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export my data
          </button>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Downloads everything you’ve recorded — feeds, sleep, diapers, plans, questions, and
            memories — as a file you keep.
          </p>
        </Section>

        <Section title="Privacy">
          <div className="flex items-start gap-2.5 rounded-2xl border border-border bg-card p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Your family’s information is private to you. We don’t sell it, and we don’t use it for
              advertising. It’s isolated so no other family can ever see it.
            </p>
          </div>
        </Section>

        <Section title="Delete account">
          <p className="text-xs leading-relaxed text-muted-foreground">
            This permanently deletes your baby, all logs, plans, questions, and memories. It cannot
            be undone. Type <span className="font-semibold text-foreground">DELETE</span> to confirm.
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-destructive focus:outline-none"
          />
          <button
            onClick={deleteAccount}
            disabled={confirmText !== 'DELETE' || deleting}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive/10 py-3.5 text-sm font-semibold text-destructive transition-transform active:scale-95 disabled:opacity-40"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Delete everything
          </button>
        </Section>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </BottomSheet>
  )
}
