'use client'

import { useEffect, type ReactNode } from 'react'
import { PrototypeProvider, useNav } from './context'
import { AuthProvider, useAuth } from './auth'
import { SignInScreen } from './screens/sign-in'
import { ProfileProvider, useProfile } from './profile'
import { LogsProvider } from './logs'
import { MomProvider } from './mom'
import { MemoriesProvider } from './memories'
import { AppointmentsProvider } from './appointments'
import { PartnerProvider } from './partner'
import { HouseholdProvider } from './household'
import { GroceryProvider } from './grocery'
import { InboxProvider } from './inbox/store'
import { BottomSheet, FullOverlay, Toast } from './sheet'
import { OnboardingScreen } from './screens/onboarding'
import { SettingsScreen } from './screens/settings'
import { ResetScreen } from './screens/reset'
import { ApptComposeScreen } from './screens/appt-compose'
import { CaptureContent } from './screens/capture'
import { TodayScreen } from './screens/today'
import { BabyScreen } from './screens/baby'
import { InboxScreen } from './screens/inbox'
import { MeScreen } from './screens/me'
import { QuickLogContent } from './screens/quick-log'
import { AppointmentScreen } from './screens/appointment'
import { VoiceScreen } from './screens/voice'
import { PhotoScreen } from './screens/photo'
import { UpcomingScreen } from './screens/upcoming'
import { MemoriesScreen } from './screens/memories'
import { PartnerScreen } from './screens/partner'
import { Beyond90Screen } from './screens/beyond90'
import { ReadScreen } from './screens/read'
import { GroceryScreen } from './screens/grocery'
import { ReminderScreen } from './screens/reminder'

function ActiveTab() {
  const { tab } = useNav()
  switch (tab) {
    case 'baby':
      return <BabyScreen />
    case 'inbox':
      return <InboxScreen />
    case 'me':
      return <MeScreen />
    default:
      return <TodayScreen />
  }
}

// Gates the whole app on auth: signed-out users see sign-in; signed-in users
// (once their family is ensured) see the app. A brief loading state avoids flashes.
function AuthGate({ children }: { children: ReactNode }) {
  const { status, bootstrapping } = useAuth()

  if (status === 'loading' || (status === 'signed-in' && bootstrapping)) {
    return (
      <div className="grid h-full place-items-center bg-background text-muted-foreground">
        <span className="text-sm">Loading…</span>
      </div>
    )
  }
  if (status === 'signed-out') return <SignInScreen />
  return <>{children}</>
}

function Stage() {
  const { phase, setPhase, overlay, closeOverlay, toast } = useNav()
  const { profile, hydrated } = useProfile()

  // Once storage is read: if a profile already exists, skip straight into the app.
  // Onboarding itself flips phase to 'app' when it finishes, so we only need to
  // handle the returning-user case here.
  useEffect(() => {
    if (hydrated && profile && phase === 'onboarding') {
      setPhase('app')
    }
  }, [hydrated, profile, phase, setPhase])

  // Avoid flashing onboarding before we know whether a profile exists.
  if (!hydrated) {
    return (
      <div className="grid h-full place-items-center bg-background text-muted-foreground">
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  return (
    <>
      {phase === 'onboarding' ? <OnboardingScreen /> : <ActiveTab />}

      <BottomSheet open={overlay === 'capture'} onClose={closeOverlay}>
        <CaptureContent />
      </BottomSheet>

      <BottomSheet open={overlay === 'quicklog'} onClose={closeOverlay}>
        <QuickLogContent />
      </BottomSheet>

      <FullOverlay open={overlay === 'appointment'}>
        <AppointmentScreen />
      </FullOverlay>
      <FullOverlay open={overlay === 'apptCompose'}>
        <ApptComposeScreen />
      </FullOverlay>
      <FullOverlay open={overlay === 'voice'} dark>
        <VoiceScreen />
      </FullOverlay>
      <FullOverlay open={overlay === 'photo'} dark>
        <PhotoScreen />
      </FullOverlay>
      <FullOverlay open={overlay === 'upcoming'}>
        <UpcomingScreen />
      </FullOverlay>
      <FullOverlay open={overlay === 'memories'}>
        <MemoriesScreen />
      </FullOverlay>
      <FullOverlay open={overlay === 'partner'}>
        <PartnerScreen />
      </FullOverlay>
      <FullOverlay open={overlay === 'beyond90'}>
        <Beyond90Screen />
      </FullOverlay>
      <FullOverlay open={overlay === 'read'}>
        <ReadScreen />
      </FullOverlay>
      <FullOverlay open={overlay === 'grocery'}>
        <GroceryScreen />
      </FullOverlay>
      <FullOverlay open={overlay === 'settings'}>
        <SettingsScreen />
      </FullOverlay>
      <FullOverlay open={overlay === 'reset'}>
        <ResetScreen />
      </FullOverlay>
      {overlay === 'reminder' && (
        <div className="absolute inset-0 z-40">
          <ReminderScreen />
        </div>
      )}

      <Toast message={toast} />
    </>
  )
}

export function Prototype() {
  return (
    <main className="flex min-h-[100dvh] w-full items-center justify-center bg-[oklch(0.93_0.018_82)] sm:p-6">
      <div className="relative flex h-[100dvh] w-full max-w-[404px] flex-col overflow-hidden bg-background sm:h-[868px] sm:rounded-[3rem] sm:border-[13px] sm:border-foreground sm:shadow-[0_40px_80px_-30px_rgba(38,50,56,0.5)]">
        <AuthProvider>
          <ProfileProvider>
            <LogsProvider>
              <HouseholdProvider>
              <GroceryProvider>
              <PartnerProvider>
                <MomProvider>
                  <MemoriesProvider>
                    <AppointmentsProvider>
                      <InboxProvider>
                        <PrototypeProvider initialPhase="onboarding" initialTab="today">
                          <AuthGate>
                            <Stage />
                          </AuthGate>
                        </PrototypeProvider>
                      </InboxProvider>
                    </AppointmentsProvider>
                  </MemoriesProvider>
                </MomProvider>
              </PartnerProvider>
              </GroceryProvider>
              </HouseholdProvider>
            </LogsProvider>
          </ProfileProvider>
        </AuthProvider>
      </div>
    </main>
  )
}
