'use client'

import { useMemo } from 'react'
import {
  ShoppingCart,
  ListChecks,
  CalendarDays,
  Users,
  Check,
  Circle,
  Clock,
} from 'lucide-react'
import { useNav } from '../context'
import { useGrocery } from '../grocery'
import { useTasks, type Task } from '../tasks'
import { useCalendar, type CalendarEvent } from '../calendar'
import { useHousehold } from '../household'
import {
  BottomNav,
  PreviewRow,
  Screen,
  Scroll,
  StatRow,
  StatusBar,
  StatusChip,
  SummaryEmpty,
  SummaryError,
  SummaryLoading,
  SummarySection,
} from '../ui'

// ── Home (MamaHQ 2.0) ───────────────────────────────────────────────────────
//
// "What needs managing around home and family life?"
//
// Home is the canonical discovery/management surface for Grocery, Tasks, Calendar
// and Family. It shows REAL information from the existing providers and opens the
// existing full-feature screens (overlays) — it never rebuilds those features or
// owns their state.
//
// Every summary obeys the MamaHQ 2.0 rule: Loading ≠ Empty ≠ Failed. A count is
// never shown before its provider has hydrated, and a load failure never collapses
// into a false "0 / nothing here" empty state.

const MAX_PREVIEW = 3

export function HomeScreen() {
  return (
    <Screen>
      <StatusBar />
      <Scroll className="space-y-5 px-5 pb-6">
        <header className="pt-1">
          <h1 className="font-serif text-[26px] font-semibold tracking-tight">Home</h1>
          <p className="mt-0.5 text-[14px] text-muted-foreground">Keep life moving.</p>
        </header>

        <GrocerySummary />
        <TasksSummary />
        <CalendarSummary />
        <FamilySummary />
      </Scroll>

      <BottomNav active="home" />
    </Screen>
  )
}

/* ── Grocery ─────────────────────────────────────────────────────────────────
 * The hero of Home: substantial functionality already exists but was hidden. We
 * surface count + first few names, and open the full GroceryScreen (autocomplete,
 * quantities, complete/restore, Your Usual, purchase history all live there). */
function GrocerySummary() {
  const { openOverlay } = useNav()
  const { active, hydrated, loadError } = useGrocery()

  const preview = active.slice(0, 4)
  const overflow = active.length - preview.length

  const body = () => {
    if (loadError) return <SummaryError onRetry={() => openOverlay('grocery')} />
    if (!hydrated) return <SummaryLoading label="Loading your list…" />
    if (active.length === 0) {
      return (
        <SummaryEmpty
          label="Nothing on the list yet."
          action={{ label: 'Add item', onClick: () => openOverlay('grocery') }}
        />
      )
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {preview.map((it) => (
          <span
            key={it.id}
            className="max-w-full truncate rounded-full bg-muted px-2.5 py-1 text-[13px] font-medium text-foreground"
          >
            {it.displayName}
          </span>
        ))}
        {overflow > 0 && (
          <span className="rounded-full px-1.5 py-1 text-[13px] font-medium text-muted-foreground">
            +{overflow} more
          </span>
        )}
      </div>
    )
  }

  // Count in the header only once we truthfully know it.
  const count = loadError ? undefined : hydrated ? `${active.length} ${active.length === 1 ? 'item' : 'items'}` : undefined

  return (
    <SummarySection
      title="Grocery"
      icon={ShoppingCart}
      count={count}
      onOpen={() => openOverlay('grocery')}
      openLabel="Open list"
    >
      {body()}
    </SummarySection>
  )
}

/* ── Tasks ───────────────────────────────────────────────────────────────────
 * Signed-in shared household feature (no local mode). We answer "how many need
 * attention today / how many open" and preview the next few. Full management —
 * assignment, acceptance/relinquish — stays in TasksScreen. We never imply a task
 * has been accepted; we only show its title + a neutral open marker here. */
function isDueToday(t: Task): boolean {
  if (!t.dueAt) return false
  const d = new Date(t.dueAt)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function TasksSummary() {
  const { openOverlay } = useNav()
  const { open, hydrated, available, loadError } = useTasks()

  const todayCount = useMemo(() => open.filter(isDueToday).length, [open])
  const preview = open.slice(0, MAX_PREVIEW)

  const body = () => {
    // Tasks require an authenticated family. Signed-out/solo-without-family: don't
    // fabricate; guide to the full screen which handles that state truthfully.
    if (!available) {
      return <SummaryEmpty label="Shared tasks live here once you're set up." action={{ label: 'Open tasks', onClick: () => openOverlay('tasks') }} />
    }
    if (loadError) return <SummaryError onRetry={() => openOverlay('tasks')} />
    if (!hydrated) return <SummaryLoading label="Loading tasks…" />
    if (open.length === 0) {
      return <SummaryEmpty label="Nothing to handle right now." action={{ label: 'Add a task', onClick: () => openOverlay('tasks') }} />
    }
    return (
      <div className="space-y-0.5">
        <StatRow
          className="mb-1.5"
          stats={[
            { value: todayCount, label: 'today' },
            { value: open.length, label: 'open' },
          ]}
        />
        {preview.map((t) => (
          <PreviewRow
            key={t.id}
            lead={<Circle className="size-4 text-muted-foreground/50" strokeWidth={2} />}
            label={t.title}
            meta={isDueToday(t) ? 'Today' : undefined}
          />
        ))}
      </div>
    )
  }

  const count = available && hydrated && !loadError && open.length > 0
    ? `${todayCount} today`
    : undefined

  return (
    <SummarySection title="Tasks" icon={ListChecks} count={count} onOpen={() => openOverlay('tasks')} openLabel="Open tasks">
      {body()}
    </SummarySection>
  )
}

/* ── Calendar ────────────────────────────────────────────────────────────────
 * Near-term schedule: today + tomorrow. Opens the canonical CalendarScreen. We
 * preserve the provider's existing loading / load-error / empty distinction. */
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

function CalendarSummary() {
  const { openOverlay } = useNav()
  const { onDay, today, hydrated, available, loadError } = useCalendar()

  const tomorrowKey = useMemo(() => {
    const t = new Date()
    t.setDate(t.getDate() + 1)
    return dayKeyOf(t)
  }, [])
  const tomorrow = useMemo(() => onDay(tomorrowKey), [onDay, tomorrowKey])

  const body = () => {
    if (!available) {
      return <SummaryEmpty label="Your shared schedule shows up here." action={{ label: 'Open calendar', onClick: () => openOverlay('calendar') }} />
    }
    if (loadError) return <SummaryError onRetry={() => openOverlay('calendar')} />
    if (!hydrated) return <SummaryLoading label="Loading your calendar…" />
    if (today.length === 0 && tomorrow.length === 0) {
      return <SummaryEmpty label="Nothing scheduled today or tomorrow." action={{ label: 'Add to calendar', onClick: () => openOverlay('calendar') }} />
    }
    return (
      <div className="space-y-2">
        <DayGroup label="Today" events={today} />
        <DayGroup label="Tomorrow" events={tomorrow} />
      </div>
    )
  }

  return (
    <SummarySection title="Calendar" icon={CalendarDays} onOpen={() => openOverlay('calendar')} openLabel="View calendar">
      {body()}
    </SummarySection>
  )
}

function DayGroup({ label, events }: { label: string; events: CalendarEvent[] }) {
  if (events.length === 0) return null
  return (
    <div>
      <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">{label}</p>
      {events.slice(0, MAX_PREVIEW).map((e) => (
        <PreviewRow
          key={e.id}
          lead={<Clock className="size-3.5 text-muted-foreground/60" strokeWidth={2} />}
          label={e.title}
          meta={eventTime(e)}
        />
      ))}
      {events.length > MAX_PREVIEW && (
        <p className="pl-6 text-[12px] text-muted-foreground">+{events.length - MAX_PREVIEW} more</p>
      )}
    </div>
  )
}

/* ── Family ──────────────────────────────────────────────────────────────────
 * Understated. Reuses the household people; opens the existing People/Household
 * screen. Solo households get a light "invite" nudge, not empty partner fields.
 * Truthful visibility: this is shared household data — no private/lock UI. */
function FamilySummary() {
  const { openOverlay } = useNav()
  const { people, hydrated, me } = useHousehold()

  const body = () => {
    if (!hydrated) return <SummaryLoading label="Loading your household…" />
    // Others = everyone who isn't the current user's own person.
    const others = people.filter((p) => !me || p.id !== me.id)
    if (others.length === 0) {
      return (
        <SummaryEmpty
          label="It's just you so far. Invite another adult to share the load."
          action={{ label: 'Invite', onClick: () => openOverlay('people') }}
        />
      )
    }
    return (
      <div className="space-y-1">
        {others.slice(0, MAX_PREVIEW).map((p) => {
          const roleLabel = p.role === 'owner' ? 'Owner' : p.role === 'member' ? 'Partner' : p.relationship
          return (
            <PreviewRow
              key={p.id}
              label={p.displayName}
              meta={roleLabel || undefined}
              lead={
                <span className="flex size-6 items-center justify-center rounded-full bg-sage-soft text-[12px] font-semibold text-sage">
                  {p.displayName.trim().charAt(0).toUpperCase() || '?'}
                </span>
              }
            />
          )
        })}
        {/* Status chips row — icon+text, not colour alone. */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {others.some((p) => p.accountStatus === 'connected') && (
            <StatusChip label="Connected" tone="positive" icon={Check} />
          )}
          {others.some((p) => p.accountStatus === 'invited') && (
            <StatusChip label="Invite pending" tone="info" />
          )}
        </div>
      </div>
    )
  }

  return (
    <SummarySection title="Family" icon={Users} onOpen={() => openOverlay('people')} openLabel="Manage family">
      {body()}
    </SummarySection>
  )
}
