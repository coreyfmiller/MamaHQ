'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronRight, Hand as HandIcon, Plus } from 'lucide-react'
import { useNav } from '../context'
import { useProfile, ageLabel } from '../profile'
import { useLogs, lastOfKind, describeLog, clockTime, isSameDay } from '../logs'
import { useHousehold } from '../household'
import { useCare } from '../care'
import { useMemories } from '../memories'
import { NameAvatar } from '../name-avatar'
import { CategoryChip } from '../event-meta'
import { BottomNav, Card, Screen, Scroll, Segmented, StatusBar } from '../ui'
import { baby } from '@/lib/mama-data'

type BabyTab = 'timeline' | 'patterns' | 'memories'

function Header() {
  const { profile } = useProfile()
  const name = profile?.babyName ?? baby.name
  const age = profile ? ageLabel(profile.birthDate) : baby.age
  return (
    <header className="flex items-center gap-3 px-6 pt-1">
      <span className="ring-2 ring-card rounded-full">
        <NameAvatar name={name} photo={profile?.photo} className="size-14 text-[20px]" />
      </span>
      <div className="flex-1">
        <h1 className="font-serif text-[24px] leading-tight font-semibold tracking-tight">{name}</h1>
        <p className="text-[14px] text-muted-foreground">{age}</p>
      </div>
    </header>
  )
}

// Step 9 — a compact "who has the baby" card + entry into the care-handoff surface.
// Deterministic + minimal; does not redesign Baby/Care.
function CareHolderCard() {
  const { openOverlay } = useNav()
  const { available, holderPersonId, pending } = useCare()
  const { people, me } = useHousehold()
  if (!available) return null

  const name = (id: string | null): string => {
    if (!id) return 'No one yet'
    const p = people.find((x) => x.id === id)
    if (!p) return 'Someone'
    return me && p.id === me.id ? 'You' : p.displayName
  }

  return (
    <Card onClick={() => openOverlay('careHandoff')} className="flex items-center gap-3.5">
      <span className="flex size-10 items-center justify-center rounded-full bg-sage-soft">
        <HandIcon className="size-5 text-sage" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold tracking-wide text-muted-foreground">Care right now</p>
        <p className="text-[15px] font-semibold leading-tight">
          {pending ? `Handoff pending → ${name(pending.toPersonId)}` : `${name(holderPersonId)} ${holderPersonId ? 'has the baby' : ''}`.trim()}
        </p>
      </div>
      <ChevronRight className="size-4 text-muted-foreground" />
    </Card>
  )
}

function Timeline() {
  const { logs } = useLogs()
  const today = logs.filter((l) => isSameDay(l.createdAt))

  if (today.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 px-5 py-8 text-center">
        <p className="font-serif text-[17px] font-medium">Nothing logged today yet.</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Use the capture button to log a feed, sleep or diaper.
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="mb-3 font-serif text-[18px] font-medium">Today</p>
      <ol className="relative">
        {today.map((e, i) => {
          const { title, detail } = describeLog(e)
          return (
            <li key={e.id} className="relative flex gap-4 pb-5 last:pb-0">
              <div className="relative flex flex-col items-center">
                <CategoryChip category={e.kind} size="sm" />
                {i < today.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
              </div>
              <div className="pt-0.5">
                <p className="text-[12px] text-muted-foreground">{clockTime(e.createdAt)}</p>
                <p className="text-[15px] font-semibold leading-snug">
                  {title}
                  {detail && <span className="font-normal text-muted-foreground"> &middot; {detail}</span>}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Patterns() {
  const { logs } = useLogs()
  const today = logs.filter((l) => isSameDay(l.createdAt))
  const count = (kind: string) => today.filter((l) => l.kind === kind).length
  const lastFeed = lastOfKind(logs, 'feed')

  const facts = [
    { label: 'Feeds logged today', value: String(count('feed')) },
    { label: 'Diapers today', value: String(count('diaper')) },
    { label: 'Sleeps recorded today', value: String(count('sleep')) },
    { label: 'Last feed', value: lastFeed ? clockTime(lastFeed.createdAt) : '—' },
  ]
  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Just the facts you&apos;ve recorded. Nothing to score.
      </p>
      <Card className="divide-y divide-border/60 p-0">
        {facts.map((f) => (
          <div key={f.label} className="flex items-center justify-between px-5 py-3.5">
            <span className="text-[15px]">{f.label}</span>
            <span className="text-[15px] font-semibold tabular-nums">{f.value}</span>
          </div>
        ))}
      </Card>
    </div>
  )
}

function Memories() {
  const { openOverlay } = useNav()
  const { memories } = useMemories()
  return (
    <div className="grid grid-cols-2 gap-3">
      {memories.map((m) => (
        <button
          key={m.id}
          onClick={() => openOverlay('memories')}
          className="overflow-hidden rounded-2xl border border-border/70 bg-card text-left shadow-sm transition-transform active:scale-[0.98]"
        >
          <span className="relative block aspect-square w-full">
            <Image src={m.photo} alt={m.caption || 'Memory'} fill sizes="180px" className="object-cover" />
          </span>
          {m.caption && <span className="block px-3 py-2 text-[13px] font-medium">{m.caption}</span>}
        </button>
      ))}
      <button
        onClick={() => openOverlay('memories')}
        className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 text-muted-foreground transition-colors active:bg-muted"
      >
        <Plus className="size-6" strokeWidth={1.75} />
        <span className="text-[13px] font-medium">Add a memory</span>
      </button>
    </div>
  )
}

export function BabyScreen() {
  const { openOverlay } = useNav()
  const [tab, setTab] = useState<BabyTab>('timeline')

  return (
    <Screen>
      <StatusBar />
      <Scroll className="space-y-5 px-6 pb-4">
        <Header />
        <CareHolderCard />
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'timeline', label: 'Timeline' },
            { value: 'patterns', label: 'Patterns' },
            { value: 'memories', label: 'Memories' },
          ]}
        />
        {tab === 'timeline' && <Timeline />}
        {tab === 'patterns' && <Patterns />}
        {tab === 'memories' && <Memories />}
      </Scroll>

      <div className="bg-gradient-to-t from-background via-background to-transparent px-6 pt-2">
        <button
          onClick={() => openOverlay('quicklog')}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 text-[16px] font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] transition-transform active:scale-[0.99]"
        >
          <Plus className="size-5" strokeWidth={2} /> Log something
        </button>
        <div className="mt-2">
          <BottomNav active="baby" />
        </div>
      </div>
    </Screen>
  )
}
