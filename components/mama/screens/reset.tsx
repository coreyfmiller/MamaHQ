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
import { TopBar } from '../ui'

/**
 * Deliberately hard "start over". This permanently erases the profile and every
 * log. To prevent accidents it takes several intentional steps:
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
  const [acknowledged, setAcknowledged] = useState(false)
  const [typed, setTyped] = useState('')

  // Case-insensitive exact match, ignoring surrounding whitespace.
  const matches = typed.trim().toLowerCase() === babyName.toLowerCase() && babyName.length > 0

  const doReset = () => {
    if (!matches) return
    // Wipe the cloud family's data too (fire-and-forget; local clears are instant).
    if (familyId) clearFamilyData(familyId).catch((e) => console.warn('cloud reset', e))
    clearLogs()
    clearMom()
    clearMemories()
    clearAppointments()
    clearInbox()
    clearPartner()
    clearProfile()
    showToast('Everything was erased')
    // Note: this erases the baby profile + logs, not your household identity — so
    // you return to the (now empty) app, where Today shows the first-run nudge. We
    // no longer force the onboarding phase here: first-run routing is derived from
    // authoritative identity (useHousehold().firstRun), and your identity still
    // stands. Re-establishing a baby is done from the normal add-people flow.
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
          Erase everything and start over?
        </h1>
        <p className="mx-auto mt-3 max-w-[19rem] text-center text-[15px] leading-relaxed text-muted-foreground">
          This permanently deletes {babyName ? <strong className="text-foreground">{babyName}</strong> : 'your baby'}
          &apos;s profile and <strong className="text-foreground">every log</strong> — feeds, sleeps, diapers,
          all of it. This cannot be undone.
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
                Type <strong className="text-foreground">{babyName || 'the baby&apos;s name'}</strong> to confirm
              </span>
              <input
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={babyName}
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-[16px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-destructive"
              />
            </label>

            <button
              onClick={doReset}
              disabled={!matches}
              className="mt-5 w-full rounded-2xl bg-destructive py-4 text-[15px] font-semibold text-white transition-transform active:scale-[0.99] disabled:opacity-40"
            >
              Permanently erase everything
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
