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
