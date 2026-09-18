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
    'babies',
  ]
  for (const t of tables) {
    const { error } = await sb.from(t).delete().eq('family_id', familyId)
    if (error) throw error
  }
}
