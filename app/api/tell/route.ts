// MamaHQ — Tell MamaHQ interpretation endpoint (Step 12).
//
// The trusted server boundary. It is NOT a generic OpenAI proxy: it performs exactly
// one operation — interpret a household brain-dump into safe, resolved proposals for
// the user to review. It:
//   1. authenticates the caller server-side (cookie session) and DERIVES the family
//      (never trusts a client-supplied family_id/user_id),
//   2. enforces an input length limit,
//   3. loads the MINIMUM canonical context (household people by name only),
//   4. calls the provider-agnostic interpreter (OpenAI adapter today),
//   5. STRICTLY validates the untrusted model output with Zod,
//   6. resolves references deterministically against canonical state,
//   7. returns safe proposals. It NEVER executes anything and never returns secrets.
//
// Interpretation is READ-ONLY. Execution is a separate, explicit, confirmed step on
// the client that calls the trusted domain RPCs.

import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { supabaseServer } from '@/lib/supabase/server'
import { createInterpreter } from '@/lib/tell/openai-adapter'
import { InterpretationError } from '@/lib/tell/interpreter'
import { rawInterpretationSchema } from '@/lib/tell/contract'
import { resolveInterpretation, type CanonicalPerson } from '@/lib/tell/resolve'

export const runtime = 'nodejs'

// Household brain-dump, not a document upload. Bounded to prevent token abuse / DoS.
const MAX_INPUT_CHARS = 2000

interface DbPersonRow {
  id: string
  display_name: string
  relationship: string | null
  user_id: string | null
}

export async function POST(req: Request) {
  // --- Parse + bound the input BEFORE any model work. ---
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Could not read your note.' }, { status: 400 })
  }
  const text = typeof (body as { text?: unknown })?.text === 'string' ? (body as { text: string }).text.trim() : ''
  if (!text) {
    return NextResponse.json({ error: 'empty', message: 'Type something first.' }, { status: 400 })
  }
  if (text.length > MAX_INPUT_CHARS) {
    // Do not silently truncate (that could change meaning) — ask for a shorter note.
    return NextResponse.json(
      { error: 'too_long', message: 'That’s a lot at once — try a shorter note so I can get it right.' },
      { status: 413 },
    )
  }

  // --- Authenticate + derive the family SERVER-SIDE (RLS-backed). ---
  const supabase = await supabaseServer()
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user) {
    return NextResponse.json({ error: 'unauthenticated', message: 'Please sign in.' }, { status: 401 })
  }

  // ensure_family is SECURITY DEFINER + idempotent; it returns the caller's OWN
  // family. We never accept a client-supplied family id.
  const { data: familyId, error: famErr } = await supabase.rpc('ensure_family')
  if (famErr || !familyId || typeof familyId !== 'string') {
    return NextResponse.json({ error: 'no_family', message: 'Couldn’t find your household.' }, { status: 403 })
  }

  // --- Minimum necessary context: household people by NAME only (no emails/phones,
  // no ids sent to the model, no history/secrets). RLS scopes this to the family. ---
  const { data: peopleRows, error: peopleErr } = await supabase
    .from('household_people')
    .select('id, display_name, relationship, user_id')
    .eq('family_id', familyId)
  if (peopleErr) {
    return NextResponse.json({ error: 'context_failed', message: 'Couldn’t load your household.' }, { status: 500 })
  }
  const rows = (peopleRows ?? []) as DbPersonRow[]
  const canonicalPeople: CanonicalPerson[] = rows.map((r) => ({
    id: r.id,
    displayName: r.display_name,
    hasAccount: Boolean(r.user_id),
    isMe: r.user_id === user.id,
  }))

  const now = new Date()
  const todayDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)

  // --- Interpret (provider-agnostic). ---
  let raw: unknown
  try {
    const interpreter = createInterpreter()
    raw = await interpreter.interpret({
      text,
      context: {
        nowISO: now.toISOString(),
        todayDate,
        people: canonicalPeople.map((p) => ({ displayName: p.displayName, relationship: rowRel(rows, p.id), isMe: p.isMe })),
      },
    })
  } catch (e) {
    const kind = e instanceof InterpretationError ? e.kind : 'unavailable'
    // Interpretation is read-only; a failure never loses the user's note (the client
    // keeps it) and never fabricates actions.
    return NextResponse.json(
      { error: 'interpretation_failed', kind, message: 'I couldn’t sort that out right now. Your note is still here — try again.' },
      { status: 502 },
    )
  }

  // --- STRICT validation of untrusted model output. ---
  const parsed = rawInterpretationSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_output', message: 'I couldn’t sort that out right now. Your note is still here — try again.' },
      { status: 502 },
    )
  }

  // --- Deterministic reference + time resolution against canonical state. ---
  const interpretation = resolveInterpretation(parsed.data, {
    people: canonicalPeople,
    now,
    newId: () => randomUUID(),
  })

  return NextResponse.json(interpretation, { status: 200 })
}

function rowRel(rows: DbPersonRow[], id: string): string | null {
  return rows.find((r) => r.id === id)?.relationship ?? null
}
