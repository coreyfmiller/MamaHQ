// MamaHQ — Tell MamaHQ interpreter interface (Step 12).
//
// The product/domain layer depends ONLY on this interface, never on a concrete
// model provider. Today the concrete adapter is OpenAI (see openai-adapter.ts), but
// swapping providers must not touch the contract, the resolver, the route, or the
// UI. This mirrors the Inbox `Extractor` seam already in the codebase.
//
//   product/domain → Interpreter interface → OpenAI adapter (swappable)

import type { RawInterpretation } from './contract.ts'

// The MINIMUM household context the interpreter needs. Data minimization is a
// hard rule: no secrets, no tokens, no emails/phones, no history — only what is
// needed to interpret language into structured intent.
export interface InterpreterContext {
  // The user's local "now" so relative dates ("tomorrow", "Thursday") resolve
  // against the correct day. ISO string in the user's local wall-clock sense plus
  // a stable date-only key.
  nowISO: string
  todayDate: string // 'YYYY-MM-DD' local
  // The people the model may reference, by display name only. The `isMe` flag marks
  // the person linked to the current account so "me" resolves correctly. No ids are
  // sent (the model references people by name; ids are resolved deterministically).
  people: { displayName: string; relationship: string | null; isMe: boolean }[]
}

export interface InterpretInput {
  text: string
  context: InterpreterContext
}

// The interpreter returns a RAW (untrusted) interpretation that the caller MUST
// validate with the contract schema and then resolve deterministically. The
// interface promises nothing about the model; it only promises the shape.
export interface Interpreter {
  readonly name: string
  interpret(input: InterpretInput): Promise<RawInterpretation>
}

// Thrown when the model is unavailable / times out / returns unusable output. The
// route maps this to a friendly, retryable failure that never loses the user's note
// and never fabricates actions.
export class InterpretationError extends Error {
  constructor(
    message: string,
    readonly kind: 'unavailable' | 'timeout' | 'invalid_output' | 'rate_limited' = 'unavailable',
  ) {
    super(message)
    this.name = 'InterpretationError'
  }
}
