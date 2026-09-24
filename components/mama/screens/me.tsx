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
                className={`flex flex-col items-center gap-1 rounded-2xl border py-2.5 transition-colors ${
                  isActive ? 'border-primary bg-sage-soft text-primary' : 'border-border/70 bg-card text-muted-foreground'
                }`}
              >
                <Icon className="size-[18px]" strokeWidth={1.75} />
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
  const { profile, hydrated } = useProfile()
  const now = useNow(60_000)

  // The section ALWAYS renders (never silently disappears). Three truthful states:
  //   • profile not hydrated yet → compact loading line
  //   • no birth date on file    → compact setup prompt (no invented Day number)
  //   • have a birth date        → within-journey Day N, or Beyond 90
  const header = <CardLabel className="mb-2 px-1 text-foreground">My Journey</CardLabel>

  if (!hydrated) {
    return (
      <section className="mt-6">
        {header}
        <p className="flex items-center gap-1.5 px-1 text-[13px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Loading your journey…
        </p>
      </section>
    )
  }

  if (!profile?.birthDate) {
    // Missing the one input the journey needs — guide to set it in Settings rather
    // than removing the section or fabricating a day.
    return (
      <section className="mt-6">
        {header}
        <button
          onClick={() => openOverlay('settings')}
          className="flex w-full items-center gap-3 rounded-3xl bg-sage-soft/40 px-5 py-4 text-left ring-1 ring-border/40 transition-transform active:scale-[0.99]"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage">
            <Sparkles className="size-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold leading-tight">Start your first 90 days</p>
            <p className="text-[13px] text-muted-foreground">Add Baby&apos;s birth date to see your day-by-day journey.</p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
      </section>
    )
  }

  const st = firstNinetyState(profile.birthDate, now)
  const day = dayNumber(profile.birthDate, now)

  return (
    <section className="mt-6">
      {header}

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
    <MomItemsSection
      title="My to-dos"
      note="Shared with household"
      items={state.tasks}
      hydrated={hydrated}
      loadError={loadError}
      emptyLabel="Nothing here yet."
      addLabel="Add a to-do"
      addPlaceholder="e.g. Take medication"
      errorLabel="Couldn't load your to-dos."
      onToggle={toggleTask}
      onRemove={removeTask}
      onAdd={addTask}
    />
  )
}

/* ── Questions for my doctor ──────────────────────────────────────────────────
 * mom_items kind='question'. Appointment prep, NOT a general notes/journal system. */
function DoctorQuestions() {
  const { state, hydrated, loadError, addQuestion, toggleQuestion, removeQuestion } = useMom()
  return (
    <MomItemsSection
      title="Questions for my doctor"
      items={state.questions}
      hydrated={hydrated}
      loadError={loadError}
      emptyLabel="No questions saved yet."
      addLabel="Add a question"
      addPlaceholder="e.g. Breastfeeding discomfort"
      errorLabel="Couldn't load your questions."
      onToggle={toggleQuestion}
      onRemove={removeQuestion}
      onAdd={addQuestion}
    />
  )
}

/* A Mom-items section (to-dos / doctor questions). Empty and loading/error states
 * are DELIBERATELY light — a title, a one-line message, and an inline Add — so they
 * get out of the way. Only once real items exist does it grow into a grouped
 * surface. Shared by both lists so their density stays identical. */
function MomItemsSection({
  title,
  note,
  items,
  hydrated,
  loadError,
  emptyLabel,
  addLabel,
  addPlaceholder,
  errorLabel,
  onToggle,
  onRemove,
  onAdd,
}: {
  title: string
  note?: string
  items: MomItem[]
  hydrated: boolean
  loadError: boolean
  emptyLabel: string
  addLabel: string
  addPlaceholder: string
  errorLabel: string
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  onAdd: (text: string) => void
}) {
  const hasItems = hydrated && !loadError && items.length > 0

  return (
    <section className="mt-6">
      <div className="mb-1.5 flex items-baseline justify-between px-1">
        <CardLabel className="text-foreground">{title}</CardLabel>
        {note && <span className="text-[11px] text-muted-foreground/70">{note}</span>}
      </div>

      {loadError ? (
        <div className="px-1">
          <ErrorLine label={errorLabel} />
        </div>
      ) : !hydrated ? (
        <div className="px-1">
          <LoadingLine />
        </div>
      ) : hasItems ? (
        // Populated → grouped surface.
        <Card className="space-y-1 p-4">
          <div className="divide-y divide-border/50">
            {items.map((it) => (
              <ItemRow key={it.id} item={it} onToggle={() => onToggle(it.id)} onRemove={() => onRemove(it.id)} />
            ))}
          </div>
          <AddInline label={addLabel} placeholder={addPlaceholder} onAdd={onAdd} />
        </Card>
      ) : (
        // Empty → light, out-of-the-way treatment (no big card).
        <div className="px-1">
          <p className="text-[13.5px] text-muted-foreground">{emptyLabel}</p>
          <AddInline label={addLabel} placeholder={addPlaceholder} onAdd={onAdd} />
        </div>
      )}
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
