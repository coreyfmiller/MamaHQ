'use client'

import { useState } from 'react'
import {
  Bell,
  ChevronRight,
  Moon,
  Plus,
  Settings as SettingsIcon,
  Star,
  Sun,
  Smile,
  X,
  Sparkles,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { useNav } from '../context'
import { useProfile, dayNumber } from '../profile'
import { firstNinetyState } from '@/lib/first90'
import { pickDailyRead, readMinutes } from '@/lib/daily-reads'
import { pickAffirmation } from '@/lib/affirmations'
import { useMom, dayKey, type Mood, type MomItem } from '../mom'
import { useCalendar, type CalendarEvent } from '../calendar'
import { useNotifications } from '../notifications'
import { useNow } from '../logs'
import { BottomNav, Card, CardLabel, CheckBox, Screen, Scroll, StatusBar } from '../ui'

// ── Me (MamaHQ 2.0) ─────────────────────────────────────────────────────────
//
// "Me = Mom." One coherent page about her: How are you? → My Journey → My to-dos →
// Questions for my doctor → My appointments → quiet utilities (Notifications,
// Settings). Household operations (Tasks/People/Partner) now live in Home and are
// intentionally NOT re-listed here.
//
// Truthfulness: Mom's mood, to-dos and doctor questions are family-scoped (household-
// visible) — there is NO private-to-user storage. We therefore never show lock icons,
// "Private", or "Only me"; where the distinction matters we say "Shared with
// household" quietly, once. Loading ≠ Empty ≠ Failed via useMom.hydrated/loadError.

const moodOptions: { id: Mood; label: string; icon: 'moon' | 'sun' | 'smile' | 'star' }[] = [
  { id: 'tired', label: 'Tired', icon: 'moon' },
  { id: 'okay', label: 'Okay', icon: 'sun' },
  { id: 'good', label: 'Good', icon: 'smile' },
  { id: 'great', label: 'Great', icon: 'star' },
]
const moodIcon = { moon: Moon, sun: Sun, smile: Smile, star: Star }

export function MeScreen() {
  const { openOverlay } = useNav()

  return (
    <Screen>
      <StatusBar />
      <Scroll className="px-5 pb-28">
        {/* Header — name + quiet Settings gear (opens the canonical settings overlay). */}
        <header className="flex items-start justify-between pt-1">
          <div>
            <h1 className="font-serif text-[26px] font-semibold tracking-tight">Me</h1>
            <p className="text-[13.5px] text-muted-foreground">You matter too.</p>
          </div>
          <button
            onClick={() => openOverlay('settings')}
            aria-label="Settings"
            className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-transform active:scale-95"
          >
            <SettingsIcon className="size-[19px]" strokeWidth={1.9} />
          </button>
        </header>

        <CheckIn />
        <MyJourney />
        <MyToDos />
        <DoctorQuestions />
        <MyAppointments />

        {/* Quiet utilities — not major sections. */}
        <section className="mt-6 overflow-hidden rounded-2xl ring-1 ring-border/50">
          <NotificationsRow />
          <div className="h-px bg-border/50" aria-hidden />
          <UtilityRow icon={SettingsIcon} label="Settings" sub="Profile, account, sign out" onClick={() => openOverlay('settings')} />
        </section>
      </Scroll>

      <BottomNav active="me" />
    </Screen>
  )
}

/* ── How are you? (mood check-in) ─────────────────────────────────────────────
 * Warm, one-tap, no scores/trends/history (none exist). Real + persisted per day
 * via useMom → mom_moods. */
function CheckIn() {
  const { state, setTodayMood, hydrated, loadError } = useMom()
  const today = state.moodByDay[dayKey()] ?? null

  return (
    <section className="mt-5">
      <h2 className="px-1 font-serif text-[17px] font-semibold">How are you today?</h2>
      {loadError ? (
        <p className="mt-2 flex items-center gap-1.5 px-1 text-[13px] text-muted-foreground">
          <AlertCircle className="size-3.5 shrink-0 text-peach" strokeWidth={2} /> Couldn&apos;t load your check-in.
        </p>
      ) : !hydrated ? (
        <p className="mt-2 flex items-center gap-1.5 px-1 text-[13px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Loading…
        </p>
      ) : (
        <div className="mt-2.5 grid grid-cols-4 gap-2">
          {moodOptions.map((m) => {
            const Icon = moodIcon[m.icon]
            const isActive = today === m.id
            return (
              <button
                key={m.id}
                onClick={() => setTodayMood(isActive ? null : m.id)}
                aria-pressed={isActive}
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
      )}
    </section>
  )
}

/* ── My Journey (First 90 / Beyond 90) ────────────────────────────────────────
 * The wedge, owned by Me. Within the journey: Day N + a quiet affirmation + today's
 * daily read. After Day 90: a graceful continuation into Beyond 90. Reuses the
 * existing first90 engine, daily-reads, affirmations, and read/beyond90 overlays. */
function MyJourney() {
  const { openOverlay } = useNav()
  const { profile } = useProfile()
  const now = useNow(60_000)

  if (!profile?.birthDate) return null

  const st = firstNinetyState(profile.birthDate, now)
  const day = dayNumber(profile.birthDate, now)

  return (
    <section className="mt-6">
      <CardLabel className="mb-2 px-1 text-foreground">My Journey</CardLabel>

      {st.withinJourney ? (
        <div className="overflow-hidden rounded-3xl bg-sage-soft/40 ring-1 ring-border/40">
          <div className="px-5 pt-4">
            <p className="font-serif text-[22px] font-semibold leading-none tracking-tight">Day {day}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">of your first 90 days</p>
            <p className="mt-3 text-[14px] italic leading-relaxed text-foreground/80">
              {pickAffirmation(day, now)}
            </p>
          </div>
          <TodaysRead />
        </div>
      ) : (
        <button
          onClick={() => openOverlay('beyond90')}
          className="flex w-full items-center gap-3 rounded-3xl bg-sage-soft/40 px-5 py-4 text-left ring-1 ring-border/40 transition-transform active:scale-[0.99]"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage">
            <Sparkles className="size-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold leading-tight">Beyond the first 90 days</p>
            <p className="text-[13px] text-muted-foreground">What keeps working, now that you&apos;re past Day 90.</p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
      )}
    </section>
  )
}

// Today's daily read entry — reuses the canonical read overlay.
function TodaysRead() {
  const { openOverlay } = useNav()
  const { profile } = useProfile()
  const now = useNow(60_000)
  if (!profile?.birthDate) return null
  const read = pickDailyRead(dayNumber(profile.birthDate, now))
  if (!read) return null

  return (
    <button
      onClick={() => openOverlay('read')}
      className="mt-3 flex w-full items-center gap-3 border-t border-border/50 px-5 py-3.5 text-left transition-colors active:bg-foreground/[0.03]"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Today&apos;s read</p>
        <p className="truncate text-[14.5px] font-semibold leading-tight">{read.title}</p>
        <p className="text-[12px] text-muted-foreground">{readMinutes(read)} min · {read.category}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-primary" />
    </button>
  )
}

/* ── My to-dos (Mom's personal checklist) ─────────────────────────────────────
 * mom_items kind='task'. Distinct from Home → Tasks (shared responsibility). Add /
 * toggle / remove preserved. Family-scoped, so a single quiet "Shared with
 * household" note — never a privacy/lock claim. */
function MyToDos() {
  const { state, hydrated, loadError, addTask, toggleTask, removeTask } = useMom()

  return (
    <section className="mt-6">
      <div className="mb-1.5 flex items-baseline justify-between px-1">
        <CardLabel className="text-foreground">My to-dos</CardLabel>
        <span className="text-[11px] text-muted-foreground/70">Shared with household</span>
      </div>
      <Card className="space-y-1 p-4">
        {loadError ? (
          <ErrorLine label="Couldn't load your to-dos." />
        ) : !hydrated ? (
          <LoadingLine />
        ) : (
          <>
            {state.tasks.length > 0 ? (
              <div className="divide-y divide-border/50">
                {state.tasks.map((t) => (
                  <ItemRow key={t.id} item={t} onToggle={() => toggleTask(t.id)} onRemove={() => removeTask(t.id)} />
                ))}
              </div>
            ) : (
              <p className="py-1 text-[13.5px] text-muted-foreground">Nothing here yet — a quick personal checklist for you.</p>
            )}
            <AddInline label="Add a to-do" placeholder="e.g. Take medication" onAdd={addTask} />
          </>
        )}
      </Card>
    </section>
  )
}

/* ── Questions for my doctor ──────────────────────────────────────────────────
 * mom_items kind='question'. Appointment prep, NOT a general notes/journal system. */
function DoctorQuestions() {
  const { state, hydrated, loadError, addQuestion, toggleQuestion, removeQuestion } = useMom()

  return (
    <section className="mt-6">
      <CardLabel className="mb-1.5 px-1 text-foreground">Questions for my doctor</CardLabel>
      <Card className="space-y-1 p-4">
        {loadError ? (
          <ErrorLine label="Couldn't load your questions." />
        ) : !hydrated ? (
          <LoadingLine />
        ) : (
          <>
            {state.questions.length > 0 ? (
              <div className="divide-y divide-border/50">
                {state.questions.map((q) => (
                  <ItemRow key={q.id} item={q} onToggle={() => toggleQuestion(q.id)} onRemove={() => removeQuestion(q.id)} />
                ))}
              </div>
            ) : (
              <p className="py-1 text-[13.5px] text-muted-foreground">
                Save questions as they come to you, so you don&apos;t forget at the visit.
              </p>
            )}
            <AddInline label="Add a question" placeholder="e.g. Breastfeeding discomfort" onAdd={addQuestion} />
          </>
        )}
      </Card>
    </section>
  )
}

/* ── My appointments (Calendar "mine" preview) ────────────────────────────────
 * A small Mom-associated view of the shared Calendar (participant or responsible).
 * NOT a second calendar; routes to the canonical Calendar for detail. Honors the
 * Calendar provider's own loading / loadError / empty states. Household-visible. */
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

function MyAppointments() {
  const { openOverlay, composeEvent } = useNav()
  const { mine, hydrated, available, loadError } = useCalendar()
  const now = useNow(60_000)

  // Only upcoming Mom-associated events (now or later), soonest first.
  const nowMs = now.getTime()
  const upcomingMine = mine
    .filter((e) => {
      const t = e.allDay
        ? (e.startDate ? new Date(e.startDate + 'T23:59:59').getTime() : 0)
        : (e.startsAt ? new Date(e.startsAt).getTime() : 0)
      return t >= nowMs - 12 * 3_600_000 // include today's earlier-today items
    })
    .sort((a, b) => {
      const at = a.startsAt ?? a.startDate ?? ''
      const bt = b.startsAt ?? b.startDate ?? ''
      return at < bt ? -1 : at > bt ? 1 : 0
    })
    .slice(0, 3)

  const body = () => {
    if (!available) return <p className="text-[13.5px] text-muted-foreground">Your shared schedule shows up here once you&apos;re set up.</p>
    if (loadError) return <ErrorLine label="Couldn't load your calendar." onRetry={() => openOverlay('calendar')} />
    if (!hydrated) return <LoadingLine />
    if (upcomingMine.length === 0) {
      return (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13.5px] text-muted-foreground">Nothing on your calendar right now.</p>
          <button onClick={() => composeEvent(null)} className="flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-primary">
            <Plus className="size-3.5" strokeWidth={2.25} /> Add
          </button>
        </div>
      )
    }
    return (
      <ul className="space-y-2">
        {upcomingMine.map((e) => (
          <li key={e.id}>
            <button onClick={() => composeEvent(e.id)} className="flex w-full items-center gap-3 text-left">
              <span className="w-24 shrink-0 text-[12.5px] font-medium tabular-nums text-muted-foreground">{eventWhen(e)}</span>
              <span className="min-w-0 flex-1 truncate text-[14.5px] text-foreground">{e.title}</span>
            </button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <section className="mt-6">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <CardLabel className="text-foreground">My appointments</CardLabel>
        <button onClick={() => openOverlay('calendar')} className="flex items-center gap-0.5 text-[13px] font-medium text-primary">
          Calendar <ChevronRight className="size-3.5" />
        </button>
      </div>
      <Card className="p-4">{body()}</Card>
    </section>
  )
}

/* ── Quiet utility rows ───────────────────────────────────────────────────────── */

function NotificationsRow() {
  const { openOverlay } = useNav()
  const { unreadCount } = useNotifications()
  return (
    <button onClick={() => openOverlay('notifications')} className="flex w-full items-center gap-3.5 bg-card px-4 py-3.5 text-left transition-colors active:bg-muted">
      <span className="relative flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
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
  )
}

function UtilityRow({ icon: Icon, label, sub, onClick }: { icon: typeof Bell; label: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3.5 bg-card px-4 py-3.5 text-left transition-colors active:bg-muted">
      <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-[18px]" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-tight">{label}</p>
        <p className="text-[13px] text-muted-foreground">{sub}</p>
      </div>
      <ChevronRight className="size-4 text-muted-foreground" />
    </button>
  )
}

/* ── Shared bits ──────────────────────────────────────────────────────────────── */

function LoadingLine() {
  return (
    <p className="flex items-center gap-1.5 py-1 text-[13.5px] text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" /> Loading…
    </p>
  )
}

function ErrorLine({ label, onRetry }: { label: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <p className="flex items-center gap-1.5 text-[13.5px] text-muted-foreground">
        <AlertCircle className="size-3.5 shrink-0 text-peach" strokeWidth={2} /> {label}
      </p>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 text-[13px] font-medium text-primary">Open</button>
      )}
    </div>
  )
}

function ItemRow({ item, onToggle, onRemove }: { item: MomItem; onToggle: () => void; onRemove: () => void }) {
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
      <button onClick={() => setOpen(true)} className="mt-2 flex items-center gap-2 text-[14px] font-medium text-primary">
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
      <button onClick={submit} className="rounded-xl bg-primary px-3.5 py-2 text-[14px] font-semibold text-primary-foreground transition-transform active:scale-95">
        Add
      </button>
    </div>
  )
}
