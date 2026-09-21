'use client'

import { useEffect, type ReactNode } from 'react'
import { PrototypeProvider, useNav } from './context'
import { AuthProvider, useAuth } from './auth'
import { SignInScreen } from './screens/sign-in'
import { ProfileProvider } from './profile'
import { useHousehold } from './household'
import { LogsProvider, useLogs } from './logs'
import { MomProvider } from './mom'
import { MemoriesProvider } from './memories'
import { AppointmentsProvider } from './appointments'
import { PartnerProvider } from './partner'
import { HouseholdProvider } from './household'
import { RealtimeProvider } from './realtime'
import { NotificationsProvider } from './notifications'
import { GroceryProvider } from './grocery'
import { TasksProvider } from './tasks'
import { CareProvider } from './care'
import { CalendarProvider } from './calendar'
import { TellProvider } from './tell'
import { InboxProvider } from './inbox/store'
import { BottomSheet, FullOverlay, Toast } from './sheet'
import { OnboardingScreen } from './screens/onboarding'
import { PartnerJoinScreen } from './screens/partner-join'
import { SettingsScreen } from './screens/settings'
import { ResetScreen } from './screens/reset'
import { ApptComposeScreen } from './screens/appt-compose'
import { CaptureContent } from './screens/capture'
import { TodayScreen } from './screens/today'
import { BabyScreen } from './screens/baby'
// Legacy InboxScreen intentionally no longer imported/rendered (Beta Phase 1):
// Tell MamaHQ is the single capture surface. The legacy rule-based Inbox code
// (components/mama/screens/inbox.tsx + inbox/commit.ts + inbox/local-extractor.ts)
// is retained but unreachable from primary navigation; see docs/TELL_MAMAHQ.md.
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
import { PeopleScreen } from './screens/people'
import { TasksScreen } from './screens/tasks'
import { CareHandoffScreen } from './screens/care-handoff'
import { CalendarScreen } from './screens/calendar'
import { CalendarComposeScreen } from './screens/calendar-compose'
import { NotificationsScreen } from './screens/notifications'
import { TellScreen } from './screens/tell'

function ActiveTab() {
  const { tab } = useNav()
  switch (tab) {
    case 'baby':
      return <BabyScreen />
    case 'tell':
      // Beta Phase 1: Tell MamaHQ is the single canonical capture surface, promoted
      // to a primary tab (replacing the legacy rule-based Inbox tab).
      return <TellScreen asTab />
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
  const { overlay, closeOverlay, toast, onboardingDismissed } = useNav()
  const { firstRun, hydrated } = useHousehold()

  // Beta Phase 2 — first-run routing is driven by AUTHORITATIVE household identity
  // (useHousehold().firstRun), not by device-local profile/baby presence. This is
  // what makes the two journeys correct:
  //   * A joining partner lands in a household that already has a baby row — the old
  //     baby-presence check skipped onboarding entirely, so they never confirmed who
  //     they are. Now firstRun === 'partner' routes them to the join experience.
  //   * A returning, established user (real canonical name) is 'done' on ANY device,
  //     and losing localStorage can't make them look new.
  // firstRun is null until we've hydrated the household + resolved the current
  // person; show a calm loading state rather than guessing (never flash onboarding).
  if (!hydrated || firstRun === null) {
    return (
      <div className="grid h-full place-items-center bg-background text-muted-foreground">
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  // A first-run flow, once entered, owns the screen until it explicitly hands off
  // (onboardingDismissed). This prevents the mid-flow identity write — which flips
  // firstRun to 'done' — from tearing the remaining optional steps away. A returning
  // user is 'done' from the start and has never dismissed, so they go straight in.
  if (!onboardingDismissed) {
    if (firstRun === 'creator') return <OnboardingScreen />
    if (firstRun === 'partner') return <PartnerJoinScreen />
  }

  return (
    <>
      <ActiveTab />

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
      <FullOverlay open={overlay === 'people'}>
        <PeopleScreen />
      </FullOverlay>
      <FullOverlay open={overlay === 'tasks'}>
        <TasksScreen />
      </FullOverlay>
      <FullOverlay open={overlay === 'careHandoff'}>
        <CareHandoffScreen />
      </FullOverlay>
      <FullOverlay open={overlay === 'calendar'}>
        <CalendarScreen />
      </FullOverlay>
      <FullOverlay open={overlay === 'calendarCompose'}>
        <CalendarComposeScreen />
      </FullOverlay>
      <FullOverlay open={overlay === 'notifications'}>
        <NotificationsScreen />
      </FullOverlay>
      <FullOverlay open={overlay === 'tell'}>
        <TellScreen />
      </FullOverlay>
      <FullOverlay open={overlay === 'settings'}>
        <SettingsScreen />
      </FullOverlay>
      <FullOverlay open={overlay === 'reset'}>
        <ResetScreen />
      </FullOverlay>

      <LogSyncBridge />
      <Toast message={toast} />
    </>
  )
}

// Truthfulness bridge (Beta Phase 5 §24): logs write optimistically, so a failed
// cloud sync used to disappear into console.warn while the UI still said "logged".
// This surfaces the logs provider's last sync failure as a transient toast so Mom is
// told the truth — her entry is safe on-device, but it didn't reach the cloud — then
// clears it so the banner doesn't linger once syncing recovers.
function LogSyncBridge() {
  const { syncError, clearSyncError } = useLogs()
  const { showToast } = useNav()
  useEffect(() => {
    if (!syncError) return
    showToast(syncError)
    clearSyncError()
    // showToast/clearSyncError identities are stable enough; re-run only on a new error.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncError])
  return null
}

// Bridges live notification arrival to the in-app toast. Sits inside PrototypeProvider
// (so it can read showToast) and wraps the app in NotificationsProvider, so the bell
// badge + list are available everywhere while a newly-arrived notification also
// surfaces a transient toast.
function NotificationsBridge({ children }: { children: ReactNode }) {
  const { showToast } = useNav()
  return (
    <NotificationsProvider onArrive={(n) => showToast(n.title)}>
      {children}
    </NotificationsProvider>
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
              <RealtimeProvider>
              <GroceryProvider>
              <TasksProvider>
              <CareProvider>
              <CalendarProvider>
              <TellProvider>
              <PartnerProvider>
                <MomProvider>
                  <MemoriesProvider>
                    <AppointmentsProvider>
                      <InboxProvider>
                        <PrototypeProvider initialPhase="onboarding" initialTab="today">
                          <NotificationsBridge>
                            <AuthGate>
                              <Stage />
                            </AuthGate>
                          </NotificationsBridge>
                        </PrototypeProvider>
                      </InboxProvider>
                    </AppointmentsProvider>
                  </MemoriesProvider>
                </MomProvider>
              </PartnerProvider>
              </TellProvider>
              </CalendarProvider>
              </CareProvider>
              </TasksProvider>
              </GroceryProvider>
              </RealtimeProvider>
              </HouseholdProvider>
            </LogsProvider>
          </ProfileProvider>
        </AuthProvider>
      </div>
    </main>
  )
}
