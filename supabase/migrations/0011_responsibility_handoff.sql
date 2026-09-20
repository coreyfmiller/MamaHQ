-- ============================================================================
-- MamaHQ — 0011_responsibility_handoff (Step 9: Responsibility Acceptance & Care Handoff)
-- ============================================================================
-- The next layer of MamaHQ's mental-load architecture. Step 8 established WHO is
-- responsible (assignment/ownership). Step 9 establishes whether someone has
-- actually TAKEN that responsibility:
--
--   Assigned  = "James is responsible for this."            (Step 8)
--   Accepted  = "James explicitly said: I've got it."       (Step 9, NEW)
--
-- These states must NEVER be conflated. Assignment, viewing, opening the app, or a
-- (future) notification are NOT acceptance. Acceptance requires an explicit action
-- by an authenticated account linked to the assigned HouseholdPerson.
--
-- Identity doctrine (unchanged from Steps 7/8):
--   Auth User        = how someone authenticates            (auth.users)
--   Family Member    = authorization to access a household   (family_members)
--   Household Person = who the human is                       (household_people)
--   Task Owner       = HouseholdPerson responsible            (tasks.assigned_to_person_id)
--   RESPONSIBILITY ACTOR (new) = the authenticated account explicitly accepting /
--                    relinquishing / handing off / receiving responsibility.
--   Ownership/holder are ALWAYS a household_people id; the acting account is
--   ALWAYS an auth.uid() linked to that person. Never a string like 'partner'.
--
-- This migration has TWO parts:
--   A) TASK ACKNOWLEDGEMENT — explicit "I've got it" on a Task, distinct from
--      completion. Reassignment, reopen, and relinquish all INVALIDATE a current
--      acceptance (history is preserved; current acceptance is not).
--   B) CARE HANDOFF — a small, explicit domain for the active PERIOD of care
--      responsibility for a care subject (the family's baby). A proposed handoff
--      does NOT transfer responsibility; the current holder changes ONLY when the
--      receiving caregiver explicitly accepts. Transactional; exactly one valid
--      transition wins under concurrency.
--
-- No AI. No realtime. No notifications. Additive + idempotent + non-destructive.
-- Apply AFTER 0010_tasks.sql. Clean-provisions 0001 → 0011 from an empty database.
-- ============================================================================

begin;

-- ============================================================================
-- PART A — TASK ACKNOWLEDGEMENT
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A1) Current-acceptance columns on tasks (additive). Kept ON THE ROW so current
--     state is a cheap read (no event replay). Historical acceptance still lives
--     in task_events. Cleared by reassign / reopen / relinquish.
--       acknowledged_at                    — when the current acceptance happened.
--       acknowledged_by_user_id            — the RESPONSIBILITY ACTOR (auth user).
--       acknowledged_by_household_person_id— the HouseholdPerson who accepted
--                                            (== assigned_to_person_id at accept
--                                            time). SET NULL on person removal so
--                                            history survives; NULL here means
--                                            "not currently accepted".
-- ---------------------------------------------------------------------------
alter table public.tasks
  add column if not exists acknowledged_at timestamptz;
alter table public.tasks
  add column if not exists acknowledged_by_user_id uuid references auth.users(id) on delete set null;
alter table public.tasks
  add column if not exists acknowledged_by_household_person_id uuid
    references public.household_people(id) on delete set null;

-- Fast "which of my assigned tasks have I accepted / not yet accepted".
create index if not exists tasks_family_ack
  on public.tasks (family_id, acknowledged_by_household_person_id)
  where acknowledged_by_household_person_id is not null;

-- ---------------------------------------------------------------------------
-- A2) Extend the task_events vocabulary with 'accepted' and 'relinquished'.
--     0010 created the CHECK as (created,assigned,reassigned,completed,reopened);
--     we widen it additively. Drop + re-add the constraint (its name is stable
--     because Postgres auto-names it task_events_event_type_check).
-- ---------------------------------------------------------------------------
alter table public.task_events
  drop constraint if exists task_events_event_type_check;
alter table public.task_events
  add constraint task_events_event_type_check
  check (event_type in ('created','assigned','reassigned','accepted','relinquished','completed','reopened'));

commit;

-- ============================================================================
-- PART B — CARE HANDOFF DOMAIN (tables)
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- B1) care_responsibility — the CURRENT holder of active care for a care subject.
--     Step 9 scope: one care subject per family (the family's baby). We key the
--     row by (family_id, subject_baby_id) so it generalizes later without a
--     rewrite. holder_person_id = the HouseholdPerson who currently HAS care
--     (may be null before anyone has claimed it). This is CURRENT TRUTH; the
--     handoff records are HISTORICAL TRUTH.
-- ---------------------------------------------------------------------------
create table if not exists public.care_responsibility (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  -- The care subject. References the family's baby; nullable + SET NULL so the
  -- row survives a baby-row change, and so a family with no baby can still have a
  -- (dormant) responsibility row. One responsibility row per (family, subject).
  subject_baby_id uuid references public.babies(id) on delete set null,
  -- CURRENT holder (a HouseholdPerson; may be account-less in general, though in
  -- Step 9 the holder is whoever last accepted, i.e. a connected account).
  holder_person_id uuid references public.household_people(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- One current-responsibility row per (family, subject). coalesce so a null subject
-- still gets a stable uniqueness domain (a family without a baby row).
create unique index if not exists care_responsibility_family_subject
  on public.care_responsibility (family_id, coalesce(subject_baby_id, '00000000-0000-0000-0000-000000000000'::uuid));

drop trigger if exists trg_care_responsibility_updated on public.care_responsibility;
create trigger trg_care_responsibility_updated before update on public.care_responsibility
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- B2) care_handoffs — proposed/accepted/declined/cancelled transfer records.
--     HISTORICAL TRUTH + the pending-transfer state machine. A row is created when
--     a handoff is PROPOSED. The current holder does NOT change on propose; it
--     changes only when the recipient ACCEPTS (atomically, in the accept RPC).
--
--     status lifecycle:  pending → accepted | declined | cancelled  (terminal)
--
--       from_person_id  — who proposed to hand off (the current holder at propose)
--       to_person_id    — the recipient HouseholdPerson (who must accept)
--       proposed_by_user_id — the authenticated actor who proposed
--       context         — the DETERMINISTIC care summary snapshot (jsonb) captured
--                          at propose time from real logged data (never fabricated)
--       resolved_by_user_id — the actor who accepted/declined/cancelled
-- ---------------------------------------------------------------------------
create table if not exists public.care_handoffs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  subject_baby_id uuid references public.babies(id) on delete set null,

  from_person_id uuid references public.household_people(id) on delete set null,
  to_person_id uuid not null references public.household_people(id) on delete cascade,
  proposed_by_user_id uuid references auth.users(id) on delete set null default auth.uid(),

  status text not null default 'pending'
    check (status in ('pending','accepted','declined','cancelled')),

  -- Operational context only (last feed/diaper/nap etc.), snapshotted from logs at
  -- propose time. NEVER interpreted, never predicted. See docs/CARE_HANDOFF.md.
  context jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid references auth.users(id) on delete set null
);

create index if not exists care_handoffs_family_status
  on public.care_handoffs (family_id, status);
create index if not exists care_handoffs_recipient
  on public.care_handoffs (to_person_id, status);
-- At most ONE pending handoff per (family, subject) at a time — prevents ambiguous
-- concurrent proposals and makes "the pending handoff" a well-defined singleton.
create unique index if not exists care_handoffs_one_pending
  on public.care_handoffs (family_id, coalesce(subject_baby_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- B3) RLS — family-scoped, same is_family_member boundary as every table. Members
--     READ their family's care rows; ALL writes go through the transactional
--     SECURITY DEFINER RPCs (client insert/update blocked; no delete policy).
--     Least-privilege, matching the Step 8 correction: acceptance/holder changes
--     can NEVER be forged by a direct client write.
-- ---------------------------------------------------------------------------
alter table public.care_responsibility enable row level security;
alter table public.care_handoffs enable row level security;

drop policy if exists care_responsibility_select on public.care_responsibility;
create policy care_responsibility_select on public.care_responsibility
  for select using (public.is_family_member(family_id));
drop policy if exists care_responsibility_no_client_insert on public.care_responsibility;
create policy care_responsibility_no_client_insert on public.care_responsibility
  for insert with check (false);
drop policy if exists care_responsibility_no_client_update on public.care_responsibility;
create policy care_responsibility_no_client_update on public.care_responsibility
  for update using (false) with check (false);

drop policy if exists care_handoffs_select on public.care_handoffs;
create policy care_handoffs_select on public.care_handoffs
  for select using (public.is_family_member(family_id));
drop policy if exists care_handoffs_no_client_insert on public.care_handoffs;
create policy care_handoffs_no_client_insert on public.care_handoffs
  for insert with check (false);
drop policy if exists care_handoffs_no_client_update on public.care_handoffs;
create policy care_handoffs_no_client_update on public.care_handoffs
  for update using (false) with check (false);

commit;

-- ============================================================================
-- PART C — SECURITY DEFINER RPCs (each create-or-replace = idempotent).
--   Every RPC: pins search_path, requires auth.uid(), authorizes from the ROW's
--   own family (never caller-supplied), locks rows it mutates, is idempotent on
--   retry, and writes history in the SAME transaction as the state change.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Internal helper: resolve the caller's connected HouseholdPerson in a family
-- (the person whose user_id = auth.uid()). Returns null if the caller has no
-- connected person in that family. SECURITY DEFINER + search_path pinned.
-- ---------------------------------------------------------------------------
create or replace function public.my_person_in_family(p_family_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  select id into pid from public.household_people
  where family_id = p_family_id and user_id = auth.uid()
  limit 1;
  return pid;
end $$;

grant execute on function public.my_person_in_family(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- accept_task(p_task_id) — the assigned person explicitly takes responsibility.
--   ONLY the authenticated account LINKED to the task's assigned HouseholdPerson
--   may accept. This is the core "I've got it". Sets the current-acceptance columns
--   + appends an 'accepted' event. Idempotent: if already accepted by the same
--   person, no-op (no duplicate event). Does NOT complete the task and does NOT
--   change assignment. Row-locked.
--   Rejections: not authenticated; task not found; caller not a family member;
--   task unassigned; caller is not the assigned person's connected account
--   (prevents impersonation and unconnected-person acceptance).
-- ---------------------------------------------------------------------------
create or replace function public.accept_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tasks;
  assignee_uid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into t from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'task not found';
  end if;
  if not public.is_family_member(t.family_id) then
    raise exception 'not authorized for this family';
  end if;

  if t.assigned_to_person_id is null then
    raise exception 'task is not assigned to anyone';
  end if;

  -- The assigned person must be the caller's OWN connected person. We resolve the
  -- assigned person's linked account and require it equals auth.uid(). This blocks
  -- (a) another family member accepting on someone else's behalf, and (b) accepting
  -- for an account-less person (their user_id is null, never equals auth.uid()).
  select user_id into assignee_uid from public.household_people where id = t.assigned_to_person_id;
  if assignee_uid is null or assignee_uid <> auth.uid() then
    raise exception 'only the assigned person can accept this task';
  end if;

  -- Idempotent: already accepted by this same person → nothing to do.
  if t.acknowledged_by_household_person_id is not distinct from t.assigned_to_person_id
     and t.acknowledged_at is not null then
    return;
  end if;

  update public.tasks
    set acknowledged_at = now(),
        acknowledged_by_user_id = auth.uid(),
        acknowledged_by_household_person_id = t.assigned_to_person_id
    where id = t.id;

  insert into public.task_events (family_id, task_id, event_type, actor_user_id, new_person_id)
  values (t.family_id, t.id, 'accepted', auth.uid(), t.assigned_to_person_id);
end $$;

grant execute on function public.accept_task(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- relinquish_task(p_task_id) — "I can't take this" / release responsibility.
--   The person who currently holds the acceptance releases it. Clears the
--   current-acceptance columns + appends a 'relinquished' event. Does NOT change
--   assignment (James stays assigned but has explicitly said he doesn't have it)
--   and does NOT reassign to anyone else. Idempotent: if there's no current
--   acceptance, no-op. Only the accepting account may relinquish.
-- ---------------------------------------------------------------------------
create or replace function public.relinquish_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tasks;
  prev_person uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into t from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'task not found';
  end if;
  if not public.is_family_member(t.family_id) then
    raise exception 'not authorized for this family';
  end if;

  -- Idempotent: nothing currently accepted → no-op.
  if t.acknowledged_at is null then
    return;
  end if;

  -- Only the account that accepted may relinquish it.
  if t.acknowledged_by_user_id is distinct from auth.uid() then
    raise exception 'only the accepting person can relinquish this task';
  end if;

  prev_person := t.acknowledged_by_household_person_id;

  update public.tasks
    set acknowledged_at = null,
        acknowledged_by_user_id = null,
        acknowledged_by_household_person_id = null
    where id = t.id;

  insert into public.task_events (family_id, task_id, event_type, actor_user_id, prev_person_id)
  values (t.family_id, t.id, 'relinquished', auth.uid(), prev_person);
end $$;

grant execute on function public.relinquish_task(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- assign_task(p_task_id, p_person_id) — REDEFINED for Step 9.
--   Same as 0010 (set/change/clear owner + assigned/reassigned event), PLUS:
--   reassignment INVALIDATES any current acceptance. If the owner actually changes
--   and a current acceptance exists, clear the acknowledgement columns (the new
--   owner has NOT accepted). Historical 'accepted' events are preserved untouched.
--   (0011 applies after 0010, so this definition wins on clean provision; it's an
--   idempotent create-or-replace on the live DB.)
-- ---------------------------------------------------------------------------
create or replace function public.assign_task(p_task_id uuid, p_person_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tasks;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into t from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'task not found';
  end if;
  if not public.is_family_member(t.family_id) then
    raise exception 'not authorized for this family';
  end if;

  -- No-op: same owner (including both null) → no state change, no event.
  if t.assigned_to_person_id is not distinct from p_person_id then
    return;
  end if;

  perform public.assert_task_assignee(t.family_id, p_person_id);

  update public.tasks
    set assigned_to_person_id = p_person_id,
        -- Reassignment invalidates current acceptance: the new owner has not
        -- accepted. Historical acceptance stays in task_events.
        acknowledged_at = null,
        acknowledged_by_user_id = null,
        acknowledged_by_household_person_id = null
    where id = t.id;

  insert into public.task_events (family_id, task_id, event_type, actor_user_id, prev_person_id, new_person_id)
  values (
    t.family_id, t.id,
    case when t.assigned_to_person_id is null then 'assigned' else 'reassigned' end,
    auth.uid(), t.assigned_to_person_id, p_person_id
  );
end $$;

grant execute on function public.assign_task(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- reopen_task(p_task_id) — REDEFINED for Step 9.
--   Same as 0010 (status → open, clear completion metadata + reopened event),
--   PLUS: reopening returns the task to an UNACKNOWLEDGED open state. The assigned
--   person may still be the same, but they must explicitly accept again. Clear the
--   acknowledgement columns on reopen. Historical acceptance stays in task_events.
--   Idempotent: already-open is a no-op.
-- ---------------------------------------------------------------------------
create or replace function public.reopen_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tasks;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into t from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'task not found';
  end if;
  if not public.is_family_member(t.family_id) then
    raise exception 'not authorized for this family';
  end if;

  if t.status <> 'completed' then
    return; -- idempotent
  end if;

  update public.tasks
    set status = 'open', completed_at = null, completed_by_user_id = null,
        -- Reopen returns to an unacknowledged state — explicit re-acceptance needed.
        acknowledged_at = null,
        acknowledged_by_user_id = null,
        acknowledged_by_household_person_id = null
    where id = t.id;

  insert into public.task_events (family_id, task_id, event_type, actor_user_id)
  values (t.family_id, t.id, 'reopened', auth.uid());
end $$;

grant execute on function public.reopen_task(uuid) to authenticated;

-- ============================================================================
-- PART D — CARE HANDOFF RPCs
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ensure_care_responsibility(p_family_id) — idempotently create the family's
-- single care-responsibility row for its (single) baby subject, and return its id.
-- Initializes holder to the caller's connected person IF no holder is set yet
-- (so the first authenticated caregiver becomes the current holder deterministically
-- — mirrors ensure_owner_person bootstrap). Authorized: caller must be a family
-- member. SECURITY DEFINER (bypasses the client-write block).
-- ---------------------------------------------------------------------------
create or replace function public.ensure_care_responsibility(p_family_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
  subj uuid;
  me_pid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_family_member(p_family_id) then
    raise exception 'not authorized for this family';
  end if;

  -- The family's single baby subject (oldest row), if any.
  select id into subj from public.babies where family_id = p_family_id
  order by created_at asc limit 1;

  select id into rid from public.care_responsibility
  where family_id = p_family_id
    and coalesce(subject_baby_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(subj, '00000000-0000-0000-0000-000000000000'::uuid)
  limit 1;

  if rid is null then
    me_pid := public.my_person_in_family(p_family_id);
    insert into public.care_responsibility (family_id, subject_baby_id, holder_person_id)
    values (p_family_id, subj, me_pid)
    on conflict (family_id, coalesce(subject_baby_id, '00000000-0000-0000-0000-000000000000'::uuid)) do nothing
    returning id into rid;
    if rid is null then
      select id into rid from public.care_responsibility
      where family_id = p_family_id
        and coalesce(subject_baby_id, '00000000-0000-0000-0000-000000000000'::uuid)
            = coalesce(subj, '00000000-0000-0000-0000-000000000000'::uuid)
      limit 1;
    end if;
  end if;

  return rid;
end $$;

grant execute on function public.ensure_care_responsibility(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- propose_care_handoff(p_family_id, p_to_person_id, p_context)
--   The current caregiver proposes transferring care to another HouseholdPerson.
--   Creates a PENDING handoff. Current holder does NOT change. p_context is the
--   deterministic summary snapshot (built client-side from real logs). Returns the
--   handoff id.
--   Authorization: caller is a family member; recipient belongs to the SAME family
--   (cross-family rejected); recipient must be a CONNECTED account (Step 9 chose
--   option B — no in-app handoff to an account-less person, since they could never
--   accept; documented in docs/CARE_HANDOFF.md). Only one pending handoff per
--   family/subject (unique index) — a second proposal while one is pending raises.
--   Idempotency: the single-pending unique index prevents duplicates.
-- ---------------------------------------------------------------------------
create or replace function public.propose_care_handoff(
  p_family_id uuid,
  p_to_person_id uuid,
  p_context jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  subj uuid;
  rid uuid;
  holder uuid;
  to_fam uuid;
  to_uid uuid;
  hid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_family_member(p_family_id) then
    raise exception 'not authorized for this family';
  end if;

  -- Recipient must belong to THIS family and be a connected account (can accept).
  select family_id, user_id into to_fam, to_uid
  from public.household_people where id = p_to_person_id;
  if to_fam is null then
    raise exception 'recipient person not found';
  end if;
  if to_fam <> p_family_id then
    raise exception 'recipient is not in this family';
  end if;
  if to_uid is null then
    raise exception 'recipient has no connected account and cannot accept a handoff';
  end if;

  -- Ensure the responsibility row + read current holder + subject.
  rid := public.ensure_care_responsibility(p_family_id);
  select holder_person_id, subject_baby_id into holder, subj
  from public.care_responsibility where id = rid for update;

  -- Don't propose a handoff to the person who already holds care.
  if holder is not distinct from p_to_person_id then
    raise exception 'that person already has care';
  end if;

  -- Create the pending handoff (the partial unique index enforces one-pending).
  insert into public.care_handoffs (
    family_id, subject_baby_id, from_person_id, to_person_id, proposed_by_user_id,
    status, context
  ) values (
    p_family_id, subj, holder, p_to_person_id, auth.uid(),
    'pending', coalesce(p_context, '{}'::jsonb)
  )
  returning id into hid;

  return hid;
end $$;

grant execute on function public.propose_care_handoff(uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- accept_care_handoff(p_handoff_id) — the recipient explicitly takes care.
--   ONLY the authenticated account linked to the handoff's to_person may accept.
--   TRANSACTIONAL: marks the handoff accepted AND sets the care_responsibility
--   holder to the recipient in ONE transaction, so there is never an intermediate
--   state where care disappears or two people are both "the holder". Idempotent:
--   if this same handoff is already accepted, no-op success. Stale accept (the
--   handoff was cancelled/declined) is REJECTED — status must be 'pending'.
--   Row-locked, so a concurrent cancel/accept race resolves to exactly one winner.
-- ---------------------------------------------------------------------------
create or replace function public.accept_care_handoff(p_handoff_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.care_handoffs;
  to_uid uuid;
  rid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into h from public.care_handoffs where id = p_handoff_id for update;
  if not found then
    raise exception 'handoff not found';
  end if;
  if not public.is_family_member(h.family_id) then
    raise exception 'not authorized for this family';
  end if;

  -- Only the recipient's connected account may accept.
  select user_id into to_uid from public.household_people where id = h.to_person_id;
  if to_uid is null or to_uid <> auth.uid() then
    raise exception 'only the recipient can accept this handoff';
  end if;

  -- Idempotent: this exact handoff already accepted → ensure holder is set, done.
  if h.status = 'accepted' then
    return;
  end if;

  -- Stale/terminal: cancelled or declined handoffs can never be accepted.
  if h.status <> 'pending' then
    raise exception 'handoff is no longer pending';
  end if;

  -- Atomic transfer: mark accepted AND move the current holder in one transaction.
  update public.care_handoffs
    set status = 'accepted', resolved_at = now(), resolved_by_user_id = auth.uid()
    where id = h.id;

  rid := public.ensure_care_responsibility(h.family_id);
  update public.care_responsibility
    set holder_person_id = h.to_person_id
    where id = rid;
end $$;

grant execute on function public.accept_care_handoff(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- decline_care_handoff(p_handoff_id) — the recipient declines. Current holder is
--   unchanged. Only the recipient's connected account may decline. Idempotent for
--   an already-declined handoff; rejects if not pending (cannot decline an accepted
--   or cancelled one). Row-locked.
-- ---------------------------------------------------------------------------
create or replace function public.decline_care_handoff(p_handoff_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.care_handoffs;
  to_uid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into h from public.care_handoffs where id = p_handoff_id for update;
  if not found then
    raise exception 'handoff not found';
  end if;
  if not public.is_family_member(h.family_id) then
    raise exception 'not authorized for this family';
  end if;

  select user_id into to_uid from public.household_people where id = h.to_person_id;
  if to_uid is null or to_uid <> auth.uid() then
    raise exception 'only the recipient can decline this handoff';
  end if;

  if h.status = 'declined' then
    return; -- idempotent
  end if;
  if h.status <> 'pending' then
    raise exception 'handoff is no longer pending';
  end if;

  update public.care_handoffs
    set status = 'declined', resolved_at = now(), resolved_by_user_id = auth.uid()
    where id = h.id;
end $$;

grant execute on function public.decline_care_handoff(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- cancel_care_handoff(p_handoff_id) — the proposer (or another current-holder-side
--   family member) cancels a pending handoff before acceptance. Current holder
--   unchanged; the recipient can no longer accept the stale request (status flips
--   out of 'pending'). Authorized to the proposer or the current holder's account,
--   both of whom are legitimately "the sending side". Idempotent for already-
--   cancelled; rejects if not pending. Row-locked.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_care_handoff(p_handoff_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.care_handoffs;
  holder uuid;
  holder_uid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into h from public.care_handoffs where id = p_handoff_id for update;
  if not found then
    raise exception 'handoff not found';
  end if;
  if not public.is_family_member(h.family_id) then
    raise exception 'not authorized for this family';
  end if;

  if h.status = 'cancelled' then
    return; -- idempotent
  end if;
  if h.status <> 'pending' then
    raise exception 'handoff is no longer pending';
  end if;

  -- The sending side may cancel: the proposer, OR the account currently holding
  -- care (the from side). The recipient uses decline, not cancel.
  select cr.holder_person_id into holder from public.care_responsibility cr
  where cr.family_id = h.family_id
    and coalesce(cr.subject_baby_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(h.subject_baby_id, '00000000-0000-0000-0000-000000000000'::uuid)
  limit 1;
  if holder is not null then
    select user_id into holder_uid from public.household_people where id = holder;
  end if;

  if h.proposed_by_user_id is distinct from auth.uid()
     and (holder_uid is null or holder_uid <> auth.uid()) then
    raise exception 'only the proposer or current holder can cancel this handoff';
  end if;

  update public.care_handoffs
    set status = 'cancelled', resolved_at = now(), resolved_by_user_id = auth.uid()
    where id = h.id;
end $$;

grant execute on function public.cancel_care_handoff(uuid) to authenticated;
