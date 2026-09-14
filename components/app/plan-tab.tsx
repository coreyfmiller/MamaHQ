'use client'

'use client'

import { useMemo, useState } from 'react'
import type { AppState, Appointment, PlanItem, Question, ShoppingItem, Task } from '@/lib/types'
import type { Actions } from '@/components/app/mama-hq-app'
import { CalendarClock, CheckSquare, HelpCircle, ShoppingCart, MapPin, User, Check, ClipboardList } from 'lucide-react'
import { VisitSheet } from '@/components/app/visit-sheet'

// The Plan tab is where everything the Inbox captured actually lives: appointments,
// tasks, questions for the doctor, and shopping/supply lists. Mom can see it all and
// check things off. This closes the loop on "get it out of your head."

export function PlanTab({ state, actions }: { state: AppState; actions: Actions }) {
  const groups = useMemo(() => groupPlan(state.plan), [state.plan])
  const [visitFor, setVisitFor] = useState<Appointment | null>(null)
  const isEmpty =
    groups.appointments.length === 0 &&
    groups.tasks.length === 0 &&
    groups.questions.length === 0 &&
    groups.shopping.length === 0

  return (
    <div className="px-5 pt-10">
      <h1 className="font-serif text-2xl text-foreground">Plan</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Appointments, tasks, questions, and lists — everything you’ve set down.
      </p>

      {isEmpty ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
          <p className="font-serif text-lg text-foreground">Nothing here yet</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
            Head to the Inbox and brain-dump what’s on your mind. Anything you keep shows up here.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-8 pb-4">
          {groups.appointments.length > 0 && (
            <Section title="Appointments" icon={<CalendarClock className="h-4 w-4" />}>
              <ul className="space-y-2">
                {groups.appointments.map((appt) => (
                  <AppointmentRow
                    key={appt.id}
                    appt={appt}
                    questions={groups.questionsByAppointment.get(appt.id) ?? []}
                    actions={actions}
                    onPrepVisit={() => setVisitFor(appt)}
                  />
                ))}
              </ul>
            </Section>
          )}

          {groups.tasks.length > 0 && (
            <Section title="Tasks" icon={<CheckSquare className="h-4 w-4" />}>
              <ul className="space-y-2">
                {groups.tasks.map((task) => (
                  <TaskRow key={task.id} task={task} actions={actions} />
                ))}
              </ul>
            </Section>
          )}

          {groups.questions.length > 0 && (
            <Section title="Questions for the doctor" icon={<HelpCircle className="h-4 w-4" />}>
              <ul className="space-y-2">
                {groups.questions.map((q) => (
                  <QuestionRow key={q.id} question={q} actions={actions} />
                ))}
              </ul>
            </Section>
          )}

          {groups.shopping.length > 0 &&
            [...groups.shoppingByList.entries()].map(([listName, items]) => (
              <Section
                key={listName}
                title={listLabel(listName)}
                icon={<ShoppingCart className="h-4 w-4" />}
              >
                <ul className="space-y-2">
                  {items.map((item) => (
                    <ShoppingRow key={item.id} item={item} actions={actions} />
                  ))}
                </ul>
              </Section>
            ))}
        </div>
      )}

      {visitFor && (
        <VisitSheet
          appointment={visitFor}
          questions={groups.questionsByAppointment.get(visitFor.id) ?? []}
          state={state}
          onClose={() => setVisitFor(null)}
        />
      )}
    </div>
  )
}

// ---------- section wrapper ----------

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2 text-muted-foreground">
        <span className="text-primary">{icon}</span>
        <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em]">{title}</h2>
      </div>
      {children}
    </section>
  )
}

// ---------- a round check control ----------

function CheckToggle({
  checked,
  onToggle,
  label,
}: {
  checked: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      onClick={onToggle}
      aria-label={label}
      aria-pressed={checked}
      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
        checked
          ? 'border-secondary-foreground/40 bg-secondary text-secondary-foreground'
          : 'border-muted-foreground/40 text-transparent'
      }`}
    >
      <Check className="size-3" />
    </button>
  )
}

// ---------- rows ----------

function AppointmentRow({
  appt,
  questions,
  actions,
  onPrepVisit,
}: {
  appt: Appointment
  questions: Question[]
  actions: Actions
  onPrepVisit: () => void
}) {
  const meta = [appt.whenText, appt.who, appt.location].filter(Boolean)
  return (
    <li className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="font-medium text-foreground">{appt.title}</p>
      {meta.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {appt.whenText && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" />
              {appt.whenText}
            </span>
          )}
          {appt.who && (
            <span className="inline-flex items-center gap-1">
              <User className="size-3.5" />
              {appt.who}
            </span>
          )}
          {appt.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {appt.location}
            </span>
          )}
        </div>
      )}

      {questions.length > 0 && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Ask about
          </p>
          <ul className="space-y-2">
            {questions.map((q) => (
              <QuestionRow key={q.id} question={q} actions={actions} dense />
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={onPrepVisit}
        className="mt-3 flex items-center gap-1.5 text-sm font-medium text-primary"
      >
        <ClipboardList className="h-4 w-4" />
        Prep for visit
      </button>
    </li>
  )
}

function TaskRow({ task, actions }: { task: Task; actions: Actions }) {
  const meta = [task.assignee, task.dueText].filter(Boolean).join(' · ')
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm">
      <CheckToggle
        checked={task.done}
        onToggle={() => actions.updatePlanItem(task.id, { done: !task.done }, { done: !task.done })}
        label={task.done ? 'Mark task not done' : 'Mark task done'}
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${task.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
          {task.title}
        </p>
        {meta && <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>}
      </div>
    </li>
  )
}

function QuestionRow({
  question,
  actions,
  dense,
}: {
  question: Question
  actions: Actions
  dense?: boolean
}) {
  return (
    <li className={`flex items-start gap-3 ${dense ? '' : 'rounded-2xl border border-border bg-card p-3.5 shadow-sm'}`}>
      <CheckToggle
        checked={question.answered}
        onToggle={() =>
          actions.updatePlanItem(question.id, { answered: !question.answered }, { answered: !question.answered })
        }
        label={question.answered ? 'Mark question unanswered' : 'Mark question answered'}
      />
      <p className={`flex-1 text-sm ${question.answered ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
        {question.text}
      </p>
    </li>
  )
}

function ShoppingRow({ item, actions }: { item: ShoppingItem; actions: Actions }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm">
      <CheckToggle
        checked={item.done}
        onToggle={() => actions.updatePlanItem(item.id, { done: !item.done }, { done: !item.done })}
        label={item.done ? 'Mark not bought' : 'Mark bought'}
      />
      <p className={`flex-1 text-sm ${item.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
        {item.item}
      </p>
    </li>
  )
}

// ---------- grouping ----------

type Grouped = {
  appointments: Appointment[]
  tasks: Task[]
  questions: Question[] // standalone (not linked to an appointment)
  shopping: ShoppingItem[]
  shoppingByList: Map<ShoppingItem['list'], ShoppingItem[]>
  questionsByAppointment: Map<string, Question[]>
}

function groupPlan(plan: PlanItem[]): Grouped {
  const appointments: Appointment[] = []
  const tasks: Task[] = []
  const allQuestions: Question[] = []
  const shopping: ShoppingItem[] = []

  for (const p of plan) {
    if (p.kind === 'appointment') appointments.push(p)
    else if (p.kind === 'task') tasks.push(p)
    else if (p.kind === 'question') allQuestions.push(p)
    else if (p.kind === 'shopping') shopping.push(p)
  }

  const questionsByAppointment = new Map<string, Question[]>()
  const standalone: Question[] = []
  for (const q of allQuestions) {
    if (q.appointmentId) {
      const arr = questionsByAppointment.get(q.appointmentId) ?? []
      arr.push(q)
      questionsByAppointment.set(q.appointmentId, arr)
    } else {
      standalone.push(q)
    }
  }

  // Open items first, done items sink to the bottom within each list.
  const shoppingByList = new Map<ShoppingItem['list'], ShoppingItem[]>()
  for (const item of shopping) {
    const arr = shoppingByList.get(item.list) ?? []
    arr.push(item)
    shoppingByList.set(item.list, arr)
  }
  for (const [, arr] of shoppingByList) arr.sort((a, b) => Number(a.done) - Number(b.done))
  tasks.sort((a, b) => Number(a.done) - Number(b.done))
  standalone.sort((a, b) => Number(a.answered) - Number(b.answered))

  return {
    appointments,
    tasks,
    questions: standalone,
    shopping,
    shoppingByList,
    questionsByAppointment,
  }
}

function listLabel(list: ShoppingItem['list']): string {
  switch (list) {
    case 'shopping':
      return 'Shopping'
    case 'supplies':
      return 'Supplies'
    case 'general':
      return 'List'
    default:
      return 'List'
  }
}
