// MamaHQ — orchestrate the database-dependent test suites (Step 5C).
//
// Assumes a local Supabase stack is already running (`supabase start`) and the
// database has been provisioned from the authoritative migrations
// (`supabase db reset`). This orchestrator:
//   1. Reads the local stack's URL + anon + service_role keys from `supabase status`
//      (unless already provided via env), exporting them as SUPABASE_URL /
//      SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY.
//   2. Runs the completion/restore/increment suite, then the security/RLS suite.
//   3. Exits non-zero if either suite fails.
//
// Local keys only — this never targets a hosted/production project (the harness
// enforces a local-host guard as defense in depth).
//
// In CI, keys are provided directly as env vars by the workflow, so step (1) is
// skipped. Locally (with Docker), it auto-discovers them.

import { spawnSync } from 'node:child_process'

function fromEnv(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function discoverFromCli(): void {
  // `supabase status -o json` prints the local stack's endpoints + keys.
  const res = spawnSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8', shell: true })
  if (res.status !== 0) {
    console.error('✗ Could not read `supabase status`. Is the local stack running (`supabase start`)?')
    console.error(res.stderr || res.stdout)
    process.exit(1)
  }
  let parsed: Record<string, string>
  try {
    parsed = JSON.parse(res.stdout)
  } catch {
    console.error('✗ Could not parse `supabase status -o json` output.')
    process.exit(1)
  }
  // Key names as emitted by the CLI status JSON.
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || parsed.API_URL
  process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || parsed.ANON_KEY
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || parsed.SERVICE_ROLE_KEY
}

function run(script: string): number {
  console.log(`\n=== ${script} ===`)
  const res = spawnSync('node', [script], { stdio: 'inherit', env: process.env, shell: true })
  return res.status ?? 1
}

function main(): void {
  if (!fromEnv()) discoverFromCli()
  if (!fromEnv()) {
    console.error('✗ Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY after discovery.')
    process.exit(1)
  }

  const completion = run('scripts/test-db-completion.ts')
  const security = run('scripts/test-security.ts')
  const household = run('scripts/test-household.ts')
  const membership = run('scripts/test-membership.ts')
  const tasks = run('scripts/test-tasks.ts')
  const handoff = run('scripts/test-handoff.ts')
  const calendar = run('scripts/test-calendar.ts')
  const notifications = run('scripts/test-notifications.ts')
  const tellSecurity = run('scripts/test-tell-security.ts')

  if (completion !== 0 || security !== 0 || household !== 0 || membership !== 0 || tasks !== 0 || handoff !== 0 || calendar !== 0 || notifications !== 0 || tellSecurity !== 0) {
    console.error(`\n✗ Database tests failed (completion=${completion}, security=${security}, household=${household}, membership=${membership}, tasks=${tasks}, handoff=${handoff}, calendar=${calendar}, notifications=${notifications}, tellSecurity=${tellSecurity}).`)
    process.exit(1)
  }
  console.log('\n✓ All database-dependent suites passed.')
  process.exit(0)
}

main()
