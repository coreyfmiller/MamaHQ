'use client'

import { useState } from 'react'
import type { BottleContents, LogEntry, Side } from '@/lib/types'
import { newId } from '@/lib/store'
import { X } from 'lucide-react'

// Fast logging sheet for feed / diaper / pump. Big targets, few taps, sensible defaults so a
// common log is 1–3 taps. Sleep is handled as a direct toggle on Today (not here).
export function LogSheet({
  kind,
  babyName,
  onClose,
  onLog,
}: {
  kind: 'feed' | 'diaper' | 'pump'
  babyName: string
  onClose: () => void
  onLog: (entry: LogEntry) => void
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md rounded-t-3xl border-t border-border bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl text-foreground">
            {kind === 'feed' ? 'Feed' : kind === 'diaper' ? 'Diaper' : 'Pump'}
          </h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        {kind === 'feed' && <FeedForm onLog={onLog} />}
        {kind === 'diaper' && <DiaperForm onLog={onLog} />}
        {kind === 'pump' && <PumpForm onLog={onLog} />}
      </div>
    </div>
  )
}

// ---------- Feed ----------
function FeedForm({ onLog }: { onLog: (e: LogEntry) => void }) {
  const [method, setMethod] = useState<'breast' | 'bottle'>('breast')
  const [side, setSide] = useState<Side>('left')
  const [contents, setContents] = useState<BottleContents>('breast-milk')
  const [amount, setAmount] = useState('')

  function log() {
    const base = { id: newId(), kind: 'feed' as const, createdAt: new Date().toISOString() }
    if (method === 'breast') {
      onLog({ ...base, method: 'breast', side })
    } else {
      onLog({ ...base, method: 'bottle', contents, amountMl: amount ? Number(amount) : null })
    }
  }

  return (
    <div className="space-y-4">
      <Segmented
        options={[
          { v: 'breast', label: 'Breast' },
          { v: 'bottle', label: 'Bottle' },
        ]}
        value={method}
        onChange={(v) => setMethod(v as 'breast' | 'bottle')}
      />

      {method === 'breast' ? (
        <Field label="Side">
          <Segmented
            options={[
              { v: 'left', label: 'Left' },
              { v: 'right', label: 'Right' },
              { v: 'both', label: 'Both' },
            ]}
            value={side}
            onChange={(v) => setSide(v as Side)}
          />
        </Field>
      ) : (
        <>
          <Field label="Contents">
            <Segmented
              options={[
                { v: 'breast-milk', label: 'Breast milk' },
                { v: 'formula', label: 'Formula' },
                { v: 'unspecified', label: 'Either' },
              ]}
              value={contents}
              onChange={(v) => setContents(v as BottleContents)}
            />
          </Field>
          <Field label="Amount (ml) — optional">
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 100"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-primary focus:outline-none"
            />
          </Field>
        </>
      )}

      <LogButton onClick={log} />
    </div>
  )
}

// ---------- Diaper ----------
function DiaperForm({ onLog }: { onLog: (e: LogEntry) => void }) {
  function log(diaper: 'wet' | 'dirty' | 'both') {
    onLog({ id: newId(), kind: 'diaper', createdAt: new Date().toISOString(), diaper })
  }
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {(['wet', 'dirty', 'both'] as const).map((d) => (
        <button
          key={d}
          onClick={() => log(d)}
          className="rounded-2xl border border-border bg-background py-6 text-base font-medium capitalize text-foreground shadow-sm transition-transform active:scale-95 hover:border-primary/40"
        >
          {d}
        </button>
      ))}
    </div>
  )
}

// ---------- Pump ----------
function PumpForm({ onLog }: { onLog: (e: LogEntry) => void }) {
  const [side, setSide] = useState<Side>('both')
  const [amount, setAmount] = useState('')
  function log() {
    onLog({
      id: newId(),
      kind: 'pump',
      createdAt: new Date().toISOString(),
      side,
      amountMl: amount ? Number(amount) : null,
    })
  }
  return (
    <div className="space-y-4">
      <Field label="Side">
        <Segmented
          options={[
            { v: 'left', label: 'Left' },
            { v: 'right', label: 'Right' },
            { v: 'both', label: 'Both' },
          ]}
          value={side}
          onChange={(v) => setSide(v as Side)}
        />
      </Field>
      <Field label="Amount (ml) — optional">
        <input
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="e.g. 120"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-primary focus:outline-none"
        />
      </Field>
      <LogButton onClick={log} />
    </div>
  )
}

// ---------- shared ----------
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { v: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex gap-1.5 rounded-2xl bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors ${
            value === o.v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function LogButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl bg-primary py-3.5 text-base font-semibold text-primary-foreground transition-transform active:scale-95"
    >
      Log it
    </button>
  )
}
