'use client'

import { useState } from 'react'
import { Baby as BabyIcon, Check, Hand, Loader2 } from 'lucide-react'
import { useNav } from '../context'
import { useHousehold } from '../household'
import { useCare, careContextLines, type CareContext } from '../care'
import { Card, CardLabel, Screen, Scroll, StatusBar, TopBar } from '../ui'

// Step 9 — the Care Handoff surface. A minimal add-on to Baby/Care (not a redesign).
// It answers: who currently has the baby, and lets a caregiver hand off to another
// household adult who must explicitly accept. A proposed handoff does NOT transfer
// responsibility — only acceptance does. No realtime: a refetch shows the result.

export function CareHandoffScreen() {
  const { closeOverlay, showToast } = useNav()
  const { people, me } = useHousehold()
  const { available, hydrated, holderPersonId, pending, buildContext, propose, accept, decline, cancel } = useCare()
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)

  const personName = (id: string | null): string => {
    if (!id) return 'No one yet'
    const p = people.find((x) => x.id === id)
    if (!p) return 'Someone'
    return me && p.id === me.id ? 'You' : p.displayName
  }

  // Connected household people other than the current holder are valid recipients
  // (Step 9: only a connected account can accept a handoff).
  const recipients = people.filter((p) => p.accountStatus === 'connected' && p.id !== holderPersonId)

  const iAmHolder = !!me && holderPersonId === me.id
  const iAmRecipient = !!me && pending?.toPersonId === me.id
  const iProposed = !!me && pending != null && people.find((p) => p.id === holderPersonId)?.id === me.id

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => {
    setBusy(true)
    const res = await fn()
    setBusy(false)
    showToast(res.ok ? okMsg : res.error ? `Couldn't do that: ${res.error}` : "Couldn't do that")
  }

  return (
    <Screen>
      <StatusBar />
      <TopBar variant="close" title="Care handoff" onBack={closeOverlay} />
      <Scroll className="space-y-4 px-6 pb-8">
        <header className="pt-1">
          <h1 className="flex items-center gap-2 font-serif text-[24px] font-semibold tracking-tight">
            Who has the baby <BabyIcon className="size-5 text-sage" strokeWidth={1.75} />
          </h1>
          <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
            Hand off care so the other person actually has it — and you can stop holding it in
            your head. It only transfers when they say &ldquo;I&apos;ve got it.&rdquo;
          </p>
        </header>

        {!available ? (
          <Card>
            <p className="text-[14px] text-muted-foreground">
              Care handoff is shared with your household, so it lives in your account. Sign in to
              use it.
            </p>
          </Card>
        ) : !hydrated ? (
          <p className="py-6 text-center text-[14px] text-muted-foreground">Loading…</p>
        ) : (
          <>
            {/* Current holder */}
            <Card className="flex items-center gap-3.5">
              <span className="flex size-11 items-center justify-center rounded-full bg-sage-soft">
                <Check className="size-5 text-sage" strokeWidth={2.5} />
              </span>
              <div className="min-w-0 flex-1">
                <CardLabel>Currently has care</CardLabel>
                <p className="font-serif text-[18px] font-semibold leading-tight">{personName(holderPersonId)}</p>
              </div>
            </Card>

            {/* Pending handoff */}
            {pending ? (
              <Card className="space-y-3">
                <div>
                  <CardLabel className="text-foreground">Handoff pending</CardLabel>
                  <p className="mt-0.5 text-[15px]">
                    {personName(pending.fromPersonId)} → <span className="font-semibold">{personName(pending.toPersonId)}</span>
                  </p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    {personName(pending.toPersonId)} hasn&apos;t accepted yet — care is still with{' '}
                    {personName(holderPersonId)}.
                  </p>
                </div>

                <ContextPreview context={pending.context} />

                {iAmRecipient ? (
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      onClick={() => run(() => accept(pending.id), 'You have the baby')}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary py-2.5 text-[14px] font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-40"
                    >
                      {busy ? <Loader2 className="size-4 animate-spin" /> : <Hand className="size-4" />} I&apos;ve got it
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => run(() => decline(pending.id), 'Handoff declined')}
                      className="rounded-full bg-muted px-4 py-2.5 text-[14px] font-semibold text-muted-foreground disabled:opacity-40"
                    >
                      Can&apos;t take over
                    </button>
                  </div>
                ) : iProposed || iAmHolder ? (
                  <button
                    disabled={busy}
                    onClick={() => run(() => cancel(pending.id), 'Handoff cancelled')}
                    className="w-full rounded-full bg-muted py-2.5 text-[14px] font-semibold text-muted-foreground disabled:opacity-40"
                  >
                    Cancel handoff
                  </button>
                ) : (
                  <p className="text-[13px] text-muted-foreground">Waiting for {personName(pending.toPersonId)} to accept.</p>
                )}
              </Card>
            ) : (
              /* No pending handoff — the current holder can start one. */
              <div className="space-y-2">
                {iAmHolder ? (
                  !picking ? (
                    <button
                      onClick={() => setPicking(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
                    >
                      <Hand className="size-5" /> Hand off care
                    </button>
                  ) : (
                    <Card className="space-y-3">
                      <CardLabel className="text-foreground">Hand off to</CardLabel>
                      {recipients.length === 0 ? (
                        <p className="text-[13px] text-muted-foreground">
                          No one to hand off to yet. Only household members with their own MamaHQ
                          account can accept care. Invite another adult from Household.
                        </p>
                      ) : (
                        <>
                          <PreviewNote context={buildContext()} />
                          <div className="space-y-2">
                            {recipients.map((p) => (
                              <button
                                key={p.id}
                                disabled={busy}
                                onClick={() => run(() => propose(p.id), `Handoff sent to ${p.displayName}`)}
                                className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card px-3.5 py-3 text-left transition-transform active:scale-[0.99] disabled:opacity-40"
                              >
                                <span className="flex size-9 items-center justify-center rounded-full bg-sage-soft font-serif text-[15px] font-semibold text-sage">
                                  {p.displayName.trim().charAt(0).toUpperCase() || '?'}
                                </span>
                                <span className="flex-1 text-[15px] font-medium">{p.displayName}</span>
                                <Hand className="size-4 text-muted-foreground" />
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                      <button
                        onClick={() => setPicking(false)}
                        className="text-[13px] font-medium text-muted-foreground"
                      >
                        Never mind
                      </button>
                    </Card>
                  )
                ) : (
                  <Card>
                    <p className="text-[14px] text-muted-foreground">
                      {personName(holderPersonId)} currently has care. They can hand it off from
                      their device.
                    </p>
                  </Card>
                )}
              </div>
            )}

            <p className="rounded-2xl bg-muted/60 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
              Sending a handoff doesn&apos;t transfer responsibility. Care moves only when the other
              person accepts. This summary shows only what&apos;s been logged — nothing predicted.
            </p>
          </>
        )}
      </Scroll>
    </Screen>
  )
}

// The deterministic context preview shown before sending (from current logs).
function PreviewNote({ context }: { context: CareContext }) {
  const lines = careContextLines(context)
  if (lines.length === 0) {
    return (
      <p className="rounded-xl bg-muted/50 px-3 py-2 text-[13px] text-muted-foreground">
        Nothing logged recently to share. You can still hand off.
      </p>
    )
  }
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2">
      <p className="mb-1 text-[12px] font-semibold text-muted-foreground">They&apos;ll see</p>
      {lines.map((l) => (
        <p key={l.label} className="text-[13px]">
          <span className="text-muted-foreground">{l.label}:</span> {l.value}
        </p>
      ))}
    </div>
  )
}

// The context captured at propose time, shown on the pending card.
function ContextPreview({ context }: { context: CareContext }) {
  const lines = careContextLines(context)
  if (lines.length === 0) return null
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2">
      {lines.map((l) => (
        <p key={l.label} className="text-[13px]">
          <span className="text-muted-foreground">{l.label}:</span> {l.value}
        </p>
      ))}
    </div>
  )
}
