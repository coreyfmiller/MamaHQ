-- ============================================================================
-- MamaHQ — 0012_calendar_commitments (Step 10: Shared Calendar & Household Commitments)
-- ============================================================================
-- A durable, family-scoped shared calendar that understands not just TIME, but
-- also WHO an event is about and WHO is responsible for handling it.
--
--   An EVENT says what is happening.        (title + when)
--   A PARTICIPANT is who the event is about. (household_people)
--   A COMMITMENT says who is responsible.    (responsible_person_id → household_people)
--
-- These three are DISTINCT and must never be collapsed:
--   "Madelyn has the dentist" (participant) is not "Corey is taking her"
--   (responsible). One is never inferred from the other.
--
-- Identity doctrine (unchanged from Steps 7–9): participants and the responsible
-- person are ALWAYS household_people ids (never strings like 'mom'/'partner').
-- They may be account-less people. Being a participant/responsible does NOT grant
-- app access — RLS gates everything on is_family_member(family_id).
--
-- RESPONSIBILITY ≠ ACCEPTANCE (Step 9 principle preserved): a calendar event's
-- responsible person is a DESIGNATION ("Corey is expected to handle this"), NOT an
-- explicit acceptance. Step 10 deliberately does NOT build a second acceptance
-- workflow (that would duplicate the Tasks/Care acceptance system). Storing the
-- responsible person is enough; commitment-acceptance is a documented future
-- extension. See docs/CALENDAR.md.
--
-- TIMEZONE STRATEGY (see docs/CALENDAR.md):
--   * TIMED events store an unambiguous instant in `starts_at`/`ends_at`
--     (timestamptz — UTC internally), displayed in the viewer's local timezone.
--   * ALL-DAY events store `start_date`/`end_date` as plain `date` (no time, no
--     zone) so an all-day event NEVER shifts to the previous/next day under
--     timezone conversion. `all_day` selects which pair is authoritative.
--   This keeps external-calendar sync (future) straightforward and avoids the
--   classic all-day off-by-one-day bug.
--
-- Additive + idempotent + non-destructive. Apply AFTER 0011_responsibility_handoff.
-- Clean-provisions 0001 → 0012 from an empty database. This ADDS a new calendar
-- domain; it does NOT modify the existing narrow `appointments` feature.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) calendar_events — the core household event.
-- ---------------------------------------------------------------------------
-- Column rationale:
--   title / notes / location  — the human "what" + optional detail/place.
--   all_day                    — selects the time model: false → starts_at/ends_at
--                                (timed instant), true → start_date/end_date (dates).
--   starts_at / ends_at        — timed instant range (timestamptz, UTC). ends_at
--                                optional. Multi-day timed spans are allowed.
--   start_date / end_date      — all-day date range (date, no tz). end_date optional
--                                (single-day). Multi-day all-day spans allowed
--                                (e.g. vacation Jul 4–10).
--   responsible_person_id      — OPTIONAL primary responsible HouseholdPerson
--                                (a DESIGNATION, not acceptance; not the creator,
--                                not necessarily a participant). SET NULL on person
--                                removal so the event survives.
--   created_by_user_id         — the authenticated creator (provenance; distinct
--                                from responsibility). SET NULL on account removal.
--   A CHECK enforces the two time models are used coherently (see below).
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,

  title text not null check (length(btrim(title)) between 1 and 300),
  notes text,
  location text,

  all_day boolean not null default false,

  -- Timed model (all_day = false): an unambiguous UTC instant + optional end.
  starts_at timestamptz,
  ends_at timestamptz,

  -- All-day model (all_day = true): plain dates that never tz-shift.
  start_date date,
  end_date date,

  -- OPTIONAL primary responsible person (designation, not acceptance).
  responsible_person_id uuid references public.household_people(id) on delete set null,

  created_by_user_id uuid references auth.users(id) on delete set null default auth.uid(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Coherent time model: exactly the right pair is present for each mode.
  --   timed   → starts_at required; ends_at (if present) >= starts_at; no dates.
  --   all-day → start_date required; end_date (if present) >= start_date; no times.
  constraint calendar_events_time_model check (
    (
      all_day = false
      and starts_at is not null
      and start_date is null and end_date is null
      and (ends_at is null or ends_at >= starts_at)
    )
    or (
      all_day = true
      and start_date is not null
      and starts_at is null and ends_at is null
      and (end_date is null or end_date >= start_date)
    )
  )
);

-- Access patterns: a family's events by time (timed and all-day ordering), and by
-- responsible person ("what am I handling").
create index if not exists calendar_events_family_starts
  on public.calendar_events (family_id, starts_at) where starts_at is not null;
create index if not exists calendar_events_family_startdate
  on public.calendar_events (family_id, start_date) where start_date is not null;
create index if not exists calendar_events_family_responsible
  on public.calendar_events (family_id, responsible_person_id)
  where responsible_person_id is not null;

drop trigger if exists trg_calendar_events_updated on public.calendar_events;
create trigger trg_calendar_events_updated before update on public.calendar_events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2) calendar_event_participants — who an event is ABOUT (many-to-many).
-- ---------------------------------------------------------------------------
-- A participant is a HouseholdPerson (may be account-less). Distinct from the
-- responsible person. family_id is denormalized (matches the pattern of
-- appointment_questions) for straightforward RLS + integrity checks. A person
-- appears at most once per event.
create table if not exists public.calendar_event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  person_id uuid not null references public.household_people(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- One row per (event, person).
create unique index if not exists calendar_event_participants_uniq
  on public.calendar_event_participants (event_id, person_id);
create index if not exists calendar_event_participants_family
  on public.calendar_event_participants (family_id);
create index if not exists calendar_event_participants_person
  on public.calendar_event_participants (person_id);

-- ---------------------------------------------------------------------------
-- 3) RLS — family-scoped, same is_family_member boundary as every table.
--    Members READ their household's events + participants. Writes (insert/update)
--    go through the transactional SECURITY DEFINER RPCs (client insert/update
--    blocked), so an event and its participants are always created/edited as one
--    coherent unit and no cross-family participant/responsible can be injected.
--
--    DELETE is INTENTIONALLY ALLOWED to family members (Step 10 §13): a calendar
--    event is not an immutable historical ledger (unlike task_events). A member may
--    legitimately delete their own family's event; RLS scopes it to the family so
--    no one can delete another family's event. (Participants cascade-delete.)
-- ---------------------------------------------------------------------------
alter table public.calendar_events enable row level security;
alter table public.calendar_event_participants enable row level security;

drop policy if exists calendar_events_select on public.calendar_events;
create policy calendar_events_select on public.calendar_events
  for select using (public.is_family_member(family_id));
drop policy if exists calendar_events_no_client_insert on public.calendar_events;
create policy calendar_events_no_client_insert on public.calendar_events
  for insert with check (false);
drop policy if exists calendar_events_no_client_update on public.calendar_events;
create policy calendar_events_no_client_update on public.calendar_events
  for update using (false) with check (false);
drop policy if exists calendar_events_delete on public.calendar_events;
create policy calendar_events_delete on public.calendar_events
  for delete using (public.is_family_member(family_id));

drop policy if exists calendar_event_participants_select on public.calendar_event_participants;
create policy calendar_event_participants_select on public.calendar_event_participants
  for select using (public.is_family_member(family_id));
drop policy if exists calendar_event_participants_no_client_insert on public.calendar_event_participants;
create policy calendar_event_participants_no_client_insert on public.calendar_event_participants
  for insert with check (false);
drop policy if exists calendar_event_participants_no_client_update on public.calendar_event_participants;
create policy calendar_event_participants_no_client_update on public.calendar_event_participants
  for update using (false) with check (false);
-- Participants are cascade-deleted with their event and rebuilt transactionally by
-- update_calendar_event; a direct client delete is neither needed nor granted.

commit;

-- ============================================================================
-- 4) SECURITY DEFINER RPCs (each create-or-replace = idempotent).
--   Every RPC: pins search_path, requires auth.uid(), authorizes from the family
--   (verified via is_family_member — never a blindly-trusted caller value), locks
--   rows it mutates, validates every HouseholdPerson reference against the event's
--   family, and creates/edits the event + its participants in ONE transaction.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Internal helper: validate that a HouseholdPerson (participant OR responsible)
-- belongs to a given family. Returns the id (echoed) or raises. null = "none"
-- (allowed — e.g. no responsible person). SECURITY DEFINER + search_path pinned;
-- called only by the calendar RPCs, which have already authorized the caller.
-- ---------------------------------------------------------------------------
create or replace function public.assert_calendar_person(p_family_id uuid, p_person_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pfam uuid;
begin
  if p_person_id is null then
    return null;
  end if;
  select family_id into pfam from public.household_people where id = p_person_id;
  if pfam is null then
    raise exception 'person not found';
  end if;
  if pfam <> p_family_id then
    -- Cross-family injection: a Family A event may never reference a Family B person.
    raise exception 'person is not in this family';
  end if;
  return p_person_id;
end $$;

-- ---------------------------------------------------------------------------
-- Internal helper: replace an event's participants with a given id array, in one
-- pass, validating each belongs to the event's family. De-dups the input. Used by
-- both create and update so the participant set is always coherent + family-safe.
-- ---------------------------------------------------------------------------
create or replace function public.set_calendar_participants(
  p_event_id uuid,
  p_family_id uuid,
  p_person_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  delete from public.calendar_event_participants where event_id = p_event_id;
  if p_person_ids is null then
    return;
  end if;
  foreach pid in array p_person_ids loop
    if pid is null then
      continue;
    end if;
    perform public.assert_calendar_person(p_family_id, pid); -- family integrity
    insert into public.calendar_event_participants (event_id, family_id, person_id)
    values (p_event_id, p_family_id, pid)
    on conflict (event_id, person_id) do nothing;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- create_calendar_event(...) — create an event AND its participants in ONE
-- transaction. Authorization: caller must be a member of p_family_id. Every
-- participant + the responsible person is validated against p_family_id
-- (cross-family injection rejected). Time model is validated by the table CHECK.
-- Idempotency: p_client_event_id is the PRIMARY KEY; a retry with the same id
-- returns the existing event (no duplicate). Returns the event id.
--
-- Timed vs all-day: pass all_day=false with p_starts_at (+ optional p_ends_at), OR
-- all_day=true with p_start_date (+ optional p_end_date). The other pair must be
-- null (enforced by the CHECK constraint).
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

  -- Idempotency: return an existing event with this client id (guard family).
  eid := coalesce(p_client_event_id, gen_random_uuid());
  select * into existing from public.calendar_events where id = eid for update;
  if found then
    if existing.family_id <> p_family_id then
      raise exception 'not authorized for this family';
    end if;
    return existing.id;
  end if;

  -- Validate the responsible person belongs to this family (or is null).
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

  return eid;
end $$;

grant execute on function public.create_calendar_event(uuid, text, boolean, timestamptz, timestamptz, date, date, text, text, uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- update_calendar_event(...) — edit an event AND replace its participants in ONE
-- transaction. Authorization from the event's OWN family (row-derived, never
-- caller-supplied). The responsible person + all participants are validated against
-- that family. Passing p_participant_ids replaces the whole set atomically (so the
-- DB never holds a partial/invalid participant set); pass the SAME array to leave
-- unchanged, or an empty array to clear. p_clear_responsible=true clears the
-- responsible person (since a null p_responsible_person_id can't distinguish
-- "clear" from "leave alone").
--   Timed ↔ all-day switch: pass the new p_all_day + the matching time fields; the
--   RPC nulls the other pair so the CHECK constraint is satisfied.
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
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into e from public.calendar_events where id = p_event_id for update;
  if not found then
    raise exception 'event not found';
  end if;
  if not public.is_family_member(e.family_id) then
    raise exception 'not authorized for this family';
  end if;

  new_all_day := coalesce(p_all_day, e.all_day);

  -- Validate responsible target (if a new one is supplied).
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
      -- Recompute the two time pairs coherently for the (possibly new) mode.
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

  -- Replace participants atomically only when asked (so callers can edit fields
  -- without touching participants). Empty array + replace=true clears them.
  if p_replace_participants then
    perform public.set_calendar_participants(e.id, e.family_id, coalesce(p_participant_ids, array[]::uuid[]));
  end if;
end $$;

grant execute on function public.update_calendar_event(uuid, text, boolean, timestamptz, timestamptz, date, date, text, text, uuid, boolean, uuid[], boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- delete_calendar_event(p_event_id) — delete an event (participants cascade).
-- A calendar event is deletable (Step 10 §13), unlike immutable task history.
-- Authorization from the event's own family. Idempotent: deleting an unknown/
-- already-deleted id is a no-op success. (RLS also permits a direct member delete;
-- this RPC gives a consistent, authorized, family-derived path for the client.)
-- ---------------------------------------------------------------------------
create or replace function public.delete_calendar_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.calendar_events;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into e from public.calendar_events where id = p_event_id for update;
  if not found then
    return; -- idempotent no-op
  end if;
  if not public.is_family_member(e.family_id) then
    raise exception 'not authorized for this family';
  end if;

  delete from public.calendar_events where id = e.id; -- participants cascade
end $$;

grant execute on function public.delete_calendar_event(uuid) to authenticated;
