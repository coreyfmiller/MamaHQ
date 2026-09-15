'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Heart, Plus, Trash2, ImagePlus, X } from 'lucide-react'
import { useNav } from '../context'
import { useMemories } from '../memories'
import { Scroll, StatusBar, TopBar } from '../ui'
import { downscaleImage } from '@/lib/utils'

export function MemoriesScreen() {
  const { closeOverlay, showToast } = useNav()
  const { memories, addMemory, removeMemory } = useMemories()
  const [adding, setAdding] = useState(false)

  return (
    <div className="flex h-full flex-col bg-blush-soft/40">
      <StatusBar />
      <TopBar
        title="Memories"
        onBack={closeOverlay}
        right={
          memories.length > 0 ? (
            <button
              onClick={() => setAdding(true)}
              aria-label="Add a memory"
              className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
            >
              <Plus className="size-5" strokeWidth={2} />
            </button>
          ) : undefined
        }
      />

      <Scroll className="px-6 pb-8">
        {memories.length === 0 ? (
          <EmptyState onAdd={() => setAdding(true)} />
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-3">
            {memories.map((m) => (
              <div
                key={m.id}
                className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
              >
                <span className="relative block aspect-square w-full">
                  <Image src={m.photo} alt={m.caption || 'Memory'} fill sizes="180px" className="object-cover" />
                </span>
                {m.caption && <span className="block px-3 py-2 text-[13px] font-medium">{m.caption}</span>}
                <button
                  onClick={() => removeMemory(m.id)}
                  aria-label="Delete memory"
                  className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-foreground/45 text-white backdrop-blur transition-colors active:bg-destructive"
                >
                  <Trash2 className="size-4" strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Scroll>

      {adding && (
        <AddMemory
          onClose={() => setAdding(false)}
          onSave={(photo, caption) => {
            addMemory(photo, caption)
            setAdding(false)
            showToast('Saved to Memories')
          }}
        />
      )}
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-10 flex flex-col items-center text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-blush-soft text-blush">
        <Heart className="size-7 fill-blush/30" strokeWidth={1.5} />
      </span>
      <h1 className="mt-5 text-balance font-serif text-[24px] leading-tight font-semibold tracking-tight">
        The little moments matter.
      </h1>
      <p className="mx-auto mt-2 max-w-[16rem] text-[15px] leading-relaxed text-muted-foreground">
        Capture the moments you never want to forget.
      </p>
      <button
        onClick={onAdd}
        className="mt-6 flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] transition-transform active:scale-[0.99]"
      >
        <Plus className="size-5" strokeWidth={2} /> Add a memory
      </button>
    </div>
  )
}

// Bottom-sheet-style composer: pick a photo (required), add an optional caption.
function AddMemory({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (photo: string, caption: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<string | undefined>(undefined)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    // Memories are the point here, so allow a bit more detail than the tiny avatar.
    downscaleImage(file, 640, 0.82)
      .then(setPhoto)
      .catch(() => setPhoto(undefined))
      .finally(() => setBusy(false))
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-foreground/40 backdrop-blur-[1px]" />
      <div className="relative rounded-t-[2rem] border-t border-border/60 bg-card px-5 pt-3 pb-9 shadow-[0_-12px_40px_-16px_rgba(38,50,56,0.35)]">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-[20px] font-semibold">Add a memory</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground">
            <X className="size-5" />
          </button>
        </div>

        <button
          onClick={() => fileRef.current?.click()}
          className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-muted/40 transition-colors active:bg-muted"
        >
          {photo ? (
            <Image src={photo} alt="Selected memory" fill sizes="360px" className="object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImagePlus className="size-8" strokeWidth={1.5} />
              <span className="text-[14px] font-medium">{busy ? 'Loading…' : 'Choose a photo'}</span>
            </span>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
        {photo && (
          <button onClick={() => fileRef.current?.click()} className="mt-2 text-[13px] font-medium text-primary">
            Choose a different photo
          </button>
        )}

        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption (optional)"
          className="mt-4 w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-[16px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
        />

        <button
          onClick={() => photo && onSave(photo, caption)}
          disabled={!photo}
          className="mt-4 w-full rounded-full bg-primary py-4 text-[16px] font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] transition-transform active:scale-[0.99] disabled:opacity-40"
        >
          Save to Memories
        </button>
      </div>
    </div>
  )
}
