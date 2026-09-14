'use client'

import { useMemo, useState } from 'react'
import type { Baby } from '@/lib/types'
import { dayNumber } from '@/lib/store'
import { PrimaryButton } from '@/components/app/ui'
import { Loader2 } from 'lucide-react'

// Short guided setup, shown once when a baby isn't onboarded. Calm, one thing per step,
// minimum questions (PRODUCT.md). Ends on "Welcome to Day X."

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// Launch market is Canada, but country is data — not baked into the brand (PRODUCT.md).
const COUNTRIES = [
  { code: 'CA', label: 'Canada' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'AU', label: 'Australia' },
]

type Step = 'name' | 'birth' | 'place'

export function Onboarding({ onDone }: { onDone: (baby: Baby) => void }) {
  const [step, setStep] = useState<Step>('name')
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState(todayISO())
  const [country, setCountry] = useState('CA')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const day = useMemo(() => dayNumber(birthDate), [birthDate])

  async function finish() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ babyName: name.trim(), birthDate, country }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save setup.')
      onDone(data.baby as Baby)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center bg-background px-8">
      <div className="w-full">
        {step === 'name' && (
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Welcome to Mama HQ
            </p>
            <h1 className="mt-3 font-serif text-3xl leading-tight text-foreground">
              What’s your baby’s name?
            </h1>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Baby’s name"
              autoFocus
              maxLength={100}
              className="mt-6 w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-lg text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
            <PrimaryButton
              onClick={() => setStep('birth')}
              disabled={!name.trim()}
              className="mt-6"
            >
              Continue
            </PrimaryButton>
          </div>
        )}

        {step === 'birth' && (
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              About {name.trim()}
            </p>
            <h1 className="mt-3 font-serif text-3xl leading-tight text-foreground">
              When was {name.trim()} born?
            </h1>
            <input
              type="date"
              value={birthDate}
              max={todayISO()}
              onChange={(e) => setBirthDate(e.target.value)}
              className="mt-6 w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-lg text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
            <p className="mt-3 text-sm text-muted-foreground">
              That makes today <span className="text-foreground">Day {day}</span>.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setStep('name')}
                className="flex-1 rounded-2xl border border-border bg-card py-3.5 text-base font-semibold text-foreground"
              >
                Back
              </button>
              <PrimaryButton onClick={() => setStep('place')} className="flex-[2]">
                Continue
              </PrimaryButton>
            </div>
          </div>
        )}

        {step === 'place' && (
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Almost there
            </p>
            <h1 className="mt-3 font-serif text-3xl leading-tight text-foreground">Where are you?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This helps us keep things relevant later. You can change it anytime.
            </p>
            <div className="mt-6 space-y-2">
              {COUNTRIES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => setCountry(c.code)}
                  aria-pressed={country === c.code}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-base transition-colors ${
                    country === c.code
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border bg-card text-foreground'
                  }`}
                >
                  {c.label}
                  {country === c.code && <span className="text-primary">✓</span>}
                </button>
              ))}
            </div>

            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setStep('birth')}
                disabled={busy}
                className="flex-1 rounded-2xl border border-border bg-card py-3.5 text-base font-semibold text-foreground disabled:opacity-50"
              >
                Back
              </button>
              <PrimaryButton onClick={finish} disabled={busy} className="flex-[2]">
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" /> Setting up…
                  </span>
                ) : (
                  `Start Day ${day}`
                )}
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
