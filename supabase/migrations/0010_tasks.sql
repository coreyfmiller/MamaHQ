-- ============================================================================
-- MamaHQ — 0010_tasks (Step 8: Tasks, Responsibilities & Ownership)
-- ============================================================================
-- MamaHQ's first durable household RESPONSIBILITY system. Not a project manager —
-- the goal is to reduce Mom's mental load by making ownership explicit:
--
--   "Mom gets something out of her head, assigns it to a real household person,
--    and trusts that MamaHQ knows who owns it."
--
-- Identity model (unchanged from Steps 2/7 — kept strictly separate):
--   Auth User        = how someone authenticates            (auth.users)
--   Family Member    = authorization to access a household   (family_members)
--   Household Person = who the human is in the household      (household_people;
--                      user_id null = no account, non-null = connected)
--   OWNERSHIP (new)  = who is responsible for a task          (assigned_to_person_id
--                      → household_people, NEVER auth.users)
--
-- CENTRAL DISTINCTIONS this migration encodes:
--   * Person ≠ Account ≠ Membership ≠ Ownership. A task's owner is a
--     household_people row, which may have NO account (e.g. Grandma). Assignment
--     is attribution/responsibility; it NEVER grants app access. Access is gated
--     ONLY by is_family_member(family_id) — the same boundary as every table.
--   * Creator ≠ Owner ≠ Completer. Mom (created_by_user_id) may create a task,
--     assign it to James (assigned_to_person_id), and Dad (completed_by_user_id)
--     may complete it. Three independent facts, all preserved.
--   * Assignment ≠ Acknowledgement. Step 8 records who CURRENTLY owns a task. It
--     does NOT model "James has taken responsibility" — that acknowledgement event
--     is deferred to a later step. The schema is designed so a future
--     'acknowledged' task_event slots in without change (task_events.event_type is
--     open text with a CHECK we can extend additively).
--   * Current Task = current truth; task_events = historical truth. We never
--     manufacture history from current state, and never rewrite events to make the
--     present look tidy (mirrors PurchaseEvent vs Household Memory from Step 6).
--
-- What this migration adds:
--   1. public.tasks            — the durable, family-scoped responsibility row.
--   2. public.task_events       — a lean append-only history (created/assigned/
--                                 reassigned/completed/reopened; extensible).
--   3. Family-scoped RLS: members may READ their family's tasks/events; direct
--      client INSERT/UPDATE/DELETE are BLOCKED — all writes go through the atomic
--      SECURITY DEFINER RPCs below (so a state change + its history event are one
--      transaction, exactly the reliability class we fixed in Grocery).
--   4. RPCs: create_task, assign_task, complete_task, reopen_task — each atomic,
--      each authorized from the ROW's own family (never caller-supplied), each
--      idempotent on retry, each safe under concurrency (row locks + status guards).
--
-- Deliberately NOT here (deferred; documented in docs/TASKS.md + PRODUCT_LIMITATIONS):
--   acknowledgement/"I've got it", Care Handoff, realtime, notifications, recurring
--   tasks, subtasks/projects, priority levels, AI parsing, Tell-MamaHQ creation.
--
-- No AI/LLM. Additive + idempotent + non-destructive. Apply AFTER
-- 0009_household_membership.sql.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) tasks — the current responsibility row (CURRENT TRUTH).
-- ---------------------------------------------------------------------------
-- Column rationale:
--   family_id                   — every task belongs to exactly one household.
--   title                       — the human-readable "what needs doing" (1..500).
--   notes                       — optional free text detail.
--   status                      — MINIMAL lifecycle: 'open' | 'completed'. No
--                                 backlog/blocked/in-progress/etc. (complex states
--                                 add mental load — see docs/TASKS.md).
--   assigned_to_person_id       — OWNERSHIP. FK → household_people (the person who
--                                 is responsible), ON DELETE SET NULL so removing a
--                                 person never destroys the task or its history —
--                                 it becomes unassigned. NULL = no owner yet (valid;
--                                 ownership is explicit when it exists, not forced).
--   created_by_user_id          — CREATOR. The authenticated user who entered it.
--                                 Independent of ownership. auth.users, SET NULL so
--                                 a disconnected account never deletes tasks.
--   source                      — PROVENANCE. Small vocabulary; Step 8 uses 'manual'.
--                                 Future Tell-MamaHQ etc. create the SAME Task, not a
--                                 second task system.
--   due_at                      — OPTIONAL due date/time. Not required.
--   completed_at / completed_by_user_id — COMPLETION FACTS. Who actually completed
--                                 it and when — distinct from the owner. Cleared on
--                                 reopen.
--   created_at / updated_at     — standard provenance.
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,

  title text not null check (length(btrim(title)) between 1 and 500),
  notes text,

  status text not null default 'open' check (status in ('open','completed')),

  -- OWNERSHIP → a person (may be account-less). NEVER an auth user id.
  assigned_to_person_id uuid references public.household_people(id) on delete set null,

  -- CREATOR → the authenticated user who captured it (independent of ownership).
  created_by_user_id uuid references auth.users(id) on delete set null default auth.uid(),

  -- PROVENANCE. Small, useful vocabulary; only 'manual' is fully used in Step 8.
  source text not null default 'manual'
    check (source in ('manual','tell_mamahq','household_member','care_handoff','calendar','system')),

  due_at timestamptz,

  -- COMPLETION facts (distinct from ownership). Set on complete, cleared on reopen.
  completed_at timestamptz,
  completed_by_user_id uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Access patterns (Step 8 §41): the open list, "Mine", due ordering, and history.
create index if not exists tasks_family_status
  on public.tasks (family_id, status);
create index if not exists tasks_family_assignee_status
  on public.tasks (family_id, assigned_to_person_id, status);
create index if not exists tasks_family_due
  on public.tasks (family_id, due_at) where due_at is not null;

drop trigger if exists trg_tasks_updated on public.tasks;
create trigger trg_tasks_updated before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2) task_events — HISTORICAL TRUTH (lean, append-only; NOT event sourcing).
-- ---------------------------------------------------------------------------
-- We do not reconstruct the task from events; the task row is the current truth.
-- Events exist to preserve responsibility history (who assigned/owned/completed
-- what, when) and to support future handoff/acknowledgement semantics.
--
--   event_type            — created | assigned | reassigned | completed | reopened.
--                           Open CHECK so future additive steps can add
--                           'acknowledged' | 'declined' | 'handed_off' WITHOUT a
--                           destructive change.
--   actor_user_id         — the authenticated user who performed the action.
--   prev_person_id / new_person_id — ownership transition (for assigned/reassigned).
--                           FK → household_people, SET NULL so history survives a
--                           person's removal (the fact that ownership changed
--                           remains, even if a name later disappears).
--   metadata              — minimal structured extras (rarely needed).
create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,

  event_type text not null
    check (event_type in ('created','assigned','reassigned','completed','reopened')),

  actor_user_id uuid references auth.users(id) on delete set null,
  prev_person_id uuid references public.household_people(id) on delete set null,
  new_person_id uuid references public.household_people(id) on delete set null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

-- History for a task, newest/oldest by created_at (Step 8 §41).
create index if not exists task_events_task
  on public.task_events (task_id, created_at);
create index if not exists task_events_family
  on public.task_events (family_id, created_at);

-- ---------------------------------------------------------------------------
-- 3) RLS — family-scoped, same is_family_member boundary as every table.
--    READ is allowed to members. WRITES are blocked at the client: every mutation
--    goes through the atomic SECURITY DEFINER RPCs (which run as table owner and
--    bypass RLS), so a task's state change and its history event are always one
--    transaction. This is the Grocery reliability lesson applied to Tasks.
-- ---------------------------------------------------------------------------
alter table public.tasks enable row level security;
alter table public.task_events enable row level security;

-- tasks: members read; no direct client writes.
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select using (public.is_family_member(family_id));

drop policy if exists tasks_no_client_insert on public.tasks;
create policy tasks_no_client_insert on public.tasks
  for insert with check (false);

drop policy if exists tasks_no_client_update on public.tasks;
create policy tasks_no_client_update on public.tasks
  for update using (false) with check (false);

-- Deletes stay possible for members (e.g. "Start over" wipe runs as the user, and
-- a member removing their own family's task is legitimate). Scoped to the family.
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete using (public.is_family_member(family_id));

-- task_events: members read; no direct client writes (events are written only by
-- the RPCs, atomically with the state change). Deletes scoped to family for the
-- "Start over" wipe.
drop policy if exists task_events_select on public.task_events;
create policy task_events_select on public.task_events
  for select using (public.is_family_member(family_id));

drop policy if exists task_events_no_client_insert on public.task_events;
create policy task_events_no_client_insert on public.task_events
  for insert with check (false);

drop policy if exists task_events_no_client_update on public.task_events;
create policy task_events_no_client_update on public.task_events
  for update using (false) with check (false);

drop policy if exists task_events_delete on public.task_events;
create policy task_events_delete on public.task_events
  for delete using (public.is_family_member(family_id));

commit;

-- ============================================================================
-- 4) SECURITY DEFINER RPCs (each create-or-replace = idempotent).
--    Every RPC: pins search_path, requires auth.uid(), authorizes from the ROW's
--    own family (never caller-supplied), locks rows it mutates, is idempotent on
--    retry, and writes its history event in the SAME transaction as the state
--    change. Assignment integrity (a person must belong to the task's family) is
--    enforced HERE — never trusting the client.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Internal helper: validate that a household person may OWN a task in a given
-- family — i.e. the person exists AND belongs to that same family. Returns the
-- person id (echoed) or raises. p_person_id null = "unassigned" (allowed).
-- SECURITY DEFINER + search_path pinned; called only by the task RPCs, which have
-- already authorized the caller against the family.
-- ---------------------------------------------------------------------------
create or replace function public.assert_task_assignee(p_family_id uuid, p_person_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pfam uuid;
begin
  if p_person_id is null then
    return null; -- unassigned is valid
  end if;
  select family_id into pfam from public.household_people where id = p_person_id;
  if pfam is null then
    raise exception 'assignee person not found';
  end if;
  if pfam <> p_family_id then
    -- Cross-family assignment: Family A task may never be owned by a Family B person.
    raise exception 'assignee person is not in this family';
  end if;
  return p_person_id;
end $$;

-- ---------------------------------------------------------------------------
-- create_task(p_family_id, p_title, p_assigned_to_person_id, p_due_at, p_notes,
--             p_source, p_client_task_id)
--   Creates a task in the caller's family AND its 'created' event (+ an 'assigned'
--   event when created already-owned) in ONE transaction. Authorization: the caller
--   must be a member of p_family_id. Assignment integrity: the assignee (if any)
--   must belong to p_family_id (assert_task_assignee).
--   IDEMPOTENCY: p_client_task_id is used as the task's PRIMARY KEY. A retried
--   create with the same id is a no-op that returns the existing id (no duplicate
--   task, no duplicate 'created' event). The client generates a stable UUID per
--   intended task (crypto.randomUUID), so a double-tap/network retry cannot create
--   two tasks. Returns the task id.
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

  -- Idempotency: if a task with this client-supplied id already exists, return it.
  tid := coalesce(p_client_task_id, gen_random_uuid());
  select * into existing from public.tasks where id = tid for update;
  if found then
    -- Only treat as the same task if it belongs to this family (guard against a
    -- caller supplying an id from another family — which they cannot read anyway).
    if existing.family_id <> p_family_id then
      raise exception 'not authorized for this family';
    end if;
    return existing.id;
  end if;

  -- Validate ownership target (if any) belongs to this family.
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

  -- 'created' event (always). If created already-owned, also an 'assigned' event so
  -- history reflects the initial ownership as a distinct fact.
  insert into public.task_events (family_id, task_id, event_type, actor_user_id, new_person_id)
  values (p_family_id, tid, 'created', uid, null);

  if p_assigned_to_person_id is not null then
    insert into public.task_events (family_id, task_id, event_type, actor_user_id, prev_person_id, new_person_id)
    values (p_family_id, tid, 'assigned', uid, null, p_assigned_to_person_id);
  end if;

  return tid;
end $$;

grant execute on function public.create_task(uuid, text, uuid, timestamptz, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- assign_task(p_task_id, p_person_id)
--   Sets/changes/clears a task's owner. ONE transaction: update the current owner
--   AND append an 'assigned' (first ownership) or 'reassigned' (owner changed)
--   event. p_person_id null = unassign. Authorization from the TASK's own family;
--   assignee (if any) must belong to that family (assert_task_assignee).
--   IDEMPOTENCY / NO-OP: assigning the same owner again changes nothing and records
--   NO event (history reflects real transitions only — Step 8 §32). Row-locked, so
--   two concurrent reassignments serialize to one coherent final owner.
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

  -- Validate the new owner belongs to this task's family (or is null = unassign).
  perform public.assert_task_assignee(t.family_id, p_person_id);

  update public.tasks
    set assigned_to_person_id = p_person_id
    where id = t.id;

  -- 'assigned' when there was no prior owner; 'reassigned' when ownership changed.
  insert into public.task_events (family_id, task_id, event_type, actor_user_id, prev_person_id, new_person_id)
  values (
    t.family_id, t.id,
    case when t.assigned_to_person_id is null then 'assigned' else 'reassigned' end,
    auth.uid(), t.assigned_to_person_id, p_person_id
  );
end $$;

grant execute on function public.assign_task(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- complete_task(p_task_id)
--   Any authorized adult household member may complete a task. ONE transaction:
--   mark completed + record completer/timestamp AND append a 'completed' event.
--   Ownership is NOT rewritten — a task owned by James and completed by Mom keeps
--   owner=James, completed_by=Mom (both facts are true and different).
--   IDEMPOTENCY: an already-completed task is a no-op that records NO duplicate
--   event (safe under double-tap / two adults racing to complete). Row-locked so
--   concurrent completers produce exactly one completion + one event.
-- ---------------------------------------------------------------------------
create or replace function public.complete_task(p_task_id uuid)
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

  -- Idempotent: already completed → nothing to do, no duplicate event.
  if t.status = 'completed' then
    return;
  end if;

  update public.tasks
    set status = 'completed', completed_at = now(), completed_by_user_id = auth.uid()
    where id = t.id;

  insert into public.task_events (family_id, task_id, event_type, actor_user_id)
  values (t.family_id, t.id, 'completed', auth.uid());
end $$;

grant execute on function public.complete_task(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- reopen_task(p_task_id)
--   Corrects an accidental completion. ONE transaction: status → open, clear
--   completion metadata (completed_at, completed_by_user_id) AND append a 'reopened'
--   event. Ownership + task identity are preserved (never duplicated). IDEMPOTENT:
--   an already-open task is a no-op with no event. Row-locked so a complete/reopen
--   collision resolves to a single coherent final state.
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

  -- Idempotent: already open → nothing to do, no duplicate event.
  if t.status <> 'completed' then
    return;
  end if;

  update public.tasks
    set status = 'open', completed_at = null, completed_by_user_id = null
    where id = t.id;

  insert into public.task_events (family_id, task_id, event_type, actor_user_id)
  values (t.family_id, t.id, 'reopened', auth.uid());
end $$;

grant execute on function public.reopen_task(uuid) to authenticated;
