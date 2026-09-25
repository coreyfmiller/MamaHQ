'use client'

import { useState } from 'react'
import {
  CalendarDays,
  ChevronRight,
  Moon,
  ShoppingCart,
  Check,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Clock,
  HeartHandshake,
  Sun,
  Smile,
  Star,
} from 'lucide-react'
import { useNav } from '../context'
import { useProfile, dayNumber } from '../profile'
import {
  useLogs,
  useNow,
  lastOfKind,
  activeSleep,
  timeAgo,
  elapsed,
  toLocalInput,
  fromLocalInput,
} from '../logs'
import { NameAvatar } from '../name-avatar'
import { pickDailyRead, readMinutes } from '@/lib/daily-reads'
import { firstNinetyState } from '@/lib/first90'
import { useGrocery } from '../grocery'
import { useCalendar, type CalendarEvent } from '../calendar'
import { useTasks } from '../tasks'
import { useCare } from '../care'
import { useHousehold } from '../household'
import { useAuth } from '../auth'
import { useMom, dayKey, type Mood } from '../mom'
import {
  buildTodayModel,
  localDayKey,
  type TodayModel,
  type DomainState,
  type AttentionItem,
} from '@/lib/today/model'
import { BottomNav, Card, CardLabel, LiveDot, Screen, Scroll, StatusBar } from '../ui'

// ── Today (MamaHQ 2.0) ────────────────────────────────────────────────────────
//
// "What matters today?" — an ADAPTIVE page, not a dashboard. A quiet day is short;
// a busy day expands. Empty domains disappear rather than render empty cards.
//
// The deterministic engine (lib/today/model.ts, buildTodayModel — 79 tests) is REUSED
// unchanged. This file is a presentation/IA redesign only. Ordering favors: action →
// time → current Baby context → secondary (grocery) → Mom.
//
// Hierarchy: Header → Needs your attention → Your day (+ To do today) → Baby glance
// (End Sleep preserved) → Grocery → Coming up → For you.

/* ======================================================================== */
/* Provider → model adapter (unchanged engine)                              */
/* ======================================================================== */

function domainState(available: boolean, hydrated: boolean, loadError: boolean): DomainState {
  if (!available) return 'ok'
  if (loadError) return 'error'
  if (!hydrated) return 'loading'
  return 'ok'
}

function useTodayModel(now: Date): TodayModel {
  const { me, people } = useHousehold()
  const { user } = useAuth()
  const tasksCtx = useTasks()
  const cal = useCalendar()
  const care = useCare()
  const grocery = useGrocery()

  return buildTodayModel({
    mePersonId: me?.id ?? null,
    meUserId: user?.id ?? null,
    people: people.map((p) => ({ id: p.id, displayName: p.displayName })),
    tasks: tasksCtx.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      assignedToPersonId: t.assignedToPersonId,
      dueAt: t.dueAt,
      acknowledgedAt: t.acknowledgedAt,
    })),
    tasksState: domainState(tasksCtx.available, tasksCtx.hydrated, tasksCtx.loadError),
    events: cal.events.map((e) => ({
      id: e.id,
      title: e.title,
      allDay: e.allDay,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      startDate: e.startDate,
      endDate: e.endDate,
      responsiblePersonId: e.responsiblePersonId,
      participantIds: e.participantIds,
    })),
    calendarState: domainState(cal.available, cal.hydrated, cal.loadError),
    careHolderPersonId: care.holderPersonId,
    carePending: care.pending
      ? {
          id: care.pending.id,
          fromPersonId: care.pending.fromPersonId,
          toPersonId: care.pending.toPersonId,
          proposedByUserId: care.pending.proposedByUserId,
          status: care.pending.status,
        }
      : null,
    careContext: care.buildContext(),
    careState: domainState(care.available, care.hydrated, care.loadError),
    groceryActiveCount: grocery.active.length,
    groceryState: domainState(true, grocery.hydrated, false),
    now,
  })
}

/* ======================================================================== */
/* Screen                                                                    */
/* ======================================================================== */

export function TodayScreen() {
  const now = useNow(60_000)
  const model = useTodayModel(now)

  return (
    <Screen>
      <StatusBar />
      <Scroll className="px-5 pb-28">
        <Header />

        {model.isLoading ? (
          <TodayLoading />
        ) : (
          <>
            <AttentionSection model={model} />
            <YourDay model={model} />
            <BabyGlance />
            <GrocerySummary count={model.grocery.activeCount} failed={model.failedDomains.includes('grocery')} />
            <ComingUp />
            <ForYou />
          </>
        )}
      </Scroll>
      <BottomNav active="today" />
    </Screen>
  )
}

/* ======================================================================== */
/* Header                                                                    */
/* ======================================================================== */

function greeting(now: Date): string {
  const h = now.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function Header() {
  const { profile } = useProfile()
  const { me } = useHousehold()
  const { openOverlay } = useNav()
  const now = useNow(60_000)
  const myName = me?.displayName ?? profile?.momName ?? 'there'
  const babyName = profile?.babyName ?? 'Baby'

  const dateLine = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  // Day N only while truthfully within the first-90 journey. Missing birth date or
  // Beyond 90 → omit (Me → My Journey owns setup/graduation). Never fabricate.
  let dayN: string | null = null
  if (profile?.birthDate) {
    const st = firstNinetyState(profile.birthDate, now)
    if (st.withinJourney) dayN = `Day ${dayNumber(profile.birthDate, now)}`
  }

  return (
    <header className="flex items-start justify-between pt-1">
      <div className="min-w-0">
        <h1 className="font-serif text-[25px] leading-tight font-semibold tracking-tight">
          {greeting(now)}, {myName}
        </h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {dateLine}
          {dayN && <span> · <span className="font-medium text-foreground">{dayN}</span></span>}
        </p>
      </div>
      <button
        onClick={() => openOverlay('settings')}
        aria-label="Settings"
        className="shrink-0 rounded-full transition-transform active:scale-95"
      >
        <NameAvatar name={babyName} photo={profile?.photo} className="size-10 text-[15px]" />
      </button>
    </header>
  )
}

function TodayLoading() {
  return (
    <div className="mt-4 space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your day…</span>
      {[0, 1].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-3xl bg-muted/60" />
      ))}
    </div>
  )
}

/* ======================================================================== */
/* Needs your attention (the spine — engine unchanged)                       */
/* ======================================================================== */

function AttentionSection({ model }: { model: TodayModel }) {
  // MamaHQ 2.0: care handoff is RETIRED from the visible UX. buildTodayModel still
  // computes 'care_handoff_incoming' items (dormant, tested), but we filter them out
  // here so care state can no longer make Today appear busy. The care backend/domain
  // is intentionally left intact for possible post-beta revival.
  const items = model.attention.filter((a) => a.kind !== 'care_handoff_incoming')
  if (items.length === 0) return null
  return (
    <section className="mt-5">
      <CardLabel className="mb-2 px-1 text-foreground">Needs your attention</CardLabel>
      <div className="space-y-2">
        {items.map((item) => (
          <AttentionRow key={`${item.kind}:${item.refId}`} item={item} />
        ))}
      </div>
    </section>
  )
}

function timeLabel(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const tasksCtx = useTasks()
  const { openOverlay, showToast } = useNav()
  const [busy, setBusy] = useState<null | string>(null)

  const run = async (label: string, fn: () => Promise<{ ok: boolean; error?: string } | void>) => {
    setBusy(label)
    try {
      const res = await fn()
      if (res && 'ok' in res && !res.ok) {
        showToast(res.error ? `Couldn't ${label}: ${res.error}` : `Couldn't ${label}`)
      }
    } catch (e) {
      showToast(`Couldn't ${label}: ${e instanceof Error ? e.message : 'try again'}`)
    } finally {
      setBusy(null)
    }
  }

  const t = timeLabel(item.at)

  const config: { Icon: typeof AlertCircle; tone: string; line: string; actions: React.ReactNode } = (() => {
    switch (item.kind) {
      // NOTE (MamaHQ 2.0): 'care_handoff_incoming' is intentionally NOT handled here —
      // care handoff is retired from the visible UX and AttentionSection filters these
      // items out before render, so this row never receives one. The fallback below
      // keeps the return type total without resurrecting any care UI.
      case 'task_awaiting_acceptance':
        return {
          Icon: HeartHandshake,
          tone: 'bg-sage-soft text-sage',
          line: 'Assigned to you — accept it so it’s clearly yours',
          actions: (
            <button onClick={() => run('accept', () => tasksCtx.accept(item.refId))} disabled={!!busy} className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-40">
              {busy === 'accept' ? <Loader2 className="size-3.5 animate-spin" /> : "I've got it"}
            </button>
          ),
        }
      case 'task_overdue':
        return {
          Icon: AlertCircle,
          tone: 'bg-peach-soft text-peach',
          line: t ? `Overdue · was due ${t}` : 'Overdue',
          actions: (
            <button onClick={() => run('complete', () => tasksCtx.complete(item.refId))} disabled={!!busy} className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-40">
              {busy === 'complete' ? <Loader2 className="size-3.5 animate-spin" /> : 'Done'}
            </button>
          ),
        }
      case 'task_due_today':
        return {
          Icon: Clock,
          tone: 'bg-sage-soft text-sage',
          line: t ? `Due today · ${t}` : 'Due today',
          actions: (
            <button onClick={() => run('complete', () => tasksCtx.complete(item.refId))} disabled={!!busy} className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-40">
              {busy === 'complete' ? <Loader2 className="size-3.5 animate-spin" /> : 'Done'}
            </button>
          ),
        }
      case 'event_responsible_soon':
        return {
          Icon: CalendarDays,
          tone: 'bg-blue-soft/60 text-foreground',
          line: t ? `You're responsible · ${t}` : "You're responsible today",
          actions: (
            <button onClick={() => openOverlay('calendar')} className="rounded-full bg-muted px-4 py-2 text-[13px] font-semibold text-foreground">
              View
            </button>
          ),
        }
      default:
        // Unreachable in the 2.0 UX (care_handoff_incoming is filtered upstream);
        // keeps the return total without rendering any care-handoff affordance.
        return { Icon: AlertCircle, tone: 'bg-muted text-muted-foreground', line: '', actions: null }
    }
  })()

  const { Icon, tone, line, actions } = config
  return (
    <Card className="space-y-2">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${tone}`}>
          <Icon className="size-[18px]" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-tight">{item.title}</p>
          <p className="text-[13px] text-muted-foreground">{line}</p>
        </div>
      </div>
      <div className="pl-12">{actions}</div>
    </Card>
  )
}

/* ======================================================================== */
/* Your day (calendar commitments + compact To do today)                     */
/* ======================================================================== */

function YourDay({ model }: { model: TodayModel }) {
  const { openOverlay, composeEvent } = useNav()
  const failed = model.failedDomains.includes('calendar')

  // "To do today" = my overdue / due-today tasks NOT already shown in Attention
  // (Attention already surfaces overdue / due-today / awaiting for accepted tasks).
  const attentionIds = new Set(model.attention.map((a) => a.refId))
  const toDoToday = model.mine.filter(
    (t) => (t.overdue || isDueTodayMine(t.dueAt)) && !attentionIds.has(t.id),
  )

  if (failed) {
    return <DomainError label="Couldn't load today's calendar" onRetry={() => openOverlay('calendar')} />
  }
  if (model.commitments.length === 0 && toDoToday.length === 0) return null

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between px-1">
        <CardLabel className="text-foreground">Your day</CardLabel>
        <button onClick={() => openOverlay('calendar')} className="flex items-center gap-0.5 text-[13px] font-medium text-primary">
          Calendar <ChevronRight className="size-3.5" />
        </button>
      </div>

      {/* Timed/all-day commitments — chronological. */}
      {model.commitments.length > 0 && (
        <div className="space-y-2">
          {model.commitments.map((c) => (
            <button
              key={c.id}
              onClick={() => composeEvent(c.id)}
              className="flex w-full items-start gap-3 rounded-2xl bg-blue-soft/40 p-3 text-left transition-transform active:scale-[0.99]"
            >
              <span className="w-16 shrink-0 pt-0.5 text-[12px] font-semibold text-muted-foreground">
                {c.allDay ? 'All day' : timeLabel(c.startsAt) ?? ''}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-tight">{c.title}</p>
                <RoleLine myRole={c.myRole} responsibleName={c.responsibleName} participantNames={c.participantNames} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* To do today — only real due-dated work, never Mom to-dos or undated tasks. */}
      {toDoToday.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">To do today</p>
          <TodoTodayList tasks={toDoToday} />
        </div>
      )}
    </section>
  )
}

function isDueTodayMine(dueAt: string | null): boolean {
  if (!dueAt) return false
  const now = new Date()
  const key = localDayKey(now)
  const d = new Date(dueAt)
  return localDayKey(d) === key
}

function TodoTodayList({ tasks }: { tasks: TodayModel['mine'] }) {
  const tasksCtx = useTasks()
  const { showToast } = useNav()
  const [busyId, setBusyId] = useState<string | null>(null)

  const complete = async (id: string) => {
    setBusyId(id)
    try {
      await tasksCtx.complete(id)
    } catch (e) {
      showToast(`Couldn't complete: ${e instanceof Error ? e.message : 'try again'}`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card className="divide-y divide-border/50 py-1">
      {tasks.map((t) => (
        <div key={t.id} className="flex items-center gap-3 py-2">
          <button
            onClick={() => complete(t.id)}
            disabled={busyId === t.id}
            aria-label={`Mark "${t.title}" done`}
            className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-transparent transition-colors hover:border-primary hover:text-primary active:bg-muted disabled:opacity-40"
          >
            {busyId === t.id ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : <Check className="size-3.5" strokeWidth={3} />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] leading-tight">{t.title}</p>
            <p className="text-[12px] text-muted-foreground">
              {t.overdue ? 'Overdue' : t.dueAt ? `Due ${timeLabel(t.dueAt) ?? 'today'}` : 'Due today'}
            </p>
          </div>
        </div>
      ))}
    </Card>
  )
}

function RoleLine({
  myRole,
  responsibleName,
  participantNames,
}: {
  myRole: 'responsible' | 'attending' | 'other'
  responsibleName: string | null
  participantNames: string[]
}) {
  if (myRole === 'responsible') return <p className="text-[13px] font-medium text-sage">You&apos;re responsible</p>
  if (myRole === 'attending') {
    return (
      <p className="text-[13px] text-muted-foreground">
        {responsibleName ? `${responsibleName} is responsible · ` : ''}You&apos;re attending
      </p>
    )
  }
  if (responsibleName) return <p className="text-[13px] text-muted-foreground">{responsibleName} is responsible</p>
  if (participantNames.length > 0) return <p className="text-[13px] text-muted-foreground">{participantNames.join(', ')}</p>
  return null
}

/* ======================================================================== */
/* Baby glance (concise; End Sleep preserved)                                */
/* ======================================================================== */

const RUNAWAY_HOURS = 10

function BabyGlance() {
  const { logs, hydrated, loadError } = useLogs()
  const { openOverlay, setTab } = useNav()
  const now = useNow(30_000)

  if (loadError) {
    return (
      <section className="mt-6">
        <DomainError label="Couldn't load Baby's activity" onRetry={() => openOverlay('quicklog')} />
      </section>
    )
  }
  if (!hydrated || logs.length === 0) return null // nothing to say → stay silent

  const sleeping = activeSleep(logs)
  const lastFeed = lastOfKind(logs, 'feed')

  let line: string
  if (sleeping) line = `Sleeping · ${elapsed(sleeping.createdAt, null, now)}`
  else if (lastFeed) line = `Last feed · ${timeAgo(lastFeed.createdAt, now)}`
  else line = 'Recent activity logged'

  return (
    <section className="mt-6">
      <button
        onClick={() => setTab('baby')}
        className="flex w-full items-center gap-3 rounded-2xl bg-muted/40 px-4 py-3 text-left ring-1 ring-border/50 transition-colors active:bg-muted"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue">
          <Moon className="size-[18px]" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Baby</p>
          <p className="text-[15px] font-semibold leading-tight">{line}</p>
        </div>
        {sleeping && <LiveDot />}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" />
      </button>

      {/* End Sleep — the ONLY place to end an active sleep (QuickLog can't). Preserved. */}
      {sleeping && <SleepControl sleepId={sleeping.id} startISO={sleeping.createdAt} now={now} />}
    </section>
  )
}

function SleepControl({ sleepId, startISO, now }: { sleepId: string; startISO: string; now: Date }) {
  const { endSleep } = useLogs()
  const { profile } = useProfile()
  const [confirming, setConfirming] = useState(false)
  const [wake, setWake] = useState(() => toLocalInput(new Date().toISOString()))

  const hours = (now.getTime() - new Date(startISO).getTime()) / 3_600_000
  const runaway = hours >= RUNAWAY_HOURS
  const babyName = profile?.babyName ?? 'Baby'

  if (confirming) {
    const wakeISO = fromLocalInput(wake)
    const valid = new Date(wakeISO).getTime() > new Date(startISO).getTime()
    return (
      <Card className="mt-2 space-y-3 border-primary/30 bg-primary/5">
        <p className="text-[15px] font-semibold">When did {babyName} wake up?</p>
        <input
          type="datetime-local"
          value={wake}
          min={toLocalInput(startISO)}
          onChange={(e) => setWake(e.target.value)}
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-[15px] text-foreground outline-none focus:border-primary"
        />
        <p className="text-[13px] font-medium text-muted-foreground">
          {valid ? `Slept ${elapsed(startISO, wakeISO)}` : 'Wake time must be after they fell asleep.'}
        </p>
        <div className="flex gap-2">
          <button onClick={() => setConfirming(false)} className="flex-1 rounded-full bg-muted py-3 text-[14px] font-semibold text-foreground transition-transform active:scale-[0.98]">
            Cancel
          </button>
          <button onClick={() => valid && endSleep(sleepId, wakeISO)} disabled={!valid} className="flex-1 rounded-full bg-primary py-3 text-[14px] font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-40">
            Save
          </button>
        </div>
      </Card>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        onClick={() => endSleep(sleepId)}
        className="flex-1 rounded-full bg-primary py-2.5 text-[14px] font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
      >
        End sleep
      </button>
      <button
        onClick={() => setConfirming(true)}
        className="rounded-full bg-muted px-4 py-2.5 text-[14px] font-semibold text-foreground transition-transform active:scale-[0.99]"
      >
        {runaway ? 'Fix time' : 'Set wake time'}
      </button>
    </div>
  )
}

/* ======================================================================== */
/* Grocery (secondary, conditional)                                          */
/* ======================================================================== */

function GrocerySummary({ count, failed }: { count: number; failed: boolean }) {
  const { openOverlay } = useNav()
  if (failed) {
    return (
      <section className="mt-6">
        <DomainError label="Couldn't load your grocery list" onRetry={() => openOverlay('grocery')} />
      </section>
    )
  }
  if (count === 0) return null
  return (
    <button
      onClick={() => openOverlay('grocery')}
      className="mt-6 flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left ring-1 ring-border/60 transition-transform active:scale-[0.99]"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage">
        <ShoppingCart className="size-[18px]" strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-tight">Grocery</p>
        <p className="text-[13px] text-muted-foreground">{count} thing{count === 1 ? '' : 's'} on your list</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  )
}

/* ======================================================================== */
/* Coming up (next 1–3 days, excluding today)                                */
/* ======================================================================== */

function comingUpWhen(e: CalendarEvent): string {
  const rel = (d: Date): string => {
    const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
    const diff = Math.round((startOfDay(d) - startOfDay(new Date())) / 86_400_000)
    if (diff === 1) return 'Tomorrow'
    if (diff > 1 && diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' })
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

function ComingUp() {
  const { composeEvent } = useNav()
  const { upcoming, hydrated, available, loadError } = useCalendar()
  const now = useNow(60_000)

  if (!available || loadError || !hydrated) return null // errors surface in Your day

  const todayKey = localDayKey(now)
  const in3Days = now.getTime() + 3 * 86_400_000
  const next = upcoming
    .filter((e) => {
      const startMs = e.allDay
        ? (e.startDate ? new Date(e.startDate + 'T00:00:00').getTime() : 0)
        : (e.startsAt ? new Date(e.startsAt).getTime() : 0)
      const key = e.allDay ? (e.startDate ?? '') : (e.startsAt ? localDayKey(new Date(e.startsAt)) : '')
      return key !== todayKey && startMs <= in3Days // strictly future days, within ~3 days
    })
    .slice(0, 3)

  if (next.length === 0) return null

  return (
    <section className="mt-6">
      <CardLabel className="mb-1.5 px-1 text-foreground">Coming up</CardLabel>
      <ul className="space-y-1.5">
        {next.map((e) => (
          <li key={e.id}>
            <button onClick={() => composeEvent(e.id)} className="flex w-full items-center gap-3 text-left">
              <span className="w-28 shrink-0 text-[12.5px] font-medium tabular-nums text-muted-foreground">{comingUpWhen(e)}</span>
              <span className="min-w-0 flex-1 truncate text-[14.5px] text-foreground">{e.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ======================================================================== */
/* For you (small: mood nudge + today's read)                                */
/* ======================================================================== */

const moodOptions: { id: Mood; label: string; Icon: typeof Sun }[] = [
  { id: 'tired', label: 'Tired', Icon: Moon },
  { id: 'okay', label: 'Okay', Icon: Sun },
  { id: 'good', label: 'Good', Icon: Smile },
  { id: 'great', label: 'Great', Icon: Star },
]

function ForYou() {
  const { openOverlay } = useNav()
  const { profile } = useProfile()
  const { state, hydrated, setTodayMood } = useMom()
  const now = useNow(60_000)

  const moodAnswered = hydrated && !!state.moodByDay[dayKey(now)]

  // Today's read only within the first-90 journey (Me owns the full journey).
  let read: ReturnType<typeof pickDailyRead> | null = null
  if (profile?.birthDate) {
    const st = firstNinetyState(profile.birthDate, now)
    if (st.withinJourney) read = pickDailyRead(dayNumber(profile.birthDate, now))
  }

  // Nothing to offer → stay silent.
  if (moodAnswered && !read) return null

  return (
    <section className="mt-6">
      <CardLabel className="mb-2 px-1 text-foreground">For you</CardLabel>

      {!moodAnswered && (
        <div className="rounded-2xl bg-sage-soft/40 px-4 py-3 ring-1 ring-border/40">
          <p className="text-[14px] font-semibold">How are you today?</p>
          <div className="mt-2 flex gap-2">
            {moodOptions.map((m) => (
              <button
                key={m.id}
                onClick={() => setTodayMood(m.id)}
                aria-label={m.label}
                className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-border/70 bg-card py-2 text-muted-foreground transition-colors active:bg-muted"
              >
                <m.Icon className="size-[18px]" strokeWidth={1.75} />
                <span className="text-[11.5px]">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {read && (
        <button
          onClick={() => openOverlay('read')}
          className={`flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left ring-1 ring-border/60 transition-transform active:scale-[0.99] ${!moodAnswered ? 'mt-2' : ''}`}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Today&apos;s read</p>
            <p className="truncate text-[14.5px] font-semibold leading-tight">{read.title}</p>
            <p className="text-[12px] text-muted-foreground">{readMinutes(read)} min · {read.category}</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-primary" />
        </button>
      )}
    </section>
  )
}

/* ======================================================================== */
/* Shared                                                                    */
/* ======================================================================== */

function DomainError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <Card className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-peach-soft text-peach">
        <AlertTriangle className="size-[18px]" strokeWidth={1.75} />
      </span>
      <p className="min-w-0 flex-1 text-[14px] text-foreground">{label}</p>
      <button onClick={onRetry} className="rounded-full bg-muted px-3.5 py-1.5 text-[13px] font-semibold text-foreground">
        Open
      </button>
    </Card>
  )
}
