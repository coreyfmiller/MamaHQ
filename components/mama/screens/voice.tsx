'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Mic, Square, Send } from 'lucide-react'
import { useNav } from '../context'
import { useInbox } from '../inbox/store'
import { transcriber, type TranscribeError, type TranscribeHandle } from '../inbox/transcribe'
import { Screen, StatusBar, TopBar } from '../ui'

const bars = [14, 26, 40, 22, 34, 48, 30, 18, 38, 24, 44, 20, 30, 16]

type Phase = 'listening' | 'review' | 'unsupported'

export function VoiceScreen() {
  const { closeOverlay, setTab, showToast } = useNav()
  const { addCapture } = useInbox()

  const supported = transcriber.isSupported()
  const [phase, setPhase] = useState<Phase>(supported ? 'listening' : 'unsupported')
  // The transcriber owns accumulation and always hands us the full transcript,
  // so we just store what it gives us — no appending, no duplication.
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<TranscribeError | null>(null)
  const handleRef = useRef<TranscribeHandle | null>(null)

  // Start/stop the transcriber with the listening phase.
  useEffect(() => {
    if (phase !== 'listening') return
    setError(null)
    const handle = transcriber.start({
      onTranscript: (fullText) => setTranscript(fullText),
      onError: (kind) => {
        setError(kind)
        // A blocked mic or fatal error can't recover by waiting — drop straight to
        // the text fallback so the user is never stuck on a silent listening screen.
        // ('no-speech' is transient and handled by the transcriber, so ignore it here.)
        if (kind === 'not-allowed' || kind === 'unavailable' || kind === 'unknown') {
          setPhase('review')
        }
      },
      onEnd: () => {
        // Recognition truly stopped (after any auto-restart). Move to review.
        setPhase((p) => (p === 'listening' ? 'review' : p))
      },
    })
    handleRef.current = handle
    return () => handle.stop()
  }, [phase])

  const stopListening = () => {
    handleRef.current?.stop()
    setPhase('review')
  }

  const send = async (text: string) => {
    const t = text.trim()
    if (!t) return
    await addCapture(t, 'voice')
    closeOverlay()
    setTab('tell')
    showToast('Saved to review')
  }

  /* ---------------- Review / edit the transcript ---------------- */
  if (phase === 'review' || phase === 'unsupported') {
    return (
      <Screen>
        <StatusBar />
        <TopBar variant="close" title="What you said" onBack={closeOverlay} />
        <div className="flex flex-1 flex-col px-6 pb-8">
          {phase === 'unsupported' && (
            <p className="mb-3 rounded-2xl bg-muted/60 px-4 py-3 text-[14px] text-muted-foreground">
              Voice isn&apos;t available in this browser — type your thoughts instead and MamaHQ will sort them.
            </p>
          )}
          {error === 'not-allowed' && (
            <p className="mb-3 rounded-2xl bg-muted/60 px-4 py-3 text-[14px] text-muted-foreground">
              Microphone access was blocked. Allow the mic in your browser&apos;s site settings, or
              type it here instead.
            </p>
          )}
          {(error === 'unknown' || error === 'unavailable') && phase === 'review' && (
            <p className="mb-3 rounded-2xl bg-muted/60 px-4 py-3 text-[14px] text-muted-foreground">
              Voice recognition couldn&apos;t start (this needs Chrome, Edge or Safari, and a secure
              connection). You can type it here instead.
            </p>
          )}
          <TranscriptEditor initial={transcript} onSend={send} onRetry={supported ? () => { setTranscript(''); setPhase('listening') } : undefined} />
        </div>
      </Screen>
    )
  }

  /* ---------------- Listening ---------------- */
  return (
    <Screen dark className="relative">
      <Image src="/images/voice-bg.png" alt="" fill sizes="400px" className="object-cover opacity-45" aria-hidden="true" />
      <div className="absolute inset-0 bg-foreground/70" aria-hidden="true" />

      <div className="relative flex h-full flex-col">
        <StatusBar dark />
        <TopBar variant="close" dark onBack={closeOverlay} />

        <div className="flex flex-1 flex-col items-center justify-center px-10 text-center">
          {transcript ? (
            <p className="max-h-40 overflow-y-auto text-balance font-serif text-[20px] leading-snug text-white">
              {transcript}
            </p>
          ) : (
            <h1 className="text-balance font-serif text-[26px] leading-snug font-medium text-white">
              Tell MamaHQ what&apos;s on your mind.
            </h1>
          )}

          <div className="mt-10 flex h-14 items-center justify-center gap-1.5">
            {bars.map((h, i) => (
              <span
                key={i}
                className="mama-wave-bar w-1.5 rounded-full bg-white/70"
                style={{ height: h, animationDelay: `${i * 90}ms` }}
              />
            ))}
          </div>

          <p className="mt-8 text-[15px] font-medium tracking-wide text-white/70">
            {error === 'no-speech' ? 'Didn\u2019t catch that\u2026 keep going' : 'Listening\u2026'}
          </p>
        </div>

        <div className="relative flex flex-col items-center gap-5 pb-12">
          <button
            onClick={stopListening}
            aria-label="Stop and review"
            className="flex size-20 items-center justify-center rounded-full bg-white text-foreground shadow-[0_0_0_10px_rgba(255,255,255,0.12)] transition-transform active:scale-95"
          >
            <Square className="size-7 fill-current" strokeWidth={0} />
          </button>
          <button onClick={closeOverlay} className="text-[15px] font-medium text-white/75">
            Cancel
          </button>
        </div>
      </div>
    </Screen>
  )
}

// Editable transcript before it becomes a capture — voice is rarely perfect.
function TranscriptEditor({
  initial,
  onSend,
  onRetry,
}: {
  initial: string
  onSend: (text: string) => void
  onRetry?: () => void
}) {
  const [text, setText] = useState(initial)

  return (
    <div className="flex flex-1 flex-col">
      <textarea
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="What's on your mind?"
        className="w-full flex-1 resize-none rounded-2xl border border-border bg-card px-4 py-3.5 text-[16px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
      />
      <div className="mt-4 flex gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 rounded-full bg-muted px-5 py-3.5 text-[15px] font-semibold text-foreground transition-transform active:scale-95"
          >
            <Mic className="size-4" strokeWidth={2} /> Redo
          </button>
        )}
        <button
          onClick={() => onSend(text)}
          disabled={!text.trim()}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] transition-transform active:scale-[0.99] disabled:opacity-40"
        >
          <Send className="size-4" strokeWidth={2} /> Sort it out
        </button>
      </div>
    </div>
  )
}
