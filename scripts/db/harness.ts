// MamaHQ — DB/security test harness (Step 5C)
//
// Shared plumbing for the database-dependent test suites that run against a
// LOCAL/CI Supabase stack (never production). It:
//   * reads connection info + keys from the environment (see below),
//   * exposes a service-role admin client (RLS-bypassing) for setup/teardown,
//   * creates confirmed auth users and returns clients authenticated with their
//     REAL JWT so row-level security genuinely executes for that role.
//
// Env (provided by the CI job / a local .env.test.local; NEVER production):
//   SUPABASE_URL                 e.g. http://127.0.0.1:54321
//   SUPABASE_ANON_KEY            local anon key (safe: unlocks only the throwaway DB)
//   SUPABASE_SERVICE_ROLE_KEY    local service role key (setup/teardown only)
//
// These are LOCAL Supabase keys. The suites refuse to run against anything that
// looks like a remote supabase.co host, as a defense-in-depth guard against ever
// pointing this at production.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type Client = SupabaseClient

function reqEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`✗ Missing required env ${name}. This suite runs only against a LOCAL/CI Supabase stack.`)
    process.exit(1)
  }
  return v
}

export function config() {
  const url = reqEnv('SUPABASE_URL')
  const anonKey = reqEnv('SUPABASE_ANON_KEY')
  const serviceKey = reqEnv('SUPABASE_SERVICE_ROLE_KEY')

  // Hard safety rail: never allow these destructive/privileged tests to target a
  // hosted Supabase project. Local hosts only.
  const host = new URL(url).hostname
  const localish = ['127.0.0.1', 'localhost', '::1', 'host.docker.internal', 'kong', 'supabase_kong']
  const isLocal = localish.includes(host) || host.endsWith('.local') || host.startsWith('172.') || host.startsWith('10.')
  if (!isLocal) {
    console.error(`✗ Refusing to run: SUPABASE_URL host "${host}" is not local. These tests must never touch a hosted/production project.`)
    process.exit(1)
  }

  return { url, anonKey, serviceKey }
}

export function admin(): Client {
  const { url, serviceKey } = config()
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function anonClient(): Client {
  const { url, anonKey } = config()
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

let userCounter = 0

export interface TestUser {
  id: string
  email: string
  password: string
  client: Client // authenticated with this user's real JWT
}

// Create a confirmed user (via admin API) and return a client signed in AS them.
export async function createUser(admin_: Client, label: string): Promise<TestUser> {
  const { url, anonKey } = config()
  const unique = `${Date.now()}-${userCounter++}`
  const email = `s5c-${label}-${unique}@example.test`
  const password = `Test-${unique}-pw!`

  const { data, error } = await admin_.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`createUser(${label}) failed: ${error?.message}`)

  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password })
  if (signInErr) throw new Error(`signIn(${label}) failed: ${signInErr.message}`)

  return { id: data.user.id, email, password, client }
}

// ---------------------------------------------------------------------------
// Tiny assertion + runner utilities (no external test framework — matches the
// project's existing hand-rolled gold-standard style).
// ---------------------------------------------------------------------------
export interface Result {
  passed: number
  failed: number
}

export function makeRunner(suiteName: string) {
  const state: Result = { passed: 0, failed: 0 }
  const failures: string[] = []

  async function test(name: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn()
      state.passed++
      console.log(`  ✓ ${name}`)
    } catch (e) {
      state.failed++
      const msg = e instanceof Error ? e.message : String(e)
      failures.push(`${name}: ${msg}`)
      console.log(`  ✗ ${name}\n      ${msg}`)
    }
  }

  function finish(): never {
    console.log(`\n${suiteName}: ${state.passed} passed, ${state.failed} failed`)
    if (state.failed > 0) {
      console.log('\nFailures:')
      for (const f of failures) console.log(`  - ${f}`)
      process.exit(1)
    }
    console.log(`✓ all ${suiteName} tests passed`)
    process.exit(0)
  }

  return { test, finish, state }
}

// Assertions -----------------------------------------------------------------
export function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

export function assertEqual<T>(actual: T, expected: T, msg?: string): void {
  if (actual !== expected) {
    throw new Error(`${msg ?? 'assertEqual'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

// A Postgres/PostgREST error whose message contains `needle` (case-insensitive).
export function errorContains(err: unknown, needle: string): boolean {
  if (!err) return false
  const anyErr = err as { message?: string }
  return typeof anyErr.message === 'string' && anyErr.message.toLowerCase().includes(needle.toLowerCase())
}

// Delete all auth users created by these suites (email prefix s5c-). Best-effort.
export async function cleanupUsers(admin_: Client): Promise<void> {
  try {
    const { data } = await admin_.auth.admin.listUsers({ page: 1, perPage: 1000 })
    for (const u of data?.users ?? []) {
      if (u.email?.startsWith('s5c-')) {
        await admin_.auth.admin.deleteUser(u.id)
      }
    }
  } catch {
    // non-fatal
  }
}
