// MamaHQ — first-run household setup (MamaHQ 2.0 closed beta).
//
// PURE + DETERMINISTIC: no React, no network. This module decides WHICH first-run step
// (if any) to show, validates the Baby step, and maps Baby setup onto the CANONICAL
// persisted Baby row. It invents no new identity or profile state:
//
//   * Mom/user name  → the caller's canonical HouseholdPerson display name
//                      (household_people.display_name via the set_my_display_name RPC).
//                      "Not set yet" = still the 'Me'/'Member' bootstrap placeholder,
//                      surfaced by useHousehold().firstRun.
//   * Baby name      → babies.name        (surfaced as Profile.babyName)
//   * Baby birthday  → babies.birth_date  (surfaced as Profile.birthDate — the exact
//                      field First90 / Day N / affirmations / Today's Read derive from)
//
// Completeness is derived ONLY from that persisted data — never a localStorage flag —
// so an established household never repeats setup, a partially configured one resumes
// at the right step, and Start Over (which deletes the family's Baby row and resets the
// caller's name to the placeholder) naturally lands back at step 1.

/** The tab the app lands on once first-run setup completes. */
export const ONBOARDING_COMPLETE_TAB = 'today' as const

/** Mirrors the DB check on babies.name (length between 1 and 100). */
export const BABY_NAME_MAX = 100

/** The earliest birth year we accept as a real (non-typo) date for this beta. */
export const BIRTH_YEAR_MIN = 1900

/** The persisted Baby/profile fields onboarding reads + writes (structural subset of
 *  components/mama/profile.tsx `Profile`). */
export interface BabySetupProfile {
  momName: string
  babyName: string
  birthDate: string
  feeding: 'breast' | 'bottle' | 'both'
  photo?: string
}

/** The canonical `babies` row shape written by onboarding (subset of DbBaby). */
export interface BabyRowWrite {
  id: string
  family_id: string
  name: string
  birth_date: string
  feeding: 'breast' | 'bottle' | 'both' | null
  photo: string | null
}

/* ------------------------------------------------------------------------ */
/* Dates                                                                    */
/* ------------------------------------------------------------------------ */

/** Local calendar date as 'YYYY-MM-DD' (NOT toISOString, which is UTC and can be
 *  tomorrow in a negative-offset timezone's evening). */
export function localTodayISO(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** True when `s` is a strict 'YYYY-MM-DD' that names a real calendar day. */
export function isRealCalendarDate(s: string | null | undefined): boolean {
  if (!s) return false
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3])
  const probe = new Date(y, mo - 1, d)
  return probe.getFullYear() === y && probe.getMonth() === mo - 1 && probe.getDate() === d
}

/* ------------------------------------------------------------------------ */
/* Completeness + routing                                                   */
/* ------------------------------------------------------------------------ */

/** True when the persisted Baby has a usable name AND a real birth date. A stored
 *  date is NOT re-checked against "today" here: completeness is about whether the data
 *  exists, so an established household is never pushed back into setup. */
export function isBabySetupComplete(
  profile: { babyName?: string | null; birthDate?: string | null } | null | undefined,
): boolean {
  if (!profile) return false
  return (profile.babyName ?? '').trim().length > 0 && isRealCalendarDate(profile.birthDate)
}

export type SetupRoute = 'loading' | 'name' | 'partner-join' | 'baby' | 'app'

export interface SetupRouteInput {
  /** useHousehold().firstRun — derived from the canonical person's name/role. */
  firstRun: 'creator' | 'partner' | 'done' | null
  householdHydrated: boolean
  profileHydrated: boolean
  /** True when the canonical Baby read FAILED (we can't know whether Baby exists). */
  profileLoadFailed: boolean
  profile: { babyName?: string | null; birthDate?: string | null } | null
  /** The invited-partner join flow handed off this session. */
  partnerJoinDismissed: boolean
}

/**
 * Which first-run surface to render, from persisted data only.
 *   - not yet knowable                         → 'loading' (never guess / flash)
 *   - owner, name still the 'Me' placeholder   → 'name'
 *   - joined partner, name still 'Member'      → 'partner-join' (existing flow)
 *   - name set, Baby name/birthday missing     → 'baby'
 *   - name + Baby name + Baby birthday present → 'app'
 * If the Baby read failed we enter the app rather than asking again: re-asking an
 * established household (and writing a second Baby) on a transient error is worse
 * than a briefly degraded app.
 */
export function resolveSetupRoute(i: SetupRouteInput): SetupRoute {
  if (!i.householdHydrated || i.firstRun === null || !i.profileHydrated) return 'loading'
  if (i.firstRun === 'creator') return 'name'
  if (i.firstRun === 'partner' && !i.partnerJoinDismissed) return 'partner-join'
  if (i.profileLoadFailed) return 'app'
  if (!isBabySetupComplete(i.profile)) return 'baby'
  return 'app'
}

/* ------------------------------------------------------------------------ */
/* Baby step validation                                                     */
/* ------------------------------------------------------------------------ */

export interface BabySetupErrors {
  babyName?: string
  birthDate?: string
}

export type BabySetupResult =
  | { ok: true; babyName: string; birthDate: string }
  | { ok: false; errors: BabySetupErrors }

/**
 * Validate the Baby step. Name is trimmed and required (no invented default).
 * Birthday must be selected, a real calendar day, not before BIRTH_YEAR_MIN, and NOT
 * in the future: MamaHQ has no pregnancy/due-date semantics (First90 clamps a future
 * date to Day 1, which would show a fabricated "Day 1"), so a future date is rejected
 * explicitly rather than silently accepted.
 */
export function validateBabySetup(
  input: { babyName: string; birthDate: string },
  now: Date = new Date(),
): BabySetupResult {
  const errors: BabySetupErrors = {}
  const babyName = input.babyName.trim()
  if (!babyName) errors.babyName = 'Please enter Baby’s name.'
  else if (babyName.length > BABY_NAME_MAX) errors.babyName = `Please keep it under ${BABY_NAME_MAX} characters.`

  const birthDate = (input.birthDate ?? '').trim()
  if (!birthDate) errors.birthDate = 'Please choose Baby’s birthday.'
  else if (!isRealCalendarDate(birthDate) || Number(birthDate.slice(0, 4)) < BIRTH_YEAR_MIN) {
    errors.birthDate = 'That doesn’t look like a real date.'
  } else if (birthDate > localTodayISO(now)) {
    // ISO 'YYYY-MM-DD' strings compare correctly lexicographically.
    errors.birthDate = 'Baby’s birthday can’t be in the future.'
  }

  if (errors.babyName || errors.birthDate) return { ok: false, errors }
  return { ok: true, babyName, birthDate }
}

/* ------------------------------------------------------------------------ */
/* Canonical mapping (shared by onboarding + ProfileProvider)               */
/* ------------------------------------------------------------------------ */

/** Build the persisted profile for a validated Baby step. Keeps any existing feeding/
 *  photo; feeding defaults to the existing 'both' default (onboarding doesn't ask). */
export function babySetupToProfile(
  valid: { babyName: string; birthDate: string },
  momName: string,
  existing?: Partial<BabySetupProfile> | null,
): BabySetupProfile {
  return {
    momName,
    babyName: valid.babyName,
    birthDate: valid.birthDate,
    feeding: existing?.feeding ?? 'both',
    photo: existing?.photo,
  }
}

/** The canonical `babies` row for a profile. Profile.babyName → babies.name and
 *  Profile.birthDate → babies.birth_date (the field First90 reads back). `id` is the
 *  existing row's id when known, so a retry or re-save UPDATES instead of inserting a
 *  duplicate Baby. */
export function babyRowFromProfile(familyId: string, id: string, p: BabySetupProfile): BabyRowWrite {
  return {
    id,
    family_id: familyId,
    name: p.babyName,
    birth_date: p.birthDate,
    feeding: p.feeding,
    photo: p.photo ?? null,
  }
}

/** The profile surfaced from a canonical `babies` row (the read side of the above). */
export function profileFromBabyRow(
  row: { name: string; birth_date: string; feeding: string | null; photo: string | null },
  momName: string,
): BabySetupProfile {
  return {
    momName,
    babyName: row.name,
    birthDate: row.birth_date,
    feeding: (row.feeding ?? 'both') as BabySetupProfile['feeding'],
    photo: row.photo ?? undefined,
  }
}
