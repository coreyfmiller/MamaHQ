// Mama HQ — provider-agnostic AI interface (data-and-ai-standard / SAFETY.md).
// AI is an ORGANIZATIONAL layer: it PROPOSES structured actions; it never commits, never
// interprets the baby's health, never invents clinical facts. Providers implement this interface
// so the model vendor can be swapped without touching product code.

import type { ProposedAction } from '@/lib/types'

export type InboxExtraction = {
  interpretation: string // short, warm summary of what was understood
  proposed: ProposedAction[] // discrete actions the user will review + approve
}

export interface AIService {
  readonly name: string
  // Turn one free-text brain dump into PROPOSED, validated structured actions. Server-side only.
  extractInboxActions(input: string): Promise<InboxExtraction>
  // Future methods (documented, not built here): detectPossibleMemory(), summarizeRecordedData().
}
