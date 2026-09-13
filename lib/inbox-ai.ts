// Mama HQ — the Inbox AI extractor. Turns free text into PROPOSED structured actions.
// Governed by data-and-ai-standard.md: AI proposes, never commits; structured output;
// provider-agnostic behind this module so the model can be swapped later.
// Server-side only — the key never reaches the client.

import OpenAI from 'openai'
import type { ProposedAction, ShoppingListName } from './types'

const MODEL = 'gpt-4o-mini' // fast + cheap; good at structured extraction. Swappable here.

const SYSTEM = `
You are the organizing layer of Mama HQ, an app for parents in the first 90 days with a newborn.
Your ONLY job is to read one free-text "brain dump" and extract discrete, PROPOSED actions the
parent can review and approve. You are not a chatbot and not a medical advisor.

Extract only these action types:
- "appointment": a scheduled thing (baby, mom, or family). Fields: title, whenText (the time
  phrase exactly as written, e.g. "Thursday at 10", or null), location (or null), who (provider
  or person, or null).
- "question": something the parent wants to ask a provider/remember to ask. Fields: text.
- "shopping": an item to buy or that they're low on. Fields: item, list (one of "shopping",
  "supplies", "general" — use "shopping" by default, "supplies" for baby supplies like diapers,
  wipes, formula).
- "task": a to-do, including things assigned to a partner. Fields: title, dueText (phrase like
  "tomorrow" or null), assignee (a name if one is mentioned, e.g. "Matt", else null).

RULES (absolute):
- Extract only what is actually present. Do not invent actions. If nothing is extractable,
  return an empty array.
- NEVER give medical advice, diagnose, or interpret the baby's health. You only organize.
- Split compound inputs into separate actions (an input can yield several).
- Keep titles/text short and natural, close to the parent's own words.

Also produce a one-sentence "interpretation": a brief, warm summary of what you understood
(e.g. "Got it — an appointment, a question, and two things to pick up.").
`.trim()

type ExtractResult = { interpretation: string; proposed: ProposedAction[] }

const VALID_LISTS: ShoppingListName[] = ['shopping', 'supplies', 'general']

export async function extractInbox(input: string): Promise<ExtractResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')

  const client = new OpenAI({ apiKey })

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `Extract proposed actions from this and return ONLY a JSON object with keys
"interpretation" (string) and "proposed" (array). Each proposed item is one of:
{"type":"appointment","title":string,"whenText":string|null,"location":string|null,"who":string|null}
{"type":"question","text":string}
{"type":"shopping","item":string,"list":"shopping"|"supplies"|"general"}
{"type":"task","title":string,"dueText":string|null,"assignee":string|null}

Input:
"""${input}"""`,
      },
    ],
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(raw) as { interpretation?: unknown; proposed?: unknown }

  const interpretation =
    typeof parsed.interpretation === 'string' && parsed.interpretation.trim()
      ? parsed.interpretation.trim()
      : 'Here’s what I found.'

  const proposed = Array.isArray(parsed.proposed)
    ? parsed.proposed.map(normalizeAction).filter((a): a is ProposedAction => a !== null)
    : []

  return { interpretation, proposed }
}

// Defensive normalization — never trust model shape blindly (structured but validated).
function normalizeAction(a: unknown): ProposedAction | null {
  if (!a || typeof a !== 'object') return null
  const o = a as Record<string, unknown>
  const s = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

  switch (o.type) {
    case 'appointment': {
      const title = s(o.title)
      if (!title) return null
      return { type: 'appointment', title, whenText: s(o.whenText), location: s(o.location), who: s(o.who) }
    }
    case 'question': {
      const text = s(o.text)
      if (!text) return null
      return { type: 'question', text }
    }
    case 'shopping': {
      const item = s(o.item)
      if (!item) return null
      const list = (VALID_LISTS.includes(o.list as ShoppingListName) ? o.list : 'shopping') as ShoppingListName
      return { type: 'shopping', item, list }
    }
    case 'task': {
      const title = s(o.title)
      if (!title) return null
      return { type: 'task', title, dueText: s(o.dueText), assignee: s(o.assignee) }
    }
    default:
      return null
  }
}
