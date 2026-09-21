# Identity & Capture (Beta Phase 1)

This phase removed the remaining places where MamaHQ could show **false, inconsistent,
or invisible household truth** before a closed beta. Three principles:

> One person has one canonical household identity.
> There is one trusted place to get something out of your head: Tell MamaHQ.
> If something fails, MamaHQ says so — and it never implies delivery that didn't happen.

## Canonical household identity

**The HouseholdPerson linked to your authenticated account IS your canonical
household identity.** Its `display_name` is the single source of truth shown across
People, task ownership, calendar responsibility, care, and notifications.

- The name entered during **onboarding** now updates that linked person (not just the
  local profile / baby row). Onboarding calls `useHousehold().renameMe(name)` →
  `set_my_display_name` RPC (migration `0014`).
- The name is **editable** any time in **Settings → Account → Your name** (same trusted
  path). There is no separate profile-name source of truth; the local profile `momName`
  is display convenience only.
- **Trusted, account-derived writer.** `set_my_display_name` is SECURITY DEFINER: it
  resolves the caller's own person from `auth.uid()`, so it can only rename the caller's
  own person, only in a family they belong to, and never creates a duplicate. Idempotent.
  Name validation: trim + collapse internal whitespace, 1..80 chars, Unicode/apostrophes/
  hyphens allowed (no culturally narrow rules).

### Existing-user reconciliation (conservative)

Existing users whose linked person still carries a **bootstrap placeholder** (`'Me'` or
`'Member'`) AND who have a real profile name on the device are reconciled once per
family: the profile name is adopted as the canonical household name. We **only**
overwrite the known placeholders — never a name the user intentionally set — so we can't
clobber a deliberate choice. If we can't safely infer a real name, we leave it for the
user to set explicitly in onboarding or Settings (never guess). See
`components/mama/household.tsx` (`renameMe` + the reconciliation effect).

## One capture path: Tell MamaHQ

MamaHQ previously exposed two competing brain-dump systems: the legacy rule-based
**Inbox** (localExtractor → commit) and the Step 12 **Tell MamaHQ** (AI → validate →
confirm → trusted domain execution). For beta there is now exactly one:

- **Tell MamaHQ is the canonical capture surface**, promoted to a primary bottom-nav
  tab ("Tell", Sparkles icon) and still reachable from the center Capture button.
- The **legacy Inbox** is no longer routed from primary navigation. The center Capture
  sheet offers **Tell MamaHQ** + **Quick log** (tap-based baby logging) only; the legacy
  Speak/Photo options (which fed the old rule-based engine into the hidden Inbox) are
  retired for beta (voice/photo capture is a documented later phase).
- **Legacy code + data are preserved, not deleted.** `components/mama/screens/inbox.tsx`,
  `components/mama/inbox/commit.ts`, and `components/mama/inbox/local-extractor.ts` remain
  in the tree but are unreachable from normal navigation; existing `captures` rows are
  untouched (no destructive migration). We can delete the dead code in a later phase once
  beta confidence is established.
- **Tell's Step 12 trust model is unchanged:** Capture → Interpret → Structured Proposal
  → Validate → Confirm → Execute trusted domain op → Result. No automatic execution;
  example prompts populate the input only (they never interpret or execute).

## Failures are visible; delivery is never overstated

- **App error boundaries:** `app/error.tsx`, `app/global-error.tsx`, and `app/not-found.tsx`
  render calm, on-brand recovery instead of a blank screen or raw stack trace. They offer
  retry + a safe path home and never claim data was/ wasn't saved.
- **Privacy-first monitoring:** `lib/monitoring.ts` reports only uncaught error
  type/message/stack + release/env, scrubs obvious tokens/emails/phones, and is a safe
  no-op when `NEXT_PUBLIC_SENTRY_DSN` is unset or `@sentry/nextjs` isn't installed.
  Monitoring can never block the product.
- **Partner delivery false-truth removed:** the partner screen no longer shows SMS/email
  delivery toggles or channel chips (there is no SMS/email delivery). Partner contact
  details are clearly "for your reference"; the real, live channel is **in-app
  notifications** for partners who have their own account (invite them from Household).

## Auth ≠ local prototype

The `/app` shell is auth-gated (`AuthGate`): a signed-out user sees the sign-in screen,
**never** a local-only prototype masquerading as a real shared household. Real, durable,
shared household state always requires authentication; localStorage is only a read-cache
/ offline fallback while signed in, and the store for the signed-out marketing/demo path.
(No auth rewrite was performed; the existing email-OTP flow already surfaces sign-in on
sign-out / session loss.)
