'use client'

import { useState } from 'react'
import type { BottleContents, LogEntry, Side } from '@/lib/types'
import { newId } from '@/lib/store'
import { BottomSheet, Segmented, AmountChips, Field, PrimaryButton } from '@/components/app/ui'

// Fast logging sheet for feed / diaper / pump. Big targets, few taps, sensible defaults so a
// common log is 1–3 taps. Breast feeding as a running session (start → switch → stop) is handled
// on Today; this sheet handles the quick "log it now" cases.
export function LogSheet({
  kind,
  babyName,
  lastBottle,
  onClose,
  onLog,
  onStartBreastFeed,
}: {
  kind: 'feed' | 'diaper' | 'pump'
  babyName: string
  // Remembered last bottle (contents/amount) so Flow B can be ~3s.
  lastBottle?: { contents: BottleContents; amountMl: number | null } | null
  onClose: () => void
  onLog: (entry: LogEntry) => void
  // Start a running breastfeeding session (ends from Today, like sleep).
  onStartBreastFeed?: (side: Side) => void
}) {
  const title = kind === 'feed' ? 'Feed' : kind === 'diaper' ? 'Diaper' : 'Pump'
  return (
    <BottomSheet title={title} onClose={onClose}>
      {kind === 'feed' && (
        <FeedForm onLog={onLog} lastBottle={lastBottle} onStartBreastFeed={onStartBreastFeed} />
      )}
      {kind === 'diaper' && <DiaperForm onLog={onLog} />}
      {kind === 'pump' && <PumpForm onLog={onLog} />}
    </BottomSheet>
  )
}

const BOTTLE_AMOUNTS = [60, 90, 120, 150]
const PUMP_AMOUNTS = [60, 90, 120, 150]

// ---------- Feed ----------
function FeedForm({
  onLog,
  lastBottle,
  onStartBreastFeed,
}: {
  onLog: (e: LogEntry) => void
  lastBottle?: { contents: BottleContents; amountMl: number | null } | null
  onStartBreastFeed?: (side: Side) => void
}) {
  const [method, setMethod] = useState<'breast' | 'bottle'>('breast')
  const [side, setSide] = useState<Side>('left')
  // Default contents to the last bottle used, so the common case is fewer taps.
  const [contents, setContents] = useState<BottleContents>(lastBottle?.contents ?? 'breast-milk')
  const [amount, setAmount] = useState<string>(lastBottle?.amountMl ? String(lastBottle.amountMl) : '')

  function logBottle() {
    onLog({
      id: newId(),
      kind: 'feed',
      createdAt: new Date().toISOString(),
      method: 'bottle',
      contents,
      amountMl: amount ? Number(amount) : null,
    })
  }

  const amountNum = amount ? Number(amount) : null

  return (
    <div className="space-y-4">
      <Segmented
        ariaLabel="Feed method"
        options={[
          { v: 'breast', label: 'Breast' },
          { v: 'bottle', label: 'Bottle' },
        ]}
        value={method}
        onChange={(v) => setMethod(v)}
      />

      {method === 'breast' ? (
        <>
          <Field label="Side">
            <Segmented
              ariaLabel="Side"
              options={[
                { v: 'left', label: 'Left' },
                { v: 'right', label: 'Right' },
                { v: 'both', label: 'Both' },
              ]}
              value={side}
              onChange={(v) => setSide(v)}
            />
          </Field>
          {/* Flow A: start a running session that survives reload; ends from Today. */}
          <PrimaryButton onClick={() => onStartBreastFeed?.(side)}>Start feeding</PrimaryButton>
        </>
      ) : (
        <>
          <Field label="Contents">
            <Segmented
              ariaLabel="Contents"
              options={[
                { v: 'breast-milk', label: 'Breast milk' },
                { v: 'formula', label: 'Formula' },
                { v: 'unspecified', label: 'Either' },
              ]}
              value={contents}
              onChange={(v) => setContents(v)}
            />
          </Field>
          <Field label="Amount">
            <AmountChips
              values={BOTTLE_AMOUNTS}
              selected={BOTTLE_AMOUNTS.includes(amountNum ?? -1) ? amountNum : null}
              onSelect={(v) => setAmount(String(v))}
            />
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="or type ml"
              aria-label="Amount in millilitres"
              className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-primary focus:outline-none"
            />
          </Field>
          <PrimaryButton onClick={logBottle}>Log it</PrimaryButton>
        </>
      )}
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
  const amountNum = amount ? Number(amount) : null
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
          ariaLabel="Side"
          options={[
            { v: 'left', label: 'Left' },
            { v: 'right', label: 'Right' },
            { v: 'both', label: 'Both' },
          ]}
          value={side}
          onChange={(v) => setSide(v)}
        />
      </Field>
      <Field label="Amount">
        <AmountChips
          values={PUMP_AMOUNTS}
          selected={PUMP_AMOUNTS.includes(amountNum ?? -1) ? amountNum : null}
          onSelect={(v) => setAmount(String(v))}
        />
        <input
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="or type ml"
          aria-label="Amount in millilitres"
          className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-primary focus:outline-none"
        />
      </Field>
      <PrimaryButton onClick={log}>Log it</PrimaryButton>
    </div>
  )
}
