'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useNav } from '../context'
import { useProfile } from '../profile'
import { useLogs } from '../logs'
import { useMom } from '../mom'
import { useMemories } from '../memories'
import { useAppointments } from '../appointments'
import { useInbox } from '../inbox/store'
import { usePartner } from '../partner'
import { useAuth } from '../auth'
import { clearFamilyData } from '@/lib/supabase/data'
import { resetConfirmationMatches, RESET_CONFIRM_WORD } from '@/lib/reset-confirm'
import { TopBar } from '../ui'

/**
 * Deliberately hard "start over". This clears the baby profile and all logs (plus
 * check-in, to-dos, questions, memories and grocery) — locally and in the cloud — but
 * it is NOT account/household deletion: RPC-protected shared records (tasks, calendar,
 * care hand-offs, pending invites, notifications) survive, and full permanent deletion
 * is operator-managed (see docs/BETA_DATA_DELETION.md). To prevent accidents it takes
 * several intentional steps:
 *   1. An explicit "I understand" acknowledgement of what will be lost.
 *   2. Typing the baby's name EXACTLY to confirm.
 *   3. A final destructive button that only enables once the name matches.
 * There is no single-tap path to data loss.
 */
export function ResetScreen() {
  const { closeOverlay, showToast } = useNav()
  const { profile, clearProfile } = useProfile()
  const { clearLogs } = useLogs()
  const { clearMom } = useMom()
  const { clearMemories } = useMemories()
  const { clearAppointments } = useAppointments()
  const { clearInbox } = useInbox()
  const { clearPartner } = usePartner()
  const { familyId } = useAuth()

  const babyName = (profile?.babyName ?? '').trim()
  const hasBaby = babyName.length > 0
  const [acknowledged, setAcknowledged] = useState(false)
  const [typed, setTyped] = useState('')

  // Confirmation gate (pure, in lib/reset-confirm): with a baby, type the baby's name
  // (case-insensitive, trimmed); with NO baby, type the literal word RESET. Either way
  // the destructive button stays disabled until this matches.
  const matches = resetConfirmationMatches(hasBaby, babyName, typed)

  const [busy, setBusy] = useState(false)

  const doReset = async () => {
    if (!matches || busy) return
    // Clear the on-device copies immediately (these always succeed locally).
    clearLogs()
    clearMom()
    clearMemories()
    clearAppointments()
    clearInbox()
    clearPartner()
    clearProfile()
    // Clear the cloud family data. Truthfulness (Beta Launch Fixes): this removes the
    // baby profile, logs, mood/to-dos/questions, memories and grocery, but some SHARED
    // household records (tasks, calendar events, care handoffs, and any pending
    // invites) are RPC-protected and are NOT wiped by this client path — they can
    // remain until beta support removes them. So we do NOT claim "everything was
    // erased". We also await the cloud clear so we can tell the truth if it fails
    // rather than firing an unconditional success toast.
    let cloudOk = true
    if (familyId) {
      setBusy(true)
      try {
        await clearFamilyData(familyId)
      } catch (e) {
        console.warn('cloud reset', e)
        cloudOk = false
      } finally {
        setBusy(false)
      }
    }
    showToast(
      cloudOk
        ? 'Your baby profile and logs were cleared'
        : "Cleared on this device — some cloud data couldn't be reached",
    )
    // This clears the baby profile + logs, not your household identity — so you return
    // to the (now empty) app, where Today shows the first-run nudge. first-run routing
    // is derived from authoritative identity (useHousehold().firstRun), and your
    // identity still stands. Re-establishing a baby is done from the normal add flow.
    closeOverlay()
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <TopBar variant="close" title="Start over" onBack={closeOverlay} />

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="mx-auto mt-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" strokeWidth={1.75} />
        </div>

        <h1 className="mt-5 text-center font-serif text-[24px] font-semibold tracking-tight">
          Start over?
        </h1>
        <p className="mx-auto mt-3 max-w-[19rem] text-center text-[15px] leading-relaxed text-muted-foreground">
          This clears {babyName ? <strong className="text-foreground">{babyName}</strong> : 'your baby'}
          &apos;s profile and <strong className="text-foreground">all the logs</strong> — feeds, sleeps,
          diapers — plus your check-in, to-dos, questions, memories and grocery list. This can&apos;t be
          undone.
        </p>
        <p className="mx-auto mt-3 max-w-[19rem] text-center text-[13px] leading-relaxed text-muted-foreground">
          Shared items like tasks, calendar events and care hand-offs may stay with your household.
          To permanently delete your whole account and household, contact beta support.
        </p>

        {!acknowledged ? (
          <div className="mt-8 space-y-3">
            <button
              onClick={() => setAcknowledged(true)}
              className="w-full rounded-2xl border border-destructive/40 bg-destructive/5 py-4 text-[15px] font-semibold text-destructive transition-transform active:scale-[0.99]"
            >
              I understand — continue
            </button>
            <button
              onClick={closeOverlay}
              className="w-full rounded-full bg-muted py-3.5 text-[15px] font-semibold text-foreground transition-transform active:scale-[0.99]"
            >
              Keep my data
            </button>
          </div>
        ) : (
          <div className="mt-8">
            <label className="block">
              <span className="mb-1.5 block px-1 text-[13px] font-medium text-muted-foreground">
                {hasBaby ? (
                  <>
                    Type <strong className="text-foreground">{babyName}</strong> to confirm
                  </>
                ) : (
                  <>
                    Type <strong className="text-foreground">{RESET_CONFIRM_WORD}</strong> to confirm
                  </>
                )}
              </span>
              <input
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={hasBaby ? babyName : RESET_CONFIRM_WORD}
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-[16px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-destructive"
              />
            </label>

            <button
              onClick={() => void doReset()}
              disabled={!matches || busy}
              className="mt-5 w-full rounded-2xl bg-destructive py-4 text-[15px] font-semibold text-white transition-transform active:scale-[0.99] disabled:opacity-40"
            >
              {busy ? 'Clearing…' : hasBaby ? 'Clear this baby & logs' : 'Clear my data'}
            </button>
            <button
              onClick={closeOverlay}
              className="mt-2 w-full rounded-full bg-muted py-3.5 text-[15px] font-semibold text-foreground transition-transform active:scale-[0.99]"
            >
              Cancel — keep my data
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
