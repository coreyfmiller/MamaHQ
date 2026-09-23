'use client'

import { useState } from 'react'
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Moon,
  ShoppingCart,
  Sparkles,
  Square,
  Check,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Baby as BabyIcon,
  ListChecks,
  Clock,
  HeartHandshake,
  Users,
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
  type LogKind,
} from '../logs'
import { NameAvatar } from '../name-avatar'
import { CategoryChip } from '../event-meta'
import type { Category } from '@/lib/mama-data'
import { pickAffirmation } from '@/lib/affirmations'
import { pickDailyRead, readMinutes } from '@/lib/daily-reads'
import { firstNinetyState } from '@/lib/first90'
import { useGrocery } from '../grocery'
import { useCalendar } from '../calendar'
import { useTasks } from '../tasks'
import { useCare } from '../care'
import { useHousehold } from '../household'
import { useAuth } from '../auth'
import {
  buildTodayModel,
  isSoloHousehold,
  type TodayModel,
  type DomainState,
  type AttentionItem,
} from '@/lib/today/model'
import { BottomNav, Card, CardLabel, LiveDot, Screen, Scroll, StatusBar } from '../ui'

/* ======================================================================== */
/* Provider → projection adapter                                            */
/* ======================================================================== */

// Map a provider's (hydrated, available, loadError) into the model's DomainState.
// A signed-out/unavailable domain is treated as 'ok' + empty (nothing to show),
// which is truthful: there is no shared state to fail at.
function domainState(available: boolean, hydrated: boolean, loadError: boolean): DomainState {
  if (!available) return 'ok'
  if (loadError) return 'error'
  if (!hydrated) return 'loading'
  return 'ok'
}

// Builds the Today model from live provider state. The clock ticks (useNow) so
// overdue/today boundaries stay fresh without impure Date.now() in render.
function useTodayModel(now: Date): TodayModel {
  const { me, people } = useHousehold()
  const { user } = useAuth()
  const tasksCtx = useTasks()
  const cal = useCalendar()
  const care = useCare()
  const grocery = useGrocery()

  return buildTodayModel({
    mePersonId: me?.id ?? null,
    // Auth user id — used only as a secondary signal to classify an OUTGOING care
    // handoff I proposed (proposedByUserId), alongside fromPersonId === mePersonId.
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
  const { profile } = useProfile()
  const soloHousehold = useIsSoloHousehold()

  return (
    <Screen>
      <StatusBar />
      <Scroll className="space-y-4 px-6 pb-4">
        <Header />

        {model.isLoading ? (
          <TodayLoading />
        ) : model.isEmpty ? (
          <EmptyToday />
        ) : (
          <>
            <AttentionSection model={model} />
            <TodayPlan model={model} />
            <MineSection model={model} />
            <HouseholdSection model={model} />
            {/* Responsibility teaching state: when Mom is the only connected adult,
                "Others are handling" can never populate, so the biggest differentiator
                (shared, owned responsibility) is invisible. Teach it honestly — never
                fabricate activity — and only until another adult actually connects. */}
            {soloHousehold && !model.failedDomains.includes('tasks') && <ShareTheLoadCard />}
            <CareSection model={model} />
            <GroceryCard count={model.grocery.activeCount} />
            <TellCta />
          </>
        )}

        {/* Quiet secondary editorial — never outranks operational state. */}
        {profile && !model.isLoading && (
          <div className="pt-1">
            <AffirmationCard />
            <div className="mt-3">
              <TodaysReadButton />
            </div>
          </div>
        )}

        {/* Live baby-log care detail + running sleep control (persisted logs). */}
        {!model.isLoading && <RightNow />}
      </Scroll>
      <Footer />
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
  // Prefer the canonical household identity for the greeting; fall back to the local
  // profile display name only if identity isn't resolved yet.
  const myName = me?.displayName ?? profile?.momName ?? 'there'
  const babyName = profile?.babyName ?? 'Baby'

  return (
    <header className="flex items-start justify-between px-6 pt-1">
      <div>
        <h1 className="font-serif text-[26px] leading-tight font-semibold tracking-tight">
          {greeting(now)}, {myName}
        </h1>
        <p className="mt-1 max-w-[16rem] text-[14px] leading-snug text-muted-foreground">
          Here&apos;s what matters today.
        </p>
      </div>
      <button
        onClick={() => openOverlay('settings')}
        aria-label="Settings"
        className="rounded-full transition-transform active:scale-95"
      >
        <NameAvatar name={babyName} photo={profile?.photo} className="size-10 text-[15px]" />
      </button>
    </header>
  )
}

/* ======================================================================== */
/* Loading / Empty                                                           */
/* ======================================================================== */

function TodayLoading() {
  return (
    <div className="mt-2 space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your day…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-3xl bg-muted/60" />
      ))}
    </div>
  )
}

function EmptyToday() {
  const { setTab, openOverlay } = useNav()
  return (
    <div className="mt-2 space-y-4">
      <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
        <p className="font-serif text-[19px] leading-snug font-semibold">Nothing needs your attention right now.</p>
        <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
          When something&apos;s on your mind — a to-do, an appointment, groceries — tell MamaHQ and
          it&apos;ll sort it into your shared household. You approve everything first.
        </p>
        <button
          onClick={() => setTab('tell')}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
        >
          <Sparkles className="size-4" strokeWidth={2} /> What&apos;s on your mind?
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <QuickShortcut icon={ListChecks} label="Add task" onClick={() => openOverlay('tasks')} />
        <QuickShortcut icon={CalendarDays} label="Add event" onClick={() => openOverlay('calendar')} />
        <QuickShortcut icon={ShoppingCart} label="Grocery" onClick={() => openOverlay('grocery')} />
      </div>
    </div>
  )
}

function QuickShortcut({ icon: Icon, label, onClick }: { icon: typeof ListChecks; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-[14px] font-medium text-foreground transition-transform active:scale-[0.98]"
    >
      <span className="flex size-5 items-center justify-center rounded-full bg-sage-soft text-sage">
        <Icon className="size-3.5" strokeWidth={2} />
      </span>
      {label}
    </button>
  )
}

/* ======================================================================== */
/* Attention                                                                 */
/* ======================================================================== */

function AttentionSection({ model }: { model: TodayModel }) {
  if (model.attention.length === 0) return null
  return (
    <div>
      <CardLabel className="mb-2 px-1 text-foreground">Needs your attention</CardLabel>
      <div className="space-y-2">
        {model.attention.map((item) => (
          <AttentionRow key={`${item.kind}:${item.refId}`} item={item} />
        ))}
      </div>
    </div>
  )
}

function timeLabel(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const tasksCtx = useTasks()
  const care = useCare()
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

  // Per-kind icon + copy + action.
  const config: {
    Icon: typeof AlertCircle
    tone: string
    line: string
    actions: React.ReactNode
  } = (() => {
    switch (item.kind) {
      case 'care_handoff_incoming':
        return {
          Icon: BabyIcon,
          tone: 'bg-blush/30 text-blush',
          line: item.fromName ? `${item.fromName} wants to hand off care to you` : 'A care handoff is waiting for you',
          actions: (
            <div className="flex gap-2">
              <button
                onClick={() => run('accept', () => care.accept(item.refId))}
                disabled={!!busy}
                className="flex-1 rounded-full bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-40"
              >
                {busy === 'accept' ? <Loader2 className="mx-auto size-3.5 animate-spin" /> : "I've got it"}
              </button>
              <button
                onClick={() => run('decline', () => care.decline(item.refId))}
                disabled={!!busy}
                className="rounded-full bg-muted px-3 py-2 text-[13px] font-semibold text-foreground disabled:opacity-40"
              >
                Decline
              </button>
            </div>
          ),
        }
      case 'task_awaiting_acceptance':
        return {
          Icon: HeartHandshake,
          tone: 'bg-sage-soft text-sage',
          line: 'Assigned to you — accept it so it’s clearly yours',
          actions: (
            <button
              onClick={() => run('accept', () => tasksCtx.accept(item.refId))}
              disabled={!!busy}
              className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-40"
            >
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
            <button
              onClick={() => run('complete', () => tasksCtx.complete(item.refId))}
              disabled={!!busy}
              className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-40"
            >
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
            <button
              onClick={() => run('complete', () => tasksCtx.complete(item.refId))}
              disabled={!!busy}
              className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-40"
            >
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
            <button
              onClick={() => openOverlay('calendar')}
              className="rounded-full bg-muted px-4 py-2 text-[13px] font-semibold text-foreground"
            >
              View
            </button>
          ),
        }
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
/* Today's plan (calendar)                                                   */
/* ======================================================================== */

function TodayPlan({ model }: { model: TodayModel }) {
  const { openOverlay, composeEvent } = useNav()
  const failed = model.failedDomains.includes('calendar')

  if (failed) {
    return <DomainError label="Couldn't load today's calendar" onRetry={() => openOverlay('calendar')} />
  }
  if (model.commitments.length === 0) return null

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <CardLabel className="text-foreground">Today&apos;s plan</CardLabel>
        <button onClick={() => openOverlay('calendar')} className="flex items-center gap-0.5 text-[13px] font-medium text-primary">
          Calendar <ChevronRight className="size-3.5" />
        </button>
      </div>
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
              <RoleLine
                myRole={c.myRole}
                responsibleName={c.responsibleName}
                participantNames={c.participantNames}
              />
            </div>
          </button>
        ))}
      </div>
    </Card>
  )
}

// Honest role line: distinguishes responsible vs attending vs other; never conflates.
function RoleLine({
  myRole,
  responsibleName,
  participantNames,
}: {
  myRole: 'responsible' | 'attending' | 'other'
  responsibleName: string | null
  participantNames: string[]
}) {
  if (myRole === 'responsible') {
    return <p className="text-[13px] font-medium text-sage">You&apos;re responsible</p>
  }
  if (myRole === 'attending') {
    return (
      <p className="text-[13px] text-muted-foreground">
        {responsibleName ? `${responsibleName} is responsible · ` : ''}You&apos;re attending
      </p>
    )
  }
  // other: show who's responsible / who's involved without implying it's mine.
  if (responsibleName) return <p className="text-[13px] text-muted-foreground">{responsibleName} is responsible</p>
  if (participantNames.length > 0) return <p className="text-[13px] text-muted-foreground">{participantNames.join(', ')}</p>
  return null
}

/* ======================================================================== */
/* Mine                                                                      */
/* ======================================================================== */

function MineSection({ model }: { model: TodayModel }) {
  const tasksCtx = useTasks()
  const { openOverlay, showToast } = useNav()
  const [busyId, setBusyId] = useState<string | null>(null)
  const failed = model.failedDomains.includes('tasks')

  if (failed) {
    return <DomainError label="Couldn't load your tasks" onRetry={() => openOverlay('tasks')} />
  }
  if (model.mine.length === 0) return null

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
    <Card className="space-y-2">
      <div className="flex items-center justify-between">
        <CardLabel className="text-foreground">You&apos;re handling</CardLabel>
        <button onClick={() => openOverlay('tasks')} className="flex items-center gap-0.5 text-[13px] font-medium text-primary">
          Tasks <ChevronRight className="size-3.5" />
        </button>
      </div>
      <div className="divide-y divide-border/50">
        {model.mine.map((t) => (
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
              <p className="text-[15px] leading-tight">{t.title}</p>
              <p className="text-[12px] text-muted-foreground">
                {t.overdue ? 'Overdue' : t.dueAt ? `Due ${dueLabel(t.dueAt)}` : 'No due date'}
                {t.acceptance === 'accepted' ? ' · You’ve got it' : ''}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function dueLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/* ======================================================================== */
/* Household — someone else is handling it                                   */
/* ======================================================================== */

function HouseholdSection({ model }: { model: TodayModel }) {
  const { openOverlay } = useNav()
  if (model.failedDomains.includes('tasks')) return null // error already shown in Mine
  if (model.household.length === 0) return null

  return (
    <Card className="space-y-3">
      <CardLabel className="text-foreground">Others are handling</CardLabel>
      <div className="space-y-2.5">
        {model.household.map((h) => (
          <div key={h.personId}>
            <p className="text-[14px] font-semibold">{h.personName}</p>
            <div className="mt-0.5 space-y-0.5">
              {h.tasks.map((t) => (
                <p key={t.id} className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <span className="size-1 rounded-full bg-muted-foreground/50" />
                  {t.title}
                  {t.acceptance === 'accepted' && <span className="text-sage"> · has it</span>}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => openOverlay('people')} className="flex items-center gap-0.5 text-[13px] font-medium text-primary">
        Household <ChevronRight className="size-3.5" />
      </button>
    </Card>
  )
}

// True when the current user is the ONLY connected adult in the household — i.e. no
// OTHER person is linked to an authenticated account. Derived from durable household
// truth (accountStatus === 'connected'), never from display text or pending invites:
// a person who was merely invited (not yet joined) does NOT count, so the teaching
// state stays literally true ("when another adult joins…") until someone actually
// accepts. Signed-out/unhydrated households are treated as solo (nothing to show yet).
function useIsSoloHousehold(): boolean {
  const { people, me, hydrated } = useHousehold()
  if (!hydrated) return false
  // Pure predicate (lib/today/model) so the teaching-state condition is testable
  // without React. Signed-out/unhydrated households are treated as solo (handled above).
  return isSoloHousehold(people, me?.id ?? null)
}

// The responsibility teaching state. Calm, compact, truthful: it explains the
// capability that "Others are handling" will show once another adult connects, and
// offers a single action into the EXISTING Household/People surface. It fabricates no
// tasks and no household activity, and disappears entirely once a second adult joins.
function ShareTheLoadCard() {
  const { openOverlay } = useNav()
  return (
    <Card className="space-y-2.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage">
          <Users className="size-[18px]" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-tight">Share the load</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
            When another adult joins MamaHQ, you&apos;ll both see who&apos;s handling what — and you can
            hand things off so it&apos;s not all on you.
          </p>
        </div>
      </div>
      <div className="pl-12">
        <button
          onClick={() => openOverlay('people')}
          className="rounded-full bg-muted px-4 py-2 text-[13px] font-semibold text-foreground transition-transform active:scale-[0.98]"
        >
          Invite someone
        </button>
      </div>
    </Card>
  )
}

/* ======================================================================== */
/* Care                                                                      */
/* ======================================================================== */

function CareSection({ model }: { model: TodayModel }) {
  const { openOverlay } = useNav()
  const { profile } = useProfile()
  const failed = model.failedDomains.includes('care')
  const c = model.care
  const babyName = profile?.babyName ?? 'Baby'

  if (failed) {
    return <DomainError label="Couldn't load care status" onRetry={() => openOverlay('careHandoff')} />
  }

  // Only render the care summary card when there's something real to say.
  const hasHolder = !!c.holderName
  const hasContext = !!(c.context.lastFeed || c.context.lastDiaper || c.context.lastNap)
  if (!hasHolder && !hasContext && !c.outgoingPendingToName) return null

  return (
    <Card className="space-y-2.5">
      <div className="flex items-center justify-between">
        <CardLabel className="text-foreground">{babyName}</CardLabel>
        <button onClick={() => openOverlay('careHandoff')} className="flex items-center gap-0.5 text-[13px] font-medium text-primary">
          Care <ChevronRight className="size-3.5" />
        </button>
      </div>

      {hasHolder && (
        <p className="text-[14px]">
          <span className="font-medium">Care right now: </span>
          {c.iHoldCare ? <span className="text-sage font-semibold">You have {babyName}</span> : `${c.holderName} has ${babyName}`}
        </p>
      )}

      {/* Truthful pending state — NEVER "X has the baby" until they accept. */}
      {c.outgoingPendingToName && (
        <p className="text-[13px] text-muted-foreground">
          Waiting for {c.outgoingPendingToName} to accept the handoff
        </p>
      )}

      {hasContext && (
        <div className="space-y-0.5 text-[13px] text-muted-foreground">
          {c.context.lastFeed && <p>Last feed · {timeLabel(c.context.lastFeed.at)}{c.context.lastFeed.detail ? ` · ${c.context.lastFeed.detail}` : ''}</p>}
          {c.context.lastDiaper && <p>Last diaper · {timeLabel(c.context.lastDiaper.at)}{c.context.lastDiaper.detail ? ` · ${c.context.lastDiaper.detail}` : ''}</p>}
          {c.context.lastNap && (
            <p>
              {c.context.lastNap.inProgress
                ? `Sleeping since ${timeLabel(c.context.lastNap.start)}`
                : `Last sleep · ${timeLabel(c.context.lastNap.start)}${c.context.lastNap.durationLabel ? ` · ${c.context.lastNap.durationLabel}` : ''}`}
            </p>
          )}
        </div>
      )}
    </Card>
  )
}

/* ======================================================================== */
/* Grocery + Tell + shared bits                                              */
/* ======================================================================== */

function GroceryCard({ count }: { count: number }) {
  const { openOverlay } = useNav()
  if (count === 0) return null // restrained: no card when the list is empty
  return (
    <button
      onClick={() => openOverlay('grocery')}
      className="flex w-full items-center gap-3.5 rounded-2xl border border-border/70 bg-card p-3.5 text-left shadow-sm transition-transform active:scale-[0.99]"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sage-soft text-sage">
        <ShoppingCart className="size-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-tight">Grocery</p>
        <p className="text-[13px] text-muted-foreground">
          {count} thing{count === 1 ? '' : 's'} on the list
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  )
}

function TellCta() {
  const { setTab } = useNav()
  return (
    <button
      onClick={() => setTab('tell')}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
    >
      <Sparkles className="size-4" strokeWidth={2} /> Tell MamaHQ what&apos;s on your mind
    </button>
  )
}

// A restrained, retryable per-domain error — never disguised as empty.
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

function Footer() {
  return <BottomNav active="today" />
}

/* ======================================================================== */
/* Live baby-log detail + running sleep (persisted logs) — retained          */
/* ======================================================================== */

const RUNAWAY_HOURS = 10

function RightNow() {
  const { logs } = useLogs()
  const now = useNow()
  const sleeping = activeSleep(logs)
  const hasAny = logs.length > 0
  if (!hasAny && !sleeping) return null // nothing logged → CareSection already covers holder

  const rows: { category: Category; label: string; kind: LogKind }[] = [
    { category: 'feed', label: 'Last feed', kind: 'feed' },
    { category: 'sleep', label: sleeping ? 'Sleeping' : 'Last sleep', kind: 'sleep' },
    { category: 'diaper', label: 'Last diaper', kind: 'diaper' },
  ]

  const sleepValue = (last: ReturnType<typeof lastOfKind>) => {
    if (sleeping) return `${elapsed(sleeping.createdAt, null, now)} so far`
    if (last?.endedAt) return `${elapsed(last.createdAt, last.endedAt)} · ${timeAgo(last.endedAt, now)}`
    return last ? timeAgo(last.createdAt, now) : 'Nothing logged yet'
  }

  return (
    <>
      <Card className="space-y-1">
        <div className="mb-2 flex items-center justify-between">
          <CardLabel className="text-foreground">Recent care detail</CardLabel>
          {(hasAny || sleeping) && <LiveDot />}
        </div>
        <div className="divide-y divide-border/60">
          {rows.map((row) => {
            const last = lastOfKind(logs, row.kind)
            const value =
              row.kind === 'sleep'
                ? sleepValue(last)
                : last
                  ? timeAgo(last.createdAt, now)
                  : 'Nothing logged yet'
            return (
              <div key={row.label} className="flex items-center gap-3.5 py-2.5">
                <CategoryChip category={row.category} />
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold leading-tight">{row.label}</p>
                  <p className="text-[13px] text-muted-foreground">{value}</p>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
      {sleeping && <SleepControl sleepId={sleeping.id} startISO={sleeping.createdAt} now={now} />}
    </>
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
      <Card className="mt-3 space-y-3 border-primary/30 bg-primary/5">
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
          <button
            onClick={() => setConfirming(false)}
            className="flex-1 rounded-full bg-muted py-3 text-[14px] font-semibold text-foreground transition-transform active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            onClick={() => valid && endSleep(sleepId, wakeISO)}
            disabled={!valid}
            className="flex-1 rounded-full bg-primary py-3 text-[14px] font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </Card>
    )
  }

  if (runaway) {
    return (
      <Card className="mt-3 space-y-3 border-peach/40 bg-peach-soft/40">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-2xl bg-peach-soft text-peach">
            <Moon className="size-[18px]" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-[15px] font-semibold leading-tight">Is {babyName} still asleep?</p>
            <p className="text-[13px] text-muted-foreground">
              This sleep has been running {elapsed(startISO, null, now)}.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirming(true)}
            className="flex-1 rounded-full bg-primary py-3 text-[14px] font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
          >
            They woke up
          </button>
          <button
            onClick={() => {
              /* keep counting */
            }}
            className="flex-1 rounded-full bg-card py-3 text-[14px] font-semibold text-foreground ring-1 ring-border transition-transform active:scale-[0.98]"
          >
            Still asleep
          </button>
        </div>
      </Card>
    )
  }

  return (
    <button
      onClick={() => {
        setWake(toLocalInput(new Date().toISOString()))
        setConfirming(true)
      }}
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3.5 text-[15px] font-semibold text-foreground shadow-sm transition-transform active:scale-[0.99]"
    >
      <Square className="size-4 fill-current" strokeWidth={0} />
      Stop sleep · {elapsed(startISO, null, now)}
    </button>
  )
}

/* ======================================================================== */
/* Quiet editorial (secondary)                                               */
/* ======================================================================== */

function AffirmationCard() {
  const { profile } = useProfile()
  const now = useNow(60_000)
  if (!profile) return null
  const day = dayNumber(profile.birthDate, now)
  const text = pickAffirmation(day, now)
  return (
    <div className="rounded-3xl bg-sage-soft/50 px-5 py-4">
      <p className="whitespace-pre-line font-serif text-[16px] leading-relaxed text-foreground/90">{text}</p>
    </div>
  )
}

function TodaysReadButton() {
  const { openOverlay } = useNav()
  const { profile } = useProfile()
  const now = useNow(60_000)
  if (!profile) return null
  // Beta Phase 4 — only offer "Today's read" while within the 1–90 day journey. After
  // Day 90 there is no read for today; we don't pretend the Day 90 piece is today's.
  const j = firstNinetyState(profile.birthDate, now)
  if (!j.hasReadToday) return null
  const read = pickDailyRead(j.day)
  const mins = readMinutes(read)
  return (
    <button
      onClick={() => openOverlay('read')}
      className="flex w-full items-center gap-3.5 rounded-2xl border border-border/70 bg-card p-3.5 text-left shadow-sm transition-transform active:scale-[0.99]"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sage-soft text-sage">
        <BookOpen className="size-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        {/* Subtle journey framing so MamaHQ feels like it's intentionally walking Mom
            through the first 90 days. Uses the SAME authoritative journey-day state as
            everything else; only rendered within Days 1–90 (hasReadToday gates it). */}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-sage">
          Day {j.day} of your first 90
        </p>
        <p className="truncate text-[15px] font-semibold leading-tight">{read.title}</p>
        <p className="text-[13px] text-muted-foreground">
          {read.category} &middot; {mins} min read
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  )
}
