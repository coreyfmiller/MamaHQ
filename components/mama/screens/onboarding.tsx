'use client'

import { useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { Clock, HeartHandshake, Sparkles, Heart, Camera, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNav } from '../context'
import { useProfile, type Feeding, type Profile } from '../profile'
import { NameAvatar } from '../name-avatar'
import { LeafSprig } from '../decor'
import { Screen, Scroll, StatusBar } from '../ui'
import { downscaleImage } from '@/lib/utils'

const values = [
  { Icon: Sparkles, label: 'Less to remember' },
  { Icon: Clock, label: 'More time for what matters' },
  { Icon: HeartHandshake, label: 'Support for every stage' },
]

// Steps after the welcome slide. Kept short — this is a tender moment, not a form marathon.
type Step = 'welcome' | 'mom' | 'baby' | 'feeding' | 'photo'
const STEPS: Step[] = ['welcome', 'mom', 'baby', 'feeding', 'photo']

const feedingOptions: { value: Feeding; label: string; sub: string }[] = [
  { value: 'breast', label: 'Breast', sub: 'Nursing' },
  { value: 'bottle', label: 'Bottle', sub: 'Formula or pumped' },
  { value: 'both', label: 'Both', sub: 'A mix of the two' },
]

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function OnboardingScreen() {
  const { setPhase, setTab } = useNav()
  const { saveProfile } = useProfile()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('welcome')
  const [momName, setMomName] = useState('')
  const [babyName, setBabyName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [feeding, setFeeding] = useState<Feeding | null>(null)
  const [photo, setPhoto] = useState<string | undefined>(undefined)

  const index = STEPS.indexOf(step)

  const finish = () => {
    const profile: Profile = {
      momName: momName.trim() || 'Mama',
      babyName: babyName.trim() || 'Baby',
      birthDate: birthDate || todayISO(),
      feeding: feeding ?? 'both',
      photo,
    }
    saveProfile(profile)
    setTab('today')
    setPhase('app')
  }

  const next = () => {
    const i = STEPS.indexOf(step)
    if (i < STEPS.length - 1) setStep(STEPS[i + 1])
    else finish()
  }
  const back = () => {
    const i = STEPS.indexOf(step)
    if (i > 0) setStep(STEPS[i - 1])
  }

  // Per-step gate for the primary button.
  const canContinue =
    step === 'welcome' ||
    (step === 'mom' && momName.trim().length > 0) ||
    (step === 'baby' && babyName.trim().length > 0 && birthDate.length > 0) ||
    (step === 'feeding' && feeding !== null) ||
    step === 'photo' // photo is optional

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset the input so picking the same file again still fires onChange.
    e.target.value = ''
    if (!file) return
    // Downscale to a small thumbnail before storing. A full phone photo as a
    // base64 data URL can be several MB and blow past the ~5MB localStorage
    // quota, which would silently drop the whole profile on save. A ~256px
    // JPEG keeps it tiny and well within budget.
    downscaleImage(file, 256, 0.8)
      .then(setPhoto)
      .catch(() => setPhoto(undefined))
  }

  /* ---------------- Welcome slide (unchanged in spirit) ---------------- */
  if (step === 'welcome') {
    return (
      <Screen>
        <StatusBar />
        <LeafSprig className="pointer-events-none absolute -right-6 -top-2 h-40 w-24 rotate-12 opacity-70" />
        <Scroll className="flex flex-col px-7">
          <div className="mt-2 flex items-center gap-1.5">
            <Heart className="size-4 fill-blush text-blush" />
            <span className="font-serif text-xl font-semibold tracking-tight">MamaHQ</span>
          </div>

          <div className="mt-8 text-center">
            <h1 className="text-balance font-serif text-[30px] leading-[1.15] font-semibold tracking-tight">
              MamaHQ is here for the real moments.
            </h1>
            <p className="mx-auto mt-4 max-w-[17rem] text-pretty text-[15px] leading-relaxed text-muted-foreground">
              Capture, remember and stay organized through every stage of motherhood.
            </p>
          </div>

          <div className="relative mt-7 aspect-[5/4] w-full overflow-hidden rounded-[1.75rem]">
            <Image
              src="/images/newborn-hand.png"
              alt="A newborn baby holding a parent's finger"
              fill
              sizes="400px"
              className="object-cover"
              priority
            />
          </div>

          <ul className="mt-7 space-y-3">
            {values.map(({ Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-2xl bg-sage-soft text-sage">
                  <Icon className="size-[18px]" strokeWidth={1.75} />
                </span>
                <span className="text-[15px] font-medium">{label}</span>
              </li>
            ))}
          </ul>
        </Scroll>

        <div className="px-7 pt-3 pb-8">
          <Dots index={index} />
          <Button
            onClick={next}
            className="mt-4 h-14 w-full rounded-full bg-primary text-[16px] font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)]"
          >
            Get started
          </Button>
          <button
            onClick={finish}
            className="mt-3 w-full text-center text-[14px] font-medium text-muted-foreground"
          >
            I already have an account
          </button>
        </div>
      </Screen>
    )
  }

  /* ---------------- Data-entry steps ---------------- */
  return (
    <Screen>
      <StatusBar />
      <div className="px-6 pt-2">
        <button onClick={back} className="text-[14px] font-medium text-muted-foreground">
          ← Back
        </button>
      </div>

      <Scroll className="flex flex-col px-7 pt-4">
        {step === 'mom' && (
          <StepShell
            title="First, what should we call you?"
            sub="MamaHQ is for you too, not just the baby."
          >
            <TextField
              value={momName}
              onChange={setMomName}
              placeholder="Your name"
              autoFocus
              onEnter={() => canContinue && next()}
            />
          </StepShell>
        )}

        {step === 'baby' && (
          <StepShell title="Tell us about your little one." sub="This shapes your day and their age.">
            <TextField
              value={babyName}
              onChange={setBabyName}
              placeholder="Baby's name"
              autoFocus
            />
            <label className="mt-4 block">
              <span className="mb-1.5 block px-1 text-[13px] font-medium text-muted-foreground">
                Birth date
              </span>
              <input
                type="date"
                value={birthDate}
                max={todayISO()}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-[16px] text-foreground outline-none focus:border-primary"
              />
            </label>
          </StepShell>
        )}

        {step === 'feeding' && (
          <StepShell title="How are you feeding right now?" sub="You can change this anytime.">
            <div className="space-y-2.5">
              {feedingOptions.map((o) => {
                const active = feeding === o.value
                return (
                  <button
                    key={o.value}
                    onClick={() => setFeeding(o.value)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                      active ? 'border-primary bg-sage-soft' : 'border-border bg-card'
                    }`}
                  >
                    <span>
                      <span className="block text-[15px] font-semibold">{o.label}</span>
                      <span className="block text-[13px] text-muted-foreground">{o.sub}</span>
                    </span>
                    {active && (
                      <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-4" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </StepShell>
        )}

        {step === 'photo' && (
          <StepShell
            title="Add a photo of your baby?"
            sub="Totally optional — we'll use their initial if you skip."
          >
            <div className="flex flex-col items-center pt-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="relative flex size-32 items-center justify-center rounded-full border border-dashed border-border bg-card transition-colors active:bg-muted"
                aria-label="Choose a photo"
              >
                {photo ? (
                  <NameAvatar name={babyName || 'Baby'} photo={photo} className="size-32" />
                ) : babyName.trim() ? (
                  <NameAvatar name={babyName} className="size-32" textClassName="text-4xl" />
                ) : (
                  <Camera className="size-8 text-muted-foreground" strokeWidth={1.5} />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={onPickPhoto}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="mt-4 text-[14px] font-medium text-primary"
              >
                {photo ? 'Choose a different photo' : 'Choose a photo'}
              </button>
              {photo && (
                <button
                  onClick={() => setPhoto(undefined)}
                  className="mt-1 text-[13px] font-medium text-muted-foreground"
                >
                  Remove
                </button>
              )}
            </div>
          </StepShell>
        )}
      </Scroll>

      <div className="px-7 pt-3 pb-8">
        <Dots index={index} />
        <Button
          onClick={next}
          disabled={!canContinue}
          className="mt-4 h-14 w-full rounded-full bg-primary text-[16px] font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] disabled:opacity-40"
        >
          {step === 'photo' ? (photo ? 'All set' : 'Skip for now') : 'Continue'}
        </Button>
      </div>
    </Screen>
  )
}

/* ---------------- Small building blocks ---------------- */

function StepShell({
  title,
  sub,
  children,
}: {
  title: string
  sub: string
  children: ReactNode
}) {
  return (
    <div>
      <h1 className="text-balance font-serif text-[26px] leading-tight font-semibold tracking-tight">
        {title}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{sub}</p>
      <div className="mt-6">{children}</div>
    </div>
  )
}

function TextField({
  value,
  onChange,
  placeholder,
  autoFocus = false,
  onEnter,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  autoFocus?: boolean
  onEnter?: () => void
}) {
  return (
    <input
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-[16px] text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary"
    />
  )
}

function Dots({ index }: { index: number }) {
  return (
    <div className="flex justify-center gap-1.5">
      {STEPS.map((s, i) => (
        <span
          key={s}
          className={`h-1.5 rounded-full transition-all ${
            i === index ? 'w-5 bg-primary' : 'w-1.5 bg-border'
          }`}
        />
      ))}
    </div>
  )
}
