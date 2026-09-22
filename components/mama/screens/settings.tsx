'use client'

import { useState } from 'react'
import { ChevronRight, LogOut, Check, Pencil, Loader2 } from 'lucide-react'
import { useNav } from '../context'
import { useProfile, ageLabel } from '../profile'
import { useAuth } from '../auth'
import { useHousehold } from '../household'
import { NameAvatar } from '../name-avatar'
import { Screen, Scroll, StatusBar, TopBar, Card, CardLabel } from '../ui'

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

  return (
    <Screen>
      <StatusBar />
      <TopBar variant="close" title="Settings" onBack={closeOverlay} />
      <Scroll className="space-y-5 px-6 pb-10">
        {profile && (
          <Card className="flex items-center gap-3.5">
            <NameAvatar name={profile.babyName} photo={profile.photo} className="size-14 text-[20px]" />
            <div className="min-w-0 flex-1">
              <p className="font-serif text-[18px] font-semibold leading-tight">{profile.babyName}</p>
              <p className="text-[13px] text-muted-foreground">
                {ageLabel(profile.birthDate)} · {feedingLabel[profile.feeding] ?? profile.feeding} feeding
              </p>
            </div>
          </Card>
        )}

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

        {/* Danger zone — visually set apart, and the reset itself is gated again inside. */}
        <div>
          <CardLabel className="mb-2 px-1 text-destructive">Danger zone</CardLabel>
          <button
            onClick={() => openOverlay('reset')}
            className="flex w-full items-center justify-between rounded-3xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-left transition-transform active:scale-[0.99]"
          >
            <span>
              <span className="block text-[15px] font-semibold text-destructive">Start over</span>
              <span className="block text-[13px] text-muted-foreground">
                Clears this baby&apos;s profile and logs on your account
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-destructive/70" />
          </button>
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
