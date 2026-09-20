# MamaHQ — Manual QA Checklist

Status legend for every item:

- **[AUTOMATED]** — covered by an automated test/gate (name given). No human needed.
- **[HUMAN]** — requires a person to verify on a real build/device. Not covered by
  automation.

> IMPORTANT: Do not mark a **[HUMAN]** item as passed unless a human actually
> performed it. As of Step 5C, **all [HUMAN] items are OUTSTANDING** — none have been
> executed by a person. Automation cannot certify how the app *feels* on a device.

---

## What is already AUTOMATED (no human needed)

These run locally (`pnpm run verify`) and in CI on every push/PR:

- **[AUTOMATED]** Catalog integrity — `catalog:validate` (417 concepts, 0 errors).
- **[AUTOMATED]** Grocery Search correctness — `test:grocery-search` (55 tests).
- **[AUTOMATED]** Grocery Resolver correctness — `test:grocery-resolver` (38 tests).
- **[AUTOMATED]** Grocery Action/duplicate logic — `test:grocery-actions` (18 tests).
- **[AUTOMATED]** TypeScript soundness — `tsc --noEmit`.
- **[AUTOMATED]** Lint — `eslint .` (0 errors).
- **[AUTOMATED]** Production build — `next build`.
- **[AUTOMATED]** Clean DB provisioning from migrations — CI `database` job
  (`supabase db reset`).
- **[AUTOMATED]** Completion / restore / increment DB behavior + idempotency —
  `test:db` (in CI).
- **[AUTOMATED]** RLS family isolation, catalog authorization, RPC authorization,
  assigned≠authorized — `test:security` (in CI).

Automated tests prove **domain logic and database/security behavior**. They do NOT
prove the UI wiring, feel, mobile ergonomics, or real-device capture. Those are below.

---

## Grocery — end-to-end UI (all [HUMAN], OUTSTANDING)

Perform in the running app (`pnpm dev` or the deployed site), signed in.

1. **[HUMAN]** Open Grocery (Today → Grocery card, and the `grocery` overlay).
   *Expected:* the list opens; active items show; completed section is separate.
2. **[HUMAN]** Add an ordinary item by typing "milk" and pressing the add control.
   *Expected:* "Milk" appears as an active item, quantity 1.
3. **[HUMAN]** Autocomplete selection: type "ban", pick "Banana" from suggestions.
   *Expected:* the canonical item is added; suggestion list is keyboard+touch usable.
4. **[HUMAN]** Direct Enter phrase: type "2 lb ground beef" and press Enter (no pick).
   *Expected:* resolves to the canonical concept with quantity/unit parsed.
5. **[HUMAN]** Custom item: type something not in the catalog (e.g. "party streamers").
   *Expected:* added as a first-class custom item (no canonical match, still usable).
6. **[HUMAN]** Quantity phrase: add "3 apples".
   *Expected:* quantity 3 on a single Apple item.
7. **[HUMAN]** Duplicate: add "milk" again.
   *Expected:* recognized as the same item (not a second row).
8. **[HUMAN]** Duplicate quantity increment: add "2 milk" when milk already exists.
   *Expected:* existing item's quantity increases by 2 (no duplicate row).
9. **[HUMAN]** Attribute conflict: add "2% milk" then "whole milk".
   *Expected:* treated as distinct items (attributes differentiate), not merged.
10. **[HUMAN]** Package-size conflict: add "4L milk" then "2L milk".
    *Expected:* distinct items (package size differentiates).
11. **[HUMAN]** Unknown modifier: add "natrel milk".
    *Expected:* item added; "natrel" preserved as an unmatched modifier, not dropped.
12. **[HUMAN]** Ambiguity / "Did you mean": add a known-ambiguous alias (e.g. "gummies").
    *Expected:* an inline confirm ("Did you mean…") appears; choosing resolves it.
13. **[HUMAN]** Edit an item (name/quantity).
    *Expected:* change persists and re-renders.
14. **[HUMAN]** Delete an item.
    *Expected:* removed from active list.
15. **[HUMAN]** Complete an item.
    *Expected:* moves to completed section; a toast confirms.
16. **[HUMAN]** Restore a completed item.
    *Expected:* returns to active; its purchase record is reversed.
17. **[HUMAN]** Completed section reflects completions and restores correctly.
18. **[HUMAN]** Refresh the page.
    *Expected:* the list (active + completed) reloads from the server unchanged.
19. **[HUMAN]** Sign out.
    *Expected:* session ends; protected data no longer visible.
20. **[HUMAN]** Sign back in.
    *Expected:* the same family + grocery list are restored.

---

## Tasks / Ownership — Step 8 (all [HUMAN], OUTSTANDING)

Automated `test:tasks` proves the DB/ownership/RLS behavior in CI (creation,
assignment integrity, cross-family rejection, completion actor/ownership retention,
reopen, "Mine" resolution, account-less ownership). The following prove the UI +
the two-adult flow on a real build. **Do NOT mark passed unless a human runs them.**

Single adult:

1. **[HUMAN]** Me → Tasks opens the Tasks surface.
2. **[HUMAN]** Type "Take garbage out" and press Enter / tap +.
   *Expected:* appears under Open as `Take garbage out · Unassigned`.
3. **[HUMAN]** Use "Assign someone or set a due date"; assign to a person; set a due
   date. *Expected:* the row shows the owner name and the due time (e.g. "Tonight").
4. **[HUMAN]** Complete it (tap the checkbox). *Expected:* moves to Done; toast.
5. **[HUMAN]** Reopen it (Done view → reopen). *Expected:* returns to Open, ownership
   preserved.
6. **[HUMAN]** Reassign it via the inline owner picker. *Expected:* owner changes.
7. **[HUMAN]** Refresh. *Expected:* tasks (Open + Done) reload unchanged.

Two authenticated adults (the mental-load proof):

8. **[HUMAN]** As Mom: create "Take garbage out tonight", assign to James, due tonight.
9. **[HUMAN]** As James (second account, member of the same household): sign in, open
   Tasks, switch to **Mine**. *Expected:* the task appears under Mine (owned by James),
   even though Mom created it.
10. **[HUMAN]** As James: complete it.
11. **[HUMAN]** As Mom: refetch/reload. *Expected:* the task shows completed.
12. **[HUMAN]** (If history surfaced later) confirm created-by-Mom, owned-by-James,
    completed-by-James read coherently.
13. **[HUMAN]** As Mom: reopen it, reassign to herself. *Expected:* coherent state;
    owner is now Mom, status open.

## Responsibility Acceptance & Care Handoff — Step 9 (all [HUMAN], OUTSTANDING)

Automated `test:handoff` proves the DB/authorization/RLS behavior in CI. The
following prove the UI + two-adult flow on a real build. **Do NOT mark passed unless
a human runs them.**

Task acceptance:

1. **[HUMAN]** As Mom: create "Take garbage out", assign James.
2. **[HUMAN]** As James (2nd account, same household): open Tasks → Mine. The task
   shows **"I've got it"**. Press it. Expected: **"You have this ✓"**.
3. **[HUMAN]** As Mom: refetch. Expected: the task shows **"James has it ✓"** (not
   before he accepted).
4. **[HUMAN]** As James: complete it. History shows created-by-Mom, assigned-James,
   accepted-James, completed-James.

Reassignment invalidates acceptance:

5. **[HUMAN]** James accepts a task → Mom reassigns it to Sarah. Expected: it no
   longer shows "James has it"; it shows "Assigned to Sarah / waiting to accept".
   Sarah must press "I've got it" herself.

Relinquish:

6. **[HUMAN]** James accepts, then presses "I can't take this". Expected: acceptance
   clears, task stays assigned to James (not reassigned).

Care acceptance:

7. **[HUMAN]** As Mom (current holder): Baby → "Care right now" → Hand off care →
   pick James. Expected: preview shows only logged facts (last feed/diaper/nap); send.
8. **[HUMAN]** Before James accepts: Mom is still the current holder ("Handoff
   pending → James").
9. **[HUMAN]** As James: open the pending handoff, press "I've got it". Expected:
   James becomes current holder; Mom (after refetch) sees James has it.

Decline:

10. **[HUMAN]** Mom → James, James presses "Can't take over". Expected: Mom remains
    current holder; nothing implies James took it.

Cancel / stale:

11. **[HUMAN]** Mom proposes → James, then Mom cancels before James accepts.
    Expected: Mom remains holder; James can no longer accept the stale request.

## Shared Calendar & Commitments — Step 10 (all [HUMAN], OUTSTANDING)

Automated `test:calendar` proves the DB/authorization/RLS/time behavior in CI. The
following prove the UI + two-adult flow on a real build. **Do NOT mark passed unless
a human runs them.**

1. **[HUMAN]** As Mom: Today → "On the calendar today" (or Calendar) → Add event.
   Create "Dentist", timed Thursday 2:00 PM, participant Madelyn, responsible James.
   *Expected:* appears under Upcoming as `Dentist · Thu · 2:00 PM / Madelyn / James is handling this`.
2. **[HUMAN]** As James (2nd account, same household): open Calendar, refetch.
   *Expected:* sees the same event; under **Mine** it shows "You're handling this".
3. **[HUMAN]** All-day: create "School closed", all-day, a specific date.
   *Expected:* shows "All day" on exactly that date (does not shift a day).
4. **[HUMAN]** Multiple participants: create "Family dinner" with several people.
   *Expected:* all participant names shown; no responsible line needed.
5. **[HUMAN]** Edit: as James change the location to "Saint John Dental".
   *Expected:* Mom, after refetch, sees the updated location.
6. **[HUMAN]** Delete: delete an event. *Expected:* removed for both accounts after refetch.
7. **[HUMAN]** Cross-family: a second unrelated household cannot see or mutate the event.

## Realtime & Notifications — Step 11 (all [HUMAN], OUTSTANDING)

Automated `test:notifications` proves generation, recipient-scoped security, dedupe,
self-suppression, and domain-independence in CI with real JWTs. **Websocket realtime
delivery CANNOT be proven in CI** — the following two-browser scenarios must be run by
a human. **Do NOT mark realtime QA passed unless a human runs it.**

Set-up: two browsers (or a browser + a private window), signed in as two adults in the
SAME household (use the Step 7 invite flow to connect the second account).

Realtime — shared truth updates without refresh:

1. **[HUMAN]** Grocery: add "Milk" in Browser A. *Expected:* Browser B's list shows
   Milk within ~1–2s, no manual refresh. Complete it in A → B reflects it. Restore in
   A → B reflects it.
2. **[HUMAN]** Tasks: create/assign a task to Person B in A. *Expected:* B's Tasks
   updates live. B accepts ("I've got it") → A's task shows accepted.
3. **[HUMAN]** Care: propose a handoff A→B. *Expected:* B sees the pending handoff
   live. B accepts → A's current holder updates without refresh.
4. **[HUMAN]** Calendar: create, then edit, then delete an event in A. *Expected:* B's
   calendar updates on each, coalesced (no flicker on the create's participant burst).
5. **[HUMAN]** Self-echo: perform a mutation in A. *Expected:* A shows no duplicate row
   and no flicker when the realtime echo of A's own change arrives.

Notifications — attention directed correctly:

6. **[HUMAN]** Assign a task to B in A. *Expected:* B's bell badge increments live; the
   center shows "New task for you: …"; A gets NO notification (self/actor).
7. **[HUMAN]** B accepts the task. *Expected:* A (the creator) gets "… has it: …"; B
   gets nothing (self).
8. **[HUMAN]** Care handoff proposed A→B. *Expected:* B notified "… wants to hand off
   care to you". B accepts → A notified "… has the baby".
9. **[HUMAN]** Calendar: designate B responsible for an event. *Expected:* B notified
   "You're handling: …" (copy must NOT say "accepted").
10. **[HUMAN]** Self-suppression: assign a task to YOURSELF in A. *Expected:* no
    notification.
11. **[HUMAN]** Read state: open a notification → it marks read, badge decrements, and
    tapping navigates to the right domain (Tasks/Care/Calendar).
12. **[HUMAN]** Multi-tab: open A in two tabs; mark a notification read in one.
    *Expected:* the other tab converges to read after its refetch.
13. **[HUMAN]** Recipient privacy: confirm B's notifications never appear for A even
    though they share a family.

Reconnect / recovery:

14. **[HUMAN]** Sleep/close Browser B (or drop its network). Make grocery/task/calendar
    changes in A. Reconnect/wake B. *Expected:* B refetches canonical state on
    reconnect and shows everything it missed — no manual refresh.

## Mobile / ergonomics (all [HUMAN], OUTSTANDING)

Verify on an actual phone (or accurate device emulation):

- **[HUMAN]** Phone-sized viewport: layout is usable, nothing clipped/overflowing.
- **[HUMAN]** Touch autocomplete: suggestions are tappable; the right one is easy to hit.
- **[HUMAN]** Keyboard behavior: on-screen keyboard doesn't obscure the input/suggestions; Enter/Go submits.
- **[HUMAN]** One-handed Grocery use: add/complete reachable with a thumb.
- **[HUMAN]** Tap targets: buttons/checkboxes meet a comfortable minimum size.
- **[HUMAN]** Scroll behavior: long lists scroll smoothly; completed section reachable.
- **[HUMAN]** Overlay behavior: the Grocery overlay opens/closes cleanly; back/escape works.
- **[HUMAN]** Voice capture (Tell MamaHQ): microphone permission + transcription works on-device.
- **[HUMAN]** Photo/OCR capture: taking/selecting a photo runs OCR (tesseract.js) and produces text.

---

## Auth (all [HUMAN], OUTSTANDING)

- **[HUMAN]** OTP request: entering an email sends a code (check inbox/local mail).
- **[HUMAN]** OTP verification: entering the code signs in.
- **[HUMAN]** Session persistence: reloading keeps you signed in.
- **[HUMAN]** Sign out: ends the session.
- **[HUMAN]** Sign back in: works again.
- **[HUMAN]** Family restoration: the same family is returned on re-login.
- **[HUMAN]** Owner Household Person restoration: the "Me"/owner person still exists.

---

## Cross-family sanity (optional [HUMAN], OUTSTANDING)

Automated `test:security` already proves RLS isolation with two authenticated
families in CI. This optional manual scenario is a human sanity check — **not** the
same as Partner Mode (which does not exist; see `docs/PRODUCT_LIMITATIONS.md`).

- **[HUMAN]** Create two independent accounts (two emails) → two separate families.
- **[HUMAN]** Add grocery items in each.
- **[HUMAN]** Confirm neither account can see the other's list anywhere in the UI.

---

## Recording results

When a human runs these, record date, build/commit, device, and pass/fail per item.
Until then, the honest status of this checklist is: **CREATED; human execution STILL
REQUIRED.**
