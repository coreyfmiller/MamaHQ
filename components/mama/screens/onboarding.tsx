'use client'

import { useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import {
  Clock,
  HeartHandshake,
  Sparkles,
  Heart,
  Camera,
  Check,
  Loader2,
  Plus,
  Users,
  Baby as BabyIcon,
  Link2,
  Share2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNav } from '../context'
import { useProfile, type Feeding, type Profile } from '../profile'
import { useHousehold, type HouseholdPerson } from '../household'
import { NameAvatar } from '../name-avatar'
import { LeafSprig } from '../decor'
import { Screen, Scroll, StatusBar } from '../ui'
import { downscaleImage } from '@/lib/utils'
import { shareInvite, copyInvite, canNativeShare } from '../invite-share'

const values = [
  { Icon: Sparkles, label: 'Less to remember' },
  { Icon: Clock, label: 'More time for what matters' },
  { Icon: HeartHandshake, label: 'Shared, so it’s not all on you' },
]

// The creator's first run. Short by design: who you are, who's in the household,
// (optionally) invite your partner, then straight into the real product. Identity
// is the ONLY blocking step — everything else is skippable and can be done later.
type Step = 'welcome' | 'name' | 'people' | 'invite' | 'ready'
const ORDER: Step[] = ['welcome', 'name', 'people', 'invite', 'ready']

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function OnboardingScreen() {
  const { setTab, openOverlay, showToast, dismissOnboarding } = useNav()
  const { saveProfile, profile } = useProfile()
  const { renameMe, savePerson, people, invitePerson } = useHousehold()

  const [step, setStep] = useState<Step>('welcome')

  // ── Identity (the one required thing) ──────────────────────────────────────
  const [name, setName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  const go = (s: Step) => {
    setStep(s)
  }

  // Advance from the name step ONLY when the canonical identity actually persisted.
  // This is the §14 truth guarantee: onboarding must never advance past "who are
  // you" while the trusted identity write failed — otherwise the household would
  // show a placeholder while the UI pretended the name was saved.
  const submitName = async () => {
    const clean = name.trim()
    if (!clean || savingName) return
    setSavingName(true)
    setNameError(null)
    const res = await renameMe(clean)
    setSavingName(false)
    if (!res.ok) {
      setNameError(res.error ?? 'We couldn’t save your name. Please try again.')
      return
    }
    go('people')
  }

  // Skip straight into the app WITHOUT setting a name (e.g. "I'll do this later").
  // We do NOT fabricate an identity; the placeholder stays and the user is nudged in
  // Settings. Because firstRun is derived from the cloud name, leaving it a
  // placeholder means they'd see onboarding again next time — which is honest: they
  // haven't told us who they are. To avoid a loop we only offer this on welcome.
  // PR2 — the app always lands on a real tab (Today). "Start with a first Tell" now
  // opens the Tell overlay ON Today rather than routing to a Tell tab (which no
  // longer exists — Tell is a Capture capability, not a destination).
  const enterApp = (startTell = false) => {
    setTab('today')
    // Hand off to the app. dismissOnboarding makes Stage render the product even if
    // firstRun is still 'creator' (e.g. the user chose to name themselves later) —
    // an honest exit that doesn't fabricate an identity. If they DID set a name,
    // firstRun is already 'done'.
    dismissOnboarding()
    if (startTell) openOverlay('tell')
  }

  const index = ORDER.indexOf(step)

  /* ─────────────────────────── Welcome ─────────────────────────── */
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
              Your family’s mental load, in one place.
            </h1>
            <p className="mx-auto mt-4 max-w-[19rem] text-pretty text-[15px] leading-relaxed text-muted-foreground">
              MamaHQ helps your household remember what needs to happen, who’s responsible, and
              what comes next.
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
            onClick={() => go('name')}
            className="mt-4 h-14 w-full rounded-full bg-primary text-[16px] font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)]"
          >
            Get started
          </Button>
        </div>
      </Screen>
    )
  }

  /* ─────────────────────────── Your name (required) ─────────────────────────── */
  if (step === 'name') {
    return (
      <StepScreen index={index} onBack={() => go('welcome')}>
        <StepShell
          title="First, what should we call you?"
          sub="This is how your household will see you — on tasks, the calendar, and everywhere else."
        >
          <TextField
            value={name}
            onChange={(v) => {
              setName(v)
              if (nameError) setNameError(null)
            }}
            placeholder="Your name"
            autoFocus
            onEnter={submitName}
          />
          {nameError && (
            <p className="mt-2 flex items-start gap-1.5 px-1 text-[13px] text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {nameError}
            </p>
          )}
        </StepShell>

        <PrimaryBar>
          <Button
            onClick={submitName}
            disabled={name.trim().length === 0 || savingName}
            className="h-14 w-full rounded-full bg-primary text-[16px] font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] disabled:opacity-40"
          >
            {savingName ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Saving…
              </span>
            ) : (
              'Continue'
            )}
          </Button>
        </PrimaryBar>
      </StepScreen>
    )
  }

  /* ─────────────────────────── Household people (optional) ─────────────────────────── */
  if (step === 'people') {
    return (
      <PeopleStep
        index={index}
        people={people}
        profile={profile}
        onAddPerson={(p) => savePerson(p)}
        onSaveBaby={saveProfile}
        onBack={() => go('name')}
        onContinue={() => go('invite')}
      />
    )
  }

  /* ─────────────────────────── Invite a partner (optional) ─────────────────────────── */
  if (step === 'invite') {
    return (
      <InviteStep
        index={index}
        people={people}
        invitePerson={invitePerson}
        showToast={showToast}
        onBack={() => go('people')}
        onContinue={() => go('ready')}
      />
    )
  }

  /* ─────────────────────────── Ready → first Tell ─────────────────────────── */
  return (
    <ReadyStep
      index={index}
      onBack={() => go('invite')}
      onStartTell={() => enterApp(true)}
      onSkip={() => enterApp()}
    />
  )
}

/* ======================================================================== */
/* Household people step                                                    */
/* ======================================================================== */

type NewPersonKind = 'partner' | 'child' | 'other'

function PeopleStep({
  index,
  people,
  profile,
  onAddPerson,
  onSaveBaby,
  onBack,
  onContinue,
}: {
  index: number
  people: HouseholdPerson[]
  profile: Profile | null
  onAddPerson: (p: { displayName: string; relationship?: string }) => void
  onSaveBaby: (p: Profile) => void
  onBack: () => void
  onContinue: () => void
}) {
  const [adding, setAdding] = useState<NewPersonKind | 'baby' | null>(null)

  // People I've added here (exclude myself — the owner person is always present and
  // is "me", already named in the previous step).
  const others = people.filter((p) => p.relationship !== 'owner')

  return (
    <StepScreen index={index} onBack={onBack}>
      <StepShell
        title="Who else is in your household?"
        sub="Add the people MamaHQ should know about. You can skip this and add them anytime."
      >
        <div className="space-y-2">
          {others.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-sage-soft font-serif text-[15px] font-semibold text-sage">
                {p.displayName.trim().charAt(0).toUpperCase() || '?'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold leading-tight">{p.displayName}</p>
                {p.relationship && <p className="text-[13px] capitalize text-muted-foreground">{p.relationship}</p>}
              </div>
            </div>
          ))}
          {profile && (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-blush/30 text-blush">
                <BabyIcon className="size-[18px]" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold leading-tight">{profile.babyName}</p>
                <p className="text-[13px] text-muted-foreground">Baby</p>
              </div>
            </div>
          )}
        </div>

        {adding === null ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <AddChip icon={Users} label="Partner" onClick={() => setAdding('partner')} />
            <AddChip icon={Users} label="Child" onClick={() => setAdding('child')} />
            {!profile && <AddChip icon={BabyIcon} label="Baby" onClick={() => setAdding('baby')} />}
            <AddChip icon={Plus} label="Someone else" onClick={() => setAdding('other')} />
          </div>
        ) : adding === 'baby' ? (
          <BabyForm
            onCancel={() => setAdding(null)}
            onSave={(p) => {
              onSaveBaby(p)
              setAdding(null)
            }}
          />
        ) : (
          <PersonForm
            kind={adding}
            onCancel={() => setAdding(null)}
            onSave={(displayName) => {
              onAddPerson({
                displayName,
                relationship: adding === 'other' ? undefined : adding,
              })
              setAdding(null)
            }}
          />
        )}
      </StepShell>

      <PrimaryBar>
        <Button
          onClick={onContinue}
          className="h-14 w-full rounded-full bg-primary text-[16px] font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)]"
        >
          {others.length > 0 || profile ? 'Continue' : 'Skip for now'}
        </Button>
      </PrimaryBar>
    </StepScreen>
  )
}

function AddChip({ icon: Icon, label, onClick }: { icon: typeof Plus; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-[14px] font-medium text-foreground transition-transform active:scale-[0.98]"
    >
      <span className="flex size-5 items-center justify-center rounded-full bg-sage-soft text-sage">
        <Icon className="size-3.5" strokeWidth={2} />
      </span>
      {label}
    </button>
  )
}

function PersonForm({
  kind,
  onSave,
  onCancel,
}: {
  kind: NewPersonKind
  onSave: (displayName: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState('')
  const label = kind === 'partner' ? 'Partner’s name' : kind === 'child' ? 'Child’s name' : 'Their name'
  const submit = () => {
    if (value.trim()) onSave(value.trim())
  }
  return (
    <div className="mt-3 space-y-2 rounded-2xl border border-border bg-card p-3">
      <label className="block px-1 text-[13px] font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') onCancel()
          }}
          placeholder={kind === 'partner' ? 'e.g. Alex' : 'Name'}
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-[16px] text-foreground outline-none focus:border-primary"
        />
        <button
          onClick={submit}
          disabled={value.trim().length === 0}
          aria-label="Add person"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
        >
          <Check className="size-5" strokeWidth={2.5} />
        </button>
      </div>
      <button onClick={onCancel} className="px-1 text-[13px] font-medium text-muted-foreground">
        Cancel
      </button>
    </div>
  )
}

function BabyForm({ onSave, onCancel }: { onSave: (p: Profile) => void; onCancel: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [babyName, setBabyName] = useState('')
  const [birthDate, setBirthDate] = useState(() => todayISO())
  const [feeding, setFeeding] = useState<Feeding>('both')
  const [photo, setPhoto] = useState<string | undefined>(undefined)

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    downscaleImage(file, 256, 0.8).then(setPhoto).catch(() => setPhoto(undefined))
  }

  const canSave = babyName.trim().length > 0 && birthDate.length > 0
  const save = () => {
    if (!canSave) return
    onSave({
      // momName is carried by the canonical identity now; keep a friendly display
      // default in the local profile (it is not the identity source of truth).
      momName: 'Mama',
      babyName: babyName.trim(),
      birthDate,
      feeding,
      photo,
    })
  }

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => fileRef.current?.click()}
          className="relative flex size-14 items-center justify-center rounded-full border border-dashed border-border bg-background"
          aria-label="Choose a photo"
        >
          {photo ? (
            <NameAvatar name={babyName || 'Baby'} photo={photo} className="size-14" />
          ) : babyName.trim() ? (
            <NameAvatar name={babyName} className="size-14" />
          ) : (
            <Camera className="size-5 text-muted-foreground" strokeWidth={1.5} />
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPickPhoto} className="hidden" />
        <div className="min-w-0 flex-1">
          <label className="mb-1 block px-1 text-[13px] font-medium text-muted-foreground">Baby’s name</label>
          <input
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={babyName}
            onChange={(e) => setBabyName(e.target.value)}
            placeholder="Baby’s name"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[16px] text-foreground outline-none focus:border-primary"
          />
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block px-1 text-[13px] font-medium text-muted-foreground">Birth date</span>
        <input
          type="date"
          value={birthDate}
          max={todayISO()}
          onChange={(e) => setBirthDate(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[16px] text-foreground outline-none focus:border-primary"
        />
      </label>

      <div className="flex gap-2">
        {(['breast', 'bottle', 'both'] as Feeding[]).map((f) => (
          <button
            key={f}
            onClick={() => setFeeding(f)}
            className={`flex-1 rounded-xl border py-2 text-[14px] font-medium capitalize transition-colors ${
              feeding === f ? 'border-primary bg-sage-soft text-primary' : 'border-border bg-background text-muted-foreground'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="rounded-full bg-muted px-5 py-2.5 text-[14px] font-semibold text-foreground">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={!canSave}
          className="flex-1 rounded-full bg-primary py-2.5 text-[14px] font-semibold text-primary-foreground disabled:opacity-40"
        >
          Add baby
        </button>
      </div>
    </div>
  )
}

/* ======================================================================== */
/* Invite a partner step                                                    */
/* ======================================================================== */

function InviteStep({
  index,
  people,
  invitePerson,
  showToast,
  onBack,
  onContinue,
}: {
  index: number
  people: HouseholdPerson[]
  invitePerson: (personId: string, email?: string) => Promise<{ ok: boolean; url?: string; error?: string }>
  showToast: (m: string) => void
  onBack: () => void
  onContinue: () => void
}) {
  // Only account-less adults can be invited. A partner added in the previous step is
  // account-less until they accept, so they're eligible. Children/baby are not
  // invited (they don't get accounts).
  const invitable = people.filter(
    (p) => (p.relationship === 'partner' || p.relationship === 'member') && (p.accountStatus ?? 'none') === 'none',
  )

  return (
    <StepScreen index={index} onBack={onBack}>
      <StepShell
        title="Bring your partner in"
        sub="MamaHQ works best when responsibility is actually shared — not just written down. Invite your partner so they get their own account and see what’s theirs to handle."
      >
        {invitable.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 px-4 py-5 text-center">
            <Users className="mx-auto size-6 text-muted-foreground" strokeWidth={1.5} />
            <p className="mt-2 text-[14px] text-muted-foreground">
              No partner added yet. You can add and invite one anytime from Household.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {invitable.map((p) => (
              <InviteRow key={p.id} person={p} invitePerson={invitePerson} showToast={showToast} />
            ))}
          </div>
        )}

        <p className="mt-3 rounded-2xl bg-muted/60 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
          MamaHQ doesn’t send anything for you. You’ll get a private link to share however you
          like — text, email, whatever’s easiest.
        </p>
      </StepShell>

      <PrimaryBar>
        <Button
          onClick={onContinue}
          className="h-14 w-full rounded-full bg-primary text-[16px] font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)]"
        >
          Continue
        </Button>
      </PrimaryBar>
    </StepScreen>
  )
}

// One invitable person: generate a link, then show honest share/copy controls. The
// button label reflects REAL state — "Invite" → "Copy link / Share" once a link
// exists — and never claims the invite was sent.
function InviteRow({
  person,
  invitePerson,
  showToast,
}: {
  person: HouseholdPerson
  invitePerson: (personId: string, email?: string) => Promise<{ ok: boolean; url?: string; error?: string }>
  showToast: (m: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    setBusy(true)
    setError(null)
    const res = await invitePerson(person.id, person.email)
    setBusy(false)
    if (res.ok && res.url) {
      setUrl(res.url)
    } else {
      setError(res.error ?? 'Couldn’t create an invite link.')
    }
  }

  const share = async () => {
    if (!url) return
    const r = await shareInvite(url, person.displayName)
    if (r === 'copied') showToast('Invite link copied — send it to ' + person.displayName)
    else if (r === 'failed') showToast('Couldn’t copy — the link is shown below')
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-sage-soft font-serif text-[16px] font-semibold text-sage">
          {person.displayName.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight">{person.displayName}</p>
          <p className="text-[13px] text-muted-foreground">{url ? 'Invite ready to share' : 'Not invited yet'}</p>
        </div>
        {!url && (
          <button
            onClick={generate}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
            {busy ? 'Creating…' : 'Create invite'}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-[13px] text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {error}
        </p>
      )}

      {url && (
        <div className="mt-3 space-y-2">
          <p className="text-[13px] font-medium text-foreground">
            Copy this private link and send it to {person.displayName}:
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-muted-foreground">
              {url}
            </code>
            <button
              onClick={share}
              aria-label={canNativeShare() ? 'Share invite link' : 'Copy invite link'}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
            >
              {canNativeShare() ? <Share2 className="size-4" /> : <Link2 className="size-4" />}
            </button>
          </div>
          <button
            onClick={async () => {
              const ok = await copyInvite(url)
              showToast(ok ? 'Invite link copied' : 'Couldn’t copy — select the link above')
            }}
            className="text-[13px] font-medium text-primary"
          >
            Copy link
          </button>
        </div>
      )}
    </div>
  )
}

/* ======================================================================== */
/* Ready → first Tell                                                       */
/* ======================================================================== */

function ReadyStep({
  index,
  onBack,
  onStartTell,
  onSkip,
}: {
  index: number
  onBack: () => void
  onStartTell: () => void
  onSkip: () => void
}) {
  return (
    <StepScreen index={index} onBack={onBack}>
      <StepShell
        title="What’s one thing you’re carrying right now?"
        sub="Tell MamaHQ in plain words — a to-do, something for the calendar, groceries. You’ll approve everything before it’s added."
      >
        <div className="space-y-2">
          {[
            'We need milk and diapers.',
            'Book the baby’s checkup next week.',
            'Soccer practice Tuesday at 6.',
          ].map((ex) => (
            <div
              key={ex}
              className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-[14px] text-muted-foreground"
            >
              <Sparkles className="size-4 shrink-0 text-sage" strokeWidth={1.75} /> {ex}
            </div>
          ))}
        </div>
      </StepShell>

      <PrimaryBar>
        <Button
          onClick={onStartTell}
          className="h-14 w-full rounded-full bg-primary text-[16px] font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)]"
        >
          Tell MamaHQ something
        </Button>
        <button onClick={onSkip} className="mt-3 w-full text-center text-[14px] font-medium text-muted-foreground">
          I’ll do it later
        </button>
      </PrimaryBar>
    </StepScreen>
  )
}

/* ======================================================================== */
/* Shared building blocks                                                   */
/* ======================================================================== */

function StepScreen({
  index,
  onBack,
  children,
}: {
  index: number
  onBack: () => void
  children: ReactNode
}) {
  return (
    <Screen>
      <StatusBar />
      <div className="px-6 pt-2">
        <button onClick={onBack} className="text-[14px] font-medium text-muted-foreground">
          ← Back
        </button>
      </div>
      <Scroll className="flex flex-col px-7 pt-4">{children}</Scroll>
      <div className="px-7 pt-3 pb-8">
        <Dots index={index} />
      </div>
    </Screen>
  )
}

// A bottom action bar rendered by steps that need a primary CTA. Kept visually
// consistent with the welcome screen's button placement.
function PrimaryBar({ children }: { children: ReactNode }) {
  return <div className="mt-6">{children}</div>
}

function StepShell({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div>
      <h1 className="text-balance font-serif text-[26px] leading-tight font-semibold tracking-tight">{title}</h1>
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
      {ORDER.map((s, i) => (
        <span
          key={s}
          className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-primary' : 'w-1.5 bg-border'}`}
        />
      ))}
    </div>
  )
}
