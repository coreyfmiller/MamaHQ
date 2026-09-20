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
