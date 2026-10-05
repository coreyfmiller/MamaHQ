// MamaHQ — Me is MOM-CENTRIC (PR6). Pure + deterministic.
//
// Me's mood check-in, "My to-dos" and "Questions for my doctor" are stored
// FAMILY-SCOPED (mom_moods keyed per family + day; mom_items per family) — there is
// no per-account private storage. So these belong to Mom, the household OWNER (who
// set the household up), not to whoever happens to open Me:
//   * the owner (or a signed-out local user) gets the full, editable Me;
//   * a joined member (partner) sees Mom's shared items READ-ONLY, labelled as
//     Mom's — never as their own "My to-dos" — and cannot write Mom's mood (which
//     would overwrite hers, since mood is one row per family-day).
// This is a truthful presentation of the existing data model, not new storage.

export type HouseholdRole = 'owner' | 'member' | null | undefined

/** Is the current user the owner of Me's (family-scoped) Mom space? */
export function isMomSpaceOwner(input: { signedIn: boolean; role: HouseholdRole }): boolean {
  if (!input.signedIn) return true // local-only device: no shared household
  return input.role === 'owner'
}

export interface MeSectionCopy {
  todosTitle: string
  questionsTitle: string
  /** May this user add/toggle/remove items and set the mood? */
  editable: boolean
  /** Short truthful note shown to a partner. */
  partnerNote: string | null
}

/** Section titles + editability for Me, given who is viewing. `momName` is the
 *  owner's canonical display name (for the partner's labels). */
export function meSectionCopy(input: { isOwner: boolean; momName?: string | null }): MeSectionCopy {
  if (input.isOwner) {
    return { todosTitle: 'My to-dos', questionsTitle: 'Questions for my doctor', editable: true, partnerNote: null }
  }
  const who = (input.momName ?? '').trim() || 'Mom'
  const possessive = who.endsWith('s') ? `${who}’` : `${who}’s`
  return {
    todosTitle: `${possessive} to-dos`,
    questionsTitle: `${possessive} questions for the doctor`,
    editable: false,
    partnerNote: `These are ${possessive} — shown so you know what's on her mind. Only she can change them here.`,
  }
}
