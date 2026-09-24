'use client'

import { useState } from 'react'
import { Users, UserPlus, Link2, X, Check, Share2, Loader2, ChevronRight } from 'lucide-react'
import { useNav } from '../context'
import { useHousehold, type HouseholdPerson } from '../household'
import { shareInvite, copyInvite, canNativeShare } from '../invite-share'
import { Card, Screen, Scroll, StatusBar, TopBar } from '../ui'

// Local id generator so we can create a person AND generate their invite against the
// same id in one action (savePerson would otherwise mint the id internally).
function newPersonId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

// Step 7 — the Household People surface. Shows who's in the household and each
// person's account status (Connected / Invite pending / Not connected), and lets the
// owner invite an account-less adult by generating a shareable join link. Minimal by
// design: this proves + uses household membership, it is not a settings product.
export function PeopleScreen() {
  const { closeOverlay, openOverlay, showToast } = useNav()
  const { people, savePerson, invitePerson, revokeInvite } = useHousehold()
  // The freshly-generated invite link, kept in memory per person so we can surface it
  // for the user to share. The link is a credential — never logged, never sent by us.
  const [inviteUrls, setInviteUrls] = useState<Record<string, string>>({})

  // Create a brand-new account-less adult and immediately generate their invite link.
  // This is what makes a one-person household NOT a dead end: without it, the only
  // way to add an adult was the onboarding wizard, so a solo owner had nothing to
  // invite and no way to add someone to invite. Returns the share URL on success so
  // the caller can surface it inline.
  const inviteNewPerson = async (displayName: string): Promise<{ ok: boolean; error?: string }> => {
    const name = displayName.trim()
    if (!name) return { ok: false, error: 'Enter a name first' }
    const id = newPersonId()
    // savePerson is fire-and-forget (optimistic). Create the person as a partner so
    // it's an invitable adult, then generate the invite against that same id.
    savePerson({ id, displayName: name, relationship: 'partner' })
    const res = await invitePerson(id, undefined)
    if (res.ok && res.url) {
      setInviteUrls((m) => ({ ...m, [id]: res.url! }))
      return { ok: true }
    }
    return { ok: false, error: res.error ?? 'Couldn’t create invite' }
  }

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
              inviteUrl={inviteUrls[p.id]}
              onInvite={async () => {
                const res = await invitePerson(p.id, p.email)
                if (res.ok && res.url) {
                  // Surface the link for the user to send themselves (we don't
                  // deliver it). Do NOT claim it was "sent".
                  setInviteUrls((m) => ({ ...m, [p.id]: res.url! }))
                } else {
                  showToast(res.error ? `Couldn't invite: ${res.error}` : "Couldn't create invite")
                }
              }}
              onShare={async (url) => {
                const r = await shareInvite(url, p.displayName)
                if (r === 'copied') showToast(`Invite link copied — send it to ${p.displayName}`)
                else if (r === 'failed') showToast('Couldn’t copy — the link is shown below')
              }}
              onCopy={async (url) => {
                const ok = await copyInvite(url)
                showToast(ok ? 'Invite link copied' : 'Couldn’t copy — select the link above')
              }}
              onRevoke={async () => {
                if (p.pendingInvitationId) {
                  await revokeInvite(p.pendingInvitationId)
                  setInviteUrls((m) => {
                    const next = { ...m }
                    delete next[p.id]
                    return next
                  })
                  showToast('Invite revoked')
                }
              }}
            />
          ))}
          {people.length === 0 && (
            <p className="pt-2 text-center text-[14px] text-muted-foreground">No people yet.</p>
          )}
        </div>

        {/* Invite a brand-new adult. This is the entry point that makes a solo
            household usable — create the person and generate their link in one step. */}
        <InviteSomeoneNew onInvite={inviteNewPerson} />

        <p className="rounded-2xl bg-muted/60 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
          An invite link lets another adult create or sign into their own MamaHQ account and join
          this household. Being listed here is not the same as having access — access comes only
          from accepting an invite.
        </p>

        {/* Partner view — the "share the load" surface. Kept reachable here in the
            household domain (Home → Family) after Me 2.0 removed its Me link, so the
            existing PartnerScreen never becomes orphaned. */}
        <button
          onClick={() => openOverlay('partner')}
          className="flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left ring-1 ring-border/60 transition-colors active:bg-muted"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage">
            <Users className="size-[18px]" strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold leading-tight">Partner view</p>
            <p className="text-[13px] text-muted-foreground">Share the load</p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
      </Scroll>
    </Screen>
  )
}

function PersonRow({
  person,
  inviteUrl,
  onInvite,
  onShare,
  onCopy,
  onRevoke,
}: {
  person: HouseholdPerson
  inviteUrl?: string
  onInvite: () => void | Promise<void>
  onShare: (url: string) => void | Promise<void>
  onCopy: (url: string) => void | Promise<void>
  onRevoke: () => void | Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const status = person.accountStatus ?? 'none'
  const roleLabel = person.role === 'owner' ? 'Owner' : person.role === 'member' ? 'Partner' : person.relationship

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-3.5">
        <span className="flex size-11 items-center justify-center rounded-full bg-sage-soft font-serif text-[17px] font-semibold text-sage">
          {person.displayName.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-[17px] font-semibold leading-tight">{person.displayName}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
            {roleLabel && <span className="capitalize">{roleLabel}</span>}
            {roleLabel && <span aria-hidden>·</span>}
            <StatusChip status={status} hasLink={!!inviteUrl} />
          </p>
        </div>

        {/* Eligible to invite: an account-less person with no pending invite. Once a
            link exists we don't re-generate — the share/copy controls appear below. */}
        {status === 'none' && !inviteUrl && (
          <button
            onClick={async () => {
              setBusy(true)
              await onInvite()
              setBusy(false)
            }}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
            {busy ? 'Creating…' : 'Invite'}
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
      </div>

      {/* A freshly-generated link to share. Honest: MamaHQ generates the link, the
          user sends it. Never "invitation sent". */}
      {inviteUrl && status !== 'connected' && (
        <div className="space-y-2 rounded-2xl bg-muted/50 px-3.5 py-3">
          <p className="text-[13px] font-medium text-foreground">
            Copy this private link and send it to {person.displayName}:
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-muted-foreground">
              {inviteUrl}
            </code>
            <button
              onClick={() => onShare(inviteUrl)}
              aria-label={canNativeShare() ? 'Share invite link' : 'Copy invite link'}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
            >
              {canNativeShare() ? <Share2 className="size-4" /> : <Link2 className="size-4" />}
            </button>
          </div>
          <button onClick={() => onCopy(inviteUrl)} className="text-[13px] font-medium text-primary">
            Copy link
          </button>
        </div>
      )}
    </Card>
  )
}

function StatusChip({ status, hasLink }: { status: 'connected' | 'invited' | 'none'; hasLink?: boolean }) {
  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sage-soft px-2 py-0.5 text-[12px] font-medium text-sage">
        <Check className="size-3" strokeWidth={3} /> Joined
      </span>
    )
  }
  if (status === 'invited') {
    // A pending invitation exists server-side but hasn't been accepted. We say
    // "Invite pending" (not "sent") because MamaHQ never delivered it.
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blush/30 px-2 py-0.5 text-[12px] font-medium text-foreground">
        <Link2 className="size-3" /> Invite pending
      </span>
    )
  }
  // No pending invite. If we just generated a link this session, it's "ready" to
  // share; otherwise "not invited".
  if (hasLink) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blush/30 px-2 py-0.5 text-[12px] font-medium text-foreground">
        <Link2 className="size-3" /> Invite ready
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[12px] font-medium text-muted-foreground">
      Not invited
    </span>
  )
}

// Add-and-invite a new adult in one step. Collapsed to a single button until tapped,
// then a name field + "Create invite". On success the new person appears in the list
// above (with their share/copy controls); we clear and re-collapse.
function InviteSomeoneNew({
  onInvite,
}: {
  onInvite: (displayName: string) => Promise<{ ok: boolean; error?: string }>
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    const res = await onInvite(name)
    setBusy(false)
    if (res.ok) {
      setName('')
      setOpen(false)
    } else {
      setError(res.error ?? 'Couldn’t create invite')
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-4 py-3.5 text-[14px] font-semibold text-foreground transition-transform active:scale-[0.99]"
      >
        <UserPlus className="size-4 text-sage" strokeWidth={1.75} />
        Invite someone new
      </button>
    )
  }

  return (
    <Card className="space-y-3">
      <p className="text-[14px] font-semibold">Invite another adult</p>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim() && !busy) submit()
        }}
        placeholder="Their name (e.g. Alex)"
        className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[15px] outline-none focus:border-primary"
      />
      {error && <p className="text-[13px] text-destructive">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={busy || !name.trim()}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3.5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
          {busy ? 'Creating…' : 'Create invite'}
        </button>
        <button
          onClick={() => {
            setOpen(false)
            setName('')
            setError(null)
          }}
          disabled={busy}
          className="rounded-full bg-muted px-3.5 py-2.5 text-[13px] font-semibold text-muted-foreground disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </Card>
  )
}
