'use client'

// Transcription capability seam. Voice is just another way to produce the raw
// text the extractor consumes — so speech-to-text lives behind a swappable
// provider, exactly like the Extractor. Today: the browser's Web Speech API
// (free, on-device-ish, zero backend). Later: a server STT provider (Whisper /
// Gemini) implementing the same interface, with no change to the Voice screen.

export interface TranscribeHandle {
  stop: () => void
}

export interface Transcriber {
  /** Whether this provider can run in the current environment. */
  isSupported: () => boolean
  /**
   * Begin transcribing. The provider owns accumulation and always emits the FULL
   * transcript so far — `onTranscript(fullText, isFinal)` — so callers never
   * append (which is what caused duplication on mobile, where the API re-emits
   * finalized results). `onError` reports permission/no-speech/etc. `onEnd` fires
   * only when recognition has truly stopped (after any auto-restart). Returns a
   * handle to stop.
   */
  start: (cbs: {
    onTranscript?: (fullText: string, isFinal: boolean) => void
    onError?: (kind: TranscribeError) => void
    onEnd?: () => void
  }) => TranscribeHandle
}

export type TranscribeError = 'not-allowed' | 'no-speech' | 'unavailable' | 'unknown'

/* ---------------- Minimal Web Speech typings (not in TS DOM lib) ---------------- */

interface SpeechRecognitionAlternativeLike {
  transcript: string
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike
  isFinal: boolean
  length: number
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: { length: number; [index: number]: SpeechRecognitionResultLike }
}
interface SpeechRecognitionErrorEventLike {
  error: string
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/* ---------------- Web Speech provider ---------------- */

export const webSpeechTranscriber: Transcriber = {
  isSupported: () => getCtor() !== null,

  start({ onTranscript, onError, onEnd }) {
    const Ctor = getCtor()
    if (!Ctor) {
      onError?.('unavailable')
      onEnd?.()
      return { stop: () => {} }
    }

    // The user's intent to keep listening. Only a real stop() (or a fatal error)
    // clears it; a natural pause that ends recognition triggers an auto-restart.
    let listening = true
    // Committed, finalized text across restarts. We accumulate here and always
    // emit the WHOLE transcript, so the caller never appends and can't duplicate.
    let committed = ''
    // Text carried over from sessions before the current one (across restarts).
    let committedBeforeSession = ''
    let rec: SpeechRecognitionLike | null = null

    const emit = (isFinal: boolean, interim = '') => {
      const full = [committed, interim].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
      onTranscript?.(full, isFinal)
    }

    const build = () => {
      const r = new Ctor()
      r.lang = typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US'
      r.continuous = true
      r.interimResults = true

      r.onresult = (e) => {
        // Rebuild from the full results list each event (don't trust resultIndex
        // across mobile re-emits). Finalized results extend `committed`; interim
        // results are shown live but not yet committed.
        let finalizedThisSession = ''
        let interim = ''
        for (let i = 0; i < e.results.length; i += 1) {
          const result = e.results[i]
          const text = result[0]?.transcript ?? ''
          if (result.isFinal) finalizedThisSession += ` ${text}`
          else interim += ` ${text}`
        }
        // `committed` holds text from PRIOR sessions (before a restart). Within
        // this session, finalizedThisSession is the authoritative finalized text.
        const sessionFinal = finalizedThisSession.trim()
        const base = [committedBeforeSession, sessionFinal].filter(Boolean).join(' ')
        committed = base.replace(/\s+/g, ' ').trim()
        emit(false, interim.trim())
      }

      r.onerror = (e) => {
        const kind: TranscribeError =
          e.error === 'not-allowed' || e.error === 'service-not-allowed'
            ? 'not-allowed'
            : e.error === 'no-speech'
              ? 'no-speech'
              : 'unknown'
        // 'no-speech' is transient (a quiet pause) — keep the session alive.
        if (kind === 'no-speech') {
          onError?.(kind)
          return
        }
        listening = false
        onError?.(kind)
      }

      r.onend = () => {
        if (listening) {
          // Recognition auto-ended (mobile ignores `continuous` after a pause).
          // Fold this session's finalized text into the running total and restart
          // so the user can keep talking without it "quickly stopping".
          committedBeforeSession = committed
          try {
            r.start()
          } catch {
            // If immediate restart fails, end for real.
            listening = false
            emit(true)
            onEnd?.()
          }
        } else {
          emit(true)
          onEnd?.()
        }
      }

      return r
    }

    rec = build()
    try {
      rec.start()
    } catch {
      onError?.('unknown')
      onEnd?.()
    }

    return {
      stop: () => {
        listening = false
        try {
          rec?.stop()
        } catch {
          // ignore
        }
      },
    }
  },
}

// The active transcription provider. Swapping to a server STT provider later is
// a one-line change here — the Voice screen never needs to know.
export const transcriber: Transcriber = webSpeechTranscriber
