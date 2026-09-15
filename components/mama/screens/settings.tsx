'use client'

import { ChevronRight } from 'lucide-react'
import { useNav } from '../context'
import { useProfile, ageLabel } from '../profile'
import { NameAvatar } from '../name-avatar'
import { Screen, Scroll, StatusBar, TopBar, Card, CardLabel } from '../ui'

const feedingLabel: Record<string, string> = {
  breast: 'Breast',
  bottle: 'Bottle',
  both: 'Both',
}

export function SettingsScreen() {
  const { closeOverlay, openOverlay } = useNav()
  const { profile } = useProfile()

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
            <div className="px-5 py-3.5">
              <p className="text-[15px]">
                Signed in as{' '}
                <span className="font-semibold">{profile?.momName ?? 'Mama'}</span>
              </p>
            </div>
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
                Permanently erase this baby&apos;s profile and all logs
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-destructive/70" />
          </button>
        </div>
      </Scroll>
    </Screen>
  )
}
