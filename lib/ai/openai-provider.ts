// Mama HQ — OpenAI implementation of AIService. Server-side only; the key never reaches the
// client. Uses structured JSON output, then VALIDATES every action with zod (schema.ts) before it
// is proposed. Never commits, never interprets the baby (SAFETY.md).

import OpenAI from 'openai'
import type { AIService, InboxExtraction } from './types'
import { extractionSchema, validateAction } from './schema'

const MODEL = 'gpt-4o-mini' // fast + cheap, strong at structured extraction. Swappable here.

const SYSTEM = `
You are the organizing layer of Mama HQ, an app for parents in the first 90 days with a newborn.
Your ONLY job is to read one free-text "brain dump" and extract discrete, PROPOSED actions the
parent can review and approve. You are not a chatbot and not a medical advisor.

Extract only these action types:
- "feed": the baby ate. Fields: method ("breast" or "bottle"), side ("left"/"right"/"both" for
  breast, else null), contents ("breast-milk"/"formula"/"unspecified" for bottle, else null),
  amountMl (a number of millilitres if stated — CONVERT ounces to ml at 30 ml/oz, e.g. "4oz" -> 120
  — else null), whenText (the time phrase exactly as written, e.g. "around 2:10", "after that",
  or null).
- "diaper": a diaper change. Fields: diaper ("wet", "dirty", or "both"), whenText (time phrase or null).
- "appointment": a scheduled thing (baby, mom, or family). Fields: title, whenText (the time
  phrase exactly as written, e.g. "Thursday at 10", or null), location (or null), who (provider
  or person, or null).
- "question": something the parent wants to ask a provider/remember to ask. Fields: text.
- "shopping": an item to buy or that they're low on. Fields: item, list (one of "shopping",
  "supplies", "general" — use "shopping" by default, "supplies" for baby supplies like diapers,
  wipes, formula).
- "task": a to-do, including things assigned to a partner. Fields: title, dueText (phrase like
  "tomorrow" or null), assignee (a name if one is mentioned, e.g. "Matt", else null).

You DESCRIBE what happened. You NEVER judge whether an amount, frequency, or anything about the
baby is normal, healthy, adequate, or concerning. A question about the baby's health (e.g. "ask
about the rash") is a "question" to remember — you do NOT answer it.

RULES (absolute):
- Extract only what is actually present. Do not invent actions. If nothing is extractable,
  return an empty array.
- NEVER give medical advice, diagnose, or interpret the baby's health. You only organize.
- Split compound inputs into separate actions (an input can yield several).
- Keep titles/text short and natural, close to the parent's own words.

Also produce a one-sentence "interpretation": a brief, warm summary of what you understood
(e.g. "Got it — an appointment, a question, and two things to pick up.").
`.trim()

const USER_INSTRUCTION = (input: string) => `Extract proposed actions from this and return ONLY a JSON object with keys
"interpretation" (string) and "proposed" (array). Each proposed item is one of:
{"type":"feed","method":"breast"|"bottle","side":"left"|"right"|"both"|null,"contents":"breast-milk"|"formula"|"unspecified"|null,"amountMl":number|null,"whenText":string|null}
{"type":"diaper","diaper":"wet"|"dirty"|"both","whenText":string|null}
{"type":"appointment","title":string,"whenText":string|null,"location":string|null,"who":string|null}
{"type":"question","text":string}
{"type":"shopping","item":string,"list":"shopping"|"supplies"|"general"}
{"type":"task","title":string,"dueText":string|null,"assignee":string|null}

Input:
"""${input}"""`

export class OpenAIProvider implements AIService {
  readonly name = 'openai'
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }

  async extractInboxActions(input: string): Promise<InboxExtraction> {
    const completion = await this.client.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: USER_INSTRUCTION(input) },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = {}
    }

    // Validate the envelope, then validate each action; drop anything malformed.
    const env = extractionSchema.safeParse(parsed)
    const interpretationRaw = env.success ? env.data.interpretation : ''
    const candidates = env.success ? env.data.proposed : []

    const proposed = candidates
      .map(validateAction)
      .filter((a): a is NonNullable<typeof a> => a !== null)

    const interpretation = interpretationRaw.trim() || 'Here’s what I found.'
    return { interpretation, proposed }
  }
}
