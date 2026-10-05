// MamaHQ — Start Over / Reset confirmation gate deterministic tests.
//
// Pure, no network, no DB, no AI. Proves the reset confirmation is BOTH truthful and
// reachable: with a baby you must type the baby's name; with NO baby (a valid state —
// baby is optional) you confirm by typing RESET, so a childless household can still
// reset. The destructive button is gated on this predicate.
//
//   node scripts/test-reset-confirm.ts   (npm run test:reset-confirm)

import { resetConfirmationMatches, runStartOver, RESET_CONFIRM_WORD } from '../lib/reset-confirm.ts'
import { resolveSetupRoute, isBootstrapPlaceholder } from '../lib/onboarding.ts'

function eq<T>(actual: T, expected: T, msg: string) {
  ok(actual === expected, `${msg} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`)
}

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
// START OVER → onboarding NAME step (regression: stale owner name → Baby step)
// ==========================================================================
// Simulate canonical persisted state + the client's view of it, run the REAL
// runStartOver orchestration, and resolve the REAL onboarding router at every step.
async function startOverScenario(opts: { cloudFails?: boolean; refreshFails?: boolean } = {}) {
  // Canonical DB truth (what reset_family_data operates on).
  const db = { ownerName: 'Sarah', baby: { babyName: 'Emma', birthDate: '2026-09-20' } as { babyName: string; birthDate: string } | null }
  // The client's current view (household people + profile providers).
  const client = { ownerName: db.ownerName, profile: db.baby ? { ...db.baby } : null }
  const calls: string[] = []
  const routes: string[] = []
  const route = () =>
    resolveSetupRoute({
      firstRun: isBootstrapPlaceholder(client.ownerName) ? 'creator' : 'done',
      householdHydrated: true,
      profileHydrated: true,
      profileLoadFailed: false,
      profile: client.profile,
      partnerJoinDismissed: false,
      role: 'owner',
    })
  routes.push(route())
  const result = await runStartOver({
    signedIn: true,
    resetCloud: async () => {
      calls.push('resetCloud')
      if (opts.cloudFails) throw new Error('rpc failed')
      // reset_family_data: Baby removed AND owner name reset, in one transaction.
      db.baby = null
      db.ownerName = 'Me'
      routes.push(route())
    },
    refreshHousehold: async () => {
      calls.push('refreshHousehold')
      if (opts.refreshFails) return false
      client.ownerName = db.ownerName // canonical re-read
      routes.push(route())
      return true
    },
    clearLocal: () => {
      calls.push('clearLocal')
      client.profile = null
      routes.push(route())
    },
  })
  return { db, client, calls, routes, result, route }
}

await (async () => {
  // 1–5: completed owner → Start Over → Baby removed, name reset, router → NAME.
  const s = await startOverScenario()
  eq(s.routes[0], 'app', 'before: completed owner profile → app')
  eq(s.result, 'reset', 'Start Over completes')
  ok(s.db.baby === null, 'Baby setup removed by the reset')
  ok(isBootstrapPlaceholder(s.db.ownerName), "canonical owner name reset to the 'Me' placeholder")
  eq(s.calls.join('>'), 'resetCloud>refreshHousehold>clearLocal', 'order: server reset → household re-read → local clear')
  eq(s.route(), 'name', 'after Start Over the router resolves to the NAME step')
  ok(!s.routes.slice(1).includes('baby'), 'the Baby step is NEVER shown on the way (no stale-name flash)')

  // 6: saving a new name advances to the Baby step.
  s.db.ownerName = 'Sam'
  s.client.ownerName = s.db.ownerName
  eq(s.route(), 'baby', 'new name saved → Baby step')

  // 7: completing Baby setup advances to the app/Today.
  s.db.baby = { babyName: 'Noah', birthDate: '2026-09-28' }
  s.client.profile = { ...s.db.baby }
  eq(s.route(), 'app', 'Baby setup completed → app (Today)')
})()

await (async () => {
  // Server reset fails → nothing local is cleared and the owner stays where they were.
  const s = await startOverScenario({ cloudFails: true })
  eq(s.result, 'failed', 'server failure reported')
  eq(s.calls.join('>'), 'resetCloud', 'no household re-read and no local clear after a failed reset')
  ok(s.client.profile !== null, 'local Baby profile untouched on failure')
  eq(s.route(), 'app', 'still in the app — nothing half-reset')
})()

await (async () => {
  // Household re-read fails → reported as pending (reload finishes it); never claims done.
  const s = await startOverScenario({ refreshFails: true })
  eq(s.result, 'reset_reload_pending', 'failed re-read is reported, not claimed as done')
})()

await (async () => {
  // Signed-out local data: nothing cloud-side, local cleared.
  const calls: string[] = []
  const r = await runStartOver({
    signedIn: false,
    resetCloud: async () => { calls.push('resetCloud') },
    refreshHousehold: async () => { calls.push('refreshHousehold'); return true },
    clearLocal: () => { calls.push('clearLocal') },
  })
  eq(r, 'reset', 'signed-out reset completes')
  eq(calls.join('>'), 'clearLocal', 'signed-out reset touches only local data')
})()

// ==========================================================================
console.log(`\nReset confirmation: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log('  - ' + f)
  process.exit(1)
}
console.log('✓ all reset confirmation tests passed')
process.exit(0)
