# Realtime (Step 11)

> **Realtime synchronizes shared truth. Notifications direct attention.**
> These are two different problems and MamaHQ keeps them separate. This document
> covers realtime; see `NOTIFICATIONS.md` for the attention layer.

## The problem realtime solves

MamaHQ is a shared household operating system. When one adult changes shared state —
adds a grocery item, reassigns a task, accepts a care handoff, edits a calendar
event — the other adult should not have to manually refresh to see the new household
truth. Realtime asks one question:

> Has the shared household state changed?

It does **not** ask "does a specific person need to be told?" — that is the
notification layer's job, and the two must never be collapsed.

## Architecture

```
Authenticated Account
  → Active Family
    → Family Realtime Coordinator   (components/mama/realtime.tsx)
      → Domain Invalidation          (coalesced, per-domain)
        → Domain Provider Refetch     (canonical DB read)
          → UI
```

A **single** coordinator owns the raw Supabase channel. Domain providers never open
their own channels; they register an invalidation listener via
`useRealtimeInvalidation(domain, refetch)` and refetch canonical state when told.

### The coordinator (`RealtimeProvider`)

- **One lifecycle.** A single `useEffect` keyed on `[familyId, status]` owns exactly
  one `supabase.channel('family:<familyId>')`. There is never an uncontrolled swarm
  of per-component subscriptions.
- **Family-scoped.** Every `postgres_changes` subscription is filtered
  `family_id=eq.<familyId>`. Switching families produces a genuinely different
  channel name, and the effect cleanup removes the previous channel — so no duplicate
  subscription accumulates across a family change.
- **Auth-aware cleanup.** On logout (`familyId` → null) or family change or unmount,
  the effect cleanup calls `supabase.removeChannel(channel)` and clears pending
  coalesce timers. Nothing survives into the next family.

### Invalidate → refetch (not state replay)

A realtime event maps to a **domain to invalidate**; the domain provider then
**refetches canonical state** from the database. We deliberately do **not**
reconstruct mutations in the browser from realtime payloads. The database remains the
single source of truth; realtime only says "your copy is stale, re-read." This
eliminates a whole class of ordering/divergence/reconciliation bugs.

Because every refetch is an idempotent canonical read, a realtime event that
**echoes the local actor's own optimistic mutation** is safe — it just re-reads the
same truth the client already applied. No duplicate rows, no flicker, no rollback.

### Coalescing

One logical operation can touch several rows. Creating a calendar event writes the
`calendar_events` row **and** several `calendar_event_participants` rows **and**
possibly changes the responsible person. A naive design would refetch the calendar
four times. The coordinator debounces invalidations **per domain** (`COALESCE_MS =
120`), collapsing that burst into a single refetch. The map that routes tables to
domains intentionally sends related tables to the same domain:

| Table | Domain invalidated |
|---|---|
| `grocery_items` | `grocery` |
| `tasks`, `task_events` | `tasks` |
| `care_responsibility`, `care_handoffs` | `care` |
| `calendar_events`, `calendar_event_participants` | `calendar` |

So one task mutation (which writes both `tasks` and `task_events`) refetches the
tasks domain **once**, not twice.

### Reconnect / recovery

Realtime delivery is not guaranteed. Laptops sleep, phones background, connections
drop. On **every** `SUBSCRIBED` transition — first connect and every reconnect — the
coordinator invalidates **all** domains, forcing a canonical refetch of anything
missed while the socket was down. Realtime improves freshness; it never replaces
canonical reads, and the client is never assumed to have observed every event.

### Realtime is an enhancement, never a prerequisite

If the channel never establishes, every domain mutation and manual refetch still work
exactly as before. Establishing (or failing to establish) a channel never corrupts
optimistic state. Core household writes do not depend on realtime.

## Realtime-enabled tables (the publication)

Migration `0013_realtime_notifications.sql` adds **only** these tables to the
`supabase_realtime` publication, and explains why each is exposed:

| Table | Why exposed |
|---|---|
| `grocery_items` | shared list add/complete/restore/quantity |
| `tasks` | current task truth (assign/complete/reopen/acknowledge) |
| `task_events` | acceptance/relinquish transitions the UI reflects |
| `care_responsibility` | current care-holder changes |
| `care_handoffs` | handoff propose/accept/decline/cancel |
| `calendar_events` | event create/edit/delete + responsibility |
| `calendar_event_participants` | participant-set changes |
| `notifications` | a recipient's live unread badge/list |

**Not exposed** (deliberately): household memory/observations, `purchase_events`,
`logs`, `appointments`, `mom_*`, `memories`, `captures`, and the
`families`/`family_members`/`household_people`/`household_invitations` identity
surfaces. They are either private-per-device, historical, or identity/auth surfaces
that do not need live cross-session sync in Step 11. Adding a table later is a
one-line change to the publication block.

The publication is provisioned idempotently: the migration creates the publication if
a bare Postgres lacks it, then adds each table only if it is not already a member — so
a clean provision (0001 → 0013) and a re-apply on a live DB both succeed.

**Replica identity:** providers use invalidate → **refetch** (not old-row diffing),
and realtime RLS evaluates the **new** row, so DEFAULT replica identity (primary key)
is sufficient. We do **not** set `REPLICA IDENTITY FULL` (it would only add WAL
overhead for old-row columns we never read).

## Security: RLS is the boundary, not the filter

The client-side `family_id` subscription filter is a **convenience**, not a security
control. Row-Level Security remains authoritative: a client cannot subscribe its way
around RLS. A household never receives another household's rows because RLS on each
exposed table already scopes reads to `is_family_member(family_id)` (and, for
notifications, to `recipient_user_id = auth.uid()`). Two-household isolation is proven
in the JWT test harness (see `scripts/test-notifications.ts` and the existing
security suites).

## Per-domain behavior

- **Grocery** — `reloadCloud(familyId)` re-reads `grocery_items`. Partner sees adds/
  completes/restores/quantity changes without refresh.
- **Tasks** — `reload(familyId)` re-reads tasks (create/assign/complete/reopen/accept/
  relinquish). `tasks` + `task_events` both map to the tasks domain and coalesce.
- **Care** — `load(familyId)` re-reads the current holder + handoffs
  (propose/accept/decline/cancel; holder change).
- **Calendar** — `reload(familyId)` re-reads events + participants
  (create/edit/delete, participant + responsible-person changes), coalesced.

### HouseholdPeople / membership

Household identity changes (adding a person, an invite being accepted) are **not**
wired into the family coordinator in Step 11. Identity is comparatively static within
a session, the providers that render it already refetch on `familyId`, and adding it
to the realtime publication would broaden the exposed surface without a clear
Step-11 payoff. The `household` domain slot exists in the coordinator for a future
step to opt in with a one-line change.

## Multi-tab / multi-device

The same account open in two tabs (or laptop + phone) each runs its own coordinator
and its own recipient-scoped notification channel. Because everything is
invalidate → refetch against canonical truth, the tabs converge: a read state changed
on one device is picked up by the other's refetch. No duplicate subscriptions
accumulate because each tab's coordinator owns exactly one channel and tears it down
on unmount.

## Testing

Websocket delivery itself cannot be proven deterministically in CI, so:

- **Deterministic DB tests** (`scripts/test-notifications.ts`) prove the durable,
  trusted foundation realtime rides on (generation, recipient security, dedupe,
  domain independence) with real JWTs against a local stack.
- **Manual realtime QA** (two browsers) stays **OUTSTANDING** until a human performs
  it — see `MANUAL_QA.md`. We do not claim websocket QA passed.
