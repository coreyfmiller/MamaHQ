'use client'

import { useMemo, useState } from 'react'
import { Heart, Check, Loader2, AlertCircle, Users, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNav } from '../context'
import { useHousehold } from '../household'
import { LeafSprig } from '../decor'
import { Screen, Scroll, StatusBar } from '../ui'

// The INVITED partner's first run (firstRun === 'partner'). They already belong to
// an existing household — the invite acceptance (Step 7 RPC, run at sign-in) created
// exactly ONE membership and linked their EXISTING HouseholdPerson. So this flow
// must NOT create a household, a person, or any duplicate. It only:
//   1. establishes their canonical name (their linked person is still the 'Member'
//      placeholder), via the trusted renameMe RPC — blocking on real success, and
//   2. shows them the household they joined + who's already here, then
//   3. drops them into the real product.
type Step = 'name' | 'welcome'

export function PartnerJoinScreen() {
  const { setTab, dismissOnboarding } = useNav()
  const { me, people, renameMe } = useHousehold()

  const [step, setStep] = useState<Step>('name')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Everyone in the household except me — this is the existing shared state I'm
  // joining, surfaced honestly (real people, no fabrication).
  const others = useMemo(
    () => people.filter((p) => p.id !== me?.id),
    [people, me],
  )

  const submitName = async () => {
    const clean = name.trim()
    if (!clean || saving) return
    setSaving(true)
    setError(null)
    const res = await renameMe(clean)
    setSaving(false)
    if (!res.ok) {
      setError(res.error ?? 'We couldn’t save your name. Please try again.')
      return
    }
    setStep('welcome')
  }

  const enter = () => {
    setTab('today')
    dismissOnboarding()
  }

  if (step === 'name') {
    return (
      <Screen>
        <StatusBar />
        <LeafSprig className="pointer-events-none absolute -right-6 -top-2 h-40 w-24 rotate-12 opacity-70" />
        <Scroll className="flex flex-col px-7 pt-4">
          <div className="mt-2 flex items-center gap-1.5">
            <Heart className="size-4 fill-blush text-blush" />
            <span className="font-serif text-xl font-semibold tracking-tight">MamaHQ</span>
          </div>

          <div className="mt-8">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-3 py-1 text-[13px] font-medium text-sage">
              <Users className="size-3.5" /> You’ve joined the household
            </span>
            <h1 className="mt-4 text-balance font-serif text-[27px] leading-tight font-semibold tracking-tight">
              Welcome in. What should we call you?
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
              This is how your household will see you — on tasks, the calendar, and everywhere
              you’re involved.
            </p>
          </div>

          <div className="mt-6">
            <input
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (error) setError(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && submitName()}
              placeholder="Your name"
              className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-[16px] text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary"
            />
            {error && (
              <p className="mt-2 flex items-start gap-1.5 px-1 text-[13px] text-destructive">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {error}
              </p>
            )}
          </div>
        </Scroll>

        <div className="px-7 pt-3 pb-8">
          <Button
            onClick={submitName}
            disabled={name.trim().length === 0 || saving}
            className="h-14 w-full rounded-full bg-primary text-[16px] font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] disabled:opacity-40"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Saving…
              </span>
            ) : (
              'Continue'
            )}
          </Button>
        </div>
      </Screen>
    )
  }

  /* ── Welcome: the household you joined + who's here ── */
  return (
    <Screen>
      <StatusBar />
      <Scroll className="flex flex-col px-7 pt-6">
        <div className="text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-sage-soft text-sage">
            <Check className="size-7" strokeWidth={2.5} />
          </span>
          <h1 className="mt-4 text-balance font-serif text-[26px] leading-tight font-semibold tracking-tight">
            You’re in, {me?.displayName?.trim() || 'there'}.
          </h1>
          <p className="mx-auto mt-2 max-w-[19rem] text-[15px] leading-relaxed text-muted-foreground">
            You and your household share one MamaHQ. What one of you adds, the other sees — and you
            can decide together who’s handling what.
          </p>
        </div>

        {others.length > 0 && (
          <div className="mt-7">
            <p className="px-1 text-[13px] font-medium text-muted-foreground">Already in your household</p>
            <div className="mt-2 space-y-2">
              {others.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-sage-soft font-serif text-[16px] font-semibold text-sage">
                    {p.displayName.trim().charAt(0).toUpperCase() || '?'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold leading-tight">{p.displayName}</p>
                    <p className="text-[13px] capitalize text-muted-foreground">
                      {p.role === 'owner' ? 'Owner' : p.relationship || 'Household member'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-start gap-2.5 rounded-2xl bg-muted/60 px-4 py-3.5">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-sage" strokeWidth={1.75} />
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            When something’s on your mind, Tell MamaHQ and it’ll sort it into the shared household —
            you approve everything first.
          </p>
        </div>
      </Scroll>

      <div className="px-7 pt-3 pb-8">
        <Button
          onClick={enter}
          className="h-14 w-full rounded-full bg-primary text-[16px] font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)]"
        >
          Go to MamaHQ
        </Button>
      </div>
    </Screen>
  )
}
