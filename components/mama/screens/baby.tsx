'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { ChevronRight, Hand as HandIcon, Plus, Moon, AlertCircle, Loader2 } from 'lucide-react'
import { useNav } from '../context'
import { useProfile, ageLabel, dayNumber } from '../profile'
import { firstNinetyState } from '@/lib/first90'
import {
  useLogs,
  useNow,
  lastOfKind,
  activeSleep,
  describeLog,
  clockTime,
  elapsed,
  timeAgo,
  isSameDay,
} from '../logs'
import { useHousehold } from '../household'
import { useCare } from '../care'
import { useMemories } from '../memories'
import { NameAvatar } from '../name-avatar'
import { CategoryChip } from '../event-meta'
import { BottomNav, Screen, Scroll, Segmented, StatusBar } from '../ui'

// ── Baby (MamaHQ 2.0) ─────────────────────────────────────────────────────────
//
// "What's happening with my baby?" — understanding first, logging second (the global
// + already handles fast capture). Hierarchy:
//   Header (+ compact Log)  →  Right now (status + care)  →  Latest  →  Today  →
//   Timeline · Patterns · Memories (deeper exploration).
//
// Everything is derived from the EXISTING logs/care/memories providers. No second
// logging system, no new persistence. Truthfulness rules (see PR3 audit):
//   • never claim "awake" (no such domain state — only active sleep is known);
//   • never fabricate elapsed times (use real timestamps);
//   • feed volumes only sum feeds that actually carry an oz amount (nursing has none);
//   • sleep duration only from completed sleeps (endedAt set).
// Loading ≠ Empty ≠ Failed is honored via logs.hydrated / logs.loadError.

type BabyTab = 'timeline' | 'patterns' | 'memories'

export function BabyScreen() {
  const { openQuickLog } = useNav()
  const [tab, setTab] = useState<BabyTab>('timeline')
  const { logs, hydrated, loadError } = useLogs()

  return (
    <Screen>
      <StatusBar />
      <Scroll className="px-5 pb-28">
        <Header onLog={() => openQuickLog()} />

        {loadError ? (
          <LoadFailed />
        ) : !hydrated ? (
          <LoadingBlock />
        ) : logs.length === 0 ? (
          <EmptyBaby onLog={() => openQuickLog()} />
        ) : (
          <>
            <RightNow />
            <Latest />
            <TodaySummary />
          </>
        )}

        {/* Deeper exploration is always available (even before any logs) so Memories
            and history are never hidden by an empty operational state. */}
        <section className="mt-6">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'timeline', label: 'Timeline' },
              { value: 'patterns', label: 'Patterns' },
              { value: 'memories', label: 'Memories' },
            ]}
          />
          <div className="mt-4">
            {tab === 'timeline' && <Timeline />}
            {tab === 'patterns' && <Patterns />}
            {tab === 'memories' && <MemoriesPreview />}
          </div>
        </section>
      </Scroll>

      <BottomNav active="baby" />
    </Screen>
  )
}

/* ── Header ───────────────────────────────────────────────────────────────────
 * Calm + compact: avatar, name, and a truthful day/age line. "Day N" only while the
 * baby is inside the first-90 journey; after that, the age label; nothing if there's
 * no birth date to compute from. A compact Log + sits on the right (contextual
 * convenience — opens the SAME Quick Log used by Capture). */
function Header({ onLog }: { onLog: () => void }) {
  const { profile } = useProfile()
  const name = profile?.babyName?.trim() || 'Baby'

  let dayline: string | null = null
  if (profile?.birthDate) {
    const st = firstNinetyState(profile.birthDate)
    dayline = st.withinJourney ? `Day ${dayNumber(profile.birthDate)}` : ageLabel(profile.birthDate)
  }

  return (
    <header className="flex items-center gap-3 pt-1">
      <span className="ring-2 ring-card rounded-full">
        <NameAvatar name={name} photo={profile?.photo} className="size-12 text-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="font-serif text-[23px] leading-tight font-semibold tracking-tight">{name}</h1>
        {dayline && <p className="text-[13.5px] text-muted-foreground">{dayline}</p>}
      </div>
      <button
        onClick={onLog}
        className="flex items-center gap-1.5 rounded-full bg-muted px-3.5 py-2 text-[13px] font-semibold text-foreground transition-transform active:scale-[0.98]"
      >
        <Plus className="size-4" strokeWidth={2.25} /> Log
      </button>
    </header>
  )
}

/* ── Right now ────────────────────────────────────────────────────────────────
 * The strongest surface. Two truths: (1) current activity — an active sleep with a
 * live elapsed timer, else the most recent activity as "last X · N ago" (we do NOT
 * assert "awake"); (2) care responsibility, from the care provider. Ticks each
 * minute so elapsed stays honest without a refresh. */
function RightNow() {
  const now = useNow(30_000)
  const { logs } = useLogs()
  const { openOverlay } = useNav()
  const { holderPersonId, pending, available, hydrated: careHydrated } = useCare()
  const { people, me } = useHousehold()

  const asleep = activeSleep(logs)
  const lastFeed = lastOfKind(logs, 'feed')

  // Current-activity line — only from real state.
  let statusIcon = <Moon className="size-5 text-blue" strokeWidth={2} />
  let statusText: string
  if (asleep) {
    statusText = `Sleeping · ${elapsed(asleep.createdAt, null, now)}`
  } else if (lastFeed) {
    statusIcon = <CategoryChip category="feed" size="sm" />
    statusText = `Last feed ${timeAgo(lastFeed.createdAt, now)}`
  } else {
    // There ARE logs (RightNow only renders when logs exist) but none are feed/sleep.
    const latest = logs[0]
    const { title } = describeLog(latest)
    statusText = `Last: ${title} · ${timeAgo(latest.createdAt, now)}`
  }

  // Care line — truthful holder / pending, never implied acceptance.
  const nameOf = (id: string | null): string => {
    if (!id) return 'No one yet'
    const p = people.find((x) => x.id === id)
    if (!p) return 'Someone'
    return me && p.id === me.id ? 'You' : p.displayName
  }
  let careText: string | null = null
  if (available && careHydrated) {
    if (pending) {
      careText = `Handoff pending → ${nameOf(pending.toPersonId)}`
    } else if (holderPersonId) {
      const who = nameOf(holderPersonId)
      careText = who === 'You' ? 'You have Baby' : `${who} has Baby`
    }
  }

  // Hand off is only meaningful when there's another connected adult to hand to.
  const eligibleOther = people.some(
    (p) => (!me || p.id !== me.id) && p.accountStatus === 'connected',
  )

  return (
    <section className="mt-4 rounded-2xl bg-muted/40 ring-1 ring-border/50">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center">{statusIcon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Right now</p>
          <p className="text-[16px] font-semibold leading-tight">{statusText}</p>
        </div>
      </div>

      {careText && (
        <>
          <div className="h-px bg-border/60" aria-hidden />
          <button
            onClick={() => openOverlay('careHandoff')}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-foreground/[0.03]"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage">
              <HandIcon className="size-[18px]" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Care</p>
              <p className="text-[15px] font-semibold leading-tight">{careText}</p>
            </div>
            {eligibleOther && !pending && (
              <span className="flex items-center gap-0.5 text-[13px] font-medium text-primary">
                Hand off <ChevronRight className="size-3.5" />
              </span>
            )}
            {(pending || !eligibleOther) && <ChevronRight className="size-4 text-muted-foreground/60" />}
          </button>
        </>
      )}
    </section>
  )
}

/* ── Latest ───────────────────────────────────────────────────────────────────
 * One row per relevant category that has data (feed / diaper / sleep) — not the last
 * three chronological rows (which could all be the same kind). Only fields the log
 * actually carries are shown. Categories with no data are simply omitted. */
function Latest() {
  const now = useNow(30_000)
  const { logs } = useLogs()

  const rows: { key: string; category: 'feed' | 'diaper' | 'sleep'; title: string; detail: string }[] = []

  const feed = lastOfKind(logs, 'feed')
  if (feed) {
    const bits = [feed.amount, feed.side ? `nursing (${feed.side})` : undefined].filter(Boolean)
    rows.push({
      key: 'feed',
      category: 'feed',
      title: 'Feed',
      detail: [bits.join(' · ') || null, timeAgo(feed.createdAt, now)].filter(Boolean).join(' · '),
    })
  }

  const diaper = lastOfKind(logs, 'diaper')
  if (diaper) {
    rows.push({
      key: 'diaper',
      category: 'diaper',
      title: 'Diaper',
      detail: [diaper.diaperType ?? null, timeAgo(diaper.createdAt, now)].filter(Boolean).join(' · '),
    })
  }

  const sleep = lastOfKind(logs, 'sleep')
  if (sleep) {
    const detail = sleep.endedAt
      ? `${elapsed(sleep.createdAt, sleep.endedAt)} · ended ${timeAgo(sleep.endedAt, now)}`
      : `in progress · ${elapsed(sleep.createdAt, null, now)}`
    rows.push({ key: 'sleep', category: 'sleep', title: 'Sleep', detail })
  }

  if (rows.length === 0) return null

  return (
    <section className="mt-6">
      <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
        Latest
      </p>
      <div className="overflow-hidden rounded-2xl ring-1 ring-border/50">
        {rows.map((r, i) => (
          <div key={r.key} className={`flex items-center gap-3 bg-card px-4 py-3 ${i > 0 ? 'border-t border-border/50' : ''}`}>
            <CategoryChip category={r.category} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-tight">{r.title}</p>
              <p className="truncate text-[13px] text-muted-foreground">{r.detail || '—'}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── Today summary ────────────────────────────────────────────────────────────
 * Truthful counts from today's logs only. Feed volume sums ONLY feeds that carry a
 * parseable oz amount (nursing feeds have none) and is labelled "oz bottle" so it is
 * never mistaken for total intake. Sleep total sums only completed sleeps that both
 * started and ended today (in-progress sleep has no duration yet). */
function parseOz(amount?: string): number | null {
  if (!amount) return null
  const m = /(\d+(?:\.\d+)?)\s*oz/i.exec(amount)
  return m ? Number(m[1]) : null
}

function TodaySummary() {
  const now = useNow(60_000)
  const { logs } = useLogs()

  const model = useMemo(() => {
    const today = logs.filter((l) => isSameDay(l.createdAt, now))
    const feeds = today.filter((l) => l.kind === 'feed')
    const diapers = today.filter((l) => l.kind === 'diaper')
    const sleeps = today.filter((l) => l.kind === 'sleep')

    // Bottle volume — only feeds with a real oz amount contribute.
    let bottleOz = 0
    let bottleCount = 0
    for (const f of feeds) {
      const oz = parseOz(f.amount)
      if (oz != null) {
        bottleOz += oz
        bottleCount++
      }
    }

    // Sleep total — completed sleeps only; use real start/end.
    let sleepMins = 0
    for (const s of sleeps) {
      if (s.endedAt) sleepMins += Math.max(0, Math.round((new Date(s.endedAt).getTime() - new Date(s.createdAt).getTime()) / 60_000))
    }
    const pumps = today.filter((l) => l.kind === 'pumping').length

    return { feeds: feeds.length, bottleOz, bottleCount, diapers: diapers.length, sleepMins, pumps }
  }, [logs, now])

  const sleepLabel = model.sleepMins > 0
    ? (model.sleepMins >= 60 ? `${Math.floor(model.sleepMins / 60)}h ${model.sleepMins % 60}m` : `${model.sleepMins}m`)
    : null

  // Build only truthful stat cells.
  const stats: { value: string; label: string }[] = []
  stats.push({ value: String(model.feeds), label: model.feeds === 1 ? 'feed' : 'feeds' })
  if (model.bottleCount > 0) {
    const oz = Number.isInteger(model.bottleOz) ? String(model.bottleOz) : model.bottleOz.toFixed(1)
    stats.push({ value: `${oz} oz`, label: 'bottle' })
  }
  stats.push({ value: String(model.diapers), label: model.diapers === 1 ? 'diaper' : 'diapers' })
  if (sleepLabel) stats.push({ value: sleepLabel, label: 'sleep' })
  if (model.pumps > 0) stats.push({ value: String(model.pumps), label: model.pumps === 1 ? 'pump' : 'pumps' })

  return (
    <section className="mt-6">
      <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
        Today
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {stats.map((s, i) => (
          <div key={i} className="rounded-2xl bg-muted/40 px-3.5 py-3 ring-1 ring-border/40">
            <p className="text-[19px] font-bold leading-none tracking-tight tabular-nums">{s.value}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── Timeline (chronological, today) ──────────────────────────────────────────
 * Reuses the same logs + describeLog. Compact list of today's activity, newest at
 * the top of a connected trail. Depth beyond today stays in the logs domain. */
function Timeline() {
  const now = useNow(30_000)
  const { logs } = useLogs()
  const today = useMemo(() => logs.filter((l) => isSameDay(l.createdAt, now)), [logs, now])

  if (today.length === 0) {
    return (
      <p className="rounded-2xl bg-muted/40 px-4 py-3 text-[13.5px] text-muted-foreground ring-1 ring-border/40">
        Nothing logged today yet.
      </p>
    )
  }

  return (
    <ol className="relative">
      {today.map((e, i) => {
        const { title, detail } = describeLog(e)
        const liveDetail = e.kind === 'sleep' && !e.endedAt ? `in progress · ${elapsed(e.createdAt, null, now)}` : detail
        return (
          <li key={e.id} className="relative flex gap-3.5 pb-4 last:pb-0">
            <div className="relative flex flex-col items-center">
              <CategoryChip category={e.kind} size="sm" />
              {i < today.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
            </div>
            <div className="pt-0.5">
              <p className="text-[12px] text-muted-foreground">{clockTime(e.createdAt)}</p>
              <p className="text-[14.5px] font-semibold leading-snug">
                {title}
                {liveDetail && <span className="font-normal text-muted-foreground"> · {liveDetail}</span>}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/* ── Patterns (honest observations) ───────────────────────────────────────────
 * ONLY facts the recorded data can support — counts + simple derived observations.
 * No medical interpretation, no "normal/abnormal", no scoring. */
function Patterns() {
  const now = useNow(60_000)
  const { logs } = useLogs()

  const facts = useMemo(() => {
    const out: { label: string; value: string }[] = []
    const today = logs.filter((l) => isSameDay(l.createdAt, now))
    const yesterday = logs.filter((l) => {
      const d = new Date(l.createdAt)
      const y = new Date(now); y.setDate(y.getDate() - 1)
      return d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate()
    })

    out.push({ label: 'Feeds today', value: String(today.filter((l) => l.kind === 'feed').length) })

    // Typical time between today's feeds (needs at least 2 feeds to be meaningful).
    const feedTimes = today.filter((l) => l.kind === 'feed').map((l) => new Date(l.createdAt).getTime()).sort((a, b) => a - b)
    if (feedTimes.length >= 2) {
      let gap = 0
      for (let i = 1; i < feedTimes.length; i++) gap += feedTimes[i] - feedTimes[i - 1]
      const avgMin = Math.round(gap / (feedTimes.length - 1) / 60_000)
      if (avgMin > 0) {
        const label = avgMin >= 60 ? `about every ${Math.floor(avgMin / 60)}h ${avgMin % 60}m` : `about every ${avgMin}m`
        out.push({ label: 'Feeding rhythm today', value: label })
      }
    }

    out.push({
      label: 'Diapers today vs. yesterday',
      value: `${today.filter((l) => l.kind === 'diaper').length} · ${yesterday.filter((l) => l.kind === 'diaper').length}`,
    })

    // Longest completed sleep in the last 7 days.
    const weekAgo = now.getTime() - 7 * 86_400_000
    let longest = 0
    for (const s of logs) {
      if (s.kind === 'sleep' && s.endedAt && new Date(s.createdAt).getTime() >= weekAgo) {
        longest = Math.max(longest, new Date(s.endedAt).getTime() - new Date(s.createdAt).getTime())
      }
    }
    if (longest > 0) {
      const mins = Math.round(longest / 60_000)
      out.push({ label: 'Longest sleep this week', value: mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m` })
    }

    return out
  }, [logs, now])

  return (
    <div className="space-y-3">
      <p className="px-1 text-[12.5px] leading-relaxed text-muted-foreground">
        Just the patterns in what you&apos;ve recorded — nothing to score.
      </p>
      <div className="overflow-hidden rounded-2xl ring-1 ring-border/50">
        {facts.map((f, i) => (
          <div key={f.label} className={`flex items-center justify-between bg-card px-4 py-3 ${i > 0 ? 'border-t border-border/50' : ''}`}>
            <span className="text-[14px] text-foreground">{f.label}</span>
            <span className="text-[14px] font-semibold tabular-nums">{f.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Memories (preview → canonical overlay) ───────────────────────────────────
 * Reuses the existing Memories provider + overlay. Shows only user-created memories;
 * never manufactures a memory from a log/photo. Opening routes to the canonical
 * Memories flow. */
function MemoriesPreview() {
  const { openOverlay } = useNav()
  const { memories, hydrated } = useMemories()

  if (!hydrated) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-muted/40 px-4 py-3 text-[13.5px] text-muted-foreground ring-1 ring-border/40">
        <Loader2 className="size-3.5 animate-spin" /> Loading memories…
      </p>
    )
  }

  if (memories.length === 0) {
    return (
      <button
        onClick={() => openOverlay('memories')}
        className="flex w-full items-center justify-between rounded-2xl bg-muted/40 px-4 py-3.5 text-left ring-1 ring-border/40 transition-colors active:bg-muted"
      >
        <span className="text-[13.5px] text-muted-foreground">
          Keep the little moments — first bath, first smile, meeting grandma.
        </span>
        <span className="ml-2 flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-primary">
          Add <Plus className="size-3.5" strokeWidth={2.25} />
        </span>
      </button>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {memories.slice(0, 6).map((m) => (
          <button
            key={m.id}
            onClick={() => openOverlay('memories')}
            className="relative aspect-square overflow-hidden rounded-xl ring-1 ring-border/50 transition-transform active:scale-[0.98]"
          >
            <Image src={m.photo} alt={m.caption || 'Memory'} fill sizes="120px" className="object-cover" />
          </button>
        ))}
      </div>
      <button
        onClick={() => openOverlay('memories')}
        className="mt-2 flex items-center gap-0.5 text-[13px] font-medium text-primary"
      >
        Open memories <ChevronRight className="size-3.5" />
      </button>
    </div>
  )
}

/* ── States: loading / failed / empty ─────────────────────────────────────────── */

function LoadingBlock() {
  return (
    <div className="mt-4 space-y-2" aria-busy="true">
      <span className="sr-only">Loading Baby…</span>
      {[0, 1].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted/50" />
      ))}
    </div>
  )
}

function LoadFailed() {
  return (
    <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-peach-soft/40 px-4 py-3.5 ring-1 ring-peach/30">
      <AlertCircle className="size-4 shrink-0 text-peach" strokeWidth={2} />
      <p className="text-[14px] text-foreground">Couldn&apos;t load Baby&apos;s activity right now.</p>
    </div>
  )
}

function EmptyBaby({ onLog }: { onLog: () => void }) {
  return (
    <div className="mt-4 rounded-2xl bg-muted/40 px-4 py-5 ring-1 ring-border/40">
      <p className="font-serif text-[17px] font-semibold">Nothing logged yet.</p>
      <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
        Log the first feed, diaper or sleep whenever you&apos;re ready — or use the + button anytime.
      </p>
      <button
        onClick={onLog}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-[14px] font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
      >
        <Plus className="size-4" strokeWidth={2.25} /> Log
      </button>
    </div>
  )
}
