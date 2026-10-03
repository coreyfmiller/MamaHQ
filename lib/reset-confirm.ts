// MamaHQ — Start Over / Reset confirmation logic (pure, testable).
//
// The reset screen requires an explicit typed confirmation before the destructive
// action enables. There are two branches, because a Baby profile is OPTIONAL (a
// household can exist with no baby):
//
//   * hasBaby   → the user must type the baby's name EXACTLY (case-insensitive,
//                 whitespace-trimmed) — the existing, unchanged safeguard.
//   * no baby   → there is no name to type, so the user confirms by typing the
//                 literal word RESET. We use RESET (not DELETE) because Start Over
//                 resets MamaHQ data while PRESERVING the auth account.
//
// Kept UI-free so the confirmation gate is deterministically testable
// (scripts/test-reset-confirm.ts) without React.

/** The literal confirmation word used when no baby profile exists. */
export const RESET_CONFIRM_WORD = 'RESET'

/**
 * Does the typed confirmation satisfy the reset gate?
 *
 * @param hasBaby   whether a baby profile exists (a non-empty baby name).
 * @param babyName  the baby's display name (may be empty/whitespace).
 * @param typed     what the user typed into the confirmation field.
 *
 * Baby path: case-insensitive, trimmed exact match of the baby name (and the name
 * must be non-empty). No-baby path: EXACT, case-SENSITIVE match of RESET (trimmed),
 * so a stray "reset" does not arm the destructive button.
 */
export function resetConfirmationMatches(hasBaby: boolean, babyName: string, typed: string): boolean {
  const t = typed.trim()
  if (hasBaby) {
    const name = babyName.trim()
    return name.length > 0 && t.toLowerCase() === name.toLowerCase()
  }
  return t === RESET_CONFIRM_WORD
}

/**
 * May the current user START OVER? (PR6.) Only the household OWNER may wipe shared
 * household data. The database is authoritative (0017 reset_family_data rejects
 * non-owners); this mirrors it so the UI never offers an action that will be refused.
 *
 *   * signed out (local-only demo data) → yes: there is no shared household.
 *   * signed in → only when the caller's membership role is 'owner'. An unresolved
 *     role (null/undefined) is NOT treated as owner.
 */
export function canStartOver(input: { signedIn: boolean; role: 'owner' | 'member' | null | undefined }): boolean {
  if (!input.signedIn) return true
  return input.role === 'owner'
}

/** Truthful one-line summary of what Start Over clears (Settings row). */
export const START_OVER_SUMMARY =
  'Clears Baby, logs, your check-ins, to-dos, questions, memories and grocery list'

/** Shown to a joined member instead of the Start Over action. */
export const START_OVER_OWNER_ONLY = 'Only the household owner can start over.'
