// MamaHQ — first-run household setup tests (MamaHQ 2.0 closed beta).
//
// Pure, no network, no DB, no AI. Proves the persisted-data completeness rules that
// decide the first-run step, the Baby-step validation (incl. explicit future/invalid
// birthday rejection), and that onboarding writes Baby's name + birthday to the exact
// canonical fields First90 reads back.
//
//   node scripts/test-onboarding.ts   (npm run test:onboarding)

import {
  ONBOARDING_COMPLETE_TAB,
  babyRowFromProfile,
  babySetupToProfile,
  isBabySetupComplete,
  localTodayISO,
  profileFromBabyRow,
  resolveSetupRoute,
  validateBabySetup,
  type SetupRouteInput,
} from '../lib/onboarding.ts'
import { firstNinetyState, journeyDay } from '../lib/first90.ts'

let passed = 0
let failed = 0
const failures: string[] = []
function ok(cond: boolean, msg: string) {
  if (cond) passed++
  else {
    failed++
    failures.push(msg)
  }
}
function eq<T>(actual: T, expected: T, msg: string) {
  ok(actual === expected, `${msg} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`)
}

// A fixed local "now": 2026-10-02 09:00 local.
const NOW = new Date(2026, 9, 2, 9, 0, 0)
const COMPLETE = { babyName: 'Emma', birthDate: '2026-09-20' }

function route(over: Partial<SetupRouteInput>) {
  return resolveSetupRoute({
    firstRun: 'done',
    householdHydrated: true,
    profileHydrated: true,
    profileLoadFailed: false,
    profile: COMPLETE,
    partnerJoinDismissed: false,
    role: 'owner',
    ...over,
  })
}

// ==========================================================================
// 1–4, 8. Completeness routing from persisted data
// ==========================================================================
{
  // 1. no name (owner still the 'Me' placeholder) → name step, regardless of Baby.
  eq(route({ firstRun: 'creator', profile: null }), 'name', '1: no name, no Baby → name step')
  eq(route({ firstRun: 'creator', profile: COMPLETE }), 'name', '1: no name but Baby exists → still name step')

  // 2. name exists, Baby missing → Baby step.
  eq(route({ profile: null }), 'baby', '2: name set, no Baby → Baby step')

  // 3. Baby name exists but birthday missing → Baby step (and the reverse).
  eq(route({ profile: { babyName: 'Emma', birthDate: '' } }), 'baby', '3: Baby name but no birthday → Baby step')
  eq(route({ profile: { babyName: 'Emma', birthDate: 'not-a-date' } }), 'baby', '3: Baby name + garbage birthday → Baby step')
  eq(route({ profile: { babyName: '   ', birthDate: '2026-09-20' } }), 'baby', '3: whitespace Baby name + birthday → Baby step')

  // 4. complete canonical profile → app.
  eq(route({}), 'app', '4: name + Baby name + birthday → app')

  // 8. established household never sees onboarding again — independent of the
  //    session-only dismissed flag, and even with an old (graduated) birth date.
  eq(route({ partnerJoinDismissed: true }), 'app', '8: established household (dismissed) → app')
  eq(route({ profile: { babyName: 'Emma', birthDate: '2024-01-01' } }), 'app', '8: established household past Day 90 → app')
  // A stored future date (pre-existing data) is NOT treated as incomplete — completeness
  // is about presence, so an established household is never pushed back into setup.
  ok(isBabySetupComplete({ babyName: 'Emma', birthDate: '2030-01-01' }), '8: stored future date still counts as present')

  // Never guess / flash onboarding before everything is hydrated.
  eq(route({ householdHydrated: false }), 'loading', 'household not hydrated → loading')
  eq(route({ profileHydrated: false, profile: null }), 'loading', 'profile not hydrated → loading (no Baby-step flash)')
  eq(route({ firstRun: null }), 'loading', 'firstRun unknown → loading')

  // A failed canonical Baby read must NOT re-ask (could write a duplicate Baby).
  eq(route({ profile: null, profileLoadFailed: true }), 'app', 'Baby read failed → app, never re-ask')
  // ...but a missing NAME still routes to the name step (that's identity, not Baby).
  eq(route({ firstRun: 'creator', profile: null, profileLoadFailed: true }), 'name', 'Baby read failed + no name → name')

  // Existing invited-partner flow is preserved.
  eq(route({ firstRun: 'partner', role: 'member' }), 'partner-join', 'joined partner, placeholder name → partner-join')
  eq(route({ firstRun: 'partner', role: 'member', partnerJoinDismissed: true }), 'app', 'partner handed off, Baby exists → app')
}

// ==========================================================================
// PR6 — partner join routing
// ==========================================================================
{
  // The join flow, once entered, stays mounted while the partner's name save flips
  // firstRun to 'done' — the welcome step is no longer torn away.
  eq(
    route({ firstRun: 'done', role: 'member', partnerJoinStarted: true }),
    'partner-join',
    'partner join started + name saved (firstRun done) → STILL partner-join (welcome visible)',
  )
  // Even if the household has no Baby yet, the latch keeps the welcome on screen…
  eq(
    route({ firstRun: 'done', role: 'member', partnerJoinStarted: true, profile: null }),
    'partner-join',
    'partner join started, household has no Baby → still partner-join, not Baby step',
  )
  // …and after handing off, a joined member never lands on the OWNER's Baby step.
  eq(
    route({ firstRun: 'done', role: 'member', partnerJoinStarted: true, partnerJoinDismissed: true, profile: null }),
    'app',
    'partner handed off, household has no Baby → app (never the owner Baby step)',
  )
  eq(route({ firstRun: 'done', role: 'member', profile: null }), 'app', 'established member, no Baby → app')
  eq(route({ firstRun: 'done', role: null, profile: null }), 'app', 'unresolved role, no Baby → app (not guessed as owner)')
  // The latch beats loading so a refetch mid-flow can't flash a spinner over it.
  eq(
    route({ householdHydrated: false, firstRun: null, role: 'member', partnerJoinStarted: true }),
    'partner-join',
    'partner join started + household refetching → stays partner-join',
  )
  // Without the latch, the pre-PR6 behaviour is what tore the welcome away.
  eq(route({ firstRun: 'done', role: 'member', partnerJoinStarted: false }), 'app', 'no latch → app (documents the old tear-down)')
}

// ==========================================================================
// PR6 — owner onboarding still works exactly as before
// ==========================================================================
{
  eq(route({ firstRun: 'creator', role: 'owner', profile: null }), 'name', 'owner: no name → name step')
  eq(route({ firstRun: 'done', role: 'owner', profile: null }), 'baby', 'owner: name saved, no Baby → Baby step')
  eq(route({ firstRun: 'done', role: 'owner', profile: { babyName: 'Emma', birthDate: '' } }), 'baby', 'owner: no birthday → Baby step')
  eq(route({ firstRun: 'done', role: 'owner' }), 'app', 'owner: complete → app')
  // The owner is never caught by the partner latch (it's only set on partner-join).
  eq(route({ firstRun: 'creator', role: 'owner', partnerJoinStarted: false, profile: null }), 'name', 'owner unaffected by partner latch')
}

// ==========================================================================
// Reset: Start Over deletes the Baby row + resets name to placeholder → step 1,
// then name → Baby step, purely from persisted data (no reset special-case).
// ==========================================================================
{
  eq(route({ firstRun: 'creator', profile: null }), 'name', 'reset: placeholder name + no Baby → name step')
  eq(route({ firstRun: 'done', profile: null }), 'baby', 'reset: after name saved → Baby step')
}

// ==========================================================================
// 9. Baby-step validation (explicit, safe)
// ==========================================================================
{
  const v = (babyName: string, birthDate: string) => validateBabySetup({ babyName, birthDate }, NOW)

  const good = v('  Emma  ', '2026-09-20')
  ok(good.ok, '9: valid name + past birthday → ok')
  if (good.ok) {
    eq(good.babyName, 'Emma', '9: Baby name is trimmed')
    eq(good.birthDate, '2026-09-20', '9: birthday unchanged')
  }

  ok(v('Emma', localTodayISO(NOW)).ok, '9: birthday = today (Day 1) → ok')

  const noName = v('   ', '2026-09-20')
  ok(!noName.ok && !!noName.errors.babyName && !noName.errors.birthDate, '9: blank name → name error only (no default name invented)')

  const noDate = v('Emma', '')
  ok(!noDate.ok && !!noDate.errors.birthDate, '9: no birthday → birthday error')

  const future = v('Emma', '2026-10-03')
  ok(!future.ok && /future/i.test(future.errors.birthDate ?? ''), '9: tomorrow → explicit future-date error')
  ok(!v('Emma', '2027-01-01').ok, '9: far-future birthday rejected')

  ok(!v('Emma', '2026-02-30').ok, '9: impossible calendar date rejected')
  ok(!v('Emma', '2026-13-01').ok, '9: impossible month rejected')
  ok(!v('Emma', '0001-01-01').ok, '9: absurd year rejected')
  ok(!v('Emma', '20260920').ok, '9: malformed date rejected')
  ok(!v('E'.repeat(101), '2026-09-20').ok, '9: name over DB limit rejected')

  const both = v('', '')
  ok(!both.ok && !!both.errors.babyName && !!both.errors.birthDate, '9: both missing → both errors reported')

  // Local "today" must not be UTC: 2026-10-02 23:30 local is still the 2nd locally.
  eq(localTodayISO(new Date(2026, 9, 2, 23, 30)), '2026-10-02', 'localTodayISO uses the LOCAL calendar day')
}

// ==========================================================================
// 5–6. Onboarding writes the canonical Baby fields First90 consumes
// ==========================================================================
{
  const valid = validateBabySetup({ babyName: ' Emma ', birthDate: '2026-09-20' }, NOW)
  ok(valid.ok, '5/6: setup valid')
  if (valid.ok) {
    const profile = babySetupToProfile(valid, 'Corey', null)
    eq(profile.babyName, 'Emma', '5: profile.babyName = trimmed Baby name')
    eq(profile.birthDate, '2026-09-20', '6: profile.birthDate = chosen birthday')
    eq(profile.feeding, 'both', 'feeding keeps the existing default (not asked)')

    const row = babyRowFromProfile('fam-1', 'baby-1', profile)
    eq(row.name, 'Emma', '5: written to babies.name')
    eq(row.birth_date, '2026-09-20', '6: written to babies.birth_date')
    eq(row.family_id, 'fam-1', 'row scoped to the family')
    eq(row.id, 'baby-1', 'row carries the known id (re-save updates, never duplicates)')

    // Round trip: the row read back is exactly what First90 derives Day N from.
    const back = profileFromBabyRow({ ...row, feeding: row.feeding }, 'Corey')
    eq(back.birthDate, profile.birthDate, '6: birth_date reads back as profile.birthDate')
    eq(back.babyName, profile.babyName, '5: name reads back as profile.babyName')
    const st = firstNinetyState(back.birthDate, NOW)
    eq(st.day, 13, '6: First90 derives Day 13 from the saved birthday (Sep 20 → Oct 2)')
    ok(st.withinJourney && st.hasReadToday, '6: within Days 1–90 → Today’s Read available')
    eq(journeyDay(back.birthDate, NOW), 13, '6: journeyDay agrees')

    // Resuming a partial profile keeps existing non-onboarding fields.
    const resumed = babySetupToProfile(valid, 'Corey', { feeding: 'breast', photo: 'data:x' })
    ok(resumed.feeding === 'breast' && resumed.photo === 'data:x', 'resume keeps existing feeding/photo')

    // After saving, routing resolves to the app.
    eq(route({ profile }), 'app', '7: after Baby save → app')
  }
}

// ==========================================================================
// 7. Completion lands on Today
// ==========================================================================
eq(ONBOARDING_COMPLETE_TAB, 'today', '7: completion tab is Today')

// ==========================================================================
console.log(`\nOnboarding: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log('  - ' + f)
  process.exit(1)
}
console.log('✓ all onboarding tests passed')
process.exit(0)
