'use client'

// Visit Mode (prototype) — a describe-only sheet to bring to an appointment. Per SAFETY.md this
// REPORTS recorded counts only; it never interprets the baby. Opened from an appointment in Plan.
// This is a Step-4 prototype: the recorded-data summary is computed from real logs, the layout is
// the target; full Visit Mode is Step 12.

import type { AppState, Appointment, Question } from '@/lib/types'
import { BottomSheet, Section } from '@/components/app/ui'
import { CalendarClock, MapPin, User } from 'lucide-react'

export function VisitSheet({
  appointment,
  questions,
  state,
  onClose,
}: {
  appointment: Appointment
  questions: Question[]
  state: AppState
  onClose: () => void
}) {
  // Describe-only recorded counts for the last 7 days. Counts, never conclusions.
  const since = Date.now() - 7 * 86400000
  const recent = state.logs.filter((l) => new Date(l.createdAt).getTime() >= since)
  const feeds = recent.filter((l) => l.kind === 'feed').length
  const diapers = recent.filter((l) => l.kind === 'diaper').length
  const sleeps = recent.filter((l) => l.kind === 'sleep').length
  const pumps = recent.filter((l) => l.kind === 'pump').length

  const meta = [appointment.whenText, appointment.who, appointment.location].filter(Boolean)

  return (
    <BottomSheet title="Visit prep" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <p className="font-serif text-lg text-foreground">{appointment.title}</p>
          {meta.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {appointment.whenText && (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="size-3.5" />
                  {appointment.whenText}
                </span>
              )}
              {appointment.who && (
                <span className="inline-flex items-center gap-1">
                  <User className="size-3.5" />
                  {appointment.who}
                </span>
              )}
              {appointment.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {appointment.location}
                </span>
              )}
            </div>
          )}
        </div>

        <Section title="Questions to ask">
          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No questions saved for this visit yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm text-foreground">
              {questions.map((q) => (
                <li key={q.id} className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  {q.text}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Recorded in the last 7 days">
          <p className="text-sm leading-relaxed text-foreground">
            Feeds logged: {feeds} · Diapers logged: {diapers} · Sleep sessions logged: {sleeps} ·
            Pumping logged: {pumps}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            This is a summary of what you recorded — not medical advice. Bring it to your provider.
          </p>
        </Section>
      </div>
    </BottomSheet>
  )
}
