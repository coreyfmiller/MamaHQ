// Mama HQ — AI service factory. Returns the configured provider behind the AIService interface,
// so product code (the Inbox route) never depends on a specific vendor. Add new providers here.

import type { AIService } from './types'
import { OpenAIProvider } from './openai-provider'

export type { AIService, InboxExtraction } from './types'

// Resolve the active AI provider. Currently OpenAI; swapping vendors happens ONLY here.
export function getAIService(): AIService {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('AI is not configured (OPENAI_API_KEY missing).')
  return new OpenAIProvider(key)
}

export function hasAI(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}
