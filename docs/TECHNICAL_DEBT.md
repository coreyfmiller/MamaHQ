# MamaHQ — Technical Debt Register

A living record of known debt and deferred architecture. Each entry: **status**,
**why it matters**, **dependency**, **suggested future milestone**. No dates are
invented; milestones are relative/ordinal.

Status values: `absent` (not built), `partial` (some scaffolding), `deferred`
(deliberately postponed), `advisory` (works, but flagged for future attention).

---

## Product / feature debt

### Authenticated second household adult (invite / join flow)
- **Status:** RESOLVED in Step 7 (migration `0009_household_membership.sql`).
- Secure hashed-token invitations, a transactional `accept_household_invitation`
  RPC that joins the existing household and links the existing person, an
  invitation-aware auth bootstrap (no accidental personal household), and the People
  UI now exist. `family_members` self-insert and `household_people.user_id` hijack
  are closed. See `docs/HOUSEHOLD_MEMBERSHIP.md`.

### Household member removal / separation workflow
- **Status:** deferred (infrastructure ready).
- **Why it matters:** an adult may later need to be removed from a household.
  `family_members.status` includes `removed` to support revoking *authorization*
  while preserving the HouseholdPerson identity (historical ownership references
  depend on it). No workflow/UI is built.
- **Suggested milestone:** a later admin step; must never delete the person row.

### partner_contacts → household_people consolidation
- **Status:** deferred (retained-but-deprecated as of Step 7).
- **Why it matters:** `partner_contacts` is a parallel representation of the same
  human as an account-less `household_people` row. The target is one coherent
  household-person model. A future migration should fold partner_contacts into
  household_people (carrying phone/email/notify prefs) and retire the table.
- **Dependency:** none blocking.

### mom_items.assignee string → tasks / assignee_person_id
- **Status:** advisory (destination now exists as of Step 8).
- **Why it matters:** `mom_items.assignee` is the legacy `'partner'` string.
  Ownership should reference `household_people.id`. Step 8 built the durable
  destination — `public.tasks` with `assigned_to_person_id → household_people` — so
  the convergence target is no longer hypothetical. A future step should migrate
  `mom_items` tasks onto `tasks` (or add `assignee_person_id` + backfill) and
  deprecate the `'partner'` string. Not done in Step 8 (Tasks did not rewrite the
  Mom/Me surface); see the legacy audit in `docs/TASKS.md`.

### Task acknowledgement ("I've got it")
- **Status:** RESOLVED in Step 9 (migration `0011_responsibility_handoff.sql`).
- Explicit acceptance is now modelled: current acceptance on `tasks`
  (`acknowledged_at`/`_by_user_id`/`_by_household_person_id`) + `accepted` /
  `relinquished` events. Only the assigned connected account can accept; reassign /
  reopen / relinquish invalidate it; acceptance is distinct from completion. See
  `docs/CARE_HANDOFF.md`.

### Care Handoff — external delivery + acknowledgment (revisited)
- **Status:** PARTIAL — in-app acknowledgement now exists (Step 9); external
  delivery still absent.
- **What's done (Step 9):** a `care_responsibility` holder + `care_handoffs` state
  machine (propose/accept/decline/cancel), atomic holder transfer on accept,
  deterministic care summary, connected-recipient enforcement, full RLS + security
  tests. "James has the baby ✓" is trustworthy in-app.
- **Still deferred:** no SMS/email/push delivery, no realtime, no proxy acceptance
  for account-less caregivers. `lib/notify.ts` remains a no-op seam.

### Tasks — realtime / notifications
- **Status:** deferred (absent).
- **Why it matters:** a partner must refetch to see task changes; no push/email/SMS
  is sent when a task is assigned. Both are intentionally out of Step 8.
- **Dependency:** realtime is best introduced across household domains together;
  notifications need a provider (Resend/Twilio) + the acknowledgement design.
- **Suggested milestone:** post-acknowledgement, alongside the broader realtime pass.

### Calendar — recurrence, external sync, notifications, commitment acceptance
- **Status:** deferred (Step 10 base domain implemented; extensions absent by design).
- **What's done (Step 10):** `calendar_events` + `calendar_event_participants` keyed
  to household_people, optional responsible person, timezone-safe timed/all-day/
  multi-day, transactional SECURITY DEFINER RPCs, family-scoped RLS, Calendar UI +
  Today integration. See `docs/CALENDAR.md`.
- **Deferred (non-blocking):** recurrence (RRULE/series/exceptions); external calendar
  sync (Google/Apple/Outlook/ICS); calendar notifications/reminders; conflict
  detection; Tell-MamaHQ/AI event parsing; task↔event and care-handoff↔event linking;
  custody scheduling; a calendar commitment-acceptance workflow (an "I've got it" on
  an event — would reuse the Step 9 acceptance pattern). The schema avoids obvious
  dead ends (clean timed/all-day split; participants as a real M:N) so these remain
  additive later.

### Recurring tasks
- **Status:** deferred (absent, by design).
- **Why it matters:** garbage day, medication refills, school forms, filters, bills
  are recurring responsibilities, but recurrence has its own semantics (generation,
  skip, completion-of-an-instance) that would muddy the Step 8 foundation.
- **Suggested milestone:** its own step after the base task system is proven.

### Care Handoff — external delivery + acknowledgment
- **Status:** partial (assignment exists; delivery/ack absent).
- **Why it matters:** a hand-off that can't actually reach the other person isn't a
  hand-off. `lib/notify.ts` is a no-op seam; no SMS/email/share is sent; there is no
  "I've got it" acknowledgment and no authenticated recipient.
- **Dependency:** authenticated second adult (for in-app receipt/ack); an external
  provider (e.g. Resend/Twilio) for out-of-app delivery. **Note:** the Resend key is
  being revoked (see HUMAN_ACTIONS) and should only be re-provisioned when this is
  actually built.
- **Suggested milestone:** after the second-adult unlock.

### PurchaseEvent structured snapshot (Household Grocery Memory prerequisite)
- **Status:** RESOLVED in Step 6 (migration `0008_household_memory.sql`).
- `purchase_events` now also snapshots `canonical_item_id`, `resolved_attributes`,
  `package_size`, `package_type`, `unmatched_modifiers`, written atomically by
  `complete_grocery_item`. This was the Step 6 prerequisite; it is done.

### Household Grocery Memory — residual (Step 6 follow-ups)
- **Status:** partial (infrastructure implemented in Step 6).
- **What's done:** variants, observation ledger, conservative learning + thresholds,
  explicit "make usual", enrichment with provenance, restore reversal, RLS.
- **Residual / deferred (non-blocking):**
  - brand/store enrichment: columns exist but the resolver does not parse brand/store
    from the phrase, so those fields are only filled when a variant already carries
    them. A future brand-aware resolver step would populate them.
  - recency tie-breaker: implemented in `learning.ts` but intentionally not used to
    break ambiguity among multiple established variants (conservative by design).
  - "Usually Buy" / "Recently Bought" surfaces still absent (see below).

### Resolver drops a trailing measure that follows an attribute
- **Status:** RESOLVED (Step 6 follow-up correction, `quantity.ts`).
- `resolveGroceryPhrase` now folds a measure size (weight/volume — fused like "2L"
  or split like "2 L") into the quantity **regardless of position**, so
  "1% 2L milk" == "2L 1% milk" and "milk 2L" all preserve the explicit 2L. Package
  words and bare counts are never folded, so concept tokens and counts are not
  stripped. Covered by resolver gold-standard cases in both orderings across milk,
  ground beef, and chicken breast, plus guards for "size 4 diapers", "3 cans …",
  and "2 dozen eggs".

### Realtime Grocery synchronization
- **Status:** deferred (absent).
- **Why it matters:** two devices / two members won't see each other's changes
  without a manual refetch. React re-render is not realtime.
- **Dependency:** best paired with the second-adult unlock (little value with one
  user/device).
- **Suggested milestone:** post-partner.

### Offline / IndexedDB / mutation queue / reconciliation
- **Status:** deferred (absent).
- **Why it matters:** the app is online-only; a failed mutation is lost. The
  `client_action_id` idempotency key is the one primitive already in place to make a
  future queue safe, but nothing consumes it offline.
- **Dependency:** none technical; product priority.
- **Suggested milestone:** post-partner, alongside realtime.

### Tell MamaHQ → Grocery integration
- **Status:** absent.
- **Why it matters:** the capture inbox does rule-based extraction but is not wired
  into the Grocery resolver, and there is no multi-item grocery parse from free text.
- **Dependency:** the Grocery resolver/actions layers (already built).
- **Suggested milestone:** a focused "capture → grocery" step.

### Tell MamaHQ LLM architecture
- **Status:** absent (rule-based only; `openai` dep present but unused).
- **Why it matters:** current interpretation is deterministic/rule-based; there is no
  model-backed understanding. "AI" is aspirational today.
- **Dependency:** a server-side LLM integration + safety/validation design.
- **Suggested milestone:** a dedicated AI step, after Grocery depth.

### Meals
- **Status:** absent (no tables, domain, or UI).
- **Suggested milestone:** its own major step; likely feeds Grocery via `source_type='meal'`.

### Kitchen surface
- **Status:** absent.
- **Suggested milestone:** later; undefined scope.

### "Usually Buy" / "Recently Bought"
- **Status:** absent (raw `purchase_events` is the only substrate).
- **Dependency:** the PurchaseEvent snapshot work above.
- **Suggested milestone:** part of Step 6 Household Grocery Memory.

### Shopping Mode
- **Status:** absent.
- **Suggested milestone:** after Grocery Memory; a shopping-focused view/ordering.

### Store ordering
- **Status:** absent (items carry a free-text `store`, `category`; no aisle order).
- **Suggested milestone:** with Shopping Mode.

### Barcode
- **Status:** absent (`source_type='barcode'` reserved in the schema only).
- **Suggested milestone:** later; needs a scanner + product lookup.

---

## Operational / code debt

### Production migration history not reconciled
- **Status:** partial (mechanism + docs ready; execution is a human action).
- **Why it matters:** production still lacks a CLI-tracked `schema_migrations`. Until
  reconciled (HUMAN_ACTIONS #3), production migrations remain hand-applied.
- **Dependency:** a Management access token (human-held).
- **Suggested milestone:** whenever the next production migration is needed.

### Production-vs-clean schema drift not verified
- **Status:** deferred (needs linked production read; a human action).
- **Why it matters:** clean provisioning is proven in CI, but the diff against live
  production is NOT VERIFIED until a human links the project read-only.
- **Dependency:** Management token (HUMAN_ACTIONS #4).

### `react-hooks/set-state-in-effect` warnings in stores
- **Status:** advisory.
- **Why it matters:** react-hooks 7 (React Compiler) flags the store hydration
  pattern (`setHydrated(false)` at the top of a fetch effect) across ~8 stores. It is
  a perf/style advisory, not a correctness bug; the code works and is build-verified.
  Downgraded to a lint **warning** in Step 5C to avoid a state-management rewrite
  (explicitly out of scope). Also related: `react-hooks/exhaustive-deps` warnings on
  the store `useMemo`s.
- **Dependency:** none.
- **Suggested milestone:** a deliberate store-refactor pass (own step), not mixed
  into feature work.

### `ensure_owner_person` lacks an explicit membership check
- **Status:** advisory (safe by construction; see `docs/SECURITY_DEFINER_AUDIT.md`).
- **Why it matters:** it's the one SECURITY DEFINER function that takes a family id
  and acts without `is_family_member`. Analysis shows negligible risk (it only
  idempotently creates the *owner's own* person row and exposes nothing), so no fix
  was applied during hardening to avoid an unnecessary behavior-touching migration.
- **Dependency:** none.
- **Suggested milestone:** optional one-line additive migration (add the membership
  guard or `revoke execute … from authenticated`) if the auth surface is revisited.

### Unused `openai` dependency
- **Status:** advisory.
- **Why it matters:** `openai` is in `dependencies` but imported nowhere. Harmless
  but misleading; remove when the AI direction is decided (or keep if imminent).

### Editorial `.docx` in `public/`
- **Status:** advisory (see `docs/EDITORIAL_DOCX.md`).
- **Why it matters:** an untracked source `.docx` lives under `public/`. The runtime
  does not need it; recommendation is to keep editorial source out of `public/`.

### Confidence / ambiguity not persisted on grocery items
- **Status:** advisory.
- **Why it matters:** the resolver computes a confidence score + ambiguity signal
  used transiently in the UI but not stored on the row. Minor; would help future
  analytics on "how sure were we at add time."
- **Suggested milestone:** opportunistic, if/when analytics need it.
---

## Realtime & Notifications debt (Step 11)

### Notification delivery is in-app only (push/email/SMS deferred)
- **Status:** intentional deferral (see `docs/NOTIFICATIONS.md`).
- **Why it matters:** notifications are durable + shown in-app + live via realtime,
  but there is no browser/mobile push (no service worker/PWA push), no email, no SMS.
  The model separates the notification *record* from *delivery*, so adapters slot in
  later without touching domain logic (`lib/notify.ts` is the outbound seam).
- **Suggested milestone:** a dedicated push sub-step after an architecture review; then
  email/SMS adapters; then a preference center.

### Websocket realtime QA is manual-only
- **Status:** advisory (see `docs/MANUAL_QA.md` Step 11 section).
- **Why it matters:** CI proves the trusted notification foundation deterministically,
  but two-browser websocket delivery/self-echo/reconnect behavior cannot be asserted in
  CI and stays OUTSTANDING until a human runs it. We do not claim it passed.

### `notifications` is not wiped by `clearFamilyData` ("Start over")
- **Status:** advisory (consistent with tasks/care/calendar).
- **Why it matters:** `notifications` has no client DELETE policy (recipient-owned,
  trusted-write). Like the other RPC-only tables, a client `delete().eq(family_id)` is
  RLS-filtered to zero rows (harmless no-op). Rows are removed by the `family_id`
  ON DELETE CASCADE if a family is ever hard-deleted. A dedicated trusted reset path
  would be needed for an explicit in-app wipe.
- **Suggested milestone:** whenever a hard-reset RPC is built for tasks/care/calendar.

### HouseholdPeople / membership changes are not realtime-synced
- **Status:** intentional deferral (see `docs/REALTIME.md`).
- **Why it matters:** identity is comparatively static within a session and the
  coordinator's `household` domain slot is unused in Step 11. A future step can opt in
  with a one-line change (add the tables to the publication + wire a listener).
---

## Tell MamaHQ debt (Step 12)

### Interpretation depends on a live model (OpenAI); no CI live-model test
- **Status:** intentional (see `docs/TELL_MAMAHQ.md`).
- **Why it matters:** the `/api/tell` interpretation step needs `OPENAI_API_KEY` and a
  network call, so it is NOT exercised in CI. CI proves the deterministic safety core
  (Zod validation, reference/time resolution, execution security) with mocked model
  output + the JWT harness. A live-model smoke test is deliberately not required CI.
- **Dependency:** a key + network.

### Provider is OpenAI-only today (interface is provider-agnostic)
- **Status:** by design for MamaHQ (`product-standard.md`).
- **Why it matters:** the `Interpreter` interface + adapter seam let a different
  provider drop in without touching the contract/resolver/route/UI, but only the
  OpenAI adapter exists. Swapping = one new adapter + the factory in
  `lib/tell/openai-adapter.ts`.

### Tell MamaHQ manual (two-browser / real-model) QA is OUTSTANDING
- **Status:** advisory (see `docs/MANUAL_QA.md` Step 12 section).
- **Why it matters:** real end-to-end interpretation quality and the two-browser
  realtime propagation of Tell-created items can only be validated by a human. CI
  proves the deterministic + security layers; it does not prove model interpretation
  quality.

### `/api/tell` is stateless — no durable Tell-specific provenance beyond captures
- **Status:** advisory.
- **Why it matters:** Step 12 does not add a new table. The Inbox `captures` table
  already stores raw input immutably (the provenance model), but the `/api/tell`
  round-trip itself does not persist the interpretation/proposals server-side; the
  client holds them until the user acts. If durable Tell provenance/analytics is ever
  needed, a minimal `0014_tell_mamahq.sql` (family-scoped, RLS, minimal retention)
  would be the smallest addition — deliberately not built now.
