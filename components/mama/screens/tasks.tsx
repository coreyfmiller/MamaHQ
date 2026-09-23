'use client'

import { useMemo, useState } from 'react'
import { ListChecks, Plus, RotateCcw, Clock, ChevronDown, Check, Hand } from 'lucide-react'
import { useNav } from '../context'
import { useHousehold, type HouseholdPerson } from '../household'
import { useTasks, type Task } from '../tasks'
import { Card, CardLabel, CheckBox, Screen, Scroll, Segmented, StatusBar, TopBar } from '../ui'

// Step 8 — the Tasks surface. A household RESPONSIBILITY list, not a project
// manager. It answers three questions at a glance: what needs doing, who owns it,
// and when it's due. Ownership is a real HouseholdPerson (who may have no account);
// assignment is not acknowledgement (we never imply the owner has "accepted" it).

type View = 'open' | 'mine' | 'household' | 'completed'

const UNASSIGNED = '__unassigned__'

export function TasksScreen() {
  const { closeOverlay, showToast } = useNav()
  const { available, hydrated, open, completed, mine, mePersonId, create, assign, complete, reopen, accept, relinquish } =
    useTasks()
  const { people, me } = useHousehold()
  const [view, setView] = useState<View>('open')

  // People eligible to own a task: everyone in the household. "Me" resolves to the
  // current user's linked person but we persist the actual person id, never "Me".
  const assignablePeople = people

  const list = useMemo<Task[]>(() => {
    switch (view) {
      case 'mine':
        return mine
      case 'household':
        return open // "Household" = the shared open list (everyone's open tasks)
      case 'completed':
        return completed
      default:
        return open
    }
  }, [view, open, mine, completed])

  const personName = (id: string | null): string | null => {
    if (!id) return null
    const p = people.find((x) => x.id === id)
    if (!p) return null
    return me && p.id === me.id ? 'Me' : p.displayName
  }

  return (
    <Screen>
      <StatusBar />
      <TopBar variant="close" title="Tasks" onBack={closeOverlay} />
      <Scroll className="space-y-4 px-6 pb-8">
        <header className="pt-1">
          <h1 className="flex items-center gap-2 font-serif text-[24px] font-semibold tracking-tight">
            Tasks <ListChecks className="size-5 text-sage" strokeWidth={1.75} />
          </h1>
          <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
            Shared household responsibilities. Get it out of your head and give it an owner —
            when someone owns it, you don&apos;t have to keep carrying it. (For a personal
            reminder just for you, use My to-dos on Me.)
          </p>
        </header>

        {!available ? (
          <Card>
            <p className="text-[14px] text-muted-foreground">
              Tasks are shared with your household, so they live in your account. Sign in to start
              handing things off.
            </p>
          </Card>
        ) : (
          <>
            <QuickAdd
              people={assignablePeople}
              meId={me?.id ?? null}
              onCreate={async (input) => {
                await create(input)
                showToast('Task added')
              }}
            />

            <Segmented<View>
              value={view}
              onChange={setView}
              options={[
                { value: 'open', label: 'Open', badge: open.length || undefined },
                { value: 'mine', label: 'Mine', badge: mine.length || undefined },
                { value: 'completed', label: 'Done', badge: completed.length || undefined },
              ]}
            />

            {!hydrated ? (
              <p className="py-6 text-center text-[14px] text-muted-foreground">Loading…</p>
            ) : list.length === 0 ? (
              <EmptyState view={view} />
            ) : (
              <div className="space-y-2">
                {list.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    ownerName={personName(t.assignedToPersonId)}
                    people={assignablePeople}
                    meId={me?.id ?? null}
                    mePersonId={mePersonId}
                    onComplete={() => complete(t.id)}
                    onReopen={() => reopen(t.id)}
                    onAssign={(pid) => assign(t.id, pid)}
                    onAccept={() => accept(t.id)}
                    onRelinquish={() => relinquish(t.id)}
                  />
                ))}
              </div>
            )}

            <p className="rounded-2xl bg-muted/60 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
              Assigning a task asks someone to take it. It becomes theirs when they press
              &ldquo;I&apos;ve got it.&rdquo; Until then it&apos;s assigned, not accepted — so you know whether it&apos;s
              really off your plate.
            </p>
          </>
        )}
      </Scroll>
    </Screen>
  )
}

function EmptyState({ view }: { view: View }) {
  const copy: Record<View, string> = {
    open: 'Nothing open. Add the next thing on your mind above.',
    mine: 'Nothing assigned to you right now.',
    household: 'No open household tasks.',
    completed: 'Nothing completed yet.',
  }
  return <p className="py-6 text-center text-[14px] text-muted-foreground">{copy[view]}</p>
}

// Fast capture: type a title and save. Assigning an owner + a due date are optional
// and progressively disclosed (Step 8 §21) so the common case is one line + Enter.
function QuickAdd({
  people,
  meId,
  onCreate,
}: {
  people: HouseholdPerson[]
  meId: string | null
  onCreate: (input: { title: string; assignedToPersonId?: string | null; dueAt?: string | null }) => void | Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [showDetail, setShowDetail] = useState(false)
  const [assignee, setAssignee] = useState<string>(UNASSIGNED)
  const [due, setDue] = useState('') // yyyy-mm-ddThh:mm (local) from datetime-local

  const reset = () => {
    setTitle('')
    setAssignee(UNASSIGNED)
    setDue('')
    setShowDetail(false)
  }

  const submit = async () => {
    const t = title.trim()
    if (!t) return
    await onCreate({
      title: t,
      assignedToPersonId: assignee === UNASSIGNED ? null : assignee,
      dueAt: due ? new Date(due).toISOString() : null,
    })
    reset()
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          placeholder="Add a task, e.g. Take garbage out"
          className="flex-1 rounded-xl border border-border bg-card px-3 py-2.5 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
        />
        <button
          onClick={submit}
          disabled={!title.trim()}
          aria-label="Add task"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
        >
          <Plus className="size-5" strokeWidth={2.25} />
        </button>
      </div>

      {!showDetail ? (
        <button
          onClick={() => setShowDetail(true)}
          className="flex items-center gap-1.5 text-[13px] font-medium text-primary"
        >
          <ChevronDown className="size-4" /> Assign someone or set a due date
        </button>
      ) : (
        <div className="space-y-2.5">
          <div>
            <CardLabel className="mb-1.5">Assign to</CardLabel>
            <AssigneePicker people={people} meId={meId} value={assignee} onChange={setAssignee} />
          </div>
          <div>
            <CardLabel className="mb-1.5">Due (optional)</CardLabel>
            <input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[14px] text-foreground outline-none focus:border-primary"
            />
          </div>
        </div>
      )}
    </Card>
  )
}

// A chip-style person picker. "Me" is shown for the current user's linked person,
// but the value persisted is always the real HouseholdPerson id (never "Me").
function AssigneePicker({
  people,
  meId,
  value,
  onChange,
}: {
  people: HouseholdPerson[]
  meId: string | null
  value: string
  onChange: (v: string) => void
}) {
  const chips = [
    { id: UNASSIGNED, label: 'Unassigned' },
    ...people.map((p) => ({ id: p.id, label: meId && p.id === meId ? 'Me' : p.displayName })),
  ]
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => {
        const active = c.id === value
        return (
          <button
            key={c.id}
            onClick={() => onChange(c.id)}
            className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
              active ? 'border-primary bg-sage-soft text-primary' : 'border-border/70 bg-card text-muted-foreground'
            }`}
          >
            {c.label}
          </button>
        )
      })}
    </div>
  )
}

function TaskRow({
  task,
  ownerName,
  people,
  meId,
  mePersonId,
  onComplete,
  onReopen,
  onAssign,
  onAccept,
  onRelinquish,
}: {
  task: Task
  ownerName: string | null
  people: HouseholdPerson[]
  meId: string | null
  mePersonId: string | null
  onComplete: () => void
  onReopen: () => void
  onAssign: (personId: string | null) => void
  onAccept: () => void
  onRelinquish: () => void
}) {
  const [editing, setEditing] = useState(false)
  const done = task.status === 'completed'

  // Acceptance state (Step 9). Assignment ≠ acceptance: we only ever show
  // "has it ✓" once the person has explicitly accepted.
  const assignedToMe = !!mePersonId && task.assignedToPersonId === mePersonId
  const accepted = !!task.acknowledgedAt && !!task.acknowledgedByPersonId
  const acceptedByMe = accepted && task.acknowledgedByPersonId === mePersonId
  const acceptedName = accepted
    ? people.find((p) => p.id === task.acknowledgedByPersonId)?.displayName ?? null
    : null

  return (
    <Card className="space-y-2">
      <div className="flex items-start gap-3">
        <button
          onClick={done ? onReopen : onComplete}
          aria-label={done ? 'Reopen task' : 'Complete task'}
          className="pt-0.5"
        >
          <CheckBox checked={done} />
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-[15px] leading-snug ${done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
            {task.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
            <button
              onClick={() => setEditing((v) => !v)}
              className="font-medium text-foreground/80 underline-offset-2 hover:underline"
            >
              {ownerName ? (ownerName === 'Me' ? 'Assigned to me' : `Assigned to ${ownerName}`) : 'Unassigned'}
            </button>
            {task.dueAt && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" /> {formatDue(task.dueAt)}
                </span>
              </>
            )}
          </div>
        </div>
        {done && (
          <button
            onClick={onReopen}
            aria-label="Reopen"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground active:bg-muted"
          >
            <RotateCcw className="size-4" />
          </button>
        )}
      </div>

      {/* Acceptance affordance / status — only for open tasks. Completion stays a
          separate action (the checkbox above). */}
      {!done && (
        <div className="pl-9">
          {acceptedByMe ? (
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-2.5 py-1 text-[12px] font-semibold text-sage">
                <Check className="size-3.5" strokeWidth={3} /> You have this
              </span>
              <button
                onClick={onRelinquish}
                className="text-[12px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                I can&apos;t take this
              </button>
            </div>
          ) : accepted ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-2.5 py-1 text-[12px] font-semibold text-sage">
              <Check className="size-3.5" strokeWidth={3} /> {acceptedName ?? 'Someone'} has it
            </span>
          ) : assignedToMe ? (
            <button
              onClick={onAccept}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
            >
              <Hand className="size-3.5" /> I&apos;ve got it
            </button>
          ) : task.assignedToPersonId ? (
            <span className="text-[12px] text-muted-foreground">Waiting for {ownerName === 'Me' ? 'you' : ownerName} to accept</span>
          ) : null}
        </div>
      )}

      {editing && (
        <div className="rounded-2xl bg-muted/50 p-3">
          <CardLabel className="mb-1.5">Reassign to</CardLabel>
          <AssigneePicker
            people={people}
            meId={meId}
            value={task.assignedToPersonId ?? UNASSIGNED}
            onChange={(v) => {
              onAssign(v === UNASSIGNED ? null : v)
              setEditing(false)
            }}
          />
        </div>
      )}
    </Card>
  )
}

function formatDue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const isTomorrow = d.toDateString() === tomorrow.toDateString()
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return `Today ${time}`
  if (isTomorrow) return `Tomorrow ${time}`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` ${time}`
}
// Note: a task's history timeline (created → assigned → completed → reopened →
// reassigned) is available via useTasks().history(taskId); surfacing it in the UI
// is deferred to a later step to keep this surface uncluttered.
