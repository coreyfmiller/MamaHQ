'use client'

import { useState } from 'react'
import { Bell, ChevronRight, Heart, ListChecks, Moon, Plus, Sparkles, Star, Sun, Smile, Users, X } from 'lucide-react'
import { useNav } from '../context'
import { CategoryChip } from '../event-meta'
import { BottomNav, Card, CardLabel, CheckBox, Screen, Scroll, StatusBar } from '../ui'
import { LeafSprig } from '../decor'
import { useMom, dayKey, type Mood, type MomItem } from '../mom'
import { useCalendar, type CalendarEvent } from '../calendar'
import { useNotifications } from '../notifications'

const moodOptions: { id: Mood; label: string; icon: 'moon' | 'sun' | 'smile' | 'star' }[] = [
  { id: 'tired', label: 'Tired', icon: 'moon' },
  { id: 'okay', label: 'Okay', icon: 'sun' },
  { id: 'good', label: 'Good', icon: 'smile' },
  { id: 'great', label: 'Great', icon: 'star' },
]
const moodIcon = { moon: Moon, sun: Sun, smile: Smile, star: Star }

function CheckIn() {
  const { state, setTodayMood } = useMom()
  const today = state.moodByDay[dayKey()] ?? null
  return (
    <Card className="space-y-4">
      <div>
        <h3 className="font-serif text-[17px] font-medium">How are you doing today?</h3>
        <p className="text-[13px] text-muted-foreground">
          {today ? 'Thanks for checking in. Tap again to change it.' : 'Take a moment for you.'}
        </p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {moodOptions.map((m) => {
          const Icon = moodIcon[m.icon]
          const isActive = today === m.id
          return (
            <button
              key={m.id}
              onClick={() => setTodayMood(isActive ? null : m.id)}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border py-3 transition-colors ${
                isActive ? 'border-primary bg-sage-soft text-primary' : 'border-border/70 bg-card text-muted-foreground'
              }`}
            >
              <Icon className="size-5" strokeWidth={1.75} />
              <span className={`text-[12px] ${isActive ? 'font-semibold text-foreground' : ''}`}>{m.label}</span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

// A checkable, removable row for a mom task/question.
function ItemRow({
  item,
  onToggle,
  onRemove,
}: {
  item: MomItem
  onToggle: () => void
  onRemove: () => void
}) {
  return (
    <div className="group flex items-center gap-3 py-2">
      <button onClick={onToggle} className="flex flex-1 items-center gap-3 text-left" aria-label="Toggle done">
        <CheckBox checked={item.done} />
        <span className={`text-[15px] transition-colors ${item.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
          {item.text}
        </span>
      </button>
      <button
        onClick={onRemove}
        aria-label="Remove"
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:text-destructive active:bg-muted"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

// Inline "add" affordance: a link that becomes a text input.
function AddInline({ label, placeholder, onAdd }: { label: string; placeholder: string; onAdd: (t: string) => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  const submit = () => {
    if (!text.trim()) return
    onAdd(text)
    setText('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 flex items-center gap-2 text-[14px] font-medium text-primary"
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-sage-soft">
          <Plus className="size-4" strokeWidth={2} />
        </span>
        {label}
      </button>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') setOpen(false)
        }}
        onBlur={() => (text.trim() ? submit() : setOpen(false))}
        placeholder={placeholder}
        className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
      />
      <button
        onClick={submit}
        className="rounded-xl bg-primary px-3.5 py-2 text-[14px] font-semibold text-primary-foreground transition-transform active:scale-95"
      >
        Add
      </button>
    </div>
  )
}

// Compact "when" label for the next Calendar event on the Me screen. Deterministic,
// structured-data only (no fabrication): "Today · 2:00 PM", "Tomorrow · All day",
// "Jul 4 · All day". Mirrors the Calendar screen's phrasing without importing its
// private formatter (kept small + self-contained to avoid touching Step 10).
function eventWhen(e: CalendarEvent): string {
  const rel = (d: Date): string => {
    const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
    const diff = Math.round((startOfDay(d) - startOfDay(new Date())) / 86_400_000)
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Tomorrow'
    if (diff > 1 && diff < 7) return d.toLocaleDateString(undefined, { weekday: 'short' })
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
  const clock = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (e.allDay) {
    if (!e.startDate) return 'All day'
    const [y, m, d] = e.startDate.split('-').map(Number)
    return `${rel(new Date(y, (m ?? 1) - 1, d ?? 1))} · All day`
  }
  if (!e.startsAt) return ''
  const start = new Date(e.startsAt)
  return `${rel(start)} · ${clock(start)}`
}

export function MeScreen() {
  const { openOverlay, composeEvent } = useNav()
  const { state, addTask, addQuestion, toggleTask, toggleQuestion, removeTask, removeQuestion } = useMom()
  // Beta Phase 6 — "Coming up" reads the CANONICAL shared Calendar (Step 10), not the
  // retired legacy Appointments store. One scheduling truth: if it happens at a date
  // or time, it's a Calendar event.
  const { upcoming } = useCalendar()
  const nextEvent = upcoming[0] ?? null
  const { unreadCount } = useNotifications()

  return (
    <Screen>
      <StatusBar />
      <LeafSprig className="pointer-events-none absolute -right-4 top-8 h-32 w-20 rotate-12 opacity-60" />
      <Scroll className="space-y-4 px-6 pb-4">
        <header className="pt-1">
          <h1 className="font-serif text-[26px] font-semibold tracking-tight">Me</h1>
          <p className="flex items-center gap-1.5 text-[14px] text-muted-foreground">
            You matter too <Heart className="size-3.5 fill-blush text-blush" />
          </p>
        </header>

        {/* Beta Phase 4 — HONEST visibility. This space is family-scoped in the
            database (mom_moods / mom_items are readable by household members), so we
            must not imply it's private. We say so plainly rather than pretending. */}
        <p className="rounded-2xl bg-muted/50 px-4 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
          Your check-in, to-dos, and questions are part of your shared household — anyone in your
          household can see them. MamaHQ doesn&apos;t have a private-to-you space yet.
        </p>

        <CheckIn />

        {/* Mom's own to-dos */}
        <Card className="space-y-1">
          <CardLabel className="mb-1 text-foreground">My to-dos</CardLabel>
          {state.tasks.length > 0 ? (
            <div className="divide-y divide-border/50">
              {state.tasks.map((t) => (
                <ItemRow key={t.id} item={t} onToggle={() => toggleTask(t.id)} onRemove={() => removeTask(t.id)} />
              ))}
            </div>
          ) : (
            <p className="py-1 text-[14px] text-muted-foreground">Nothing here yet. Add something for you.</p>
          )}
          <AddInline label="Add a to-do" placeholder="e.g. Take medication" onAdd={addTask} />
        </Card>

        {/* Coming up — the next event on the shared Calendar. Tapping opens the
            canonical Calendar; adding routes to the Calendar composer. */}
        <div>
          <CardLabel className="mb-2 px-1 text-foreground">Coming up</CardLabel>
          {nextEvent ? (
            <Card onClick={() => openOverlay('calendar')} className="flex items-center gap-3.5">
              <CategoryChip category="appointment" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{nextEvent.title}</p>
                <p className="text-[13px] text-muted-foreground">{eventWhen(nextEvent)}</p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Card>
          ) : (
            <button
              onClick={() => composeEvent(null)}
              className="flex w-full items-center gap-3 rounded-3xl border border-dashed border-border bg-card/60 p-3.5 text-left text-muted-foreground transition-colors active:bg-muted"
            >
              <span className="flex size-9 items-center justify-center rounded-2xl bg-muted">
                <Plus className="size-[18px]" strokeWidth={1.75} />
              </span>
              <span className="text-[14px] font-medium">Add to the calendar</span>
            </button>
          )}
        </div>

        {/* Questions for my doctor */}
        <Card className="space-y-1">
          <CardLabel className="mb-1 text-foreground">Questions for my doctor</CardLabel>
          {state.questions.length > 0 ? (
            <div className="divide-y divide-border/50">
              {state.questions.map((q) => (
                <ItemRow
                  key={q.id}
                  item={q}
                  onToggle={() => toggleQuestion(q.id)}
                  onRemove={() => removeQuestion(q.id)}
                />
              ))}
            </div>
          ) : (
            <p className="py-1 text-[14px] text-muted-foreground">
              Save questions as they come to you, so you don&apos;t forget at the visit.
            </p>
          )}
          <AddInline label="Add a question" placeholder="e.g. Breastfeeding discomfort" onAdd={addQuestion} />
        </Card>

        {/* Notifications entry with a live unread badge. */}
        <Card className="py-1">
          <button
            onClick={() => openOverlay('notifications')}
            className="flex w-full items-center gap-3.5 py-3 text-left"
          >
            <span className="relative flex size-9 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Bell className="size-[18px]" strokeWidth={1.75} />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold leading-[18px] text-primary-foreground">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-tight">Notifications</p>
              <p className="text-[13px] text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} need${unreadCount === 1 ? 's' : ''} your attention` : 'When someone needs you'}
              </p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
        </Card>

        <Card className="divide-y divide-border/50 py-1">
          {[
            { icon: ListChecks, label: 'Tasks', sub: 'Who owns what', action: () => openOverlay('tasks') },
            { icon: Users, label: 'Household', sub: 'People & invites', action: () => openOverlay('people') },
            { icon: Users, label: 'Partner view', sub: 'Share the load', action: () => openOverlay('partner') },
            { icon: Sparkles, label: 'After the first 90 days', sub: 'What keeps working', action: () => openOverlay('beyond90') },
          ].map(({ icon: Icon, label, sub, action }) => (
            <button key={label} onClick={action} className="flex w-full items-center gap-3.5 py-3 text-left">
              <span className="flex size-9 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Icon className="size-[18px]" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-tight">{label}</p>
                <p className="text-[13px] text-muted-foreground">{sub}</p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          ))}
        </Card>
      </Scroll>

      <BottomNav active="me" />
    </Screen>
  )
}
