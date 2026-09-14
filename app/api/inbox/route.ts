// POST /api/inbox — extract PROPOSED actions from a brain dump. Never commits anything;
// the client shows the proposals for the user to approve (data-and-ai-standard Rule 2).
// AI runs behind a provider-agnostic AIService (lib/ai), server-side only.

import { NextResponse } from 'next/server'
import { getAIService, hasAI } from '@/lib/ai'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  let body: { input?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const input = typeof body.input === 'string' ? body.input.trim() : ''
  if (!input) return NextResponse.json({ error: 'Nothing to capture.' }, { status: 400 })
  if (input.length > 4000) return NextResponse.json({ error: 'That’s a bit long.' }, { status: 400 })

  if (!hasAI()) {
    return NextResponse.json({ error: 'The inbox is not configured yet.' }, { status: 503 })
  }

  try {
    const result = await getAIService().extractInboxActions(input)
    return NextResponse.json(result)
  } catch (e) {
    console.error('[inbox] extract failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Could not read that just now. Please try again.' }, { status: 500 })
  }
}
