'use client'

import { useState } from 'react'
import type { Appointment, PlanItem, ShoppingListName } from '@/lib/types'
import { newId } from '@/lib/store'
import { BottomSheet, Segmented, Field, PrimaryButton } from '@/components/app/ui'

// Manually add a plan item (Step 9) — everything works without AI. The kind chooser adapts the
// form: task (assignee/due), appointment (when/who/location), question (link to an appointment),
// shopping (which list).

type Kind = 'task' | 'appointment' | 'question' | 'shopping'

export function PlanAddSheet({
  appointments,
  onClose,
  onAdd,
}: {
  appointments: Appointment[]
  onClose: () => void
  onAdd: (item: PlanItem) => void
}) {
  const [kind, setKind] = useState<Kind>('task')
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState('')
  const [dueText, setDueText] = useState('')
  const [whenText, setWhenText] = useState('')
  const [who, setWho] = useState('')
  const [location, setLocation] = useState('')
  const [list, setList] = useState<ShoppingListName>('shopping')
  const [appointmentId, setAppointmentId] = useState<string>('')

  function add() {
    const t = title.trim()
    if (!t) return
    const base = { id: newId(), createdAt: new Date().toISOString() }
    let item: PlanItem
    switch (kind) {
      case 'task':
        item = { ...base, kind: 'task', title: t, dueText: dueText.trim() || null, assignee: assignee.trim() || null, done: false, note: null }
        break
      case 'appointment':
        item = { ...base, kind: 'appointment', title: t, whenText: whenText.trim() || null, location: location.trim() || null, who: who.trim() || null, note: null, questionIds: [] }
        break
      case 'question':
        item = { ...base, kind: 'question', text: t, appointmentId: appointmentId || null, answered: false }
        break
      case 'shopping':
        item = { ...base, kind: 'shopping', item: t, list, done: false }
        break
    }
    onAdd(item)
    onClose()
  }

  const titleLabel =
    kind === 'question' ? 'Question' : kind === 'shopping' ? 'Item' : kind === 'appointment' ? 'Appointment' : 'Task'

  return (
    <BottomSheet title="Add to plan" onClose={onClose}>
      <div className="space-y-4">
        <Segmented
          ariaLabel="What to add"
          options={[
            { v: 'task', label: 'Task' },
            { v: 'appointment', label: 'Appt' },
            { v: 'question', label: 'Question' },
            { v: 'shopping', label: 'Shopping' },
          ]}
          value={kind}
          onChange={(v) => setKind(v as Kind)}
        />

        <Field label={titleLabel}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            maxLength={500}
            placeholder={
              kind === 'question'
                ? 'Ask about her skin'
                : kind === 'shopping'
                  ? 'Diapers'
                  : kind === 'appointment'
                    ? 'Pediatrician'
                    : 'Call the clinic'
            }
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-primary focus:outline-none"
          />
        </Field>

        {kind === 'task' && (
          <>
            <Field label="Assign to (optional)">
              <input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="e.g. Matt"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-primary focus:outline-none"
              />
            </Field>
            <Field label="When (optional)">
              <input
                value={dueText}
                onChange={(e) => setDueText(e.target.value)}
                placeholder="e.g. tomorrow"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-primary focus:outline-none"
              />
            </Field>
          </>
        )}

        {kind === 'appointment' && (
          <>
            <Field label="When (optional)">
              <input
                value={whenText}
                onChange={(e) => setWhenText(e.target.value)}
                placeholder="e.g. Thursday at 10"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-primary focus:outline-none"
              />
            </Field>
            <Field label="Who / where (optional)">
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={who}
                  onChange={(e) => setWho(e.target.value)}
                  placeholder="Provider"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-primary focus:outline-none"
                />
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Location"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-primary focus:outline-none"
                />
              </div>
            </Field>
          </>
        )}

        {kind === 'question' && appointments.length > 0 && (
          <Field label="Link to an appointment (optional)">
            <select
              value={appointmentId}
              onChange={(e) => setAppointmentId(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-primary focus:outline-none"
            >
              <option value="">Not linked</option>
              {appointments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                  {a.whenText ? ` — ${a.whenText}` : ''}
                </option>
              ))}
            </select>
          </Field>
        )}

        {kind === 'shopping' && (
          <Field label="List">
            <Segmented
              ariaLabel="Which list"
              options={[
                { v: 'shopping', label: 'Shopping' },
                { v: 'supplies', label: 'Supplies' },
                { v: 'general', label: 'General' },
              ]}
              value={list}
              onChange={(v) => setList(v as ShoppingListName)}
            />
          </Field>
        )}

        <PrimaryButton onClick={add} disabled={!title.trim()}>
          Add {titleLabel.toLowerCase()}
        </PrimaryButton>
      </div>
    </BottomSheet>
  )
}
