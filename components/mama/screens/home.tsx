'use client'

import { useMemo } from 'react'
import {
  ShoppingCart,
  ListChecks,
  Users,
  ChevronRight,
  Plus,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { useNav } from '../context'
import { useGrocery } from '../grocery'
import { useTasks, type Task } from '../tasks'
import { useCalendar, type CalendarEvent } from '../calendar'
import { useHousehold } from '../household'
import {
  BottomNav,
  GroupedSurface,
  Hairline,
  OpenRegion,
  Screen,
  Scroll,
  StatusBar,
} from '../ui'

// ── Home (MamaHQ 2.0) ───────────────────────────────────────────────────────
//
// "What needs managing around home and family life?"
//
// Canonical discovery/management surface for Grocery, Tasks, Calendar and Family.
// It shows REAL provider data and opens the existing full-feature screens; it never
// rebuilds a feature or owns its state. Every module obeys Loading ≠ Empty ≠ Failed.
//
// COMPOSITION (not four identical cards):
//   • Grocery + Tasks  → one soft "operational band" of two compact rows.
//   • Calendar         → an open agenda section on the page background (more width).
//   • Family           → an understated single row, not a full card.
// Three surface treatments + three sizes create rhythm instead of repetition.

const PREVIEW_NAMES = 4
const PREVIEW_ROWS = 3

export function HomeScreen() {
  return (
    <Screen>
      <StatusBar />
      {/* Extra bottom padding so the fixed BottomNav never covers Family/agenda. */}
      <Scroll className="px-5 pb-28">
        <header className="pb-4 pt-1">
          <h1 className="font-serif text-[25px] font-semibold tracking-tight">Home</h1>
          <p className="text-[13.5px] text-muted-foreground">Keep life moving.</p>
        </header>

        {/* Operational band — Grocery + Tasks share one grouped surface. */}
        <GroupedSurface>
          <GroceryRow />
          <Hairline />
          <TasksRow />
        </GroupedSurface>

        {/* Agenda — wider, open on the page, deliberately unlike the band. */}
        <CalendarAgenda />

        {/* Family — quiet single row. */}
        <FamilyRow />
      </Scroll>

      <BottomNav active="home" />
    </Screen>
  )
}

/* ── small shared bits ─────────────────────────────────────────────────────── */

// One-line module heading used inside the operational band: icon + name + count,
// with an affordance chevron. Whole row is the open target (no separate footer).
function RowHead({
  icon: Icon,
  title,
  count,
  trailing,
}: {
  icon: typeof ShoppingCart
  title: string
  count?: string
  trailing?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="size-[18px] shrink-0 text-sage" strokeWidth={1.9} />
      <span className="font-serif text-[16px] font-semibold tracking-tight">{title}</span>
      {count && <span className="text-[13px] font-medium text-muted-foreground">· {count}</span>}
      <span className="ml-auto flex items-center">{trailing}</span>
    </div>
  )
}

function MutedLine({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 truncate text-[13.5px] text-muted-foreground">{children}</p>
}

/* ── Grocery (operational band, top row) ──────────────────────────────────────
 * Compact: name + count on one line, a single truncated preview line of item
 * names, and a contextual inline "+" (the one place quick-add materially helps).
 * The row body opens the full GroceryScreen (autocomplete, quantities,
 * complete/restore, Your Usual, purchase history all live there). */
function GroceryRow() {
  const { openOverlay } = useNav()
  const { active, hydrated, loadError } = useGrocery()

  const names = active.slice(0, PREVIEW_NAMES).map((i) => i.displayName).join(' · ')
  const overflow = active.length - Math.min(active.length, PREVIEW_NAMES)
  const count = !loadError && hydrated && active.length > 0 ? `${active.length}` : undefined

  const line = () => {
    if (loadError) {
      return (
        <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-muted-foreground">
          <AlertCircle className="size-3.5 shrink-0 text-peach" strokeWidth={2} /> Couldn&apos;t load your list.
        </p>
      )
    }
    if (!hydrated) {
      return (
        <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Loading…
        </p>
      )
    }
    if (active.length === 0) return <MutedLine>Nothing on the list yet.</MutedLine>
    return <MutedLine>{names}{overflow > 0 ? ` +${overflow}` : ''}</MutedLine>
  }

  return (
    <div className="flex items-stretch">
      <OpenRegion onOpen={() => openOverlay('grocery')} ariaLabel="Open grocery list" className="min-w-0 flex-1 px-4 py-3">
        <RowHead
          icon={ShoppingCart}
          title="Grocery"
          count={count}
          trailing={<ChevronRight className="size-4 text-muted-foreground/70" />}
        />
        {line()}
      </OpenRegion>
      {/* Contextual quick-add — the one Add that materially speeds a real task. */}
      <button
        onClick={() => openOverlay('grocery')}
        aria-label="Add a grocery item"
        className="flex w-12 shrink-0 items-center justify-center border-l border-border/50 text-muted-foreground transition-colors active:bg-foreground/[0.04]"
      >
        <Plus className="size-[18px]" strokeWidth={2} />
      </button>
    </div>
  )
}

/* ── Tasks (operational band, bottom row) ─────────────────────────────────────
 * Compact sibling of Grocery. "N today" as the count; a single preview line of the
 * next task titles. Full management (assignment, acceptance/relinquish) stays in
 * TasksScreen — we never imply acceptance here. */
function isDueToday(t: Task): boolean {
  if (!t.dueAt) return false
  const d = new Date(t.dueAt)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function TasksRow() {
  const { openOverlay } = useNav()
  const { open, hydrated, available, loadError } = useTasks()

  const todayCount = useMemo(() => open.filter(isDueToday).length, [open])
  const names = open.slice(0, PREVIEW_ROWS).map((t) => t.title).join(' · ')
  const overflow = open.length - Math.min(open.length, PREVIEW_ROWS)
  const count = available && hydrated && !loadError && open.length > 0
    ? (todayCount > 0 ? `${todayCount} today` : `${open.length} open`)
    : undefined

  const line = () => {
    if (!available) return <MutedLine>Shared tasks live here once you&apos;re set up.</MutedLine>
    if (loadError) {
      return (
        <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-muted-foreground">
          <AlertCircle className="size-3.5 shrink-0 text-peach" strokeWidth={2} /> Couldn&apos;t load tasks.
        </p>
      )
    }
    if (!hydrated) {
      return (
        <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Loading…
        </p>
      )
    }
    if (open.length === 0) return <MutedLine>Nothing to handle right now.</MutedLine>
    return <MutedLine>{names}{overflow > 0 ? ` +${overflow}` : ''}</MutedLine>
  }

  return (
    <OpenRegion onOpen={() => openOverlay('tasks')} ariaLabel="Open tasks" className="px-4 py-3">
      <RowHead
        icon={ListChecks}
        title="Tasks"
        count={count}
        trailing={<ChevronRight className="size-4 text-muted-foreground/70" />}
      />
      {line()}
    </OpenRegion>
  )
}

/* ── Calendar (agenda section) ────────────────────────────────────────────────
 * Given horizontal width and an agenda treatment on the plain page background — a
 * time gutter + event rows under TODAY / TOMORROW — so it reads differently from
 * the operational band. Opens the canonical CalendarScreen. */
function eventTime(e: CalendarEvent): string {
  if (e.allDay) return 'All day'
  if (!e.startsAt) return ''
  return new Date(e.startsAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function dayKeyOf(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function CalendarAgenda() {
  const { openOverlay } = useNav()
  const { onDay, today, hydrated, available, loadError } = useCalendar()

  const tomorrowKey = useMemo(() => {
    const t = new Date()
    t.setDate(t.getDate() + 1)
    return dayKeyOf(t)
  }, [])
  const tomorrow = useMemo(() => onDay(tomorrowKey), [onDay, tomorrowKey])

  const body = () => {
    if (!available) return <p className="text-[13.5px] text-muted-foreground">Your shared schedule shows up here.</p>
    if (loadError) {
      return (
        <p className="flex items-center gap-1.5 text-[13.5px] text-muted-foreground">
          <AlertCircle className="size-3.5 shrink-0 text-peach" strokeWidth={2} /> Couldn&apos;t load your calendar.
        </p>
      )
    }
    if (!hydrated) {
      return (
        <p className="flex items-center gap-1.5 text-[13.5px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Loading your calendar…
        </p>
      )
    }
    if (today.length === 0 && tomorrow.length === 0) {
      return <p className="text-[13.5px] text-muted-foreground">Nothing scheduled today or tomorrow.</p>
    }
    return (
      <div className="space-y-2.5">
        <AgendaDay label="Today" events={today} emptyHint="Nothing today." />
        {tomorrow.length > 0 && <AgendaDay label="Tomorrow" events={tomorrow} />}
      </div>
    )
  }

  return (
    <section className="mt-6">
      <button
        onClick={() => openOverlay('calendar')}
        className="mb-2 flex w-full items-center gap-2 text-left"
        aria-label="View calendar"
      >
        <h2 className="font-serif text-[16px] font-semibold tracking-tight">Calendar</h2>
        <span className="ml-auto flex items-center gap-0.5 text-[13px] font-medium text-primary">
          View <ChevronRight className="size-3.5" />
        </span>
      </button>
      {body()}
    </section>
  )
}

function AgendaDay({ label, events, emptyHint }: { label: string; events: CalendarEvent[]; emptyHint?: string }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">{label}</p>
      {events.length === 0 ? (
        emptyHint ? <p className="text-[13px] text-muted-foreground">{emptyHint}</p> : null
      ) : (
        <ul className="space-y-1.5">
          {events.slice(0, PREVIEW_ROWS).map((e) => (
            <li key={e.id} className="flex items-baseline gap-3">
              <span className="w-16 shrink-0 text-[13px] font-medium tabular-nums text-muted-foreground">
                {eventTime(e)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[14.5px] text-foreground">{e.title}</span>
            </li>
          ))}
          {events.length > PREVIEW_ROWS && (
            <li className="pl-[76px] text-[12px] text-muted-foreground">+{events.length - PREVIEW_ROWS} more</li>
          )}
        </ul>
      )}
    </div>
  )
}

/* ── Family (understated row) ─────────────────────────────────────────────────
 * A single quiet row: overlapping avatars + a one-line summary + Manage. Reuses
 * household people; opens the existing People screen. Solo → light invite nudge.
 * Shared household data — no private/lock UI. */
function FamilyRow() {
  const { openOverlay } = useNav()
  const { people, hydrated, me } = useHousehold()

  const others = people.filter((p) => !me || p.id !== me.id)

  const summary = () => {
    if (!hydrated) return 'Loading…'
    if (others.length === 0) return 'Just you for now.'
    const connected = others.filter((p) => p.accountStatus === 'connected').length
    const pending = others.filter((p) => p.accountStatus === 'invited').length
    const names = others.slice(0, 2).map((p) => p.displayName).join(', ')
    const extra = others.length > 2 ? ` +${others.length - 2}` : ''
    const status = connected > 0 ? ' · Connected' : pending > 0 ? ' · Invite pending' : ''
    return `${names}${extra}${status}`
  }

  return (
    <section className="mt-6">
      <button
        onClick={() => openOverlay('people')}
        aria-label="Manage family"
        className="flex w-full items-center gap-3 rounded-2xl py-2 text-left transition-colors active:bg-foreground/[0.03]"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage">
          <Users className="size-[18px]" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-tight">Family</p>
          <p className="truncate text-[13px] text-muted-foreground">{summary()}</p>
        </div>
        <span className="flex items-center gap-0.5 text-[13px] font-medium text-primary">
          {hydrated && others.length === 0 ? 'Invite' : 'Manage'}
          <ChevronRight className="size-3.5" />
        </span>
      </button>
    </section>
  )
}
