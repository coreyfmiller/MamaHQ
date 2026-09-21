'use client'

// Family-scoped data access layer. Every function takes the familyId and talks to
// Supabase with the browser client (RLS enforces access on top). Row shapes here
// are the DB shapes; the stores map these to/from their client types. Keeping all
// table access in one module means the stores don't sprinkle SQL/table names around.

import { supabaseBrowser } from './client'

/* ---------------- Logs ---------------- */

export interface DbLog {
  id: string
  family_id: string
  kind: 'feed' | 'sleep' | 'diaper' | 'pumping' | 'medication'
  created_at: string
  ended_at: string | null
  amount: string | null
  side: 'left' | 'right' | null
  diaper_type: 'wet' | 'dirty' | 'mixed' | null
  note: string | null
}

export async function fetchLogs(familyId: string): Promise<DbLog[]> {
  const { data, error } = await supabaseBrowser()
    .from('logs')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DbLog[]
}

export async function insertLog(row: Omit<DbLog, 'family_id'> & { family_id: string }): Promise<void> {
  const { error } = await supabaseBrowser().from('logs').insert(row)
  if (error) throw error
}

export async function updateLog(id: string, patch: Partial<DbLog>): Promise<void> {
  const { error } = await supabaseBrowser().from('logs').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteLog(id: string): Promise<void> {
  const { error } = await supabaseBrowser().from('logs').delete().eq('id', id)
  if (error) throw error
}

/* ---------------- Appointments (+ questions) ---------------- */

export interface DbAppointment {
  id: string
  family_id: string
  title: string
  when_at: string
  location: string | null
  reminders_on: boolean
  created_at: string
}
export interface DbApptQuestion {
  id: string
  appointment_id: string
  family_id: string
  text: string
  asked: boolean
  created_at: string
}

export async function fetchAppointments(familyId: string): Promise<DbAppointment[]> {
  const { data, error } = await supabaseBrowser()
    .from('appointments')
    .select('*')
    .eq('family_id', familyId)
    .order('when_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as DbAppointment[]
}
export async function fetchApptQuestions(familyId: string): Promise<DbApptQuestion[]> {
  const { data, error } = await supabaseBrowser()
    .from('appointment_questions')
    .select('*')
    .eq('family_id', familyId)
  if (error) throw error
  return (data ?? []) as DbApptQuestion[]
}
export async function insertAppointment(row: DbAppointment): Promise<void> {
  const { error } = await supabaseBrowser().from('appointments').insert(row)
  if (error) throw error
}
export async function updateAppointment(id: string, patch: Partial<DbAppointment>): Promise<void> {
  const { error } = await supabaseBrowser().from('appointments').update(patch).eq('id', id)
  if (error) throw error
}
export async function deleteAppointment(id: string): Promise<void> {
  const { error } = await supabaseBrowser().from('appointments').delete().eq('id', id)
  if (error) throw error
}
export async function insertApptQuestion(row: DbApptQuestion): Promise<void> {
  const { error } = await supabaseBrowser().from('appointment_questions').insert(row)
  if (error) throw error
}
export async function updateApptQuestion(id: string, patch: Partial<DbApptQuestion>): Promise<void> {
  const { error } = await supabaseBrowser().from('appointment_questions').update(patch).eq('id', id)
  if (error) throw error
}
export async function deleteApptQuestion(id: string): Promise<void> {
  const { error } = await supabaseBrowser().from('appointment_questions').delete().eq('id', id)
  if (error) throw error
}

/* ---------------- Mom (moods + items) ---------------- */

export interface DbMomItem {
  id: string
  family_id: string
  kind: 'task' | 'question'
  text: string
  done: boolean
  created_at: string
  /** Who the task is handed off to. null/undefined = mom's own task. */
  assignee?: 'partner' | null
}

export async function fetchMomMoods(familyId: string): Promise<Record<string, string>> {
  const { data, error } = await supabaseBrowser()
    .from('mom_moods')
    .select('day, mood')
    .eq('family_id', familyId)
  if (error) throw error
  const map: Record<string, string> = {}
  for (const r of data ?? []) map[(r as { day: string }).day] = (r as { mood: string }).mood
  return map
}
export async function upsertMomMood(familyId: string, day: string, mood: string): Promise<void> {
  const { error } = await supabaseBrowser()
    .from('mom_moods')
    .upsert({ family_id: familyId, day, mood, updated_at: new Date().toISOString() })
  if (error) throw error
}
export async function deleteMomMood(familyId: string, day: string): Promise<void> {
  const { error } = await supabaseBrowser()
    .from('mom_moods')
    .delete()
    .eq('family_id', familyId)
    .eq('day', day)
  if (error) throw error
}
export async function fetchMomItems(familyId: string): Promise<DbMomItem[]> {
  const { data, error } = await supabaseBrowser()
    .from('mom_items')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DbMomItem[]
}
export async function insertMomItem(row: DbMomItem): Promise<void> {
  const { error } = await supabaseBrowser().from('mom_items').insert(row)
  if (error) throw error
}
export async function updateMomItem(id: string, patch: Partial<DbMomItem>): Promise<void> {
  const { error } = await supabaseBrowser().from('mom_items').update(patch).eq('id', id)
  if (error) throw error
}
export async function deleteMomItem(id: string): Promise<void> {
  const { error } = await supabaseBrowser().from('mom_items').delete().eq('id', id)
  if (error) throw error
}

/* ---------------- Memories ---------------- */

export interface DbMemory {
  id: string
  family_id: string
  photo: string
  caption: string | null
  created_at: string
}
export async function fetchMemories(familyId: string): Promise<DbMemory[]> {
  const { data, error } = await supabaseBrowser()
    .from('memories')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DbMemory[]
}
export async function insertMemory(row: DbMemory): Promise<void> {
  const { error } = await supabaseBrowser().from('memories').insert(row)
  if (error) throw error
}
export async function deleteMemory(id: string): Promise<void> {
  const { error } = await supabaseBrowser().from('memories').delete().eq('id', id)
  if (error) throw error
}

/* ---------------- Captures ---------------- */

export interface DbCapture {
  id: string
  family_id: string
  source: 'type' | 'voice' | 'photo' | 'gmail'
  raw_text: string
  status: 'proposed' | 'committed' | 'dismissed'
  items: unknown
  created_at: string
}
export async function fetchCaptures(familyId: string): Promise<DbCapture[]> {
  const { data, error } = await supabaseBrowser()
    .from('captures')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DbCapture[]
}
export async function insertCapture(row: DbCapture): Promise<void> {
  const { error } = await supabaseBrowser().from('captures').insert(row)
  if (error) throw error
}
export async function updateCapture(id: string, patch: Partial<DbCapture>): Promise<void> {
  const { error } = await supabaseBrowser().from('captures').update(patch).eq('id', id)
  if (error) throw error
}

/* ---------------- Baby (profile) ---------------- */

export interface DbBaby {
  id: string
  family_id: string
  name: string
  birth_date: string
  feeding: 'breast' | 'bottle' | 'both' | null
  photo: string | null
  created_at: string
}
export async function fetchBaby(familyId: string): Promise<DbBaby | null> {
  const { data, error } = await supabaseBrowser()
    .from('babies')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as DbBaby) ?? null
}
export async function upsertBaby(row: Partial<DbBaby> & { family_id: string }): Promise<void> {
  const { error } = await supabaseBrowser().from('babies').upsert(row)
  if (error) throw error
}

/* ---------------- Partner contact (Dad as SMS/email contact) ---------------- */

export interface DbPartnerContact {
  id: string
  family_id: string
  name: string
  phone: string | null
  email: string | null
  notify_sms: boolean
  notify_email: boolean
  created_at: string
}

// One partner contact per family for now (the first row). Fetch it.
export async function fetchPartnerContact(familyId: string): Promise<DbPartnerContact | null> {
  const { data, error } = await supabaseBrowser()
    .from('partner_contacts')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as DbPartnerContact) ?? null
}

export async function upsertPartnerContact(
  row: Partial<DbPartnerContact> & { id: string; family_id: string; name: string },
): Promise<void> {
  const { error } = await supabaseBrowser().from('partner_contacts').upsert(row)
  if (error) throw error
}

export async function deletePartnerContact(id: string): Promise<void> {
  const { error } = await supabaseBrowser().from('partner_contacts').delete().eq('id', id)
  if (error) throw error
}

/* ---------------- Household people ---------------- */

// A person who participates in the household, whether or not they have a MamaHQ
// account. `user_id` is nullable: null = no account (assigned/attributed only, NO
// app access), non-null = connected to an auth user. Identity is NOT authorization
// — RLS still gates everything on authenticated family membership.
export interface DbHouseholdPerson {
  id: string
  family_id: string
  display_name: string
  relationship: string | null
  user_id: string | null
  phone: string | null
  email: string | null
  created_at: string
  updated_at: string
}

export async function fetchHouseholdPeople(familyId: string): Promise<DbHouseholdPerson[]> {
  const { data, error } = await supabaseBrowser()
    .from('household_people')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as DbHouseholdPerson[]
}

// Beta Phase 1 — canonical identity. Set the CALLER'S OWN HouseholdPerson display
// name in a family. Trusted SECURITY DEFINER RPC (0014): the person is resolved from
// the authenticated account server-side, so this can never rename another person or
// another family's person, and never creates a duplicate. Idempotent. Returns the
// canonical person id. This is the ONE writer of the owner/member's household name;
// the UI must not write display_name directly for the current user.
export async function setMyDisplayNameRpc(familyId: string, displayName: string): Promise<string> {
  const { data, error } = await supabaseBrowser().rpc('set_my_display_name', {
    p_family_id: familyId,
    p_display_name: displayName,
  })
  if (error) throw error
  return data as string
}

export async function insertHouseholdPerson(
  row: Partial<DbHouseholdPerson> & { id: string; family_id: string; display_name: string },
): Promise<void> {
  const { error } = await supabaseBrowser().from('household_people').insert(row)
  if (error) throw error
}

export async function updateHouseholdPerson(
  id: string,
  patch: Partial<DbHouseholdPerson>,
): Promise<void> {
  const { error } = await supabaseBrowser().from('household_people').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteHouseholdPerson(id: string): Promise<void> {
  const { error } = await supabaseBrowser().from('household_people').delete().eq('id', id)
  if (error) throw error
}

/* ---------------- Grocery (operational foundation — Step 2) ---------------- */

// The operational grocery list row. `display_name` is the source of truth and
// works with zero intelligence. Attribution points at household_people. Future
// canonical_item_id / household_item_id are intentionally absent (deferred).
export interface DbGroceryItem {
  id: string
  family_id: string
  list_id: string | null
  canonical_item_id: string | null
  display_name: string
  quantity: number
  unit: string | null
  brand: string | null
  variant: string | null
  size: string | null
  category: string | null
  store: string | null
  note: string | null
  photo_url: string | null
  priority: number
  added_by_person_id: string | null
  assigned_to_person_id: string | null
  source_type: string
  source_id: string | null
  status: 'active' | 'completed'
  created_at: string
  updated_at: string
  completed_at: string | null
  // Step 5B operational detail (see 0007_grocery_action_detail.sql).
  resolved_attributes: { attribute_id: string; value: string | boolean }[]
  package_size: { value: number; unit: string } | null
  package_type: string | null
  unmatched_modifiers: string[]
  client_action_id: string | null
}

export async function fetchGroceryItems(familyId: string): Promise<DbGroceryItem[]> {
  const { data, error } = await supabaseBrowser()
    .from('grocery_items')
    .select('*')
    .eq('family_id', familyId)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DbGroceryItem[]
}
export async function insertGroceryItem(
  row: Partial<DbGroceryItem> & { id: string; family_id: string; display_name: string },
): Promise<void> {
  const { error } = await supabaseBrowser().from('grocery_items').insert(row)
  if (error) throw error
}
export async function updateGroceryItem(id: string, patch: Partial<DbGroceryItem>): Promise<void> {
  const { error } = await supabaseBrowser().from('grocery_items').update(patch).eq('id', id)
  if (error) throw error
}
export async function deleteGroceryItem(id: string): Promise<void> {
  const { error } = await supabaseBrowser().from('grocery_items').delete().eq('id', id)
  if (error) throw error
}

// Atomic + idempotent quantity increment (Step 5B). One server-side statement; a
// retried call with the same clientActionId does not double-apply. Returns the new
// quantity.
export async function incrementGroceryItemRpc(
  itemId: string,
  delta: number,
  clientActionId: string,
): Promise<number> {
  const { data, error } = await supabaseBrowser().rpc('increment_grocery_item', {
    p_item_id: itemId,
    p_delta: delta,
    p_client_action_id: clientActionId,
  })
  if (error) throw error
  return Number(data)
}

// Retained purchase history — a denormalized snapshot written when an item is
// completed as purchased, so history survives edits/removal of the source item.
export interface DbPurchaseEvent {
  id: string
  family_id: string
  item_id: string | null
  display_name: string
  quantity: number | null
  unit: string | null
  brand: string | null
  variant: string | null
  size: string | null
  category: string | null
  store: string | null
  purchased_by_person_id: string | null
  source_type: string | null
  purchased_at: string
  created_at: string
  // Step 6 structured immutable snapshot (see 0008_household_memory.sql).
  canonical_item_id: string | null
  resolved_attributes: { attribute_id: string; value: string | boolean }[]
  package_size: { value: number; unit: string } | null
  package_type: string | null
  unmatched_modifiers: string[]
}

export async function insertPurchaseEvent(
  row: Partial<DbPurchaseEvent> & { id: string; family_id: string; display_name: string },
): Promise<void> {
  const { error } = await supabaseBrowser().from('purchase_events').insert(row)
  if (error) throw error
}
export async function fetchPurchaseEvents(familyId: string): Promise<DbPurchaseEvent[]> {
  const { data, error } = await supabaseBrowser()
    .from('purchase_events')
    .select('*')
    .eq('family_id', familyId)
    .order('purchased_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DbPurchaseEvent[]
}

// Fetch a single grocery item (used to rehydrate the client after a failed
// atomic operation, so the UI never shows a false success).
export async function fetchGroceryItem(id: string): Promise<DbGroceryItem | null> {
  const { data, error } = await supabaseBrowser()
    .from('grocery_items')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as DbGroceryItem) ?? null
}

// ATOMIC completion: marks the item completed AND writes the purchase_event
// snapshot in ONE server-side transaction (commit both or neither). Idempotent —
// repeat calls never create duplicate history. Authorization is enforced inside
// the function from the item's own family; the caller passes only the item id.
export async function completeGroceryItemRpc(itemId: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc('complete_grocery_item', { p_item_id: itemId })
  if (error) throw error
}

// ATOMIC restore: sets the item active and reverses (deletes) the purchase_event
// created by that completion. Authorization enforced server-side.
export async function restoreGroceryItemRpc(itemId: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc('restore_grocery_item', { p_item_id: itemId })
  if (error) throw error
}

/* ---------------- Household membership + invitations (Step 7) ---------------- */

// Authorization membership: which authenticated user may access which household.
// This is the SECURITY boundary (NOT household_people). role owner|member.
export interface DbFamilyMember {
  family_id: string
  user_id: string
  role: 'owner' | 'member'
  display_name: string | null
  status: 'active' | 'removed'
  invited_at: string | null
  joined_at: string
  created_at: string
}

export async function fetchFamilyMembers(familyId: string): Promise<DbFamilyMember[]> {
  const { data, error } = await supabaseBrowser()
    .from('family_members')
    .select('*')
    .eq('family_id', familyId)
  if (error) throw error
  return (data ?? []) as DbFamilyMember[]
}

// A secure invitation to join a household. The plaintext token lives only in the
// invite link; the DB stores only its SHA-256 hash. Never a membership by itself.
export interface DbHouseholdInvitation {
  id: string
  family_id: string
  household_person_id: string | null
  invited_by_user_id: string
  email: string | null
  token_hash: string
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  created_at: string
  expires_at: string
  accepted_at: string | null
  accepted_by_user_id: string | null
}

// A family member may view their household's invitations (RLS-scoped). No broad
// enumerate. token_hash is not a usable credential (hash only).
export async function fetchHouseholdInvitations(familyId: string): Promise<DbHouseholdInvitation[]> {
  const { data, error } = await supabaseBrowser()
    .from('household_invitations')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DbHouseholdInvitation[]
}

// Create an invitation for an existing household person. The server stores only the
// token hash; the caller keeps the plaintext token for the link. Owner/member of the
// person's own family only (authorization enforced server-side). Returns invite id.
export async function createHouseholdInvitationRpc(
  personId: string,
  tokenHash: string,
  email: string | null,
  ttlSeconds?: number,
): Promise<string> {
  const { data, error } = await supabaseBrowser().rpc('create_household_invitation', {
    p_person_id: personId,
    p_token_hash: tokenHash,
    p_email: email,
    p_ttl_seconds: ttlSeconds ?? 604800,
  })
  if (error) throw error
  return data as string
}

// Redeem an invitation (caller proves possession of the token via its hash).
// Transactional + idempotent server-side. Returns { family_id, household_person_id }.
export async function acceptHouseholdInvitationRpc(
  tokenHash: string,
): Promise<{ family_id: string; household_person_id: string | null }> {
  const { data, error } = await supabaseBrowser().rpc('accept_household_invitation', {
    p_token_hash: tokenHash,
  })
  if (error) throw error
  return data as { family_id: string; household_person_id: string | null }
}

// Revoke a pending invitation (owner/member of its family). Returns true if it was
// pending and is now revoked; false if it wasn't pending (e.g. already accepted).
export async function revokeHouseholdInvitationRpc(invitationId: string): Promise<boolean> {
  const { data, error } = await supabaseBrowser().rpc('revoke_household_invitation', {
    p_invitation_id: invitationId,
  })
  if (error) throw error
  return Boolean(data)
}

/* ---------------- Household Grocery Memory (Step 6) ---------------- */

// CURRENT household knowledge: one row per variant of a canonical/custom concept.
// This is materialized memory, NOT purchase history. See 0008_household_memory.sql
// and docs/HOUSEHOLD_GROCERY_MEMORY.md.
export interface DbHouseholdItem {
  id: string
  family_id: string
  canonical_item_id: string | null
  variant_key: string
  display_name: string
  brand: string | null
  variant: string | null
  package_size: { value: number; unit: string } | null
  package_unit: string | null
  package_type: string | null
  resolved_attributes: { attribute_id: string; value: string | boolean }[]
  store: string | null
  evidence_state: 'observed' | 'emerging' | 'established' | 'user_set'
  observation_count: number
  is_user_set: boolean
  is_default: boolean
  last_observed_at: string | null
  created_at: string
  updated_at: string
}

// The auditable evidence ledger; each row traces to the purchase_event that made it.
export interface DbHouseholdItemObservation {
  id: string
  family_id: string
  household_item_id: string
  purchase_event_id: string | null
  observation_type: 'purchase'
  observed_values: unknown
  observed_at: string
  created_at: string
}

// Load a family's materialized household memory (the enrichment source of truth).
// One query; the store caches the result and indexes it — never per-keystroke.
export async function fetchHouseholdItems(familyId: string): Promise<DbHouseholdItem[]> {
  const { data, error } = await supabaseBrowser()
    .from('household_items')
    .select('*')
    .eq('family_id', familyId)
  if (error) throw error
  return (data ?? []) as DbHouseholdItem[]
}

// Observations for a variant (audit/debug + tests). Not needed on the hot path.
export async function fetchHouseholdObservations(
  familyId: string,
  householdItemId: string,
): Promise<DbHouseholdItemObservation[]> {
  const { data, error } = await supabaseBrowser()
    .from('household_item_observations')
    .select('*')
    .eq('family_id', familyId)
    .eq('household_item_id', householdItemId)
    .order('observed_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DbHouseholdItemObservation[]
}

// Explicit "Make this my usual" — marks the variant user_set + default and clears
// siblings (one default per concept). Authorization enforced server-side from the
// variant's own family.
export async function setHouseholdUsualRpc(householdItemId: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc('set_household_usual', { p_household_item_id: householdItemId })
  if (error) throw error
}

// Undo an explicit preference; reverts to passive-learning state.
export async function clearHouseholdUsualRpc(householdItemId: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc('clear_household_usual', { p_household_item_id: householdItemId })
  if (error) throw error
}

/* ---------------- Tasks / Ownership (Step 8) ---------------- */

// A durable, family-scoped RESPONSIBILITY row. Ownership points at a
// household_people id (assigned_to_person_id) — which may be account-less — and is
// distinct from the CREATOR (created_by_user_id) and the COMPLETER
// (completed_by_user_id). Assignment is NOT authorization; RLS gates access on
// family membership. Writes go through the RPCs below (atomic with history), not
// direct table inserts/updates. See 0010_tasks.sql and docs/TASKS.md.
export interface DbTask {
  id: string
  family_id: string
  title: string
  notes: string | null
  status: 'open' | 'completed'
  /** OWNERSHIP → household_people.id (may have no account). null = unassigned. */
  assigned_to_person_id: string | null
  /** CREATOR → the auth user who captured it (independent of ownership). */
  created_by_user_id: string | null
  source: 'manual' | 'tell_mamahq' | 'household_member' | 'care_handoff' | 'calendar' | 'system'
  due_at: string | null
  completed_at: string | null
  /** COMPLETER → the auth user who actually completed it (≠ owner). */
  completed_by_user_id: string | null
  created_at: string
  updated_at: string
  /** CURRENT ACCEPTANCE (Step 9). null = assigned but not yet accepted ("I've got
   *  it" not pressed). Cleared by reassign / reopen / relinquish. Historical
   *  acceptance lives in task_events. See 0011_responsibility_handoff.sql. */
  acknowledged_at: string | null
  /** The RESPONSIBILITY ACTOR (auth user) who accepted. */
  acknowledged_by_user_id: string | null
  /** The HouseholdPerson who accepted (== assigned_to_person_id at accept time). */
  acknowledged_by_household_person_id: string | null
}

// Append-only history of important task transitions (HISTORICAL TRUTH). The task
// row is current truth; these events preserve who owned/assigned/accepted/
// completed what. Step 9 adds 'accepted' and 'relinquished'.
export interface DbTaskEvent {
  id: string
  family_id: string
  task_id: string
  event_type: 'created' | 'assigned' | 'reassigned' | 'accepted' | 'relinquished' | 'completed' | 'reopened'
  actor_user_id: string | null
  prev_person_id: string | null
  new_person_id: string | null
  metadata: unknown
  created_at: string
}

export async function fetchTasks(familyId: string): Promise<DbTask[]> {
  const { data, error } = await supabaseBrowser()
    .from('tasks')
    .select('*')
    .eq('family_id', familyId)
    // Open first, then by due date (nulls last), then newest — a natural order that
    // needs no priority levels (Step 8 §19).
    .order('status', { ascending: true })
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DbTask[]
}

// A task's history, oldest → newest (so the UI can read it as a timeline).
export async function fetchTaskEvents(familyId: string, taskId: string): Promise<DbTaskEvent[]> {
  const { data, error } = await supabaseBrowser()
    .from('task_events')
    .select('*')
    .eq('family_id', familyId)
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as DbTaskEvent[]
}

// Rehydrate a single task after a mutation (so the UI reflects server truth).
export async function fetchTask(id: string): Promise<DbTask | null> {
  const { data, error } = await supabaseBrowser().from('tasks').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as DbTask) ?? null
}

// ATOMIC create: inserts the task AND its 'created' (+ initial 'assigned') event in
// one server-side transaction. Idempotent on the client-supplied task id — a retry
// with the same id returns the existing task, never a duplicate. Authorization +
// assignment integrity (assignee must belong to the family) are enforced
// server-side. Returns the task id.
export async function createTaskRpc(args: {
  familyId: string
  title: string
  assignedToPersonId?: string | null
  dueAt?: string | null
  notes?: string | null
  source?: DbTask['source']
  clientTaskId?: string | null
}): Promise<string> {
  const { data, error } = await supabaseBrowser().rpc('create_task', {
    p_family_id: args.familyId,
    p_title: args.title,
    p_assigned_to_person_id: args.assignedToPersonId ?? null,
    p_due_at: args.dueAt ?? null,
    p_notes: args.notes ?? null,
    p_source: args.source ?? 'manual',
    p_client_task_id: args.clientTaskId ?? null,
  })
  if (error) throw error
  return data as string
}

// ATOMIC assign/reassign/unassign: updates the owner AND appends an 'assigned' or
// 'reassigned' event in one transaction. personId null = unassign. Assigning the
// same owner is a no-op (no spurious event). Authorization + assignment integrity
// enforced server-side.
export async function assignTaskRpc(taskId: string, personId: string | null): Promise<void> {
  const { error } = await supabaseBrowser().rpc('assign_task', {
    p_task_id: taskId,
    p_person_id: personId,
  })
  if (error) throw error
}

// ATOMIC complete: marks completed + records the completer AND appends a 'completed'
// event. Does NOT rewrite ownership. Idempotent (repeat calls create no duplicate
// event). Any authorized adult may complete.
export async function completeTaskRpc(taskId: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc('complete_task', { p_task_id: taskId })
  if (error) throw error
}

// ATOMIC reopen: status → open, clears completion metadata, appends a 'reopened'
// event. Preserves ownership + identity. Idempotent on an already-open task.
// Step 9: reopen also clears any current acceptance (re-acceptance required).
export async function reopenTaskRpc(taskId: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc('reopen_task', { p_task_id: taskId })
  if (error) throw error
}

// ATOMIC accept (Step 9 — "I've got it"): the account LINKED to the task's assigned
// HouseholdPerson explicitly takes responsibility. Sets the current-acceptance
// columns + appends an 'accepted' event. Does NOT complete the task. Server rejects
// anyone who is not the assigned person's connected account. Idempotent.
export async function acceptTaskRpc(taskId: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc('accept_task', { p_task_id: taskId })
  if (error) throw error
}

// ATOMIC relinquish (Step 9 — "I can't take this"): the accepting account releases
// responsibility. Clears current acceptance + appends a 'relinquished' event. Does
// NOT change assignment (still assigned, but explicitly not held) and does NOT
// reassign. Only the account that accepted may relinquish. Idempotent.
export async function relinquishTaskRpc(taskId: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc('relinquish_task', { p_task_id: taskId })
  if (error) throw error
}

// NOTE: there is intentionally no client-side task delete. Tasks have no product
// "delete" workflow in Step 8, and RLS blocks direct client DELETE of tasks and
// task_events (least privilege — task_events is historical truth). The lifecycle is
// complete/reopen via the RPCs above. A hard reset, if ever needed, would be a
// dedicated trusted RPC, not a client delete.

/* ---------------- Care Handoff (Step 9) ---------------- */

// CURRENT holder of active care for a subject (the family's baby). Current truth;
// the handoff records are historical truth. holder_person_id is a HouseholdPerson.
// See 0011_responsibility_handoff.sql and docs/CARE_HANDOFF.md.
export interface DbCareResponsibility {
  id: string
  family_id: string
  subject_baby_id: string | null
  holder_person_id: string | null
  updated_at: string
  created_at: string
}

// A proposed/accepted/declined/cancelled care transfer. A proposed handoff does
// NOT transfer responsibility; the holder changes only when the recipient accepts.
export interface DbCareHandoff {
  id: string
  family_id: string
  subject_baby_id: string | null
  from_person_id: string | null
  to_person_id: string
  proposed_by_user_id: string | null
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
  /** Deterministic operational summary snapshot captured at propose time. */
  context: unknown
  created_at: string
  resolved_at: string | null
  resolved_by_user_id: string | null
}

// Read the family's current care-responsibility row (may be absent until ensured).
export async function fetchCareResponsibility(familyId: string): Promise<DbCareResponsibility | null> {
  const { data, error } = await supabaseBrowser()
    .from('care_responsibility')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as DbCareResponsibility) ?? null
}

// Read the family's care handoffs (newest first). Members only (RLS-scoped).
export async function fetchCareHandoffs(familyId: string): Promise<DbCareHandoff[]> {
  const { data, error } = await supabaseBrowser()
    .from('care_handoffs')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DbCareHandoff[]
}

// Idempotently create the family's care-responsibility row (first caller becomes
// the initial holder) and return its id. Authorization enforced server-side.
export async function ensureCareResponsibilityRpc(familyId: string): Promise<string> {
  const { data, error } = await supabaseBrowser().rpc('ensure_care_responsibility', {
    p_family_id: familyId,
  })
  if (error) throw error
  return data as string
}

// Propose a care handoff to a CONNECTED HouseholdPerson in the same family. Does
// NOT change the current holder. context is the deterministic summary snapshot.
// Returns the handoff id. Server rejects cross-family / account-less recipients and
// enforces one pending handoff at a time.
export async function proposeCareHandoffRpc(
  familyId: string,
  toPersonId: string,
  context: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await supabaseBrowser().rpc('propose_care_handoff', {
    p_family_id: familyId,
    p_to_person_id: toPersonId,
    p_context: context,
  })
  if (error) throw error
  return data as string
}

// Recipient accepts: atomically marks the handoff accepted AND moves the current
// holder to the recipient. Only the recipient's connected account may accept.
// Stale (cancelled/declined) accept rejected; idempotent.
export async function acceptCareHandoffRpc(handoffId: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc('accept_care_handoff', { p_handoff_id: handoffId })
  if (error) throw error
}

// Recipient declines: current holder unchanged. Only the recipient may decline.
export async function declineCareHandoffRpc(handoffId: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc('decline_care_handoff', { p_handoff_id: handoffId })
  if (error) throw error
}

// Sender (proposer or current holder) cancels a pending handoff before acceptance.
// Makes the stale request unacceptable. Current holder unchanged.
export async function cancelCareHandoffRpc(handoffId: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc('cancel_care_handoff', { p_handoff_id: handoffId })
  if (error) throw error
}

/* ---------------- Calendar & Commitments (Step 10) ---------------- */

// A shared household calendar event. Distinct concepts (never collapsed):
//   participants = who the event is ABOUT (calendar_event_participants → people)
//   responsible_person_id = who is designated to HANDLE it (a designation, NOT an
//     acceptance — Step 10 stores it but builds no acceptance workflow)
//   created_by_user_id = who created it (provenance)
// Timezone: timed events use starts_at/ends_at (timestamptz, UTC); all-day events
// use start_date/end_date (plain date, never tz-shifts). all_day selects which.
// Writes go through the RPCs below (atomic event + participants); reads are direct.
// See 0012_calendar_commitments.sql and docs/CALENDAR.md.
export interface DbCalendarEvent {
  id: string
  family_id: string
  title: string
  notes: string | null
  location: string | null
  all_day: boolean
  /** Timed model (all_day=false): unambiguous instant + optional end. */
  starts_at: string | null
  ends_at: string | null
  /** All-day model (all_day=true): plain dates, no tz shift. */
  start_date: string | null
  end_date: string | null
  /** OPTIONAL designated responsible HouseholdPerson (≠ acceptance, ≠ creator). */
  responsible_person_id: string | null
  created_by_user_id: string | null
  created_at: string
  updated_at: string
}

export interface DbCalendarEventParticipant {
  id: string
  event_id: string
  family_id: string
  person_id: string
  created_at: string
}

// An event with its participant person ids resolved (one read stitched in the
// provider). Kept separate from the row type so the DB shape stays faithful.
export interface DbCalendarEventWithParticipants extends DbCalendarEvent {
  participant_ids: string[]
}

export async function fetchCalendarEvents(familyId: string): Promise<DbCalendarEventWithParticipants[]> {
  const sb = supabaseBrowser()
  const [eventsRes, partsRes] = await Promise.all([
    sb.from('calendar_events').select('*').eq('family_id', familyId),
    sb.from('calendar_event_participants').select('event_id, person_id').eq('family_id', familyId),
  ])
  if (eventsRes.error) throw eventsRes.error
  if (partsRes.error) throw partsRes.error
  const byEvent = new Map<string, string[]>()
  for (const p of (partsRes.data ?? []) as { event_id: string; person_id: string }[]) {
    const list = byEvent.get(p.event_id) ?? []
    list.push(p.person_id)
    byEvent.set(p.event_id, list)
  }
  return ((eventsRes.data ?? []) as DbCalendarEvent[]).map((e) => ({
    ...e,
    participant_ids: byEvent.get(e.id) ?? [],
  }))
}

export async function fetchCalendarEvent(id: string): Promise<DbCalendarEvent | null> {
  const { data, error } = await supabaseBrowser().from('calendar_events').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as DbCalendarEvent) ?? null
}

// ATOMIC create: inserts the event AND its participants in one server-side
// transaction. Every participant + the responsible person is validated against the
// family (cross-family injection rejected). Idempotent on the client-supplied id.
// Timed: pass allDay=false + startsAt (+ optional endsAt). All-day: allDay=true +
// startDate (+ optional endDate). Returns the event id.
export async function createCalendarEventRpc(args: {
  familyId: string
  title: string
  allDay?: boolean
  startsAt?: string | null
  endsAt?: string | null
  startDate?: string | null
  endDate?: string | null
  location?: string | null
  notes?: string | null
  responsiblePersonId?: string | null
  participantIds?: string[] | null
  clientEventId?: string | null
}): Promise<string> {
  const { data, error } = await supabaseBrowser().rpc('create_calendar_event', {
    p_family_id: args.familyId,
    p_title: args.title,
    p_all_day: args.allDay ?? false,
    p_starts_at: args.startsAt ?? null,
    p_ends_at: args.endsAt ?? null,
    p_start_date: args.startDate ?? null,
    p_end_date: args.endDate ?? null,
    p_location: args.location ?? null,
    p_notes: args.notes ?? null,
    p_responsible_person_id: args.responsiblePersonId ?? null,
    p_participant_ids: args.participantIds ?? null,
    p_client_event_id: args.clientEventId ?? null,
  })
  if (error) throw error
  return data as string
}

// ATOMIC update: edits fields and (optionally) replaces the participant set in one
// transaction. Pass replaceParticipants=true with participantIds to replace them
// ([] clears). clearResponsible=true clears the responsible person (a null id means
// "leave unchanged"). Authorization + family integrity enforced server-side.
export async function updateCalendarEventRpc(args: {
  eventId: string
  title?: string | null
  allDay?: boolean | null
  startsAt?: string | null
  endsAt?: string | null
  startDate?: string | null
  endDate?: string | null
  location?: string | null
  notes?: string | null
  responsiblePersonId?: string | null
  clearResponsible?: boolean
  participantIds?: string[] | null
  replaceParticipants?: boolean
}): Promise<void> {
  const { error } = await supabaseBrowser().rpc('update_calendar_event', {
    p_event_id: args.eventId,
    p_title: args.title ?? null,
    p_all_day: args.allDay ?? null,
    p_starts_at: args.startsAt ?? null,
    p_ends_at: args.endsAt ?? null,
    p_start_date: args.startDate ?? null,
    p_end_date: args.endDate ?? null,
    p_location: args.location ?? null,
    p_notes: args.notes ?? null,
    p_responsible_person_id: args.responsiblePersonId ?? null,
    p_clear_responsible: args.clearResponsible ?? false,
    p_participant_ids: args.participantIds ?? null,
    p_replace_participants: args.replaceParticipants ?? false,
  })
  if (error) throw error
}

// Delete an event (participants cascade). Authorization enforced server-side.
export async function deleteCalendarEventRpc(eventId: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc('delete_calendar_event', { p_event_id: eventId })
  if (error) throw error
}

/* ---------------- Family-wide wipe (for "Start over") ---------------- */

// Deletes all of a family's data rows. Ordered so FK children go before parents.
// The family/membership rows themselves are kept (the account stays; onboarding restarts).
export async function clearFamilyData(familyId: string): Promise<void> {
  const sb = supabaseBrowser()
  // appointment_questions cascade from appointments, but delete explicitly to be safe.
  const tables = [
    'appointment_questions',
    'appointments',
    'logs',
    'mom_items',
    'mom_moods',
    'memories',
    'captures',
    'partner_contacts',
    // Tasks (Step 8): task_events reference tasks (cascade) + household_people
    // (SET NULL). Listed for FK ordering (children before people), but note these
    // two tables block direct client DELETE (RLS: RPC-only writes; task_events is
    // historical truth). So — exactly like household_invitations below — this delete
    // is RLS-filtered to zero rows and does not error; it does not actually wipe
    // tasks/events. A hard reset would need a dedicated trusted RPC.
    'task_events',
    'tasks',
    // Calendar (Step 10): participants cascade from calendar_events. Like
    // tasks/care/handoff, these are RPC-only writes (no direct-DELETE policy —
    // deletion is centralized in delete_calendar_event), so this client DELETE is
    // RLS-filtered to zero rows and does not error; it does not actually wipe them.
    // Listed for FK ordering. A hard reset would use a dedicated trusted path.
    'calendar_event_participants',
    'calendar_events',
    // Care handoff (Step 9): care_handoffs + care_responsibility reference babies +
    // household_people (SET NULL). Like tasks/task_events these are RPC-only writes
    // (no delete policy), so this client DELETE is RLS-filtered to zero rows and
    // does not error — it does not actually wipe them. Listed for FK ordering.
    'care_handoffs',
    'care_responsibility',
    // Invitations (Step 7) reference household_people (SET NULL). Also RPC-only
    // writes (no delete policy) — this delete is a no-op that does not error.
    'household_invitations',
    // Household memory (Step 6): observations reference household_items +
    // purchase_events; delete the ledger, then variants, before purchases/items.
    'household_item_observations',
    'household_items',
    // purchase_events references grocery_items (SET NULL), grocery_items references
    // household_people (SET NULL) — delete children first to keep it clean.
    'purchase_events',
    'grocery_items',
    // household_people are wiped too; the owner's connected person is re-created
    // deterministically by ensure_family() on the next sign-in bootstrap.
    'household_people',
    'babies',
  ]
  for (const t of tables) {
    const { error } = await sb.from(t).delete().eq('family_id', familyId)
    if (error) throw error
  }
}

/* ---------------------------- Notifications (Step 11) ---------------------------- */

// A durable, RECIPIENT-SCOPED attention record. RLS ensures the browser only ever
// reads rows addressed to the current user (recipient_user_id = auth.uid()), so
// there is no family_id filter needed on reads — the row is either mine or invisible.
// A notification POINTS AT domain truth (task/care/calendar); it is never truth
// itself. Generation is trusted server-side (emit_notification inside domain RPCs);
// there is intentionally no client insert path here.
export interface DbNotification {
  id: string
  family_id: string
  recipient_user_id: string
  actor_user_id: string | null
  type:
    | 'task_assigned'
    | 'task_accepted'
    | 'care_handoff_proposed'
    | 'care_handoff_accepted'
    | 'calendar_responsibility_assigned'
  domain: 'task' | 'care' | 'calendar'
  entity_id: string | null
  title: string
  metadata: Record<string, unknown>
  dedupe_key: string
  created_at: string
  read_at: string | null
}

// Fetch MY notifications (RLS scopes to the current user), newest first. The
// authoritative persisted created_at drives ordering — never a client clock.
export async function fetchNotifications(limit = 50): Promise<DbNotification[]> {
  const { data, error } = await supabaseBrowser()
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as DbNotification[]
}

// Mark ONE of my notifications read (idempotent server-side). RLS + the RPC's
// recipient check both guarantee I can only mark my own.
export async function markNotificationReadRpc(notificationId: string): Promise<void> {
  const { error } = await supabaseBrowser().rpc('mark_notification_read', {
    p_notification_id: notificationId,
  })
  if (error) throw error
}

// Mark ALL of my unread notifications read. Returns how many were affected.
export async function markAllNotificationsReadRpc(): Promise<number> {
  const { data, error } = await supabaseBrowser().rpc('mark_all_notifications_read')
  if (error) throw error
  return Number(data ?? 0)
}
