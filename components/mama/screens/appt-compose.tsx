'use client'

import { useState } from 'react'
import { useNav } from '../context'
import { useAppointments } from '../appointments'
import { Screen, Scroll, StatusBar, TopBar } from '../ui'
import { toLocalInput, fromLocalInput } from '../logs'

// Add or edit an appointment. When selectedApptId is set we edit it; otherwise create.
export function ApptComposeScreen() {
  const { closeOverlay, showToast, selectedApptId, openAppointment } = useNav()
  const { appointments, addAppointment, updateAppointment } = useAppointments()

  const editing = appointments.find((a) => a.id === selectedApptId) ?? null

  const [title, setTitle] = useState(editing?.title ?? '')
  const defaultWhen = editing?.whenISO ?? nextSensibleTime()
  const [when, setWhen] = useState(toLocalInput(defaultWhen))
  const [location, setLocation] = useState(editing?.location ?? '')
  const [reminders, setReminders] = useState(editing?.remindersOn ?? true)

  const valid = title.trim().length > 0 && when.length > 0

  const save = () => {
    if (!valid) return
    const draft = {
      title,
      whenISO: fromLocalInput(when),
      location: location || undefined,
      remindersOn: reminders,
    }
    if (editing) {
      updateAppointment(editing.id, draft)
      showToast('Appointment updated')
      openAppointment(editing.id)
    } else {
      const created = addAppointment(draft)
      showToast('Appointment added')
      openAppointment(created.id)
    }
  }

  return (
    <Screen>
      <StatusBar />
      <TopBar variant="close" title={editing ? 'Edit appointment' : 'New appointment'} onBack={closeOverlay} />
      <Scroll className="space-y-4 px-6 pb-8">
        <Field label="What is it?">
          <input
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus={!editing}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 2-month checkup"
            className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-[16px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
          />
        </Field>

        <Field label="When">
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-[16px] text-foreground outline-none focus:border-primary"
          />
        </Field>

        <Field label="Where (optional)">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Riverside Pediatrics"
            className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-[16px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
          />
        </Field>

        <button
          onClick={() => setReminders((r) => !r)}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 text-left"
        >
          <span>
            <span className="block text-[15px] font-semibold">Reminders</span>
            <span className="block text-[13px] text-muted-foreground">A day before and an hour before</span>
          </span>
          <span
            role="switch"
            aria-checked={reminders}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${reminders ? 'bg-primary' : 'bg-border'}`}
          >
            <span className={`absolute top-1 size-5 rounded-full bg-card shadow transition-all ${reminders ? 'left-6' : 'left-1'}`} />
          </span>
        </button>
      </Scroll>

      <div className="px-6 pb-8 pt-2">
        <button
          onClick={save}
          disabled={!valid}
          className="w-full rounded-full bg-primary py-4 text-[16px] font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] transition-transform active:scale-[0.99] disabled:opacity-40"
        >
          {editing ? 'Save changes' : 'Add appointment'}
        </button>
      </div>
    </Screen>
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

// Default new appointments to the next day at 10:00 — a sensible, editable guess.
function nextSensibleTime(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  return d.toISOString()
}
