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

/**
 * The Start Over sequence (pure orchestration, testable without React).
 *
 *   1. resetCloud()       — the owner-only, single-transaction reset_family_data RPC.
 *                           It clears Baby/logs/etc. AND resets the owner's canonical
 *                           household_people.display_name to the 'Me' placeholder in
 *                           the SAME transaction. If it fails, nothing else happens.
 *   2. refreshHousehold() — re-read canonical household people so the client's
 *                           firstRun sees the 'Me' placeholder → onboarding NAME step.
 *                           Done BEFORE clearing local state, so the router never
 *                           sees "real name + no Baby" (which resolves to the Baby
 *                           step) in between.
 *   3. clearLocal()       — clear on-device copies.
 *
 * Bug fixed here: Start Over used to refresh household state ONLY as a side effect of
 * a second identity RPC (reset_my_identity). When that call failed — e.g. the
 * function wasn't deployed — the client kept the stale real name, cleared Baby, and
 * routed straight to "Tell us about Baby" instead of the name step.
 */
export interface StartOverDeps {
  signedIn: boolean
  resetCloud: () => Promise<void>
  refreshHousehold: () => Promise<boolean>
  clearLocal: () => void
}

/** 'reset' = done and household re-read; 'reset_reload_pending' = reset done but the
 *  household re-read failed (data is cleared server-side; a reload finishes it);
 *  'failed' = the server reset failed and NOTHING was cleared. */
export type StartOverResult = 'reset' | 'reset_reload_pending' | 'failed'

export async function runStartOver(d: StartOverDeps): Promise<StartOverResult> {
  if (d.signedIn) {
    try {
      await d.resetCloud()
    } catch {
      return 'failed'
    }
  }
  let refreshed = true
  if (d.signedIn) {
    try {
      refreshed = await d.refreshHousehold()
    } catch {
      refreshed = false
    }
  }
  d.clearLocal()
  return refreshed ? 'reset' : 'reset_reload_pending'
}
