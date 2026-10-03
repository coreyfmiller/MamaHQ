// MamaHQ — PR6 closed-beta hardening: deterministic regression tests.
//
// Pure, no network, no DB, no AI. Locks the client-side invariants PR6 introduced
// (the DB-enforced ones live in scripts/test-ownership.ts):
//   * auth callback `next` is same-origin only (no open redirect);
//   * Start Over is offered to the household owner only;
//   * Me is Mom-centric: a partner gets read-only, Mom-labelled items;
//   * Loading ≠ Empty ≠ Failed;
//   * the "Me"/"Member" placeholder collision is explained, not looped;
//   * editing Baby's birthday updates the SAME canonical row First90 reads.
//
//   node scripts/test-pr6.ts   (npm run test:pr6)

import { safeNextPath, DEFAULT_AFTER_AUTH } from '../lib/safe-redirect.ts'
import { canStartOver, START_OVER_SUMMARY } from '../lib/reset-confirm.ts'
import { isMomSpaceOwner, meSectionCopy } from '../lib/household-role.ts'
import { loadState, mayClaimAllClear } from '../lib/load-state.ts'
import {
  placeholderNameError,
  isBootstrapPlaceholder,
  validateBabySetup,
  babySetupToProfile,
  babyRowFromProfile,
  profileFromBabyRow,
} from '../lib/onboarding.ts'
import { firstNinetyState } from '../lib/first90.ts'

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

// ==========================================================================
// Auth callback redirect safety
// ==========================================================================
{
  eq(safeNextPath('/app'), '/app', 'plain app path allowed')
  eq(safeNextPath('/join/abc?x=1#y'), '/join/abc?x=1#y', 'path + query + hash preserved')
  eq(safeNextPath(null), DEFAULT_AFTER_AUTH, 'missing → /app')
  eq(safeNextPath(''), DEFAULT_AFTER_AUTH, 'empty → /app')
  eq(safeNextPath('   '), DEFAULT_AFTER_AUTH, 'whitespace → /app')
  eq(safeNextPath('https://evil.example/phish'), DEFAULT_AFTER_AUTH, 'absolute external URL rejected')
  eq(safeNextPath('http://evil.example'), DEFAULT_AFTER_AUTH, 'http external rejected')
  eq(safeNextPath('//evil.example/x'), DEFAULT_AFTER_AUTH, 'protocol-relative rejected')
  eq(safeNextPath('/\\evil.example'), DEFAULT_AFTER_AUTH, 'slash-backslash trick rejected')
  eq(safeNextPath('\\\\evil.example'), DEFAULT_AFTER_AUTH, 'backslash-only rejected')
  eq(safeNextPath('javascript:alert(1)'), DEFAULT_AFTER_AUTH, 'javascript: rejected')
  eq(safeNextPath('data:text/html,hi'), DEFAULT_AFTER_AUTH, 'data: rejected')
  eq(safeNextPath('app'), DEFAULT_AFTER_AUTH, 'relative (no leading slash) rejected')
  eq(safeNextPath('/\tjavascript:alert(1)'), DEFAULT_AFTER_AUTH, 'control-char smuggling rejected')
  eq(safeNextPath('/%2F%2Fevil.example'), '/%2F%2Fevil.example', 'encoded slashes stay an on-origin path')
}

// ==========================================================================
// Start Over: owner only
// ==========================================================================
{
  ok(canStartOver({ signedIn: true, role: 'owner' }), 'owner can start over')
  ok(!canStartOver({ signedIn: true, role: 'member' }), 'joined member cannot start over')
  ok(!canStartOver({ signedIn: true, role: null }), 'unresolved role is not treated as owner')
  ok(!canStartOver({ signedIn: true, role: undefined }), 'undefined role is not treated as owner')
  ok(canStartOver({ signedIn: false, role: undefined }), 'signed-out local data can be cleared')
  ok(/Baby/.test(START_OVER_SUMMARY) && /grocery/.test(START_OVER_SUMMARY), 'Start Over summary names its real scope')
}

// ==========================================================================
// Me is Mom-centric
// ==========================================================================
{
  ok(isMomSpaceOwner({ signedIn: true, role: 'owner' }), 'owner owns Me')
  ok(!isMomSpaceOwner({ signedIn: true, role: 'member' }), 'partner does not own Me')
  ok(!isMomSpaceOwner({ signedIn: true, role: null }), 'unknown role does not own Me')
  ok(isMomSpaceOwner({ signedIn: false, role: null }), 'signed-out local user owns Me')

  const owner = meSectionCopy({ isOwner: true, momName: 'Sarah' })
  eq(owner.todosTitle, 'My to-dos', 'owner sees "My to-dos"')
  ok(owner.editable && owner.partnerNote === null, 'owner can edit, no partner note')

  const partner = meSectionCopy({ isOwner: false, momName: 'Sarah' })
  eq(partner.todosTitle, 'Sarah’s to-dos', 'partner sees Mom-labelled to-dos, not "My to-dos"')
  ok(!partner.todosTitle.startsWith('My'), 'partner title never claims the items are theirs')
  ok(!partner.editable, 'partner view is read-only')
  ok(!!partner.partnerNote && /Only she/.test(partner.partnerNote), 'partner note explains read-only truthfully')
  eq(meSectionCopy({ isOwner: false, momName: '' }).todosTitle, 'Mom’s to-dos', 'unknown Mom name → "Mom"')
  eq(meSectionCopy({ isOwner: false, momName: 'Jess' }).todosTitle, 'Jess’ to-dos', 'possessive for names ending in s')
}

// ==========================================================================
// Loading ≠ Empty ≠ Failed
// ==========================================================================
{
  eq(loadState({ hydrated: false, loadError: false, count: 0 }), 'loading', 'not hydrated → loading (never empty)')
  eq(loadState({ hydrated: true, loadError: true, count: 0 }), 'failed', 'failed read → failed (never empty)')
  eq(loadState({ hydrated: false, loadError: true, count: 0 }), 'failed', 'failure wins over loading')
  eq(loadState({ hydrated: true, loadError: true, count: 3 }), 'failed', 'stale items after failure are not presented as truth')
  eq(loadState({ hydrated: true, loadError: false, count: 0 }), 'empty', 'loaded + nothing → empty')
  eq(loadState({ hydrated: true, count: 2 }), 'ready', 'loaded + items → ready')
  ok(mayClaimAllClear(['empty', 'ready']), 'all loaded → may claim all clear')
  ok(!mayClaimAllClear(['empty', 'loading']), 'any loading → no all-clear claim')
  ok(!mayClaimAllClear(['empty', 'failed']), 'any failure → no all-clear claim')
}

// ==========================================================================
// Placeholder-name collision
// ==========================================================================
{
  ok(isBootstrapPlaceholder('Me') && isBootstrapPlaceholder(' Member '), 'exact placeholders detected')
  ok(!!placeholderNameError('Me'), '"Me" is explained, not silently looped')
  ok(!!placeholderNameError('Member'), '"Member" is explained')
  ok(placeholderNameError('me') === null, 'lowercase "me" is a normal name')
  ok(placeholderNameError('Mel') === null, '"Mel" is fine')
  ok(placeholderNameError('Sarah') === null, 'real name is fine')
}

// ==========================================================================
// Baby edit → canonical row → First90
// ==========================================================================
{
  const NOW = new Date(2026, 9, 2, 9, 0, 0)
  // Existing canonical Baby (as onboarding wrote it), with a known row id.
  const original = babySetupToProfile({ babyName: 'Emma', birthDate: '2026-09-25' }, 'Sarah', null)
  const before = firstNinetyState(original.birthDate, NOW)
  eq(before.day, 8, 'original birthday → Day 8')

  // The Settings correction: new name + corrected birthday, validated the same way.
  const valid = validateBabySetup({ babyName: ' Emma Rose ', birthDate: '2026-09-20' }, NOW)
  ok(valid.ok, 'edited values validate')
  if (valid.ok) {
    const edited = babySetupToProfile(valid, 'Sarah', { ...original, feeding: 'breast' })
    const row = babyRowFromProfile('fam-1', 'baby-1', edited)
    eq(row.id, 'baby-1', 'edit upserts the SAME Baby row (no duplicate)')
    eq(row.name, 'Emma Rose', 'edited name → babies.name (trimmed)')
    eq(row.birth_date, '2026-09-20', 'edited birthday → babies.birth_date')
    eq(edited.feeding, 'breast', 'edit keeps existing feeding')
    const back = profileFromBabyRow(row, 'Sarah')
    eq(firstNinetyState(back.birthDate, NOW).day, 13, 'First90 follows the corrected birthday (Day 13)')
  }
  const future = validateBabySetup({ babyName: 'Emma', birthDate: '2026-10-05' }, NOW)
  ok(!future.ok, 'editing to a future birthday is rejected')
}

// ==========================================================================
console.log(`\nPR6 hardening: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log('  - ' + f)
  process.exit(1)
}
console.log('✓ all PR6 hardening tests passed')
process.exit(0)
