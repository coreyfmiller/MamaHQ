'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, ImageIcon, Loader2, Send } from 'lucide-react'
import { useNav } from '../context'
import { useInbox } from '../inbox/store'
import { ocr } from '../inbox/ocr'
import { Screen, Scroll, StatusBar, TopBar } from '../ui'
import { downscaleImage } from '@/lib/utils'

type Phase = 'pick' | 'working' | 'review'

export function PhotoScreen() {
  const { closeOverlay, setTab, showToast } = useNav()
  const { addCapture } = useInbox()
  const fileRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<Phase>('pick')
  const [preview, setPreview] = useState<string | undefined>(undefined)
  const [progress, setProgress] = useState(0)
  const [text, setText] = useState('')
  const [failed, setFailed] = useState(false)

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setPhase('working')
    setProgress(0)
    setFailed(false)
    try {
      // Downscale first: smaller image = much faster OCR, and it's plenty for text.
      const dataUrl = await downscaleImage(file, 1400, 0.9)
      setPreview(dataUrl)
      const result = await ocr.recognize(dataUrl, setProgress)
      setText(result.text)
      setFailed(result.text.trim().length === 0)
    } catch {
      setFailed(true)
      setText('')
    } finally {
      setPhase('review')
    }
  }

  const send = async () => {
    const t = text.trim()
    if (!t) return
    await addCapture(t, 'photo')
    closeOverlay()
    setTab('inbox')
    showToast('Added to your Inbox to review')
  }

  /* ---------------- Review / edit extracted text ---------------- */
  if (phase === 'review') {
    return (
      <Screen>
        <StatusBar />
        <TopBar variant="close" title="From your photo" onBack={closeOverlay} />
        <Scroll className="flex flex-col px-6 pb-8">
          {preview && (
            <div className="relative mb-4 aspect-video w-full overflow-hidden rounded-2xl border border-border/60">
              <Image src={preview} alt="Captured" fill sizes="380px" className="object-contain" />
            </div>
          )}
          {failed && (
            <p className="mb-3 rounded-2xl bg-muted/60 px-4 py-3 text-[14px] text-muted-foreground">
              I couldn&apos;t read much text from that. You can type or fix it below, then MamaHQ will sort it.
            </p>
          )}
          <textarea
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="What does the photo say?"
            className="w-full resize-none rounded-2xl border border-border bg-card px-4 py-3.5 text-[16px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
          />
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-full bg-muted px-5 py-3.5 text-[15px] font-semibold text-foreground transition-transform active:scale-95"
            >
              <Camera className="size-4" strokeWidth={2} /> Retake
            </button>
            <button
              onClick={send}
              disabled={!text.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] transition-transform active:scale-[0.99] disabled:opacity-40"
            >
              <Send className="size-4" strokeWidth={2} /> Sort it out
            </button>
          </div>
        </Scroll>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPick} className="hidden" />
      </Screen>
    )
  }

  /* ---------------- Working: OCR in progress ---------------- */
  if (phase === 'working') {
    return (
      <Screen dark>
        <StatusBar dark />
        <TopBar variant="close" dark onBack={closeOverlay} />
        <div className="flex flex-1 flex-col items-center justify-center px-10 text-center">
          <Loader2 className="size-8 animate-spin text-white/80" />
          <p className="mt-5 font-serif text-[20px] text-white">Reading your photo…</p>
          <div className="mt-5 h-1.5 w-48 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="mt-3 text-[13px] text-white/60">First read takes a moment while it warms up.</p>
        </div>
      </Screen>
    )
  }

  /* ---------------- Pick / take a photo ---------------- */
  return (
    <Screen dark>
      <StatusBar dark />
      <TopBar variant="close" dark onBack={closeOverlay} />
      <div className="flex flex-1 flex-col items-center justify-center px-10 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-white/10 text-white">
          <Camera className="size-8" strokeWidth={1.5} />
        </span>
        <h1 className="mt-6 text-balance font-serif text-[24px] leading-snug font-medium text-white">
          Snap a note, label or appointment card.
        </h1>
        <p className="mt-2 max-w-[16rem] text-[15px] leading-relaxed text-white/70">
          MamaHQ will read the text and turn it into things you can approve.
        </p>
        <button
          onClick={() => fileRef.current?.click()}
          className="mt-8 flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[15px] font-semibold text-foreground transition-transform active:scale-95"
        >
          <Camera className="size-5" strokeWidth={2} /> Take or choose a photo
        </button>
        <span className="mt-3 flex items-center gap-1.5 text-[13px] text-white/50">
          <ImageIcon className="size-4" /> Works with your camera or photo library
        </span>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPick} className="hidden" />
    </Screen>
  )
}
