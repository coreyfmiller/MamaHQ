'use client'

import { useState } from 'react'
import { Heart, Users, Trash2, MessageSquare, Mail } from 'lucide-react'
import { useNav } from '../context'
import { usePartner } from '../partner'
import { notifier } from '@/lib/notify'
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
            Add a partner or helper so you can hand things off — and, soon, send them a nudge.
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

        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
          <Channel on={partner.notifySms} icon={<MessageSquare className="size-3.5" />} label="Texts" />
          <Channel on={partner.notifyEmail} icon={<Mail className="size-3.5" />} label="Emails" />
        </div>
      </Card>

      {/* Honest state: delivery isn't live yet. */}
      {!notifier.isConfigured() && (partner.notifySms || partner.notifyEmail) && (
        <p className="rounded-2xl bg-muted/60 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
          Heads up: message delivery isn&apos;t switched on yet. {partner.name} is saved, and
          hand-offs will start sending once notifications go live.
        </p>
      )}

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

function Channel({ on, icon, label }: { on: boolean; icon: React.ReactNode; label: string }) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium ${
        on ? 'bg-sage-soft text-sage' : 'bg-muted text-muted-foreground'
      }`}
    >
      {icon} {label} {on ? 'on' : 'off'}
    </span>
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
  const [notifySms, setNotifySms] = useState(initial?.notifySms ?? false)
  const [notifyEmail, setNotifyEmail] = useState(initial?.notifyEmail ?? false)

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

      <div className="space-y-2 border-t border-border/60 pt-3">
        <Toggle
          label="Send them texts"
          sub="Hand-offs and reminders by SMS"
          on={notifySms}
          disabled={!phone.trim()}
          onToggle={() => setNotifySms((v) => !v)}
        />
        <Toggle
          label="Send them emails"
          sub="Hand-offs and reminders by email"
          on={notifyEmail}
          disabled={!email.trim() || !emailValid}
          onToggle={() => setNotifyEmail((v) => !v)}
        />
      </div>

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
            canSave && onSave({ name, phone: phone || undefined, email: email || undefined, notifySms, notifyEmail })
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

function Toggle({
  label,
  sub,
  on,
  disabled,
  onToggle,
}: {
  label: string
  sub: string
  on: boolean
  disabled?: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={() => !disabled && onToggle()}
      disabled={disabled}
      className="flex w-full items-center justify-between py-1.5 text-left disabled:opacity-40"
    >
      <span>
        <span className="block text-[15px] font-medium text-foreground">{label}</span>
        <span className="block text-[13px] text-muted-foreground">{sub}</span>
      </span>
      <span
        role="switch"
        aria-checked={on}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on && !disabled ? 'bg-primary' : 'bg-border'}`}
      >
        <span className={`absolute top-1 size-5 rounded-full bg-card shadow transition-all ${on && !disabled ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  )
}
