// Mama HQ — zod schemas that VALIDATE the model's structured output before it becomes a proposal.
// Never trust model shape blindly (data-and-ai-standard: structured, validated outputs). Anything
// that fails validation is dropped, not guessed at.

import { z } from 'zod'
import type { ProposedAction } from '@/lib/types'

const nonEmpty = (max: number) => z.string().trim().min(1).max(max)
const nullableStr = (max: number) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      const s = typeof v === 'string' ? v.trim() : ''
      return s ? s.slice(0, max) : null
    })

const appointmentSchema = z.object({
  type: z.literal('appointment'),
  title: nonEmpty(200),
  whenText: nullableStr(120),
  location: nullableStr(200),
  who: nullableStr(120),
})

const questionSchema = z.object({
  type: z.literal('question'),
  text: nonEmpty(500),
})

const shoppingSchema = z.object({
  type: z.literal('shopping'),
  item: nonEmpty(200),
  list: z
    .union([z.literal('shopping'), z.literal('supplies'), z.literal('general')])
    .catch('shopping')
    .default('shopping'),
})

const taskSchema = z.object({
  type: z.literal('task'),
  title: nonEmpty(300),
  dueText: nullableStr(120),
  assignee: nullableStr(120),
})

// Baby events. Amount is a non-negative int (or null); side/contents fall back safely.
const nonNegIntOrNull = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
  })

const feedSchema = z.object({
  type: z.literal('feed'),
  method: z.union([z.literal('breast'), z.literal('bottle')]).catch('bottle'),
  side: z.union([z.literal('left'), z.literal('right'), z.literal('both'), z.null()]).optional().transform((v) => v ?? null),
  contents: z
    .union([z.literal('breast-milk'), z.literal('formula'), z.literal('unspecified'), z.null()])
    .optional()
    .transform((v) => v ?? null),
  amountMl: nonNegIntOrNull,
  whenText: nullableStr(120),
})

const diaperSchema = z.object({
  type: z.literal('diaper'),
  diaper: z.union([z.literal('wet'), z.literal('dirty'), z.literal('both')]).catch('wet'),
  whenText: nullableStr(120),
})

export const proposedActionSchema = z.discriminatedUnion('type', [
  appointmentSchema,
  questionSchema,
  shoppingSchema,
  taskSchema,
  feedSchema,
  diaperSchema,
])

export const extractionSchema = z.object({
  interpretation: z.string().trim().max(400).optional().default(''),
  proposed: z.array(z.unknown()).default([]),
})

// Validate one candidate action; return it typed, or null if it fails.
export function validateAction(candidate: unknown): ProposedAction | null {
  const r = proposedActionSchema.safeParse(candidate)
  return r.success ? (r.data as ProposedAction) : null
}
