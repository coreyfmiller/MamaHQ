'use client'

import { useState } from 'react'
import { Inbox as InboxIcon, Sparkles, Send, Mic, Camera } from 'lucide-react'
import { useNav } from '../context'
import { CategoryChip } from '../event-meta'
import { BottomNav, CheckBox, Screen, Scroll, Segmented, StatusBar } from '../ui'
import type { Category } from '@/lib/mama-data'
import { useInbox, type Capture } from '../inbox/store'
import { useCommit } from '../inbox/commit'
import { shortTime } from '../appointments'
import type { ProposedItem } from '../inbox/types'

type InboxTab = 'review' | 'added'

// Map a proposal to a category chip so items read consistently with the rest of the app.
function chipCategory(item: ProposedItem): Category {
  if (item.kind === 'log') return item.log?.logKind ?? 'note'
  if (item.kind === 'appointment') return 'appointment'
  if (item.kind === 'task') return 'task'
  if (item.kind === 'question') return 'note'
  return 'note'
}

function detailText(item: ProposedItem): string | undefined {
  if (item.kind === 'log' && item.log?.whenISO) return `~${shortTime(item.log.whenISO)}`
  if (item.kind === 'appointment') return item.appointment ? new Date(item.appointment.whenISO).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : undefined
  return undefined
}

export function InboxScreen() {
  const { openOverlay } = useNav()
  const { captures, addCapture, toggleItem, editItem, dismissCapture } = useInbox()
  const { commitCapture } = useCommit()
  const [tab, setTab] = useState<InboxTab>('review')
  const [draft, setDraft] = useState('')

  const toReview = captures.filter((c) => c.status === 'proposed')
  const added = captures.filter((c) => c.status === 'committed')

  const submit = async () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    await addCapture(text, 'type')
    setTab('review')
  }

  return (
    <Screen>
      <StatusBar />
      <Scroll className="space-y-4 px-6 pb-4">
        <h1 className="pt-1 font-serif text-[26px] font-semibold tracking-tight">Inbox</h1>

        {/* Composer: type a brain dump; or hand off to voice/photo (same pipeline). */}
        <div className="rounded-2xl border border-border bg-card p-3 focus-within:border-primary">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
            }}
            rows={2}
            placeholder="What's on your mind? e.g. She had 4oz around 2, wet diaper, we're low on formula, remind me about the doctor Thursday"
            className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60"
          />
          <div className="mt-1 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={() => openOverlay('voice')}
                aria-label="Speak instead"
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted"
              >
                <Mic className="size-[19px]" strokeWidth={1.75} />
              </button>
              <button
                onClick={() => openOverlay('photo')}
                aria-label="Photograph instead"
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted"
              >
                <Camera className="size-[19px]" strokeWidth={1.75} />
              </button>
            </div>
            <button
              onClick={submit}
              disabled={!draft.trim()}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[14px] font-semibold text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
            >
              <Send className="size-4" strokeWidth={2} /> Sort it out
            </button>
          </div>
        </div>

        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'review', label: 'To review', badge: toReview.length || undefined },
            { value: 'added', label: 'Added' },
          ]}
        />

        {tab === 'review' &&
          (toReview.length === 0 ? (
            <EmptyReview />
          ) : (
            <div className="space-y-4">
              {toReview.map((c) => (
                <ReviewCard
                  key={c.id}
                  capture={c}
                  onToggle={(itemId) => toggleItem(c.id, itemId)}
                  onEdit={(itemId, patch) => editItem(c.id, itemId, patch)}
                  onAddAll={() => commitCapture(c)}
                  onDismiss={() => dismissCapture(c.id)}
                />
              ))}
            </div>
          ))}

        {tab === 'added' &&
          (added.length === 0 ? (
            <p className="pt-4 text-center text-[14px] text-muted-foreground">Nothing added yet.</p>
          ) : (
            <div className="space-y-2.5">
              {added.map((c) => (
                <div key={c.id} className="rounded-2xl border border-border/60 bg-card/70 p-3.5">
                  <p className="text-[13px] text-muted-foreground">
                    {new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ·{' '}
                    {c.items.filter((i) => i.include).length} added
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[14px] text-foreground/80">{c.rawText}</p>
                </div>
              ))}
            </div>
          ))}
      </Scroll>

      <BottomNav active="inbox" />
    </Screen>
  )
}

function EmptyReview() {
  return (
    <div className="mt-10 flex flex-col items-center text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-sage-soft text-sage">
        <InboxIcon className="size-7" strokeWidth={1.5} />
      </span>
      <h2 className="mt-5 font-serif text-[22px] font-medium">Nothing waiting for you.</h2>
      <p className="mt-2 max-w-[16rem] text-[15px] leading-relaxed text-muted-foreground">
        Dump anything above whenever your brain gets full — MamaHQ will sort it into things you can approve.
      </p>
    </div>
  )
}

function ReviewCard({
  capture,
  onToggle,
  onEdit,
  onAddAll,
  onDismiss,
}: {
  capture: Capture
  onToggle: (itemId: string) => void
  onEdit: (itemId: string, patch: Partial<ProposedItem>) => void
  onAddAll: () => void
  onDismiss: () => void
}) {
  const includedCount = capture.items.filter((i) => i.include).length

  return (
    <div className="rounded-3xl border border-border/70 bg-card p-4 shadow-sm">
      {/* The raw dump, for context */}
      <p className="text-[14px] leading-relaxed text-foreground/80">{capture.rawText}</p>

      <div className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-sage">
        <Sparkles className="size-4" strokeWidth={1.75} />
        I found {capture.items.length} thing{capture.items.length === 1 ? '' : 's'}
      </div>

      <div className="mt-2 space-y-2">
        {capture.items.map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${
              item.include ? 'border-border/70 bg-card' : 'border-border/40 bg-muted/40 opacity-60'
            }`}
          >
            <CategoryChip category={chipCategory(item)} />
            <div className="min-w-0 flex-1">
              <input
                value={item.label}
                onChange={(e) => onEdit(item.id, { label: e.target.value })}
                className="w-full bg-transparent text-[15px] font-semibold leading-tight text-foreground outline-none"
              />
              {detailText(item) && <p className="text-[12px] text-muted-foreground">{detailText(item)}</p>}
            </div>
            <button onClick={() => onToggle(item.id)} aria-label="Include this item">
              <CheckBox checked={item.include} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={onDismiss}
          className="rounded-full bg-muted px-4 py-2.5 text-[14px] font-semibold text-foreground transition-transform active:scale-95"
        >
          Dismiss
        </button>
        <button
          onClick={onAddAll}
          disabled={includedCount === 0}
          className="flex-1 rounded-full bg-primary py-2.5 text-[14px] font-semibold text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
        >
          Add {includedCount} to my day
        </button>
      </div>
    </div>
  )
}
