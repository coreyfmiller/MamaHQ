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
   * Begin transcribing. `onInterim` streams the in-progress guess; `onFinal`
   * fires with confirmed text chunks; `onError` reports permission/no-speech/etc.
   * `onEnd` fires when recognition stops (for any reason). Returns a handle to stop.
   */
  start: (cbs: {
    onInterim?: (text: string) => void
    onFinal?: (text: string) => void
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

  start({ onInterim, onFinal, onError, onEnd }) {
    const Ctor = getCtor()
    if (!Ctor) {
      onError?.('unavailable')
      onEnd?.()
      return { stop: () => {} }
    }

    const rec = new Ctor()
    rec.lang = typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US'
    rec.continuous = true
    rec.interimResults = true

    let stopped = false

    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const result = e.results[i]
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) onFinal?.(text.trim())
        else interim += text
      }
      if (interim) onInterim?.(interim.trim())
    }

    rec.onerror = (e) => {
      const kind: TranscribeError =
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'not-allowed'
          : e.error === 'no-speech'
            ? 'no-speech'
            : 'unknown'
      onError?.(kind)
    }

    rec.onend = () => {
      if (!stopped) {
        // Some browsers auto-stop after a pause; surface it as an end so the UI
        // can reflect "stopped" rather than hang in a listening state.
        stopped = true
      }
      onEnd?.()
    }

    try {
      rec.start()
    } catch {
      onError?.('unknown')
      onEnd?.()
    }

    return {
      stop: () => {
        stopped = true
        try {
          rec.stop()
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
