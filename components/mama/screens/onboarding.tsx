'use client'

import { useState, type ReactNode } from 'react'
import { Heart, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNav } from '../context'
import { useProfile } from '../profile'
import { useHousehold } from '../household'
import { LeafSprig } from '../decor'
import { Screen, Scroll, StatusBar } from '../ui'
import {
  ONBOARDING_COMPLETE_TAB,
  babySetupToProfile,
  localTodayISO,
  validateBabySetup,
  type BabySetupErrors,
} from '@/lib/onboarding'

// MamaHQ 2.0 first-run household setup. Collects EXACTLY:
//   1. the user's name  → canonical HouseholdPerson name (trusted renameMe RPC)
//   2. Baby's name + birthday → canonical babies row (profile.babyName / birthDate)
// then lands on Today. The step is chosen by Stage from PERSISTED data
// (lib/onboarding resolveSetupRoute), never local wizard state — so a partially set-up
// household resumes at the right step and an established one never sees this.
// Nothing is manufactured here: Day N, affirmations and Today's Read are derived by
// the existing First90 architecture from the saved birth date.
export function OnboardingScreen({ step }: { step: 'name' | 'baby' }) {
  return step === 'name' ? <NameStep /> : <BabyStep />
}

/* ─────────────────────────── Step 1 — About you ─────────────────────────── */

function NameStep() {
  const { renameMe } = useHousehold()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Advance ONLY when the canonical identity actually persisted (§14 truth guarantee).
  // On success firstRun flips to 'done' and Stage resolves the next step (Baby) from
  // persisted data — this screen does not navigate itself.
  const submit = async () => {
    const clean = name.trim()
    if (!clean || saving) return
    setSaving(true)
    setError(null)
    const res = await renameMe(clean)
    setSaving(false)
    if (!res.ok) setError(res.error ?? 'We couldn’t save your name. Please try again.')
  }

  return (
    <SetupScreen>
      <div className="mt-2 flex items-center gap-1.5">
        <Heart className="size-4 fill-blush text-blush" />
        <span className="font-serif text-xl font-semibold tracking-tight">MamaHQ</span>
      </div>

      <div className="mt-10">
        <h1 className="text-balance font-serif text-[30px] leading-[1.15] font-semibold tracking-tight">
          Welcome to MamaHQ
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          Your first 90 days. All in one place.
        </p>
      </div>

      <div className="mt-10">
        <FieldLabel htmlFor="onboarding-name">What should we call you?</FieldLabel>
        <input
          id="onboarding-name"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={name}
          autoComplete="given-name"
          onChange={(e) => {
            setName(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Name"
          aria-invalid={!!error}
          aria-describedby={error ? 'onboarding-name-error' : undefined}
          className={inputClass}
        />
        {error && <FieldError id="onboarding-name-error">{error}</FieldError>}
      </div>

      <PrimaryButton onClick={submit} disabled={name.trim().length === 0 || saving} busy={saving}>
        Continue →
      </PrimaryButton>
    </SetupScreen>
  )
}

/* ─────────────────────────── Step 2 — About Baby ─────────────────────────── */

function BabyStep() {
  const { setTab } = useNav()
  const { me } = useHousehold()
  const { profile, saveProfile } = useProfile()

  // Resume with whatever canonical Baby data already exists (partial local profile).
  const [babyName, setBabyName] = useState(() => profile?.babyName ?? '')
  const [birthDate, setBirthDate] = useState(() => profile?.birthDate ?? '')
  // Validation messages appear only after the user tries to continue.
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const today = localTodayISO()
  const result = validateBabySetup({ babyName, birthDate })
  const errors: BabySetupErrors = attempted && !result.ok ? result.errors : {}

  const submit = async () => {
    if (saving) return
    setAttempted(true)
    setSaveError(null)
    if (!result.ok) return
    setSaving(true)
    // Writes the canonical babies row (name + birth_date). Once it persists, Stage's
    // persisted-data routing resolves to the app; we land on Today.
    setTab(ONBOARDING_COMPLETE_TAB)
    const res = await saveProfile(
      babySetupToProfile(result, me?.displayName?.trim() || profile?.momName || 'Mama', profile),
    )
    setSaving(false)
    if (!res.ok) setSaveError('We couldn’t save Baby’s details. Please try again.')
  }

  return (
    <SetupScreen>
      <div className="mt-6">
        <h1 className="text-balance font-serif text-[28px] leading-[1.15] font-semibold tracking-tight">
          Tell us about Baby
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          This helps MamaHQ personalize your first 90 days.
        </p>
      </div>

      <div className="mt-8 space-y-5">
        <div>
          <FieldLabel htmlFor="onboarding-baby-name">Baby’s name</FieldLabel>
          <input
            id="onboarding-baby-name"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={babyName}
            onChange={(e) => setBabyName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Baby name"
            aria-invalid={!!errors.babyName}
            aria-describedby={errors.babyName ? 'onboarding-baby-name-error' : undefined}
            className={inputClass}
          />
          {errors.babyName && <FieldError id="onboarding-baby-name-error">{errors.babyName}</FieldError>}
        </div>

        <div>
          <FieldLabel htmlFor="onboarding-baby-birthday">Baby’s birthday</FieldLabel>
          <input
            id="onboarding-baby-birthday"
            type="date"
            value={birthDate}
            max={today}
            onChange={(e) => setBirthDate(e.target.value)}
            aria-invalid={!!errors.birthDate}
            aria-describedby={errors.birthDate ? 'onboarding-baby-birthday-error' : undefined}
            className={inputClass}
          />
          {errors.birthDate && <FieldError id="onboarding-baby-birthday-error">{errors.birthDate}</FieldError>}
        </div>

        {saveError && <FieldError id="onboarding-baby-save-error">{saveError}</FieldError>}
      </div>

      <PrimaryButton onClick={submit} disabled={saving} busy={saving}>
        Start MamaHQ →
      </PrimaryButton>
    </SetupScreen>
  )
}

/* ─────────────────────────── Shared building blocks ─────────────────────────── */

const inputClass =
  'w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-[16px] text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary aria-[invalid=true]:border-destructive'

function SetupScreen({ children }: { children: ReactNode }) {
  return (
    <Screen>
      <StatusBar />
      <LeafSprig className="pointer-events-none absolute -right-6 -top-2 h-40 w-24 rotate-12 opacity-70" />
      <Scroll className="flex flex-col px-7 pt-4 pb-8">{children}</Scroll>
    </Screen>
  )
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block px-1 text-[15px] font-semibold text-foreground">
      {children}
    </label>
  )
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-2 flex items-start gap-1.5 px-1 text-[13px] text-destructive">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {children}
    </p>
  )
}

function PrimaryButton({
  onClick,
  disabled,
  busy,
  children,
}: {
  onClick: () => void
  disabled: boolean
  busy: boolean
  children: ReactNode
}) {
  return (
    <div className="mt-8">
      <Button
        onClick={onClick}
        disabled={disabled}
        className="h-14 w-full rounded-full bg-primary text-[16px] font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] disabled:opacity-40"
      >
        {busy ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Saving…
          </span>
        ) : (
          children
        )}
      </Button>
    </div>
  )
}
