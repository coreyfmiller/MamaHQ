'use client'

// Visit Mode (Step 12) — a describe-only sheet to bring to an appointment. Per SAFETY.md this
// REPORTS recorded counts/durations only; it never interprets the baby, never scores, never
// advises. Opened from an appointment in Plan. Questions can be checked off from here as they're
// answered during the visit.

import type { AppState, Appointment, Question } from '@/lib/types'
import type { Actions } from '@/components/app/mama-hq-app'
import { BottomSheet, Section, CheckToggle } from '@/components/app/ui'
import { CalendarClock, MapPin, User } from 'lucide-react'

// Sum sleep durations (ms) for ended sleeps in a window — describes recorded time, not quality.
function totalSleepMinutes(logs: AppState['logs'], sinceMs: number): number {
  let ms = 0
  for (const l of logs) {
    if (l.kind !== 'sleep' || !l.endedAt) continue
    const start = new Date(l.createdAt).getTime()
    if (start < sinceMs) continue
    ms += new Date(l.endedAt).getTime() - start
  }
  return Math.round(ms / 60000)
}

function fmtMinutes(min: number): string {
  if (min <= 0) return '0m'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function VisitSheet({
  appointment,
  questions,
  state,
  actions,
  onClose,
}: {
  appointment: Appointment
  questions: Question[]
  state: AppState
  actions: Actions
  onClose: () => void
}) {
  // Describe-only recorded counts for the last 7 days. Counts/durations, never conclusions.
  const since = Date.now() - 7 * 86400000
  const recent = state.logs.filter((l) => new Date(l.createdAt).getTime() >= since)
  const feeds = recent.filter((l) => l.kind === 'feed').length
  const diapers = recent.filter((l) => l.kind === 'diaper').length
  const sleeps = recent.filter((l) => l.kind === 'sleep').length
  const pumps = recent.filter((l) => l.kind === 'pump').length
  const sleepMin = totalSleepMinutes(state.logs, since)

  const meta = [appointment.whenText, appointment.who, appointment.location].filter(Boolean)
  const answered = questions.filter((q) => q.answered).length

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

        <Section title={`Questions to ask${questions.length ? ` · ${answered}/${questions.length}` : ''}`}>
          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No questions saved for this visit yet. Add them in Plan as they come to you.
            </p>
          ) : (
            <ul className="space-y-2">
              {questions.map((q) => (
                <li key={q.id} className="flex items-start gap-3">
                  <CheckToggle
                    checked={q.answered}
                    onToggle={() =>
                      actions.updatePlanItem(q.id, { answered: !q.answered }, { answered: !q.answered })
                    }
                    label={q.answered ? 'Mark question unanswered' : 'Mark question answered'}
                  />
                  <span
                    className={`flex-1 text-sm ${
                      q.answered ? 'text-muted-foreground line-through' : 'text-foreground'
                    }`}
                  >
                    {q.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Recorded in the last 7 days">
          <div className="rounded-2xl border border-border bg-card p-4">
            <ul className="space-y-1.5 text-sm text-foreground">
              <li className="flex justify-between"><span>Feeds logged</span><span className="tabular-nums text-muted-foreground">{feeds}</span></li>
              <li className="flex justify-between"><span>Diapers logged</span><span className="tabular-nums text-muted-foreground">{diapers}</span></li>
              <li className="flex justify-between"><span>Sleep sessions logged</span><span className="tabular-nums text-muted-foreground">{sleeps}</span></li>
              <li className="flex justify-between"><span>Sleep time recorded</span><span className="tabular-nums text-muted-foreground">{fmtMinutes(sleepMin)}</span></li>
              <li className="flex justify-between"><span>Pumping logged</span><span className="tabular-nums text-muted-foreground">{pumps}</span></li>
            </ul>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            This is a summary of what you recorded — not medical advice, and not a judgment about
            {' '}{state.baby.name}. Bring it to your provider.
          </p>
        </Section>
      </div>
    </BottomSheet>
  )
}
