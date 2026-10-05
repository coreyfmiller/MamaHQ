// MamaHQ — PR6 ownership / membership / privilege hardening tests (0017).
//
// Runs against a LOCAL/CI Supabase stack (never production) with REAL authenticated
// JWTs, so RLS and SECURITY DEFINER authorization genuinely execute. Proves the
// database — not the UI — enforces:
//   * a member cannot take ownership (owner_id) of a family;
//   * a family cannot be inserted claiming another account as owner;
//   * nobody can delete the owner's membership; members can't remove other members;
//     the owner can remove a member;
//   * linked household identities can't be deleted by a client;
//   * only the owner can delete the Baby row;
//   * Start Over (reset_family_data) is owner-only, and does what it says;
//   * internal SECURITY DEFINER helpers are NOT executable by anon/authenticated,
//     while the legitimate RPC paths that use them still work.
//
// Run: node scripts/test-ownership.ts  (env: SUPABASE_URL, SUPABASE_ANON_KEY,
//                                       SUPABASE_SERVICE_ROLE_KEY)

import { createHash, randomBytes } from 'node:crypto'
import {
  admin, anonClient, createUser, makeRunner, assert, assertEqual, errorContains, cleanupUsers,
  type Client, type TestUser,
} from './db/harness.ts'
import { resolveSetupRoute, isBootstrapPlaceholder } from '../lib/onboarding.ts'

const A = admin()
const { test, finish } = makeRunner('Ownership & Privilege Hardening')

async function ensureFamily(u: TestUser): Promise<string> {
  const { data, error } = await u.client.rpc('ensure_family')
  assert(!error, `ensure_family failed: ${error?.message}`)
  return data as string
}

async function ensureOwnerPerson(u: TestUser, familyId: string): Promise<string> {
  const { data, error } = await u.client.rpc('ensure_owner_person', { fid: familyId })
  assert(!error, `ensure_owner_person failed: ${error?.message}`)
  return data as string
}

async function addPerson(client: Client, familyId: string, name: string, rel = 'member'): Promise<string> {
  const { data, error } = await client
    .from('household_people').insert({ family_id: familyId, display_name: name, relationship: rel })
    .select('id').single()
  assert(!error, `insert person failed: ${error?.message}`)
  return (data as { id: string }).id
}

async function invite(owner: TestUser, personId: string, joiner: TestUser): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const hash = createHash('sha256').update(token).digest('hex')
  const c = await owner.client.rpc('create_household_invitation', { p_person_id: personId, p_token_hash: hash, p_email: null, p_ttl_seconds: 604800 })
  assert(!c.error, `create invite failed: ${c.error?.message}`)
  const a = await joiner.client.rpc('accept_household_invitation', { p_token_hash: hash })
  assert(!a.error, `accept invite failed: ${a.error?.message}`)
}

async function ownerOf(familyId: string): Promise<string | null> {
  const { data } = await A.from('families').select('owner_id').eq('id', familyId).maybeSingle()
  return (data as { owner_id: string } | null)?.owner_id ?? null
}

async function membership(familyId: string, userId: string) {
  const { data } = await A.from('family_members').select('role,status').eq('family_id', familyId).eq('user_id', userId).maybeSingle()
  return data as { role: string; status: string } | null
}

async function count(table: string, familyId: string, extra?: (q: any) => any): Promise<number> { // eslint-disable-line @typescript-eslint/no-explicit-any
  let q = A.from(table).select('*', { count: 'exact', head: true }).eq('family_id', familyId)
  if (extra) q = extra(q)
  const { count: n, error } = await q
  assert(!error, `count ${table} failed: ${error?.message}`)
  return n ?? 0
}

// An RPC must be refused for lack of EXECUTE privilege (not merely fail on input).
function isPrivilegeDenied(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  return err.code === '42501' || errorContains(err, 'permission denied')
}

async function main() {
  await cleanupUsers(A)

  const mom = await createUser(A, 'own-mom')
  const partner = await createUser(A, 'own-partner')
  const helper = await createUser(A, 'own-helper')
  const outsider = await createUser(A, 'own-outsider')

  const fam = await ensureFamily(mom)
  const famOut = await ensureFamily(outsider)
  const momPid = await ensureOwnerPerson(mom, fam)
  await ensureOwnerPerson(outsider, famOut)
  await mom.client.rpc('set_my_display_name', { p_family_id: fam, p_display_name: 'Sarah' })

  const partnerPid = await addPerson(mom.client, fam, 'James', 'partner')
  await invite(mom, partnerPid, partner)
  const helperPid = await addPerson(mom.client, fam, 'Grandma', 'member')
  await invite(mom, helperPid, helper)

  assertEqual(await ownerOf(fam), mom.id, 'setup: mom owns the family')
  assertEqual((await membership(fam, partner.id))?.role, 'member', 'setup: partner is a member')

  // ========================================================================
  // families: ownership cannot be taken or forged
  // ========================================================================
  await test('a member cannot reassign owner_id to themselves', async () => {
    await partner.client.from('families').update({ owner_id: partner.id }).eq('id', fam)
    assertEqual(await ownerOf(fam), mom.id, 'owner unchanged after member update attempt')
  })

  await test('a member cannot update the family row at all', async () => {
    const { data } = await partner.client.from('families').update({ owner_id: mom.id }).eq('id', fam).select('id')
    assertEqual((data ?? []).length, 0, 'member update affects zero rows')
  })

  await test('the owner cannot hand owner_id to another account via a client update', async () => {
    await mom.client.from('families').update({ owner_id: partner.id }).eq('id', fam)
    assertEqual(await ownerOf(fam), mom.id, 'owner unchanged — no client-side ownership transfer')
  })

  await test('a family cannot be inserted claiming another account as owner', async () => {
    // Target an account that owns NO family (the partner), so the 0015 one-family-
    // per-owner unique index can't be what rejects it — only the 0017 policy can.
    const { error } = await outsider.client.from('families').insert({ owner_id: partner.id })
    assert(error, 'expected forged-owner insert to be rejected')
    const { count: n } = await A.from('families').select('*', { count: 'exact', head: true }).eq('owner_id', partner.id)
    assertEqual(n, 0, 'no family was planted for the partner')
  })

  await test('the owner can still read their family (legitimate access intact)', async () => {
    const { data, error } = await mom.client.from('families').select('id,owner_id').eq('id', fam).maybeSingle()
    assert(!error && data, `owner read failed: ${error?.message}`)
    assertEqual((data as { owner_id: string }).owner_id, mom.id, 'owner sees themselves as owner')
  })

  // ========================================================================
  // family_members: owner self-protection + no arbitrary removal
  // ========================================================================
  await test("a member cannot delete the owner's membership", async () => {
    await partner.client.from('family_members').delete().eq('family_id', fam).eq('user_id', mom.id)
    assertEqual((await membership(fam, mom.id))?.role, 'owner', 'owner membership intact')
  })

  await test('a member cannot remove another member', async () => {
    await partner.client.from('family_members').delete().eq('family_id', fam).eq('user_id', helper.id)
    assert(await membership(fam, helper.id), 'helper membership intact after partner delete attempt')
  })

  await test('the owner cannot delete their own membership (no self-lockout)', async () => {
    await mom.client.from('family_members').delete().eq('family_id', fam).eq('user_id', mom.id)
    assertEqual((await membership(fam, mom.id))?.role, 'owner', 'owner membership intact')
  })

  await test('an outsider cannot delete any membership in another family', async () => {
    await outsider.client.from('family_members').delete().eq('family_id', fam)
    assert(await membership(fam, mom.id), 'owner intact')
    assert(await membership(fam, partner.id), 'partner intact')
  })

  // ========================================================================
  // household_people + babies
  // ========================================================================
  await test("a member cannot delete a LINKED person (e.g. the owner's identity)", async () => {
    await partner.client.from('household_people').delete().eq('id', momPid)
    const { data } = await A.from('household_people').select('id,user_id').eq('id', momPid).maybeSingle()
    assertEqual((data as { user_id: string } | null)?.user_id, mom.id, "owner's linked person still exists")
  })

  await test('an account-less person can still be removed by a member', async () => {
    const tmp = await addPerson(partner.client, fam, 'Neighbour', 'other')
    await partner.client.from('household_people').delete().eq('id', tmp)
    const { data } = await A.from('household_people').select('id').eq('id', tmp).maybeSingle()
    assertEqual(data, null, 'account-less person deleted')
  })

  const { data: babyRow } = await A.from('babies').insert({ family_id: fam, name: 'Emma', birth_date: '2026-09-20' }).select('id').single()
  const babyId = (babyRow as { id: string }).id

  await test('a member can update the Baby row (shared household data)', async () => {
    const { error } = await partner.client.from('babies').update({ name: 'Emma Rose' }).eq('id', babyId)
    assert(!error, `member baby update failed: ${error?.message}`)
    const { data } = await A.from('babies').select('name').eq('id', babyId).maybeSingle()
    assertEqual((data as { name: string }).name, 'Emma Rose', 'name updated')
  })

  await test('a member cannot delete the Baby row', async () => {
    await partner.client.from('babies').delete().eq('id', babyId)
    assertEqual(await count('babies', fam), 1, 'baby still exists')
  })

  // ========================================================================
  // Start Over — reset_family_data is owner-only and does what it says
  // ========================================================================
  await A.from('logs').insert({ family_id: fam, kind: 'feed', amount: '3 oz' })
  await A.from('mom_items').insert({ family_id: fam, kind: 'task', text: 'Call pediatrician' })
  const accountless = await addPerson(mom.client, fam, 'Aunt Jo', 'other')

  // Regression setup (0018): establish the family's dormant care_responsibility row
  // pointing at the baby. Reproduces the production state where Start Over hit
  // 23505 on care_responsibility_family_subject (baby delete set subject_baby_id
  // NULL → collided with the family's coalesce(NULL) uniqueness slot) and aborted.
  await test('setup: care_responsibility row exists for the baby before Start Over', async () => {
    const { error } = await mom.client.rpc('ensure_care_responsibility', { p_family_id: fam })
    assert(!error, `ensure_care_responsibility failed: ${error?.message}`)
    assert((await count('care_responsibility', fam)) >= 1, 'a care row exists')
  })

  await test('a joined member cannot Start Over (server rejects)', async () => {
    const { error } = await partner.client.rpc('reset_family_data', { p_family_id: fam })
    assert(error, 'expected member reset to be rejected')
    assert(errorContains(error, 'only the household owner'), `got: ${error?.message}`)
    assertEqual(await count('babies', fam), 1, 'baby untouched')
    assertEqual(await count('logs', fam), 1, 'logs untouched')
  })

  await test('an outsider cannot Start Over another family', async () => {
    const { error } = await outsider.client.rpc('reset_family_data', { p_family_id: fam })
    assert(error, 'expected outsider reset to be rejected')
    assert(errorContains(error, 'not authorized'), `got: ${error?.message}`)
    assertEqual(await count('logs', fam), 1, 'logs untouched')
  })

  await test('anon cannot Start Over', async () => {
    const { error } = await anonClient().rpc('reset_family_data', { p_family_id: fam })
    assert(error, 'expected anon reset to be rejected')
  })

  await test('the owner can Start Over even with a care_responsibility row (no 23505)', async () => {
    const { error } = await mom.client.rpc('reset_family_data', { p_family_id: fam })
    // Regression: this used to fail with 23505 on care_responsibility_family_subject.
    assert(!error, `owner reset failed: ${error?.code ?? ''} ${error?.message}`)
    assertEqual(await count('babies', fam), 0, 'baby cleared')
    assertEqual(await count('logs', fam), 0, 'logs cleared')
    assertEqual(await count('mom_items', fam), 0, 'mom items cleared')
    assertEqual(await count('care_responsibility', fam), 0, 'dormant care_responsibility cleared')
    assertEqual(await count('care_handoffs', fam), 0, 'dormant care_handoffs cleared')
    const { data } = await A.from('household_people').select('id').eq('id', accountless).maybeSingle()
    assertEqual(data, null, 'account-less person cleared')
  })

  await test('Start Over keeps linked identities and memberships, and resets only the owner name', async () => {
    const { data: me } = await A.from('household_people').select('display_name,user_id').eq('id', momPid).maybeSingle()
    assertEqual((me as { display_name: string }).display_name, 'Me', "owner's name back to the 'Me' placeholder")
    const { data: p } = await A.from('household_people').select('display_name,user_id').eq('id', partnerPid).maybeSingle()
    assertEqual((p as { user_id: string } | null)?.user_id, partner.id, "partner's linked person kept")
    assertEqual((await membership(fam, partner.id))?.role, 'member', 'partner membership kept')
    assertEqual((await membership(fam, mom.id))?.role, 'owner', 'owner membership kept')
    assertEqual(await ownerOf(fam), mom.id, 'ownership unchanged')
  })

  // Regression: after Start Over the PERSISTED owner name must be the recognized
  // placeholder, so onboarding resolves to the NAME step from canonical data — and
  // then name → Baby → app proceeds normally.
  const routeFromDb = async () => {
    const { data: p } = await mom.client.from('household_people').select('display_name').eq('family_id', fam).eq('user_id', mom.id).maybeSingle()
    const { data: b } = await mom.client.from('babies').select('name,birth_date').eq('family_id', fam).limit(1).maybeSingle()
    const name = (p as { display_name: string } | null)?.display_name ?? null
    const baby = b as { name: string; birth_date: string } | null
    return resolveSetupRoute({
      firstRun: isBootstrapPlaceholder(name) ? 'creator' : 'done',
      householdHydrated: true,
      profileHydrated: true,
      profileLoadFailed: false,
      profile: baby ? { babyName: baby.name, birthDate: baby.birth_date } : null,
      partnerJoinDismissed: false,
      role: 'owner',
    })
  }

  await test('after Start Over, onboarding (from persisted data) resolves to the NAME step', async () => {
    assertEqual(await routeFromDb(), 'name', 'route after reset')
  })

  await test('after Start Over, saving a new name advances to the Baby step', async () => {
    const { error } = await mom.client.rpc('set_my_display_name', { p_family_id: fam, p_display_name: 'Sam' })
    assert(!error, `rename failed: ${error?.message}`)
    assertEqual(await routeFromDb(), 'baby', 'route after new name')
  })

  await test('after Start Over, completing Baby setup advances to the app (Today)', async () => {
    const { error } = await mom.client.from('babies').insert({ family_id: fam, name: 'Noah', birth_date: '2026-09-28' })
    assert(!error, `baby insert failed: ${error?.message}`)
    assertEqual(await routeFromDb(), 'app', 'route after Baby setup')
  })

  // ========================================================================
  // Owner may remove a member (intended ownership model) — run late.
  // ========================================================================
  await test('the owner can remove a member', async () => {
    await mom.client.from('family_members').delete().eq('family_id', fam).eq('user_id', helper.id)
    assertEqual(await membership(fam, helper.id), null, 'helper removed by owner')
  })

  // ========================================================================
  // Internal SECURITY DEFINER helpers — not executable by clients
  // ========================================================================
  const internal: Array<[string, Record<string, unknown>]> = [
    ['emit_notification', {
      p_family_id: fam, p_recipient_user_id: partner.id, p_actor_user_id: mom.id, p_type: 'task_assigned',
      p_domain: 'task', p_entity_id: fam, p_title: 'forged', p_dedupe_key: `forged-${Date.now()}`, p_metadata: {},
    }],
    ['notif_account_for_person', { p_family_id: fam, p_person_id: partnerPid }],
    ['set_calendar_participants', { p_event_id: fam, p_family_id: fam, p_person_ids: [] }],
    ['recompute_household_default', { p_family_id: fam, p_canonical_item_id: 'milk' }],
    ['upsert_household_variant', {
      p_family_id: fam, p_canonical_item_id: 'milk', p_variant_key: 'k', p_display_name: 'Milk', p_brand: null,
      p_variant: null, p_package_size: null, p_package_unit: null, p_package_type: null, p_resolved_attributes: null, p_store: null,
    }],
    ['assert_task_assignee', { p_family_id: fam, p_person_id: partnerPid }],
    ['assert_calendar_person', { p_family_id: fam, p_person_id: partnerPid }],
  ]
  for (const [fn, args] of internal) {
    await test(`authenticated client cannot execute internal helper ${fn}`, async () => {
      const { error } = await partner.client.rpc(fn, args)
      assert(isPrivilegeDenied(error), `expected permission denied, got: ${error?.code} ${error?.message}`)
    })
    await test(`anon cannot execute internal helper ${fn}`, async () => {
      const { error } = await anonClient().rpc(fn, args)
      assert(isPrivilegeDenied(error), `expected permission denied, got: ${error?.code} ${error?.message}`)
    })
  }

  await test('no forged notification was created by the denied emit_notification call', async () => {
    const { count: n } = await A.from('notifications').select('*', { count: 'exact', head: true }).eq('title', 'forged')
    assertEqual(n, 0, 'no forged notification')
  })

  await test('legitimate RPC paths that use internal helpers still work (create_task → notification)', async () => {
    await mom.client.rpc('set_my_display_name', { p_family_id: fam, p_display_name: 'Sarah' })
    const { error } = await mom.client.rpc('create_task', {
      p_family_id: fam, p_title: 'Pick up diapers', p_assigned_to_person_id: partnerPid,
      p_due_at: null, p_notes: null, p_source: 'manual', p_client_task_id: null,
    })
    assert(!error, `create_task failed: ${error?.message}`)
    const { count: n } = await A.from('notifications').select('*', { count: 'exact', head: true })
      .eq('family_id', fam).eq('recipient_user_id', partner.id)
    assert((n ?? 0) >= 1, 'partner received the internally-emitted notification')
  })

  await test('legitimate calendar create with participants still works (set_calendar_participants internal)', async () => {
    const { data, error } = await mom.client.rpc('create_calendar_event', {
      p_family_id: fam, p_title: 'Checkup', p_all_day: true, p_starts_at: null, p_ends_at: null,
      p_start_date: '2026-10-10', p_end_date: null, p_location: null, p_notes: null,
      p_responsible_person_id: momPid, p_participant_ids: [partnerPid], p_client_event_id: null,
    })
    assert(!error, `create_calendar_event failed: ${error?.message}`)
    const { count: n } = await A.from('calendar_event_participants').select('*', { count: 'exact', head: true }).eq('event_id', data as string)
    assertEqual(n, 1, 'participant row written through the internal helper')
  })

  await cleanupUsers(A)
  finish()
}

main().catch((e) => {
  console.error('Fatal:', e instanceof Error ? e.message : e)
  process.exit(1)
})
