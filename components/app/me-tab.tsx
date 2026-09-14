'use client'

import { useMemo, useState } from 'react'
import type { AppState, Appointment, PlanItem, Question, Task } from '@/lib/types'
import type { Actions } from '@/components/app/mama-hq-app'
import { CalendarClock, CheckSquare, HelpCircle, MapPin, User, Plus, X } from 'lucide-react'
import { CheckToggle, Section, EmptyState } from '@/components/app/ui'
import { PlanAddSheet } from '@/components/app/plan-add-sheet'

// "Me" — because Mom is the one everyone forgets while focused on the baby. This is NOT a wellness
// dashboard: no scores, no streaks, no judgment (SAFETY.md). It's practical external memory for
// Mom herself — her appointments, tasks, questions for her own provider, notes — plus a gentle,
// optional daily check-in. It's a VIEW over the same plan_items table, filtered to scope='mom'.

export function MeTab({ state, actions }: { state: AppState; actions: Actions }) {
  const [adding, setAdding] = useState(false)

  const mine = useMemo(() => state.plan.filter((p) => p.scope === 'mom'), [state.plan])
  const appointments = mine.filter((p): p is Appointment => p.kind === 'appointment')
  const tasks = mine
    .filter((p): p is Task => p.kind === 'task')
    .sort((a, b) => Number(a.done) - Number(b.done))
  const questions = mine
    .filter((p): p is Question => p.kind === 'question')
    .sort((a, b) => Number(a.answered) - Number(b.answered))

  const isEmpty = mine.length === 0

  return (
    <div className="px-5 pt-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl text-foreground">You</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The things that are yours to carry — kept here so you don’t have to hold them.
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="mt-1 flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {/* Gentle daily check-in — supportive, never evaluative, no scores. */}
      <section className="mt-6 rounded-2xl bg-accent/50 p-4">
        <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-accent-foreground">
          A gentle check-in
        </h2>
        <ul className="mt-2 space-y-1">
          <CheckinItem
            label="Drink some water"
            done={state.momCheckin.water}
            onToggle={() => actions.toggleCheckin('water', !state.momCheckin.water)}
          />
          <CheckinItem
            label="Eat something"
            done={state.momCheckin.eat}
            onToggle={() => actions.toggleCheckin('eat', !state.momCheckin.eat)}
          />
          <CheckinItem
            label="Take ten minutes for yourself"
            done={state.momCheckin.rest}
            onToggle={() => actions.toggleCheckin('rest', !state.momCheckin.rest)}
          />
        </ul>
      </section>

      {isEmpty ? (
        <EmptyState title="Nothing here yet">
          Add your own appointments, tasks, or questions for your provider. Tap <span className="text-foreground">Add</span>.
        </EmptyState>
      ) : (
        <div className="mt-6 space-y-8 pb-4">
          {appointments.length > 0 && (
            <Section title="Your appointments" icon={<CalendarClock className="h-4 w-4" />}>
              <ul className="space-y-2">
                {appointments.map((a) => (
                  <MeAppointmentRow key={a.id} appt={a} onDelete={() => actions.deletePlanItem(a.id)} />
                ))}
              </ul>
            </Section>
          )}

          {tasks.length > 0 && (
            <Section title="Your tasks" icon={<CheckSquare className="h-4 w-4" />}>
              <ul className="space-y-2">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm">
                    <CheckToggle
                      checked={t.done}
                      onToggle={() => actions.updatePlanItem(t.id, { done: !t.done }, { done: !t.done })}
                      label={t.done ? 'Mark not done' : 'Mark done'}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${t.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{t.title}</p>
                      {t.dueText && <p className="mt-0.5 text-xs text-muted-foreground">{t.dueText}</p>}
                    </div>
                    <DeleteX label="Delete task" onClick={() => actions.deletePlanItem(t.id)} />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {questions.length > 0 && (
            <Section title="Questions for your provider" icon={<HelpCircle className="h-4 w-4" />}>
              <ul className="space-y-2">
                {questions.map((q) => (
                  <li key={q.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm">
                    <CheckToggle
                      checked={q.answered}
                      onToggle={() => actions.updatePlanItem(q.id, { answered: !q.answered }, { answered: !q.answered })}
                      label={q.answered ? 'Mark unanswered' : 'Mark answered'}
                    />
                    <span className={`flex-1 text-sm ${q.answered ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {q.text}
                    </span>
                    <DeleteX label="Delete question" onClick={() => actions.deletePlanItem(q.id)} />
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}

      {adding && (
        <PlanAddSheet
          appointments={appointments}
          scope="mom"
          onClose={() => setAdding(false)}
          onAdd={actions.addPlanItem}
        />
      )}
    </div>
  )
}

function MeAppointmentRow({ appt, onDelete }: { appt: Appointment; onDelete: () => void }) {
  const meta = [appt.whenText, appt.who, appt.location].filter(Boolean)
  return (
    <li className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{appt.title}</p>
          {meta.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {appt.whenText && <span className="inline-flex items-center gap-1"><CalendarClock className="size-3.5" />{appt.whenText}</span>}
              {appt.who && <span className="inline-flex items-center gap-1"><User className="size-3.5" />{appt.who}</span>}
              {appt.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{appt.location}</span>}
            </div>
          )}
        </div>
        <DeleteX label="Delete appointment" onClick={onDelete} />
      </div>
    </li>
  )
}

function DeleteX({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="shrink-0 rounded-full p-1 text-muted-foreground/50 transition-colors hover:text-destructive"
    >
      <X className="h-4 w-4" />
    </button>
  )
}

function CheckinItem({ label, done, onToggle }: { label: string; done: boolean; onToggle: () => void }) {
  return (
    <li className="flex items-center gap-3 py-1">
      <CheckToggle checked={done} onToggle={onToggle} label={done ? `Undo: ${label}` : label} />
      <button
        onClick={onToggle}
        className={`text-left text-sm ${done ? 'text-muted-foreground line-through' : 'text-foreground'}`}
      >
        {label}
      </button>
    </li>
  )
}
