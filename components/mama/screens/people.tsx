'use client'

import { useState } from 'react'
import { Users, UserPlus, Link2, X, Check } from 'lucide-react'
import { useNav } from '../context'
import { useHousehold, type HouseholdPerson } from '../household'
import { Card, Screen, Scroll, StatusBar, TopBar } from '../ui'

// Step 7 — the Household People surface. Shows who's in the household and each
// person's account status (Connected / Invite pending / Not connected), and lets the
// owner invite an account-less adult by generating a shareable join link. Minimal by
// design: this proves + uses household membership, it is not a settings product.
export function PeopleScreen() {
  const { closeOverlay, showToast } = useNav()
  const { people, invitePerson, revokeInvite } = useHousehold()

  return (
    <Screen>
      <StatusBar />
      <TopBar variant="close" title="Household" onBack={closeOverlay} />
      <Scroll className="space-y-4 px-6 pb-8">
        <header className="pt-1">
          <h1 className="flex items-center gap-2 font-serif text-[24px] font-semibold tracking-tight">
            Your household <Users className="size-5 text-sage" strokeWidth={1.75} />
          </h1>
          <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
            The people you share this with. Invite another adult so responsibilities don&apos;t all
            live in one place.
          </p>
        </header>

        <div className="space-y-2">
          {people.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              onInvite={async () => {
                const res = await invitePerson(p.id, p.email)
                if (res.ok && res.url) {
                  await copy(res.url)
                  showToast('Invite link copied')
                } else {
                  showToast(res.error ? `Couldn't invite: ${res.error}` : "Couldn't create invite")
                }
              }}
              onRevoke={async () => {
                if (p.pendingInvitationId) {
                  await revokeInvite(p.pendingInvitationId)
                  showToast('Invite revoked')
                }
              }}
            />
          ))}
          {people.length === 0 && (
            <p className="pt-2 text-center text-[14px] text-muted-foreground">No people yet.</p>
          )}
        </div>

        <p className="rounded-2xl bg-muted/60 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
          An invite link lets another adult create or sign into their own MamaHQ account and join
          this household. Being listed here is not the same as having access — access comes only
          from accepting an invite.
        </p>
      </Scroll>
    </Screen>
  )
}

function PersonRow({
  person,
  onInvite,
  onRevoke,
}: {
  person: HouseholdPerson
  onInvite: () => void | Promise<void>
  onRevoke: () => void | Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const status = person.accountStatus ?? 'none'
  const roleLabel = person.role === 'owner' ? 'Owner' : person.role === 'member' ? 'Partner' : person.relationship

  return (
    <Card className="flex items-center gap-3.5">
      <span className="flex size-11 items-center justify-center rounded-full bg-sage-soft font-serif text-[17px] font-semibold text-sage">
        {person.displayName.trim().charAt(0).toUpperCase() || '?'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-[17px] font-semibold leading-tight">{person.displayName}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          {roleLabel && <span className="capitalize">{roleLabel}</span>}
          {roleLabel && <span aria-hidden>·</span>}
          <StatusChip status={status} />
        </p>
      </div>

      {/* Eligible to invite: an account-less person with no pending invite. */}
      {status === 'none' && (
        <button
          onClick={async () => {
            setBusy(true)
            await onInvite()
            setBusy(false)
          }}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-40"
        >
          <UserPlus className="size-3.5" /> Invite
        </button>
      )}
      {status === 'invited' && (
        <button
          onClick={async () => {
            setBusy(true)
            await onRevoke()
            setBusy(false)
          }}
          disabled={busy}
          aria-label="Revoke invite"
          className="flex items-center gap-1.5 rounded-full bg-muted px-3.5 py-2 text-[13px] font-semibold text-muted-foreground disabled:opacity-40"
        >
          <X className="size-3.5" /> Revoke
        </button>
      )}
    </Card>
  )
}

function StatusChip({ status }: { status: 'connected' | 'invited' | 'none' }) {
  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sage-soft px-2 py-0.5 text-[12px] font-medium text-sage">
        <Check className="size-3" strokeWidth={3} /> Connected
      </span>
    )
  }
  if (status === 'invited') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blush/30 px-2 py-0.5 text-[12px] font-medium text-foreground">
        <Link2 className="size-3" /> Invite pending
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[12px] font-medium text-muted-foreground">
      Not connected
    </span>
  )
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Clipboard may be unavailable; the toast still confirms creation.
  }
}
