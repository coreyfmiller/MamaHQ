// MamaHQ — Start Over / Reset confirmation gate deterministic tests.
//
// Pure, no network, no DB, no AI. Proves the reset confirmation is BOTH truthful and
// reachable: with a baby you must type the baby's name; with NO baby (a valid state —
// baby is optional) you confirm by typing RESET, so a childless household can still
// reset. The destructive button is gated on this predicate.
//
//   node scripts/test-reset-confirm.ts   (npm run test:reset-confirm)

import { resetConfirmationMatches, RESET_CONFIRM_WORD } from '../lib/reset-confirm.ts'

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

// ==========================================================================
// BABY EXISTS — type the baby's name (case-insensitive, trimmed). Unchanged path.
// ==========================================================================
{
  const hasBaby = true
  const name = 'Emma'
  ok(!resetConfirmationMatches(hasBaby, name, ''), 'baby: blank → disabled')
  ok(!resetConfirmationMatches(hasBaby, name, 'Emily'), 'baby: wrong name → disabled')
  ok(resetConfirmationMatches(hasBaby, name, 'Emma'), 'baby: exact name → enabled')
  ok(resetConfirmationMatches(hasBaby, name, 'emma'), 'baby: case-insensitive → enabled')
  ok(resetConfirmationMatches(hasBaby, name, '  Emma  '), 'baby: surrounding whitespace trimmed → enabled')
  // Typing the literal RESET does NOT satisfy the baby path (must be the name).
  ok(!resetConfirmationMatches(hasBaby, name, 'RESET'), 'baby: typing RESET does not match the baby path')
}

// ==========================================================================
// NO BABY — type RESET (exact, case-sensitive). The previously-unreachable path.
// ==========================================================================
{
  const hasBaby = false
  const name = '' // no baby profile → empty name
  ok(!resetConfirmationMatches(hasBaby, name, ''), 'no baby: blank → disabled')
  ok(resetConfirmationMatches(hasBaby, name, 'RESET'), 'no baby: RESET → enabled')
  ok(resetConfirmationMatches(hasBaby, name, '  RESET  '), 'no baby: RESET trimmed → enabled')
  ok(!resetConfirmationMatches(hasBaby, name, 'reset'), 'no baby: lowercase reset → disabled (case-sensitive)')
  ok(!resetConfirmationMatches(hasBaby, name, 'Reset'), 'no baby: mixed-case Reset → disabled')
  ok(!resetConfirmationMatches(hasBaby, name, 'DELETE'), 'no baby: DELETE → disabled (word is RESET, account is preserved)')
  // Regression: the OLD logic (typed === babyName && babyName.length>0) made this
  // ALWAYS false when no baby existed — a permanent lockout. Prove it is reachable now.
  ok(resetConfirmationMatches(false, '', RESET_CONFIRM_WORD), 'no baby: reset is REACHABLE (regression guard for the lockout)')
}

// ==========================================================================
// Edge: hasBaby true but name somehow blank → never matches (cannot arm on empty).
// ==========================================================================
{
  ok(!resetConfirmationMatches(true, '', ''), 'defensive: hasBaby with empty name never matches on blank')
  ok(!resetConfirmationMatches(true, '   ', 'RESET'), 'defensive: hasBaby with whitespace name does not accept RESET')
}

// ==========================================================================
console.log(`\nReset confirmation: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log('  - ' + f)
  process.exit(1)
}
console.log('✓ all reset confirmation tests passed')
process.exit(0)
