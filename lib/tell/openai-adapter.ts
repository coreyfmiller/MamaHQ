// MamaHQ — Tell MamaHQ OpenAI adapter (Step 12).
//
// The CONCRETE interpreter used today. It is the ONLY module that imports the
// OpenAI SDK; everything else depends on the provider-agnostic `Interpreter`
// interface. Swapping providers = writing another adapter, no product changes.
//
// Server-side only: this module reads OPENAI_API_KEY and must never be imported by
// client code. It returns a PARSED-but-still-untrusted object; the caller validates
// it against the strict contract schema before anything becomes a proposal.

import OpenAI from 'openai'
import type { Interpreter, InterpretInput, InterpreterContext } from './interpreter.ts'
import { InterpretationError } from './interpreter.ts'
import type { RawInterpretation } from './contract.ts'
import { TELL_SYSTEM_PROMPT, buildContextMessage } from './prompt.ts'

// Model configuration (documented in docs/TELL_MAMAHQ.md). Chosen for structured
// extraction, low latency, reliable JSON adherence, and reasonable cost. Overridable
// via env for ops without changing product code; model choice is NOT user-facing.
const DEFAULT_MODEL = 'gpt-4o-mini'
const REQUEST_TIMEOUT_MS = 20_000
const MAX_OUTPUT_TOKENS = 1200

function modelName(): string {
  return process.env.TELL_MAMAHQ_MODEL?.trim() || DEFAULT_MODEL
}

// A compact JSON Schema mirror of the raw contract, given to the model as a
// response_format so it returns well-formed JSON. The authoritative validation is
// still the Zod parse in the route; this only improves adherence.
const RESPONSE_FORMAT = {
  type: 'json_object' as const,
}

export class OpenAIInterpreter implements Interpreter {
  readonly name = 'openai'
  private client: OpenAI

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.OPENAI_API_KEY
    if (!key) {
      // Surfaced as a clean "unavailable" to the route; never leaks config detail.
      throw new InterpretationError('interpreter is not configured', 'unavailable')
    }
    this.client = new OpenAI({ apiKey: key, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 })
  }

  async interpret({ text, context }: InterpretInput): Promise<RawInterpretation> {
    let content: string
    try {
      const completion = await this.client.chat.completions.create({
        model: modelName(),
        temperature: 0,
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: RESPONSE_FORMAT,
        messages: [
          { role: 'system', content: TELL_SYSTEM_PROMPT },
          { role: 'system', content: buildContextMessage(context) },
          // User text is DATA. It is clearly delimited and the system prompt has
          // already instructed the model to treat it as untrusted input.
          { role: 'user', content: text },
        ],
      })
      content = completion.choices[0]?.message?.content ?? ''
    } catch (e) {
      const err = e as { status?: number; name?: string }
      if (err?.status === 429) throw new InterpretationError('rate limited', 'rate_limited')
      if (err?.name === 'APIConnectionTimeoutError' || err?.name === 'AbortError') {
        throw new InterpretationError('timeout', 'timeout')
      }
      throw new InterpretationError('model call failed', 'unavailable')
    }

    if (!content) {
      throw new InterpretationError('empty model output', 'invalid_output')
    }

    // Parse JSON only. Structural validation against the strict Zod schema happens
    // in the route (defense in depth) — the adapter returns the parsed object typed
    // loosely; a malformed shape will be rejected there, never executed.
    try {
      return JSON.parse(content) as RawInterpretation
    } catch {
      throw new InterpretationError('model returned non-JSON', 'invalid_output')
    }
  }
}

// Factory the route uses. Kept tiny so provider selection lives in ONE place; a
// future switch on an env var would add another adapter here without touching
// callers.
export function createInterpreter(): Interpreter {
  return new OpenAIInterpreter()
}

// Re-export for callers that only need the context type.
export type { InterpreterContext }
