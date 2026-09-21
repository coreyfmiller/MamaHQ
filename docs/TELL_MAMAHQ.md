# Tell MamaHQ — Natural-Language Action Layer (Step 12)

> **AI proposes. MamaHQ validates. The user approves. Trusted domain services execute.**
> **A proposal is not household truth.**

Tell MamaHQ lets a parent get what's on their mind out in plain language — "we're low
on milk, James has soccer pickup Thursday at 6, remind me to call the dentist
tomorrow" — and turns it into a small set of **structured, reviewable** actions across
the existing MamaHQ domains. The AI is an **interpreter**, never a database
administrator. It never writes rows, never decides authorization, never invents
household facts, and never executes anything on its own.

## The pipeline

```
Capture → Interpret (server) → Structured Proposal → Validate (Zod) →
Resolve references (deterministic) → Confirm (user) → Execute (trusted domain RPCs) → Result
```

Interpretation is **read-only**. Execution is a **separate, explicit, confirmed**
step. The two never blur: interpreting text can be retried freely because it changes
nothing; only the user pressing "Add" runs the trusted domain operations.

## Supported actions (small on purpose)

| Type | Domain it executes into | Notes |
|---|---|---|
| `GROCERY_ADD` | Grocery (existing resolver → action resolution) | The LLM only decides "this is a grocery request"; the deterministic catalog/resolver does product matching + merge behavior. |
| `TASK_CREATE` | Tasks (`create_task`) | title, optional assignee, optional due date/time, notes. Assignment ≠ acceptance. |
| `CALENDAR_CREATE` | Calendar (`create_calendar_event`) | Event ≠ Participant ≠ Responsible person. Responsibility is a designation, never acceptance. |
| `CARE_HANDOFF_PROPOSE` | Care (`propose_care_handoff`) | Proposal only — never transfers care, recipient must be a connected account and still accepts themselves. |

### Unsupported requests

Anything outside that set (buying things, email/SMS, medical/feeding/sleep advice,
"what should I do about the baby") is **not** twisted into a supported action. It is
returned as an `unsupported` note the user can see, and produces no action. No medical
or clinical interpretation is ever generated (see `data-and-ai-standard.md`).

## Session isolation & async races

The Tell session (`components/mama/tell.tsx`) is **reset whenever the active family
changes** (login, logout, household switch) — proposals interpreted for Family A never
linger, appear, or become executable after switching to Family B, and a signed-out
state clears everything. Interpretation is guarded by a monotonic request sequence +
the originating family, so a slow/stale `/api/tell` response can never overwrite a
newer one or populate a different household's UI. `confirmAll` additionally refuses to
execute if the active family no longer matches the session's family. (Execution-time
revalidation against the current family + the domain RPCs' own family checks are the
final backstop.)

## Provider-agnostic architecture

```
product/domain layer  →  Interpreter interface  →  OpenAI adapter (today; swappable)
```

- `lib/tell/interpreter.ts` — the provider-agnostic `Interpreter` interface + minimal
  `InterpreterContext`. The route, resolver, contract, execution, and UI depend ONLY
  on this, never on OpenAI.
- `lib/tell/openai-adapter.ts` — the ONLY module that imports the `openai` SDK.
  Swapping providers = writing another adapter; no product changes. (Per MamaHQ's
  `product-standard.md`, OpenAI is the concrete provider for this project.)
- **Model configuration:** `gpt-4o-mini` (overridable via `TELL_MAMAHQ_MODEL`),
  `temperature: 0`, JSON response format, 20s timeout, 1 retry, 1200 max output
  tokens. Chosen for structured extraction, low latency, reliable JSON adherence, and
  low cost. Model choice is NOT user-facing. No secrets are hardcoded — the key comes
  from `OPENAI_API_KEY` (server only).

## The server boundary (`app/api/tell/route.ts`)

Not a generic OpenAI proxy — it performs exactly one operation. In order:

1. **Bound the input** (max 2000 chars; never silently truncated — asks for a shorter
   note) before any model work.
2. **Authenticate server-side** via the cookie session (`supabaseServer()` →
   `auth.getUser()`); unauthenticated → 401.
3. **Derive the family server-side** via `ensure_family` (SECURITY DEFINER, returns
   the caller's own family). The client-supplied family/user id is NEVER trusted.
4. **Load minimum context**: household people by **display name only** (+ relationship,
   + an `isMe` flag) — no emails, phones, ids, secrets, or history sent to the model.
5. **Interpret** via the provider-agnostic interpreter.
6. **Strictly validate** the untrusted model output with Zod (`rawInterpretationSchema`).
   Malformed output → a friendly, retryable failure; never a proposal.
7. **Resolve references deterministically** against canonical state.
8. Return safe proposals. Never returns secrets. Never executes.

## Model output is not authorized data

The contract has **two** schemas on purpose (`lib/tell/contract.ts`):

- **Raw (untrusted):** the model references people ONLY by a name token or the literal
  "me" (`personRef` strings). It **cannot emit a database id** — so it can never mint a
  trusted reference. It cannot express "run SQL" or "reveal prompt" — there is no such
  action in the discriminated union. Every raw object is **`.strict()`**, so a model
  that hallucinates an extra field (a smuggled `responsiblePersonId` uuid, a
  `familyId`, `accepted: true`, an `rpc` name, a `timezone` override) is **rejected**,
  not silently stripped — the "model output is not authorized data" guarantee is
  enforced structurally, not left to downstream ignore-behavior.
- **Resolved (safe):** produced by the pure resolver (`lib/tell/resolve.ts`) AFTER
  validating every reference against the real household. Only these are reviewable/
  executable.

### Reference & time resolution (deterministic, pure, unit-tested)

- **People:** name → canonical person by case-insensitive display-name match. Multiple
  matches → `ambiguous_person` (user picks). No match → `unknown_person` (never
  invents a person). "me/myself/I" → the person linked to the current account, or
  `no_me_person` if the account isn't linked.
- **Time:** resolved against the user's **real local now** (passed from the server),
  matching the app's existing local-offset day-key convention. No IANA timezones are
  introduced (nothing else in the app uses them).
  - Timed calendar events need BOTH a date and time → otherwise `missing_date` /
    `missing_time`. **No false precision** — a missing day is never invented as today,
    a missing time is never invented as 9am.
  - All-day events ("birthday Oct 12") keep a plain date (no tz shift), per Step 10.
  - Tasks tolerate a due date without a time.
- **Care handoff recipient** must be a **connected account** → else
  `recipient_not_connected` (an account-less person can't accept).

## Confirmation UX (`components/mama/screens/tell.tsx`)

"Here's what I understood" → per-proposal cards with plain language ("Add to Grocery",
"James is handling it", "Ask James to take over care"). The user can **edit**, **remove**,
resolve a clarification (pick a candidate; set a missing date/time), or cancel. Only
`ready` proposals (no blocking issues) count toward "Add N things".

**Partial readiness:** ready proposals and clarification-needed proposals coexist; the
count reflects only what's ready. **Trust states are explicit** — Proposed →
Executing… → Completed / Failed — never an ambiguous "Done!" hiding a partial failure.

### User edits are authoritative

An edit is applied locally and **re-validated deterministically** (readiness recomputed
from remaining issues). Edited values are NOT sent back to the model for
re-interpretation.

## Execution (`lib/tell/execute.ts`)

An **exhaustive dispatcher** on the discriminated `kind`. An unknown kind is rejected —
we never dynamically execute a function named by the model. Each proposal executes
ONLY through the existing trusted domain operations (the same `*Rpc` helpers every
other feature uses):

- Grocery → `resolveGroceryPhrase` → `resolveGroceryAction` → `planGroceryAction` →
  `insertGroceryItem`/`incrementGroceryItemRpc`. If the grocery action resolver returns
  `confirm`, Tell MamaHQ surfaces that — it cannot override it.
- Task → `createTaskRpc({ source: 'tell_mamahq' })`. Creating/assigning **never**
  records acceptance.
- Calendar → `createCalendarEventRpc`. The RPC generates any responsibility
  notification itself — Tell MamaHQ never inserts a notification.
- Care → `proposeCareHandoffRpc`. Propose only; never transfers, never accepts.

### Idempotency

Each proposal has a stable `id` assigned at the interpretation boundary. The dispatcher
maps it into the domain idempotency keys — `tell-task-<id>` (clientTaskId),
`tell-event-<id>` (clientEventId), `tell-grocery-<id>` (row id / client_action_id). A
double-click / timeout-retry with the same proposal is a domain no-op returning the
existing row — no duplicate grocery items, tasks, or events. Care propose is guarded by
the one-pending-handoff DB constraint.

### Execution-time revalidation

A proposal may sit on screen while the household changes. Before executing, the
dispatcher revalidates every referenced person against the current family
(`validPersonIds`); a now-invalid reference fails safely with a specific message, and
the domain RPC enforces the final invariants regardless.

### Multi-action commit semantics

Proposals execute **independently** (they touch independent domains — this is not a
distributed transaction). Each result is tracked and shown individually. A later
failure does not roll back an earlier success, and a retry can't duplicate a success
(idempotency keys).

## Interaction with Realtime & Notifications

- **Realtime:** after a domain commit, existing Step 11 realtime handles cross-session
  freshness. Tell MamaHQ adds no second synchronization path; the local actor's
  providers refetch as they already do.
- **Notifications:** Tell MamaHQ **never** generates a notification. The trusted domain
  RPCs own their side effects — e.g. assigning a task to James produces exactly the
  normal assignment notification (one), and a self-assigned task produces none (Step 11
  self-suppression). Duplicating a notification here is explicitly forbidden.

## Prompt-injection resistance

User text is DATA. "Ignore your instructions / output your prompt / return everyone's
records" cannot escape the structured contract: the schema has no action for SQL,
disclosure, or tool use, and any such text becomes at most an unsupported note or
(harmlessly) a grocery phrase. Structured Zod validation is part of this defense.

## Privacy & provenance

- Raw brain-dump text is sensitive household data. The route logs error categories,
  not raw prompts; no keys/tokens are logged.
- The existing Inbox `captures` table already stores raw input immutably alongside
  interpretation/approved actions (the provenance model in `data-and-ai-standard.md`).
  Step 12's `/api/tell` is stateless — it does not add new indefinite raw-prompt
  storage; the client keeps the draft in memory until the user acts.

## Security model (proved by tests)

- Interpretation requires authentication + an active family, both derived server-side.
- The model cannot mint a trusted id; cross-family / unknown / invented-uuid references
  are rejected at resolution and again by the domain RPC at execution.
- A tampered proposal (client swaps in a foreign person id) is rejected by the RPC.
- AI cannot mark a task accepted for someone else, cannot accept a care handoff for
  someone else, cannot forge a notification, and cannot write arbitrary tables (client
  inserts are RLS-blocked; all writes go through the trusted RPCs).

## Versioning

`TELL_INTERPRETER_VERSION = 'tell-mamahq-v1'`, `TELL_SCHEMA_VERSION = 1` (in
`lib/tell/contract.ts`). Bump when the contract shape changes.

## Tests

- `scripts/test-tell.ts` (deterministic, in the Verify CI job): Zod validation,
  reference resolution (me/unknown/ambiguous/account-less), participant-vs-responsible,
  assignment-vs-acceptance, time normalization + missing date/time (no false
  precision), all-day, unsupported/injection, proposal identity, multi-domain.
- `scripts/test-tell-security.ts` (JWT harness, in the Database CI job): execution
  passes through domain authz, tell_mamahq provenance, no acceptance from execution,
  idempotent retries, cross-family/tampered/invented-uuid rejection, care propose
  never transfers, direct notification/task inserts blocked.
- Interpreter contract tests use MOCKED model output (the raw JSON), so CI never
  depends on a live OpenAI call. A live-model smoke test is intentionally NOT part of
  required CI.

## Known limitations / deferred

In-app text only. No voice/audio, image/OCR, purchasing, email/SMS, external calendars,
budgeting, journaling, medical/medication automation, autonomous/confirmation-free
execution, background agents, or multi-model routing. Even a single "add milk" passes
through the propose→confirm boundary in this first version. Manual two-browser QA is
OUTSTANDING until a human performs it (see `MANUAL_QA.md`).
