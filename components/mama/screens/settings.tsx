'use client'

import { useState, type ReactNode } from 'react'
import { ChevronRight, LogOut, Check, Pencil, Loader2, AlertCircle } from 'lucide-react'
import { useNav } from '../context'
import { useProfile, ageLabel } from '../profile'
import { useAuth } from '../auth'
import { useHousehold } from '../household'
import { NameAvatar } from '../name-avatar'
import { Screen, Scroll, StatusBar, TopBar, Card, CardLabel } from '../ui'
import { canStartOver, START_OVER_SUMMARY, START_OVER_OWNER_ONLY } from '@/lib/reset-confirm'
import {
  babySetupToProfile,
  isBabySetupComplete,
  localTodayISO,
  validateBabySetup,
  type BabySetupErrors,
} from '@/lib/onboarding'

const feedingLabel: Record<string, string> = {
  breast: 'Breast',
  bottle: 'Bottle',
  both: 'Both',
}

export function SettingsScreen() {
  const { closeOverlay, openOverlay, showToast } = useNav()
  const { profile } = useProfile()
  const { user, signOut, familyId } = useAuth()
  const { me, renameMe } = useHousehold()
  const mayStartOver = canStartOver({ signedIn: !!familyId, role: me?.role })

  return (
    <Screen>
      <StatusBar />
      <TopBar variant="close" title="Settings" onBack={closeOverlay} />
      <Scroll className="space-y-5 px-6 pb-10">
        <BabyDetails />


        <div>
          <CardLabel className="mb-2 px-1 text-foreground">Account</CardLabel>
          <Card className="p-0">
            {/* Canonical household identity — editable. This is the name shown across
                People, task ownership, calendar responsibility, care and
                notifications. When signed in it writes the linked HouseholdPerson via
                the trusted RPC; the local profile name follows for display only. */}
            {familyId && me ? (
              <NameEditor
                currentName={me.displayName}
                onSave={async (name) => {
                  const res = await renameMe(name)
                  showToast(res.ok ? 'Your name was updated' : res.error ? `Couldn't save: ${res.error}` : "Couldn't save your name")
                  return res.ok
                }}
              />
            ) : (
              <div className="px-5 py-3.5">
                <p className="text-[15px]">
                  Signed in as <span className="font-semibold">{profile?.momName ?? 'Mama'}</span>
                </p>
                {user?.email && <p className="mt-0.5 text-[13px] text-muted-foreground">{user.email}</p>}
              </div>
            )}
            {familyId && me && user?.email && (
              <p className="border-t border-border/60 px-5 py-2.5 text-[13px] text-muted-foreground">{user.email}</p>
            )}
            <button
              onClick={signOut}
              className="flex w-full items-center gap-3 border-t border-border/60 px-5 py-3.5 text-left text-[15px] font-medium text-foreground transition-colors active:bg-muted"
            >
              <LogOut className="size-[18px] text-muted-foreground" strokeWidth={1.75} />
              Sign out
            </button>
          </Card>
        </div>

        {/* Danger zone — visually set apart, and the reset itself is gated again inside.
            PR6: owner-only. The database rejects a non-owner reset (0017
            reset_family_data); here a joined member is told so instead of being
            offered an action that would be refused. */}
        <div>
          <CardLabel className="mb-2 px-1 text-destructive">Danger zone</CardLabel>
          {mayStartOver ? (
            <button
              onClick={() => openOverlay('reset')}
              className="flex w-full items-center justify-between rounded-3xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-left transition-transform active:scale-[0.99]"
            >
              <span>
                <span className="block text-[15px] font-semibold text-destructive">Start over</span>
                <span className="block text-[13px] text-muted-foreground">{START_OVER_SUMMARY}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-destructive/70" />
            </button>
          ) : (
            <div className="rounded-3xl border border-border bg-card px-5 py-4">
              <p className="text-[15px] font-semibold text-foreground">Start over</p>
              <p className="text-[13px] text-muted-foreground">{START_OVER_OWNER_ONLY}</p>
            </div>
          )}
          {/* Beta honesty: Start over is NOT account/household deletion. No self-serve
              account deletion exists yet; it's operator-managed for the closed beta. */}
          <p className="mt-2 px-1 text-[12px] leading-relaxed text-muted-foreground">
            Start over isn&apos;t account deletion. To permanently delete your account and household
            data, contact beta support and we&apos;ll remove it for you.
          </p>
        </div>
      </Scroll>
    </Screen>
  )
}

// Inline editor for the current user's canonical household name. Keyboard-operable,
// labelled, with a clear save affordance; mobile-friendly tap targets.
function NameEditor({
  currentName,
  onSave,
}: {
  currentName: string
  onSave: (name: string) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(currentName)
  const [busy, setBusy] = useState(false)

  const start = () => {
    setValue(currentName)
    setEditing(true)
  }
  const save = async () => {
    const name = value.trim()
    if (!name || busy) return
    if (name === currentName) {
      setEditing(false)
      return
    }
    setBusy(true)
    const ok = await onSave(name)
    setBusy(false)
    if (ok) setEditing(false)
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3 px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-muted-foreground">Your name</p>
          <p className="text-[15px] font-semibold">{currentName}</p>
        </div>
        <button
          onClick={start}
          className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[13px] font-semibold text-foreground transition-transform active:scale-[0.98]"
        >
          <Pencil className="size-3.5" /> Edit
        </button>
      </div>
    )
  }

  return (
    <div className="px-5 py-3.5">
      <label htmlFor="settings-name" className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
        Your name
      </label>
      <div className="flex items-center gap-2">
        <input
          id="settings-name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save()
            if (e.key === 'Escape') setEditing(false)
          }}
          maxLength={80}
          className="min-w-0 flex-1 rounded-2xl border border-border bg-card px-4 py-3 text-[16px] text-foreground outline-none focus:border-primary"
        />
        <button
          onClick={() => void save()}
          disabled={busy || value.trim().length === 0}
          aria-label="Save your name"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" strokeWidth={2.5} />}
        </button>
      </div>
      <button onClick={() => setEditing(false)} className="mt-2 text-[13px] font-medium text-muted-foreground">
        Cancel
      </button>
    </div>
  )
}

// PR6 — Baby details correction path. Edits the SAME canonical Baby row onboarding
// wrote (profile.babyName → babies.name, profile.birthDate → babies.birth_date) via
// the existing saveProfile + validateBabySetup, so First90 / Day N follow a corrected
// birthday automatically. No new Baby state. Opens expanded when Baby setup is
// incomplete (Me → My Journey's setup prompt lands here). Not offered when the Baby
// read failed — saving then could create a second Baby row.
function BabyDetails() {
  const { profile, hydrated, loadFailed, saveProfile } = useProfile()
  const { me } = useHousehold()
  const { showToast } = useNav()
  const complete = isBabySetupComplete(profile)
  const [editing, setEditing] = useState(() => !complete)

  if (!hydrated) {
    return (
      <p className="flex items-center gap-1.5 px-1 text-[13px] text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Loading Baby&apos;s details…
      </p>
    )
  }
  if (loadFailed) {
    return (
      <p role="alert" className="flex items-start gap-1.5 px-1 text-[13px] text-muted-foreground">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
        Couldn&apos;t load Baby&apos;s details right now. Try again in a moment.
      </p>
    )
  }

  if (!editing && profile) {
    return (
      <Card className="flex items-center gap-3.5">
        <NameAvatar name={profile.babyName} photo={profile.photo} className="size-14 text-[20px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-[18px] font-semibold leading-tight">{profile.babyName}</p>
          <p className="text-[13px] text-muted-foreground">
            {ageLabel(profile.birthDate)} · {feedingLabel[profile.feeding] ?? profile.feeding} feeding
          </p>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-2 text-[13px] font-semibold text-foreground transition-transform active:scale-[0.98]"
        >
          <Pencil className="size-3.5" /> Edit
        </button>
      </Card>
    )
  }

  return (
    <BabyDetailsForm
      initialName={profile?.babyName ?? ''}
      initialBirthDate={profile?.birthDate ?? ''}
      canCancel={complete}
      onCancel={() => setEditing(false)}
      onSave={async (valid) => {
        const res = await saveProfile(
          babySetupToProfile(valid, me?.displayName?.trim() || profile?.momName || 'Mama', profile),
        )
        if (res.ok) {
          showToast('Baby’s details were updated')
          setEditing(false)
        }
        return res.ok
      }}
    />
  )
}

function BabyDetailsForm({
  initialName,
  initialBirthDate,
  canCancel,
  onCancel,
  onSave,
}: {
  initialName: string
  initialBirthDate: string
  canCancel: boolean
  onCancel: () => void
  onSave: (valid: { babyName: string; birthDate: string }) => Promise<boolean>
}) {
  const [babyName, setBabyName] = useState(initialName)
  const [birthDate, setBirthDate] = useState(initialBirthDate)
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const result = validateBabySetup({ babyName, birthDate })
  const errors: BabySetupErrors = attempted && !result.ok ? result.errors : {}

  const submit = async () => {
    if (busy) return
    setAttempted(true)
    setSaveError(null)
    if (!result.ok) return
    setBusy(true)
    const ok = await onSave(result)
    setBusy(false)
    if (!ok) setSaveError('We couldn’t save Baby’s details. Please try again.')
  }

  const inputClass =
    'w-full rounded-2xl border border-border bg-background px-4 py-3 text-[16px] text-foreground outline-none focus:border-primary aria-[invalid=true]:border-destructive'

  return (
    <div>
      <CardLabel className="mb-2 px-1 text-foreground">Baby</CardLabel>
      <Card className="space-y-4">
        <div>
          <label htmlFor="settings-baby-name" className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
            Baby&apos;s name
          </label>
          <input
            id="settings-baby-name"
            value={babyName}
            onChange={(e) => setBabyName(e.target.value)}
            maxLength={100}
            aria-invalid={!!errors.babyName}
            aria-describedby={errors.babyName ? 'settings-baby-name-error' : undefined}
            className={inputClass}
          />
          {errors.babyName && <FieldError id="settings-baby-name-error">{errors.babyName}</FieldError>}
        </div>
        <div>
          <label htmlFor="settings-baby-birthday" className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
            Baby&apos;s birthday
          </label>
          <input
            id="settings-baby-birthday"
            type="date"
            value={birthDate}
            max={localTodayISO()}
            onChange={(e) => setBirthDate(e.target.value)}
            aria-invalid={!!errors.birthDate}
            aria-describedby={errors.birthDate ? 'settings-baby-birthday-error' : undefined}
            className={inputClass}
          />
          {errors.birthDate && <FieldError id="settings-baby-birthday-error">{errors.birthDate}</FieldError>}
        </div>
        {saveError && <FieldError id="settings-baby-save-error">{saveError}</FieldError>}
        <div className="flex gap-2">
          {canCancel && (
            <button
              onClick={onCancel}
              className="rounded-full bg-muted px-5 py-3 text-[14px] font-semibold text-foreground"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => void submit()}
            disabled={busy}
            className="flex-1 rounded-full bg-primary py-3 text-[14px] font-semibold text-primary-foreground disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Save Baby’s details'}
          </button>
        </div>
      </Card>
    </div>
  )
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 px-1 text-[13px] text-destructive">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {children}
    </p>
  )
}
