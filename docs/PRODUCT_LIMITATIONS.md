# MamaHQ — Current Product Limitations

An explicit, honest statement of what does **not** exist yet, so future work (and
future readers) never assume these capabilities are present. This complements
`docs/TECHNICAL_DEBT.md` (which tracks the path forward) — this file is the "as-of
today, this is NOT here" record. Verified against the actual codebase in Step 5C.

Do not describe any of the below as implemented in docs, UI copy, marketing, or bot
knowledge until it actually ships.

| Capability | Status | Reality today |
|---|---|---|
| **Second authenticated household adult** | IMPLEMENTED (Step 7) | Secure invitations (hashed one-time token, expiry), transactional acceptance that links the existing person and joins the same household, invitation-aware bootstrap, People UI with account status, and hardened membership/identity RLS. One active household per user; member-removal workflow deferred. See `docs/HOUSEHOLD_MEMBERSHIP.md`. |
| **Household Tasks / Ownership** | IMPLEMENTED (Step 8) | Durable family-scoped `tasks` + `task_events`, minimal `open`/`completed` lifecycle, ownership by a `household_people` id (may be account-less), creator/owner/completer kept distinct, atomic SECURITY DEFINER RPCs (create/assign/complete/reopen) with idempotency + concurrency safety, DB-enforced assignment integrity, family-scoped RLS, and a Tasks UI (fast capture, assign picker, Open/Mine/Done, complete/reopen/reassign). See `docs/TASKS.md`. |
| **Task acknowledgement ("I've got it")** | IMPLEMENTED (Step 9) | Explicit acceptance on tasks: current acceptance on the row (`acknowledged_at`/`_by_user_id`/`_by_household_person_id`) + historical `accepted`/`relinquished` events. Only the assigned connected account can accept; reassign/reopen/relinquish clear it; acceptance ≠ completion. UI shows "I've got it" / "You have this ✓" / "{name} has it ✓". See `docs/CARE_HANDOFF.md`. |
| **Care handoff (accept/decline/cancel)** | IMPLEMENTED (Step 9) | A minimal care-responsibility domain: current holder + a pending-transfer state machine (propose → accept/decline/cancel). Propose does not transfer; the holder moves only when the recipient accepts (atomic). Deterministic summary (last feed/diaper/nap) from logs; recipient must be a connected account. See `docs/CARE_HANDOFF.md`. |
| **In-app notifications** | IMPLEMENTED (Step 11) | Durable, recipient-scoped `notifications` (recipient is an auth account, not a HouseholdPerson) generated server-side inside the domain RPCs (task assigned/accepted, care handoff proposed/accepted, calendar responsibility assigned). Self-suppressing, deduped, recipient-scoped RLS, mark-read RPCs, a bell + badge + notification center with domain navigation. A notification is not domain truth. See `docs/NOTIFICATIONS.md`. |
| **Realtime (in-app) sync** | IMPLEMENTED (Step 11) | A single family-scoped realtime coordinator invalidates→refetches grocery/tasks/care/calendar so a second signed-in adult sees shared changes without a manual refresh; coalesced, self-echo-safe, reconnect-recovering, cleaned up on logout/family-change. RLS remains the boundary. See `docs/REALTIME.md`. |
| **Push / email / SMS notification delivery** | NOT IMPLEMENTED (deferred) | Step 11 does in-app notifications only. No browser/mobile push (no service worker/PWA push), no email (Resend/SendGrid), no SMS (Twilio). The model separates the notification *record* from *delivery* so adapters can be added later without touching domain logic; `lib/notify.ts` remains the outbound seam. |
| **Notification preferences** | NOT IMPLEMENTED (deferred) | No per-type/per-channel preference center. The model does not assume every type uses every channel, leaving room for preferences later. |
| **Predicted next feed / next bottle** | NOT IMPLEMENTED | MamaHQ stores only observed care events; there is no schedule or prediction. The care-handoff summary shows "last …" facts only and never a predicted "next" time. |
| **Proxy care acceptance (account-less)** | NOT IMPLEMENTED | A care handoff can only be proposed to a connected account (who can actually accept). Handing off to an account-less person / accepting on their behalf is out of scope. |
| **Recurring tasks** | NOT IMPLEMENTED | No recurrence infrastructure (garbage day, refills, forms, bills). Deferred deliberately — recurrence has its own semantics. |
| **Shared Calendar & Household Commitments** | IMPLEMENTED (Step 10) | Durable family-scoped `calendar_events` + `calendar_event_participants` keyed to `household_people`: timed / all-day / multi-day events, participants (who it's about) and an optional responsible person (who's handling it — a designation, distinct from participant/creator). Timezone-safe (timestamptz for timed, plain date for all-day). Transactional SECURITY DEFINER create/update/delete RPCs, family-scoped RLS + cross-family integrity, a Calendar surface (Upcoming/Mine/Day) + Today integration. See `docs/CALENDAR.md`. |
| **Calendar commitment acceptance** | NOT IMPLEMENTED | An event's responsible person is a designation, not an explicit acceptance. Step 10 intentionally reuses no acceptance workflow (would duplicate Step 9 Tasks/Care acceptance); an "I've got it" on an event is a documented future extension. |
| **Recurring calendar events** | NOT IMPLEMENTED | No RRULE / recurring series / exceptions. Step 10 handles concrete event instances only. |
| **External calendar sync** | NOT IMPLEMENTED | No Google / Apple / Outlook / ICS import-export or bidirectional sync. Step 10 establishes MamaHQ's canonical internal calendar model first. |
| **Calendar conflict detection** | NOT IMPLEMENTED | Overlapping events are permitted and never flagged; no scheduling recommendations. |
| **Offline support** | NOT IMPLEMENTED | No IndexedDB, no offline state, no mutation queue, no reconciliation. Online-only. Realtime (Step 11) recovers missed changes on reconnect via canonical refetch, but there is no offline mutation queue. |
| **Care Handoff — external delivery** | NOT IMPLEMENTED | In-app notification exists (Step 11); no SMS/email/WhatsApp/iMessage/share is sent. `lib/notify.ts` is a no-op outbound seam. |
| **Tell MamaHQ (multi-domain action layer)** | IMPLEMENTED (Step 12) | Natural-language capture → server-side interpretation (provider-agnostic `Interpreter`, OpenAI adapter) → strict Zod-validated structured proposals → deterministic reference/time resolution → user confirmation → execution via the existing trusted domain RPCs (Grocery/Tasks/Calendar/Care propose). AI proposes; it never writes rows, forges acceptance/notifications, or executes autonomously. In-app text only. See `docs/TELL_MAMAHQ.md`. |
| **Tell MamaHQ — voice/photo/purchasing/external** | NOT IMPLEMENTED (deferred) | Step 12 is in-app TEXT only. No voice/audio capture, image/OCR, purchasing, email/SMS, external calendars, budgeting, journaling, medical/medication automation, autonomous/confirmation-free execution, background agents, or multi-model routing. The interpreter is voice-ready (same text pipeline) but no speech infra is added. |
| **Meals** | NOT IMPLEMENTED | No tables, domain, or UI. |
| **Kitchen** | NOT IMPLEMENTED | No such surface. |
| **Contextual Assistant** | NOT IMPLEMENTED | No assistant; depends on LLM + cross-person awareness that don't exist. |
| **Household Grocery Memory (Step 6)** | PARTIAL (infra implemented) | Step 6 added `household_items` (variants), an observation ledger, conservative learning + thresholds, explicit "Make this my usual", enrichment that fills blanks without overriding explicit input, and restore-reversal — all family-scoped with RLS. Not yet surfaced as a "Usually Buy" screen; brand/store enrichment deferred. See `docs/HOUSEHOLD_GROCERY_MEMORY.md`. |

## Beta Phase 1 (identity, single capture, error visibility)

| Capability | Status | Reality today |
|---|---|---|
| **Canonical household identity** | IMPLEMENTED (Beta Phase 1) | The onboarding/Settings name updates the authenticated user's linked HouseholdPerson via the trusted `set_my_display_name` RPC (migration 0014). Editable in Settings → Account. Identity is only ever set **explicitly** (onboarding or Settings); there is deliberately no automatic reconciliation from the device-local profile name (unsafe on a shared device — it would rename the wrong signed-in user). Existing users with a placeholder ('Me'/'Member') correct it in Settings. See `docs/IDENTITY_AND_CAPTURE.md`. |
| **Single capture surface** | IMPLEMENTED (Beta Phase 1) | Tell MamaHQ is the one brain-dump path (primary "Tell" tab + Capture button). The legacy rule-based Inbox is no longer routed from navigation (code/data retained, unreachable). Legacy Speak/Photo capture options retired for beta. |
| **App error boundaries** | IMPLEMENTED (Beta Phase 1) | `app/error.tsx` / `global-error.tsx` / `not-found.tsx` (calm, retry, no raw errors, no false save claim). No blank screens / raw stacks. |
| **Out-of-app crash monitoring** | NOT ACTIVE (deferred) | `lib/monitoring.ts` is a privacy-first seam (error type/message/stack only; no household content; no session replay) but it is a **no-op today**: `@sentry/nextjs` is not installed and no DSN is set, so it cannot send. Enabling it correctly under Next 16 (Turbopack) needs instrumentation wiring — a small focused task. Deferred blocker if crash visibility is a launch requirement. See `docs/TECHNICAL_DEBT.md`. |
| **Partner SMS/email delivery controls** | REMOVED (Beta Phase 1) | The partner screen no longer shows SMS/email toggles (there is no such delivery). In-app notifications are the real channel for partners who accept an invite. |
| **Voice / photo capture** | NOT IMPLEMENTED (deferred) | The legacy on-device voice/OCR capture fed the retired rule-based engine and is not part of the single Tell path for beta. A later phase may feed speech-to-text into the same Tell interpretation pipeline. |

## Related known gaps (see TECHNICAL_DEBT.md)

- **PurchaseEvent snapshot** now captures `canonical_item_id`, `resolved_attributes`,
  `package_size`, `package_type`, and `unmatched_modifiers` (resolved in Step 6,
  migration 0008) — the prerequisite for Household Grocery Memory is satisfied.
- **Usually Buy / Recently Bought, Shopping Mode, store ordering, barcode** — none
  exist.

## What DOES exist (for contrast)

So this file isn't misread as "nothing works": the Grocery intelligence stack
(catalog → search → resolver → action resolution → domain execution → completion →
purchase event) is implemented, deterministic, and covered by automated tests; auth
(email OTP), the single-owner family/household model, and the manual Grocery list
(add/autocomplete/duplicate/edit/complete/restore) are implemented. See the Step 5C
report and the Situation Report for the full status matrix.

## Note on FundyLogic / Vapi

Some repository steering describes a **FundyLogic** voice-bot (Vapi) content-sync
governance rule. **That is a different project.** MamaHQ has **no Vapi voice bot**,
no `@vapi-ai/*` dependency, and no voice-bot content to keep in sync. The FundyLogic
Vapi rule does **not** apply to MamaHQ. (MamaHQ's only "voice" feature is on-device
speech capture for Tell MamaHQ, which is unrelated to Vapi.)
