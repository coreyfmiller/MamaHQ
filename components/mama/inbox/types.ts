// The Inbox pipeline contracts. These types are the stable seam the whole
// Capture → Review → Commit flow is built against. Sources (type/voice/photo/
// gmail) all funnel into an Extractor that returns ProposedItem[]; the review
// queue and commit logic only ever touch ProposedItem + the real stores. Swapping
// the local rule-based extractor for a Gemini-backed one changes nothing here.

import type { LogKind } from '../logs'

/** Where a capture originated. New sources (gmail, …) extend this. */
export type CaptureSourceKind = 'type' | 'voice' | 'photo' | 'gmail'

/** The kinds of structured items the app can extract from raw input. */
export type ProposedKind =
  | 'log' // a baby log (feed/sleep/diaper/pumping/medication)
  | 'appointment' // a scheduled appointment
  | 'task' // a mom to-do
  | 'question' // a question for the doctor
  | 'note' // freeform, nothing structured matched

/**
 * A single structured proposal awaiting the user's approval. Fields are editable
 * in the review UI. `include` drives whether it gets committed. `confidence` lets
 * the UI (and future AI extractors) express uncertainty without blocking.
 */
export interface ProposedItem {
  id: string
  kind: ProposedKind
  /** Short human label shown in the review list, e.g. "Feed · 4 oz". */
  label: string
  /** Whether the user has this checked for commit (default true). */
  include: boolean
  confidence: 'high' | 'medium' | 'low'

  // --- kind-specific payloads (only the relevant one is set) ---

  /** kind === 'log' */
  log?: {
    logKind: LogKind
    amount?: string
    diaperType?: 'wet' | 'dirty' | 'mixed'
    /** ISO; when the event happened, if the text implied a time. */
    whenISO?: string
  }

  /** kind === 'appointment' */
  appointment?: {
    title: string
    whenISO: string
    location?: string
  }

  /** kind === 'task' | 'question' | 'note' */
  text?: string
}

/**
 * The Extractor seam. Given raw text (voice→transcript, photo→OCR, and gmail all
 * reduce to text), return proposed structured items. Implementations:
 *   - LocalExtractor (rule-based, now)
 *   - GeminiExtractor (LLM-backed, later) — same signature, behind a backend.
 * May be async so a remote implementation drops in without changing callers.
 */
export interface Extractor {
  extract(rawText: string): ProposedItem[] | Promise<ProposedItem[]>
}
