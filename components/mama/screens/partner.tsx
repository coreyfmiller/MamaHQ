'use client'

import { useState } from 'react'
import { Heart, Users, Trash2 } from 'lucide-react'
import { useNav } from '../context'
import { usePartner } from '../partner'
import { Card, CardLabel, Screen, Scroll, StatusBar, TopBar } from '../ui'

export function PartnerScreen() {
  const { closeOverlay } = useNav()
  const { partner, savePartner, removePartner } = usePartner()
  const [editing, setEditing] = useState(!partner)

  return (
    <Screen>
      <StatusBar />
      <TopBar variant="close" title="Partner" onBack={closeOverlay} />
      <Scroll className="space-y-4 px-6 pb-8">
        <header className="pt-1">
          <h1 className="flex items-center gap-2 font-serif text-[24px] font-semibold tracking-tight">
            Share the load <Users className="size-5 text-sage" strokeWidth={1.75} />
          </h1>
          <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
            Keep a partner or helper&apos;s details handy. To truly share the load, invite them
            from Household so they get their own account.
          </p>
        </header>

        {partner && !editing ? (
          <SavedPartner onEdit={() => setEditing(true)} onRemove={removePartner} />
        ) : (
          <PartnerForm
            initial={partner}
            onCancel={partner ? () => setEditing(false) : undefined}
            onSave={(p) => {
              savePartner(p)
              setEditing(false)
            }}
          />
        )}

        <p className="flex items-center justify-center gap-1.5 pt-2 font-serif text-[15px] font-medium text-muted-foreground">
          You&apos;re both in this <Heart className="size-4 fill-blush text-blush" />
        </p>
      </Scroll>
    </Screen>
  )
}

function SavedPartner({ onEdit, onRemove }: { onEdit: () => void; onRemove: () => void }) {
  const { partner } = usePartner()
  const [confirmRemove, setConfirmRemove] = useState(false)
  if (!partner) return null

  return (
    <>
      <Card className="space-y-3">
        <div className="flex items-center gap-3.5">
          <span className="flex size-12 items-center justify-center rounded-full bg-sage-soft font-serif text-[18px] font-semibold text-sage">
            {partner.name.trim().charAt(0).toUpperCase() || '?'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-[18px] font-semibold leading-tight">{partner.name}</p>
            <p className="text-[13px] text-muted-foreground">
              {[partner.phone, partner.email].filter(Boolean).join(' · ') || 'No contact info yet'}
            </p>
          </div>
          <button onClick={onEdit} className="text-[14px] font-medium text-primary">
            Edit
          </button>
        </div>

      </Card>

      {/* Beta Phase 1: no SMS/email delivery controls are shown — MamaHQ must never
          imply a notification channel it can't actually deliver. Partners who have
          their own account receive real in-app notifications; that is the live
          channel today. */}

      {confirmRemove ? (
        <div className="flex gap-2">
          <button
            onClick={() => setConfirmRemove(false)}
            className="flex-1 rounded-full bg-muted py-3 text-[14px] font-semibold text-foreground"
          >
            Keep
          </button>
          <button
            onClick={onRemove}
            className="flex-1 rounded-full bg-destructive py-3 text-[14px] font-semibold text-white"
          >
            Remove partner
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmRemove(true)}
          className="flex w-full items-center justify-center gap-2 py-2 text-[14px] font-medium text-destructive"
        >
          <Trash2 className="size-4" /> Remove partner
        </button>
      )}
    </>
  )
}

function PartnerForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: ReturnType<typeof usePartner>['partner']
  onSave: (p: { name: string; phone?: string; email?: string; notifySms: boolean; notifyEmail: boolean }) => void
  onCancel?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')

  const emailValid = email.trim() === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
  const canSave = name.trim().length > 0 && emailValid

  return (
    <Card className="space-y-4">
      <CardLabel className="text-foreground">{initial ? 'Edit partner' : 'Add a partner'}</CardLabel>

      <Field label="Their name">
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={!initial}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alex"
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-[16px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
        />
      </Field>

      <Field label="Phone (for texts)">
        <input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+1 555 123 4567"
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-[16px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
        />
      </Field>

      <Field label="Email">
        <input
          type="email"
          inputMode="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="alex@example.com"
          className={`w-full rounded-2xl border bg-card px-4 py-3 text-[16px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary ${
            emailValid ? 'border-border' : 'border-destructive'
          }`}
        />
      </Field>

      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Contact details are for your reference. To share the load in MamaHQ, invite them from
        Household so they get their own account and real in-app notifications.
      </p>

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-full bg-muted px-5 py-3 text-[15px] font-semibold text-foreground"
          >
            Cancel
          </button>
        )}
        <button
          onClick={() =>
            // Delivery channels are not implied: notify flags are persisted as false
            // (no SMS/email delivery exists). In-app notifications are the real channel.
            canSave && onSave({ name, phone: phone || undefined, email: email || undefined, notifySms: false, notifyEmail: false })
          }
          disabled={!canSave}
          className="flex-1 rounded-full bg-primary py-3 text-[15px] font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-40"
        >
          {initial ? 'Save' : 'Add partner'}
        </button>
      </div>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[13px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
