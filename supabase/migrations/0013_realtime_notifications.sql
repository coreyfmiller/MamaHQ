-- ============================================================================
-- MamaHQ — 0013_realtime_notifications (Step 11: Realtime & Notifications)
-- ============================================================================
-- Two DISTINCT capabilities, deliberately not collapsed:
--
--   REALTIME synchronizes SHARED TRUTH. When any household member changes a
--   shared domain (grocery, tasks, care, calendar), other members' sessions learn
--   canonical state changed and refetch — no manual refresh. Realtime is a
--   freshness enhancement layered on top of the canonical DB; it is NEVER the
--   source of truth and NEVER a prerequisite for a write.
--
--   NOTIFICATIONS direct ATTENTION. They borrow a specific person's attention only
--   when another human's action actually requires it (a task assigned to me, my
--   proposed handoff was accepted, ...). A notification is NOT domain truth — it
--   points AT truth (Task Acceptance / Care Holder / the calendar row remain
--   canonical). Reading/deleting a notification never changes any domain state.
--
-- This migration:
--   1. public.notifications — a durable, RECIPIENT-SCOPED notification record.
--   2. RLS: a member may read/update ONLY notifications addressed to THEM
--      (recipient_user_id = auth.uid()). Not merely family-scoped — privacy is
--      recipient-scoped. Direct client INSERT is blocked; all generation is trusted
--      server-side.
--   3. emit_notification(...) — the single trusted, SECURITY DEFINER generation
--      helper. Called ONLY from inside already-authorized domain RPCs, in the SAME
--      transaction as the state change, so a person-directed responsibility change
--      and its notification commit together (or not at all). Dedupe-keyed +
--      self-suppressing. A browser can never forge, misdirect, or impersonate.
--   4. mark_notification_read / mark_all_notifications_read — the only way a client
--      changes read state (its own only).
--   5. Domain RPCs REDEFINED to emit notifications (create_task, assign_task,
--      accept_task, propose_care_handoff, accept_care_handoff, create_calendar_event,
--      update_calendar_event). Each is an idempotent create-or-replace that layers
--      notification emission onto the exact Step 8/9/10 behavior — no domain
--      semantics change; the only addition is a same-transaction emit.
--   6. Realtime publication: expose ONLY the shared operational tables + the
--      per-recipient notifications table. Idempotent add-to-publication.
--
-- Notification types (small + high-value; see docs/NOTIFICATIONS.md §"Types"):
--   task_assigned                     → the assignee's linked account
--   task_accepted                     → the task creator (uncertainty resolved)
--   care_handoff_proposed             → the recipient's linked account
--   care_handoff_accepted             → the proposer (counterparty)
--   calendar_responsibility_assigned  → the responsible person's linked account
-- Self-actions never notify the actor. Account-less HouseholdPeople (user_id null)
-- cannot receive a digital notification — emission simply no-ops for them.
--
-- Additive + idempotent + non-destructive. Apply AFTER 0012_calendar_commitments.
-- Clean-provisions 0001 → 0013 from an empty database. Does NOT modify 0001–0012.
-- No AI. No push/email/SMS (delivery adapters are a later sub-step).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) notifications — a durable, recipient-scoped attention record.
-- ---------------------------------------------------------------------------
-- Column rationale:
--   family_id           — the household the notification belongs to (RLS defense
--                         in depth + cheap family cleanup). Cascade with family.
--   recipient_user_id   — WHO must be told. An AUTH USER (not a HouseholdPerson):
--                         only an authenticated account can receive a digital
--                         notification. This is the privacy boundary.
--   actor_user_id       — WHO caused it (provenance; the human whose action crossed
--                         the attention boundary). SET NULL on account removal.
--   type                — a small, closed vocabulary (CHECK). Structured, not prose.
--   domain              — which MamaHQ surface to navigate to (task|care|calendar).
--   entity_id           — the domain row this points AT (task id / handoff id /
--                         event id). NOT an FK: notifications outlive the entity and
--                         must never be a second delete path into domain truth.
--   title               — a short human line, computed server-side at emit time
--                         (deterministic; no technical event names leak to the UI).
--   metadata            — minimal structured extras (e.g. entity title snapshot) so
--                         the UI can render without re-reading domain truth. We do
--                         NOT copy sensitive payloads here.
--   dedupe_key          — a deterministic key making one logical action → one
--                         notification even under RPC/browser/realtime retries.
--                         UNIQUE, so a duplicate emit is a silent no-op.
--   created_at          — authoritative persisted timestamp (ordering; never trust
--                         client clocks).
--   read_at             — null = unread; set by the recipient via the mark RPCs.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,

  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,

  type text not null check (type in (
    'task_assigned',
    'task_accepted',
    'care_handoff_proposed',
    'care_handoff_accepted',
    'calendar_responsibility_assigned'
  )),
  domain text not null check (domain in ('task','care','calendar')),
  entity_id uuid,

  title text not null check (length(btrim(title)) between 1 and 300),
  metadata jsonb not null default '{}'::jsonb,

  dedupe_key text not null,

  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- One notification per logical action: the dedupe key is globally unique. It is
-- built from (type, entity, recipient, and the specific transition) so distinct
-- meaningful events are distinct, but a retry of the SAME event collides and no-ops.
create unique index if not exists notifications_dedupe_key
  on public.notifications (dedupe_key);

-- Primary access pattern: a recipient's newest-first inbox, and their unread count.
create index if not exists notifications_recipient_created
  on public.notifications (recipient_user_id, created_at desc);
create index if not exists notifications_recipient_unread
  on public.notifications (recipient_user_id)
  where read_at is null;
create index if not exists notifications_family
  on public.notifications (family_id);

-- ---------------------------------------------------------------------------
-- 2) RLS — RECIPIENT-SCOPED (stricter than family-scoped).
--    A user reads/updates ONLY their own notifications. Being in the same family is
--    NOT sufficient — James may not read Mom's private notifications. Direct client
--    INSERT is blocked entirely (generation is trusted server-side). No client
--    DELETE policy (notifications are recipient-owned records cleaned up by family
--    cascade / a future trusted path, not an ad-hoc client delete).
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;

-- READ: only the addressee.
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select using (recipient_user_id = auth.uid());

-- UPDATE: only the addressee, and they may only ever address themselves (a client
-- cannot re-point a notification at someone else). In practice only read_at changes,
-- via the mark RPCs; this policy is defense in depth for any direct update attempt.
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

-- INSERT: never from a client. All rows are written by emit_notification (SECURITY
-- DEFINER, bypasses RLS). An explicit false guard documents the intent.
drop policy if exists notifications_no_client_insert on public.notifications;
create policy notifications_no_client_insert on public.notifications
  for insert with check (false);

-- No client DELETE policy: a client cannot delete notifications directly.
drop policy if exists notifications_delete on public.notifications;

commit;

-- ============================================================================
-- 3) TRUSTED GENERATION — emit_notification(...)
--    The SINGLE place notification rows are created. SECURITY DEFINER + pinned
--    search_path. Called ONLY from inside domain RPCs that have ALREADY authorized
--    the caller against the family, so it trusts its callers for the family gate but
--    still enforces the invariants that matter for safety:
--      * self-suppression: never notify the actor about their own action.
--      * recipient must be a real auth account IN THIS FAMILY (resolved from a
--        HouseholdPerson or validated directly) — no cross-family / arbitrary
--        recipient, no account-less "digital" delivery.
--      * dedupe: a deterministic key makes retries/echoes a silent no-op.
--    Returns the notification id, or null when suppressed (self / account-less /
--    duplicate). NOT granted to any client role — it is internal-only, reachable
--    solely through the domain RPCs.
-- ============================================================================

-- Resolve the auth account linked to a HouseholdPerson, but ONLY if that person is
-- in the expected family (cross-family injection returns null → no notification).
create or replace function public.notif_account_for_person(p_family_id uuid, p_person_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pfam uuid;
  puid uuid;
begin
  if p_person_id is null then
    return null;
  end if;
  select family_id, user_id into pfam, puid
  from public.household_people where id = p_person_id;
  if pfam is null or pfam <> p_family_id then
    return null; -- unknown or cross-family person: never a valid recipient
  end if;
  return puid; -- may be null for an account-less person → caller no-ops
end $$;

create or replace function public.emit_notification(
  p_family_id uuid,
  p_recipient_user_id uuid,
  p_actor_user_id uuid,
  p_type text,
  p_domain text,
  p_entity_id uuid,
  p_title text,
  p_dedupe_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nid uuid;
  recipient_fam uuid;
begin
  -- Cannot notify a non-recipient.
  if p_recipient_user_id is null then
    return null;
  end if;

  -- SELF-SUPPRESSION: never notify someone about their own action. The UI already
  -- confirms the actor's own action; notifications are for crossing an attention
  -- boundary (Step 11 §16).
  if p_actor_user_id is not null and p_recipient_user_id = p_actor_user_id then
    return null;
  end if;

  -- The recipient must actually be a member of this family (defense in depth: even
  -- though callers resolve the recipient from a family row, we re-verify so a bad
  -- caller can never address an outsider).
  if not exists (
    select 1 from public.family_members fm
    where fm.family_id = p_family_id
      and fm.user_id = p_recipient_user_id
      and fm.status = 'active'
  ) then
    return null;
  end if;

  -- Dedupe: one logical action → one notification. A retry/echo with the same key
  -- collides on the unique index; we swallow it and return the existing id.
  insert into public.notifications (
    family_id, recipient_user_id, actor_user_id, type, domain, entity_id,
    title, metadata, dedupe_key
  ) values (
    p_family_id, p_recipient_user_id, p_actor_user_id, p_type, p_domain, p_entity_id,
    btrim(p_title), coalesce(p_metadata, '{}'::jsonb), p_dedupe_key
  )
  on conflict (dedupe_key) do nothing
  returning id into nid;

  return nid; -- null when deduped
end $$;

-- Deliberately NO grant to `authenticated`/`anon`: emit_notification is internal,
-- invoked only by the SECURITY DEFINER domain RPCs below. A client cannot call it.

-- ============================================================================
-- 4) READ-STATE RPCs (the only client-facing notification writes).
--    A recipient marks THEIR OWN notifications read. RLS already blocks touching
--    someone else's row; these RPCs give a clean, idempotent API and belt-and-braces
--    the recipient check.
-- ============================================================================

-- mark_notification_read(p_notification_id) — mark ONE of my notifications read.
-- Idempotent (already-read → no-op). Only the recipient may mark it; anyone else
-- (including a family member) gets zero rows updated and a raised error only if they
-- somehow reference a row they can see — in practice RLS hides others' rows so the
-- row is simply "not found for me".
create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n public.notifications;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into n from public.notifications where id = p_notification_id for update;
  if not found then
    return; -- idempotent: unknown id is a no-op
  end if;

  -- Recipient-scoped: only the addressee may change read state. A family member
  -- cannot mark another member's notification read.
  if n.recipient_user_id <> auth.uid() then
    raise exception 'not authorized for this notification';
  end if;

  if n.read_at is not null then
    return; -- already read
  end if;

  update public.notifications set read_at = now() where id = n.id;
end $$;

grant execute on function public.mark_notification_read(uuid) to authenticated;

-- mark_all_notifications_read() — mark ALL of MY unread notifications read. Scoped
-- to auth.uid(); can never touch another user's rows.
create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.notifications
    set read_at = now()
    where recipient_user_id = auth.uid() and read_at is null;
  get diagnostics affected = row_count;
  return affected;
end $$;

grant execute on function public.mark_all_notifications_read() to authenticated;

-- ============================================================================
-- 5) DOMAIN RPCs REDEFINED — emit notifications in-transaction.
--    Each is an idempotent create-or-replace preserving the EXACT Step 8/9/10
--    behavior; the ONLY change is a same-transaction emit_notification call on the
--    person-directed transitions. Because 0013 applies after 0010/0011/0012, these
--    definitions win on clean provision and are safe re-applies on a live DB.
--    Notification failure semantics (Step 11 §31): emit participates in the SAME
--    transaction as the state change, so for these person-directed changes the
--    change and its notification commit together. emit is defensive (self/absent/
--    dupe → silent no-op) so it never makes the domain write fragile.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- create_task(...) — REDEFINED (Step 11). Identical to Step 8/9 create_task, PLUS:
--   if the task is created ALREADY assigned to someone OTHER than the creator, emit
--   a task_assigned notification to that assignee's linked account. (Self-assignment
--   at creation → no notification, per §16.) Dedupe key ties to the task so a retry
--   of the same create — which is idempotent and returns the existing id without
--   re-inserting events — also cannot double-notify.
-- ---------------------------------------------------------------------------
create or replace function public.create_task(
  p_family_id uuid,
  p_title text,
  p_assigned_to_person_id uuid default null,
  p_due_at timestamptz default null,
  p_notes text default null,
  p_source text default 'manual',
  p_client_task_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  tid uuid;
  existing public.tasks;
  clean_title text;
  recipient uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_family_member(p_family_id) then
    raise exception 'not authorized for this family';
  end if;

  clean_title := btrim(coalesce(p_title, ''));
  if length(clean_title) = 0 then
    raise exception 'task title is required';
  end if;

  tid := coalesce(p_client_task_id, gen_random_uuid());
  select * into existing from public.tasks where id = tid for update;
  if found then
    if existing.family_id <> p_family_id then
      raise exception 'not authorized for this family';
    end if;
    return existing.id; -- idempotent: no duplicate task, event, or notification
  end if;

  perform public.assert_task_assignee(p_family_id, p_assigned_to_person_id);

  insert into public.tasks (
    id, family_id, title, notes, status, assigned_to_person_id,
    created_by_user_id, source, due_at
  ) values (
    tid, p_family_id, clean_title, nullif(btrim(coalesce(p_notes, '')), ''), 'open',
    p_assigned_to_person_id, uid,
    case when p_source in ('manual','tell_mamahq','household_member','care_handoff','calendar','system')
         then p_source else 'manual' end,
    p_due_at
  );

  insert into public.task_events (family_id, task_id, event_type, actor_user_id, new_person_id)
  values (p_family_id, tid, 'created', uid, null);

  if p_assigned_to_person_id is not null then
    insert into public.task_events (family_id, task_id, event_type, actor_user_id, prev_person_id, new_person_id)
    values (p_family_id, tid, 'assigned', uid, null, p_assigned_to_person_id);

    -- Notify the assignee (unless it's the creator assigning themselves).
    recipient := public.notif_account_for_person(p_family_id, p_assigned_to_person_id);
    perform public.emit_notification(
      p_family_id, recipient, uid,
      'task_assigned', 'task', tid,
      'New task for you: ' || clean_title,
      -- Dedupe on the TRANSITION none→assignee (the task is created already-owned).
      -- Same key shape as assign_task so the semantics are one consistent
      -- transition identity; a create retry (idempotent above) cannot double-notify.
      'task_assigned:' || tid::text || ':none:' || p_assigned_to_person_id::text,
      jsonb_build_object('taskTitle', clean_title)
    );
  end if;

  return tid;
end $$;

grant execute on function public.create_task(uuid, text, uuid, timestamptz, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- assign_task(...) — REDEFINED (Step 11). Identical to Step 9 assign_task (set/
--   change/clear owner, invalidate acceptance, write assigned/reassigned event),
--   PLUS: when ownership changes to a NON-null person who is NOT the acting user,
--   emit a task_assigned notification to that person's account. Unassignment
--   (p_person_id null) notifies no one. The no-op (same owner) path emits nothing.
--   Dedupe key includes the new person so re-assigning A→B→A can legitimately
--   notify A again about the later assignment, while an exact retry of one
--   assignment (which the no-op guard already blocks) cannot double-fire.
-- ---------------------------------------------------------------------------
create or replace function public.assign_task(p_task_id uuid, p_person_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tasks;
  uid uuid := auth.uid();
  recipient uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into t from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'task not found';
  end if;
  if not public.is_family_member(t.family_id) then
    raise exception 'not authorized for this family';
  end if;

  if t.assigned_to_person_id is not distinct from p_person_id then
    return; -- no-op: same owner, no event, no notification
  end if;

  perform public.assert_task_assignee(t.family_id, p_person_id);

  update public.tasks
    set assigned_to_person_id = p_person_id,
        acknowledged_at = null,
        acknowledged_by_user_id = null,
        acknowledged_by_household_person_id = null
    where id = t.id;

  insert into public.task_events (family_id, task_id, event_type, actor_user_id, prev_person_id, new_person_id)
  values (
    t.family_id, t.id,
    case when t.assigned_to_person_id is null then 'assigned' else 'reassigned' end,
    uid, t.assigned_to_person_id, p_person_id
  );

  if p_person_id is not null then
    recipient := public.notif_account_for_person(t.family_id, p_person_id);
    perform public.emit_notification(
      t.family_id, recipient, uid,
      'task_assigned', 'task', t.id,
      'New task for you: ' || t.title,
      -- Dedupe on the TRANSITION prev→new (not just (task, new owner)). This makes an
      -- A→B→A reassignment cycle three distinct notifications, while an EXACT repeat
      -- of one transition collides and no-ops (the same-owner case is already a no-op
      -- return above). 'none' marks a previously-unassigned origin so the first
      -- assignment does not collide with a later re-assignment to the same person.
      'task_assigned:' || t.id::text || ':'
        || coalesce(t.assigned_to_person_id::text, 'none') || ':' || p_person_id::text,
      jsonb_build_object('taskTitle', t.title)
    );
  end if;
end $$;

grant execute on function public.assign_task(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- accept_task(...) — REDEFINED (Step 11). Identical to Step 9 accept_task (only the
--   assignee's own account may accept; sets acknowledgement + 'accepted' event;
--   idempotent), PLUS: notify the task's CREATOR that the uncertainty is resolved
--   ("James has it"). The creator is the person who put the task into the system; if
--   the creator is the accepter (they assigned it to themselves and accepted) →
--   self-suppressed. Account-less/absent creator → no-op.
-- ---------------------------------------------------------------------------
create or replace function public.accept_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tasks;
  uid uuid := auth.uid();
  assignee_uid uuid;
  assignee_name text;
begin
  if uid is null then
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

  select user_id into assignee_uid from public.household_people where id = t.assigned_to_person_id;
  if assignee_uid is null or assignee_uid <> uid then
    raise exception 'only the assigned person can accept this task';
  end if;

  -- Idempotent: already accepted by this same person → nothing to do (no dup event,
  -- no dup notification).
  if t.acknowledged_by_household_person_id is not distinct from t.assigned_to_person_id
     and t.acknowledged_at is not null then
    return;
  end if;

  update public.tasks
    set acknowledged_at = now(),
        acknowledged_by_user_id = uid,
        acknowledged_by_household_person_id = t.assigned_to_person_id
    where id = t.id;

  insert into public.task_events (family_id, task_id, event_type, actor_user_id, new_person_id)
  values (t.family_id, t.id, 'accepted', uid, t.assigned_to_person_id);

  -- Notify the CREATOR: their uncertainty ("who's got this?") is resolved.
  select display_name into assignee_name from public.household_people where id = t.assigned_to_person_id;
  perform public.emit_notification(
    t.family_id, t.created_by_user_id, uid,
    'task_accepted', 'task', t.id,
    coalesce(assignee_name, 'Someone') || ' has it: ' || t.title,
    -- One acceptance = one notification; a re-accept is blocked by the idempotency
    -- guard above, and this key ties to the current acceptance actor.
    'task_accepted:' || t.id::text || ':' || uid::text,
    jsonb_build_object('taskTitle', t.title, 'accepterName', coalesce(assignee_name, ''))
  );
end $$;

grant execute on function public.accept_task(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- propose_care_handoff(...) — REDEFINED (Step 11). Identical to Step 9
--   propose_care_handoff (validates recipient is a connected same-family account,
--   one pending per subject, creates the pending row; holder does NOT change), PLUS:
--   notify the recipient that a handoff awaits their acceptance. The recipient is
--   always a connected account (the RPC already rejects account-less recipients), so
--   emission always has a real target (self-suppressed only in the degenerate case
--   the proposer somehow equals the recipient, which the "already has care" guard
--   and connected-account checks make impossible in practice).
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
  uid uuid := auth.uid();
  proposer_name text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_family_member(p_family_id) then
    raise exception 'not authorized for this family';
  end if;

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

  rid := public.ensure_care_responsibility(p_family_id);
  select holder_person_id, subject_baby_id into holder, subj
  from public.care_responsibility where id = rid for update;

  if holder is not distinct from p_to_person_id then
    raise exception 'that person already has care';
  end if;

  insert into public.care_handoffs (
    family_id, subject_baby_id, from_person_id, to_person_id, proposed_by_user_id,
    status, context
  ) values (
    p_family_id, subj, holder, p_to_person_id, uid,
    'pending', coalesce(p_context, '{}'::jsonb)
  )
  returning id into hid;

  -- Notify the recipient: their attention is genuinely required (they must accept
  -- or decline). from-person name for a human line.
  select display_name into proposer_name from public.household_people
  where family_id = p_family_id and id = holder;
  perform public.emit_notification(
    p_family_id, to_uid, uid,
    'care_handoff_proposed', 'care', hid,
    coalesce(proposer_name, 'Someone') || ' wants to hand off care to you',
    'care_handoff_proposed:' || hid::text,
    jsonb_build_object('proposerName', coalesce(proposer_name, ''))
  );

  return hid;
end $$;

grant execute on function public.propose_care_handoff(uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- accept_care_handoff(...) — REDEFINED (Step 11). Identical to Step 9
--   accept_care_handoff (only the recipient's account may accept; atomically marks
--   accepted AND moves the care holder; idempotent; stale/terminal rejected), PLUS:
--   notify the PROPOSER that the baby is now with the recipient ("James has the
--   baby."). Self-suppressed if the proposer accepted their own proposal (not a real
--   flow). Account-less/absent proposer → no-op.
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
  uid uuid := auth.uid();
  accepter_name text;
begin
  if uid is null then
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
  if to_uid is null or to_uid <> uid then
    raise exception 'only the recipient can accept this handoff';
  end if;

  if h.status = 'accepted' then
    return; -- idempotent: no duplicate holder move, no duplicate notification
  end if;

  if h.status <> 'pending' then
    raise exception 'handoff is no longer pending';
  end if;

  update public.care_handoffs
    set status = 'accepted', resolved_at = now(), resolved_by_user_id = uid
    where id = h.id;

  rid := public.ensure_care_responsibility(h.family_id);
  update public.care_responsibility
    set holder_person_id = h.to_person_id
    where id = rid;

  -- Notify the proposer: the baby is now with the recipient.
  select display_name into accepter_name from public.household_people where id = h.to_person_id;
  perform public.emit_notification(
    h.family_id, h.proposed_by_user_id, uid,
    'care_handoff_accepted', 'care', h.id,
    coalesce(accepter_name, 'Someone') || ' has the baby',
    'care_handoff_accepted:' || h.id::text,
    jsonb_build_object('accepterName', coalesce(accepter_name, ''))
  );
end $$;

grant execute on function public.accept_care_handoff(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- create_calendar_event(...) — REDEFINED (Step 11). Identical to Step 10
--   create_calendar_event (transactional event + participants; idempotent on client
--   id; family-validated responsible/participants), PLUS: if a responsible person is
--   designated at creation and it's NOT the creator, notify that person's account
--   that they're designated to handle the event. This is a DESIGNATION, not an
--   acceptance — the title must never imply "you accepted".
-- ---------------------------------------------------------------------------
create or replace function public.create_calendar_event(
  p_family_id uuid,
  p_title text,
  p_all_day boolean default false,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_start_date date default null,
  p_end_date date default null,
  p_location text default null,
  p_notes text default null,
  p_responsible_person_id uuid default null,
  p_participant_ids uuid[] default null,
  p_client_event_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  eid uuid;
  existing public.calendar_events;
  clean_title text;
  recipient uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_family_member(p_family_id) then
    raise exception 'not authorized for this family';
  end if;

  clean_title := btrim(coalesce(p_title, ''));
  if length(clean_title) = 0 then
    raise exception 'event title is required';
  end if;

  eid := coalesce(p_client_event_id, gen_random_uuid());
  select * into existing from public.calendar_events where id = eid for update;
  if found then
    if existing.family_id <> p_family_id then
      raise exception 'not authorized for this family';
    end if;
    return existing.id; -- idempotent: no duplicate event or notification
  end if;

  perform public.assert_calendar_person(p_family_id, p_responsible_person_id);

  insert into public.calendar_events (
    id, family_id, title, notes, location, all_day,
    starts_at, ends_at, start_date, end_date,
    responsible_person_id, created_by_user_id
  ) values (
    eid, p_family_id, clean_title,
    nullif(btrim(coalesce(p_notes, '')), ''),
    nullif(btrim(coalesce(p_location, '')), ''),
    coalesce(p_all_day, false),
    case when coalesce(p_all_day, false) then null else p_starts_at end,
    case when coalesce(p_all_day, false) then null else p_ends_at end,
    case when coalesce(p_all_day, false) then p_start_date else null end,
    case when coalesce(p_all_day, false) then p_end_date else null end,
    p_responsible_person_id, uid
  );

  perform public.set_calendar_participants(eid, p_family_id, p_participant_ids);

  if p_responsible_person_id is not null then
    recipient := public.notif_account_for_person(p_family_id, p_responsible_person_id);
    perform public.emit_notification(
      p_family_id, recipient, uid,
      'calendar_responsibility_assigned', 'calendar', eid,
      'You''re handling: ' || clean_title,
      -- Dedupe on the TRANSITION, not just (event, person). At create the previous
      -- responsible is 'none'. Keying by prev→new means a later A→B→A re-designation
      -- (whose new-person matches the create) is still a distinct, legitimate
      -- notification rather than being suppressed as a duplicate. See §17.
      'calendar_responsibility_assigned:' || eid::text || ':none:' || p_responsible_person_id::text,
      jsonb_build_object('eventTitle', clean_title)
    );
  end if;

  return eid;
end $$;

grant execute on function public.create_calendar_event(uuid, text, boolean, timestamptz, timestamptz, date, date, text, text, uuid, uuid[], uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- update_calendar_event(...) — REDEFINED (Step 11). Identical to Step 10
--   update_calendar_event (transactional field + participant replacement;
--   family-validated), PLUS: if the responsible person is CHANGED to a new non-null
--   person who is NOT the actor, notify that person. Clearing responsibility, or
--   leaving it unchanged, notifies no one. Only a genuine change of the designated
--   responsible person crosses an attention boundary (§15/§17: not every note edit).
-- ---------------------------------------------------------------------------
create or replace function public.update_calendar_event(
  p_event_id uuid,
  p_title text default null,
  p_all_day boolean default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_start_date date default null,
  p_end_date date default null,
  p_location text default null,
  p_notes text default null,
  p_responsible_person_id uuid default null,
  p_clear_responsible boolean default false,
  p_participant_ids uuid[] default null,
  p_replace_participants boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.calendar_events;
  new_all_day boolean;
  uid uuid := auth.uid();
  prev_responsible uuid;
  recipient uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into e from public.calendar_events where id = p_event_id for update;
  if not found then
    raise exception 'event not found';
  end if;
  if not public.is_family_member(e.family_id) then
    raise exception 'not authorized for this family';
  end if;

  prev_responsible := e.responsible_person_id;
  new_all_day := coalesce(p_all_day, e.all_day);

  if p_responsible_person_id is not null then
    perform public.assert_calendar_person(e.family_id, p_responsible_person_id);
  end if;

  update public.calendar_events
    set
      title = case when p_title is not null and length(btrim(p_title)) > 0
                   then btrim(p_title) else title end,
      notes = case when p_notes is not null then nullif(btrim(p_notes), '') else notes end,
      location = case when p_location is not null then nullif(btrim(p_location), '') else location end,
      all_day = new_all_day,
      starts_at = case when new_all_day then null
                       else coalesce(p_starts_at, case when e.all_day then null else e.starts_at end) end,
      ends_at   = case when new_all_day then null
                       else coalesce(p_ends_at, case when e.all_day then null else e.ends_at end) end,
      start_date = case when new_all_day
                        then coalesce(p_start_date, case when e.all_day then e.start_date else null end)
                        else null end,
      end_date   = case when new_all_day
                        then coalesce(p_end_date, case when e.all_day then e.end_date else null end)
                        else null end,
      responsible_person_id = case
        when p_clear_responsible then null
        when p_responsible_person_id is not null then p_responsible_person_id
        else responsible_person_id end
    where id = e.id;

  if p_replace_participants then
    perform public.set_calendar_participants(e.id, e.family_id, coalesce(p_participant_ids, array[]::uuid[]));
  end if;

  -- Notify ONLY on a genuine change of the responsible person to a new non-null
  -- person (not on clear, not on unchanged, not on note/title edits).
  if not p_clear_responsible
     and p_responsible_person_id is not null
     and p_responsible_person_id is distinct from prev_responsible then
    recipient := public.notif_account_for_person(e.family_id, p_responsible_person_id);
    perform public.emit_notification(
      e.family_id, recipient, uid,
      'calendar_responsibility_assigned', 'calendar', e.id,
      'You''re handling: ' || e.title,
      -- Dedupe on the TRANSITION prev→new (not just (event, new)). This makes an
      -- A→B→A cycle three distinct notifications, while an EXACT repeat of the same
      -- prev→new transition (e.g. a retried identical update) collides and no-ops.
      -- 'none' marks a create/previously-unassigned origin so update-back-to-A does
      -- not collide with the create-time key. See §17.
      'calendar_responsibility_assigned:' || e.id::text || ':'
        || coalesce(prev_responsible::text, 'none') || ':' || p_responsible_person_id::text,
      jsonb_build_object('eventTitle', e.title)
    );
  end if;
end $$;

grant execute on function public.update_calendar_event(uuid, text, boolean, timestamptz, timestamptz, date, date, text, text, uuid, boolean, uuid[], boolean) to authenticated;

-- ============================================================================
-- 6) REALTIME PUBLICATION — expose ONLY the shared operational tables + the
--    per-recipient notifications table. Realtime is family-synchronization; clients
--    subscribe with a family_id filter, but RLS remains the authoritative boundary
--    (a client cannot subscribe its way around row security). We add tables to the
--    supabase_realtime publication idempotently (create the publication if this is a
--    bare Postgres without it, then add each table only if not already a member).
--
--    Exposed (and why):
--      grocery_items                 — shared list changes (add/complete/restore/qty)
--      tasks                         — current task truth (assign/complete/reopen/ack)
--      task_events                   — acceptance/relinquish transitions the UI reflects
--      care_responsibility           — current care holder changes
--      care_handoffs                 — handoff propose/accept/decline/cancel
--      calendar_events               — event create/edit/delete, responsibility
--      calendar_event_participants   — participant set changes
--      notifications                 — a recipient's unread badge/list, live
--    NOT exposed: household memory/observations, purchase_events, logs, appointments,
--    mom/memories/captures, families/family_members/household_people/invitations —
--    either private-per-device, historical, or identity/auth surfaces that don't need
--    live cross-session sync in Step 11. Adding tables later is a one-line change.
--
--    Replica identity: the domain providers use invalidate→REFETCH (not old-row
--    diffing), and RLS on realtime uses the NEW row, so DEFAULT replica identity
--    (primary key) is sufficient. We do not set REPLICA IDENTITY FULL (it would only
--    add WAL overhead for old-row columns we never consume).
-- ============================================================================

-- Ensure the publication exists (Supabase precreates it; a bare Postgres may not).
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Idempotently add each table to the publication (only if not already a member).
do $$
declare
  t text;
  tables text[] := array[
    'grocery_items',
    'tasks',
    'task_events',
    'care_responsibility',
    'care_handoffs',
    'calendar_events',
    'calendar_event_participants',
    'notifications'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
