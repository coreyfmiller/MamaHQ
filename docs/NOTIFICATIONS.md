# Notifications (Step 11)

> **Realtime synchronizes shared truth. Notifications direct attention.**
> **A notification is not domain truth.**

Realtime keeps everyone looking at the same household state (see `REALTIME.md`).
Notifications are a different, scarcer thing: they **borrow a specific person's
attention** only when another human's action actually requires it. MamaHQ is not an
engagement system — we do not notify people merely because data changed.

## The one product test for every notification type

> If the recipient never saw this notification, would responsibility, coordination,
> or household awareness meaningfully suffer?

If the answer is **no**, we do **not** notify. Realtime synchronization may still be
appropriate — but attention is not spent.

## A notification is not domain truth

The canonical truth of "who has this task" is Task Acceptance; of "who has the baby"
is the Care Holder; of "what's on the calendar" is the calendar row. A notification
only **points at** that truth. Reading, marking-read, or (future) clearing a
notification **never** changes task responsibility, care holder, or a calendar
commitment. This is enforced: the read-state RPCs only ever touch `read_at`, and there
is a dedicated test asserting that reading a notification does not accept a task or
change its status.

## Recipient identity: an auth account, not a HouseholdPerson

Notifications target **authenticated accounts** (`recipient_user_id → auth.users`),
not HouseholdPeople. A `HouseholdPerson` may have no account (e.g. Grandma). An
account-less person **cannot receive a digital notification**, and MamaHQ never
fabricates one. Where notification logic starts from a HouseholdPerson (a task
assignee, a responsible person), it resolves the linked account **only if one
exists** via `notif_account_for_person(family, person)`; if the person is account-less
(or cross-family), emission simply no-ops.

## Data model (`notifications`)

| Column | Purpose |
|---|---|
| `id` | pk |
| `family_id` | the household (RLS defense-in-depth + cheap cleanup); cascade with family |
| `recipient_user_id` | **who must be told** — an auth account; the privacy boundary |
| `actor_user_id` | who caused it (provenance); SET NULL on account removal |
| `type` | small closed vocabulary (CHECK) — structured, not prose |
| `domain` | `task` \| `care` \| `calendar` — where to navigate |
| `entity_id` | the domain row this points at (task/handoff/event id). **Not an FK** — notifications outlive entities and must never be a second delete path into truth |
| `title` | a short human line, computed server-side at emit time |
| `metadata` | minimal structured extras (e.g. an entity title snapshot) so the UI renders without re-reading truth; no sensitive payload copies |
| `dedupe_key` | deterministic; makes one logical action → one notification (UNIQUE) |
| `created_at` | authoritative persisted timestamp (ordering; never a client clock) |
| `read_at` | null = unread; set only by the recipient via the mark RPCs |

We store **structured** notification metadata, not merely a prose sentence, so the
model can support additional delivery channels later without a rewrite.

## Trusted generation (never client-inserted)

Critical notifications must not depend on the actor's browser remembering to insert a
row. Generation happens at a **trusted database boundary**: a single SECURITY DEFINER
helper, `emit_notification(...)`, called **from inside the already-authorized domain
RPCs**, in the **same transaction** as the state change. Direct client INSERT into
`notifications` is blocked by RLS (`with check (false)`), and `emit_notification` is
**not granted** to any client role — it is internal-only, reachable solely through the
domain RPCs.

A malicious or buggy browser therefore cannot forge a notification, notify an
unrelated household, impersonate another actor, or select an arbitrary recipient.
`emit_notification` additionally re-verifies that the recipient is an **active member
of the family** (defense in depth) and self-suppresses.

### Where emission is woven in

Migration `0013` redefines these existing RPCs (idempotent create-or-replace; domain
semantics unchanged, only a same-transaction emit added):

| RPC | Emits | To | Type |
|---|---|---|---|
| `create_task` | when created already-assigned to someone else | assignee | `task_assigned` |
| `assign_task` | when ownership changes to a new person | new assignee | `task_assigned` |
| `accept_task` | on acceptance | the task **creator** | `task_accepted` |
| `propose_care_handoff` | on proposal | the recipient | `care_handoff_proposed` |
| `accept_care_handoff` | on acceptance | the **proposer** | `care_handoff_accepted` |
| `create_calendar_event` | when a responsible person is designated | that person | `calendar_responsibility_assigned` |
| `update_calendar_event` | when responsibility **changes** to a new person | that person | `calendar_responsibility_assigned` |

## Notification types (small + high-value)

- **`task_assigned`** → the assignee's account. *"New task for you: Pick up
  prescription."*
- **`task_accepted`** → the task creator (their uncertainty is resolved). *"James has
  it: Pick up prescription."*
- **`care_handoff_proposed`** → the recipient (they must accept/decline). *"Corey
  wants to hand off care to you."*
- **`care_handoff_accepted`** → the proposer (the counterparty). *"James has the
  baby."*
- **`calendar_responsibility_assigned`** → the responsible person. *"You're handling:
  Dentist."* This is a **designation, not an acceptance** — the copy never implies
  "you accepted."

### Deliberately excluded (spam avoidance)

No notification for: grocery add/complete/quantity, ordinary task title/note edits,
calendar note edits, participant-row churn, every realtime event, or the user's own
actions. Realtime handles passive synchronization of all of these; notifications are
reserved for responsibility/coordination changes that cross an attention boundary.

## Self-notification suppression

We never notify someone about an action they just performed. `emit_notification`
returns null (no row) when `recipient_user_id = actor_user_id`. So Corey creating a
task assigned to Corey, or Corey accepting his own proposal, produces no
"you did this" notification — the UI already confirmed the action. This is tested for
task self-assignment and for both care/task acceptance (the accepter is never
self-notified).

## Deduplication

One logical action must produce one notification even under RPC retries, browser
retries, multi-row changes, or realtime reconnects. Each emit supplies a deterministic
`dedupe_key` (UNIQUE index; `on conflict do nothing`). The assignment keys encode the
**transition** (`prev → new`), not just `(entity, person)`, so a legitimate A→B→A
cycle produces three distinct notifications while an exact repeat of one transition
collides and no-ops:

- `task_assigned:<taskId>:<prevPersonId|none>:<newPersonId>` (at create the previous
  owner is `none`). A→B→A re-notifies A because `B→A` ≠ the earlier `none→A`.
- `task_accepted:<taskId>:<accepterUid>`
- `care_handoff_proposed:<handoffId>` / `care_handoff_accepted:<handoffId>` (a handoff
  row is itself the transition identity — one pending per family/subject).
- `calendar_responsibility_assigned:<eventId>:<prevPersonId|none>:<newPersonId>`
  (same transition-keying; a routine title/note edit that doesn't change the
  responsible person emits nothing at all, so it never reaches a key).

> **Why transition-keyed?** An earlier `(entity, person)`-only key would permanently
> suppress a legitimate re-designation back to a previous person (A→B→A). Keying on
> the `prev→new` transition fixes that while still collapsing true retries. This was
> corrected during the Step 11 final review; regression tests cover both the task and
> calendar A→B→A cycles and the calendar routine-edit anti-spam case.

The idempotent domain RPCs (e.g. `create_task` returning an existing row on client-id
retry, or `assign_task`'s same-owner no-op) never reach the emit path twice anyway;
the dedupe key is the belt to those suspenders.

## Read / unread

Minimal by design: unread emphasis + badge, mark-one-read, mark-all-mine-read. No
archive, search, categories, snoozing, or priority scoring. Read state is changed only
via `mark_notification_read(id)` and `mark_all_notifications_read()` — both SECURITY
DEFINER, both scoped to `auth.uid()`, so a user can only ever change their own read
state.

## Security (recipient-scoped, stricter than family-scoped)

RLS on `notifications`:

- **SELECT**: `recipient_user_id = auth.uid()` — a user reads **only** their own
  notifications. Being in the same family is **not** sufficient; James cannot read
  Mom's private notifications.
- **UPDATE**: `recipient_user_id = auth.uid()` (using + with check) — a user cannot
  re-point a notification at someone else, and cannot change another user's read
  state.
- **INSERT**: `with check (false)` — never from a client.
- **DELETE**: no client policy.

Proven in `scripts/test-notifications.ts`: intended recipient reads it; a same-family
non-recipient cannot; an outsider cannot; the recipient marks own read; a non-
recipient / outsider cannot mark it read; direct INSERT is blocked; cross-family
references generate no valid notification.

## Transaction semantics (delivery guarantees)

For these person-directed responsibility changes, `emit_notification` runs **in the
same transaction** as the state change, so the change and its notification commit
together or not at all — the notification cannot be silently lost while the domain
change succeeds. `emit_notification` is intentionally **defensive** (self / account-
less / duplicate → silent no-op, returning null) so that emitting can never make an
unrelated household operation fragile. We do **not** claim guaranteed *delivery to a
device* — only durable creation. In-app retrieval + realtime freshness handle the
rest; a device that was offline at creation still sees the persisted unread record on
return.

## UI

A minimal notification center (`components/mama/screens/notifications.tsx`), reached
from the **Me** screen via a bell row with a live unread badge:

- newest-first list (authoritative `created_at` ordering),
- unread emphasis + a dot,
- mark-one (on open) and mark-all-read,
- **domain navigation**: tapping routes to Tasks / Care / Calendar (simple domain
  routing, not a deep-link framework),
- human copy only — technical event names never surface.

A newly-arrived notification also raises a transient in-app toast (via the existing
`showToast`), wired through `NotificationsProvider`'s `onArrive`.

## Deferred (explicitly out of scope for Step 11)

- **Push notifications** (browser/mobile) — deferred. No service worker / PWA push in
  Step 11. In-app first.
- **Email / SMS** — deferred. No SendGrid/Resend/Twilio. The model separates the
  notification **record** from **delivery**, so delivery adapters can be added later
  without changing domain logic. The existing `lib/notify.ts` `notifier` seam remains
  the intended outbound extension point.
- **Preference center** — not built. The model does not assume every type must use
  every channel, leaving room for per-type/per-channel preferences later.

## Multi-tab / multi-device

`NotificationsProvider` opens a **recipient-scoped** realtime channel
(`notifications:<userId>`, filtered `recipient_user_id=eq.<userId>`) — separate from
the family coordinator because this boundary is per-user, not per-family. A new row
lights the badge live; any change (including a `read_at` update from another device)
triggers a canonical refetch, so read state converges across a user's devices. On
reconnect it refetches to recover anything missed offline.
