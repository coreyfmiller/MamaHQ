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

### Existing users with a placeholder name (set explicitly — never auto-guessed)

An existing user whose linked person still shows a **bootstrap placeholder** (`'Me'` or
`'Member'`) sets their real name **explicitly**: it is shown (and editable) in
**Settings → Account → Your name**, and onboarding sets it for anyone who runs through
onboarding again. There is deliberately **no automatic reconciliation** from the
device's local profile name.

Why not auto-adopt the local `momName`? Because the local profile is **device-local**,
not tied to the current authenticated user. On a shared device, after one person
onboards (local `momName='Alice'`) and signs out, a different person signing in — whose
linked person is still `'Member'` — would have **their own** canonical cloud identity
silently renamed to `'Alice'`. The RPC would rename the correct row, but with the wrong
name. So we never guess: a placeholder stays visible until the actual account holder
corrects it in Settings. See `components/mama/household.tsx` (`renameMe`; note the
explicit comment where reconciliation was removed).

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

## First-run routing is authoritative (Beta Phase 2)

Which experience a signed-in user sees on entry is decided by **cloud household
truth**, never a device-local "onboarding complete" flag. `useHousehold().firstRun`
derives it from the current user's canonical HouseholdPerson:

- `'creator'` — I'm the household **owner** and my canonical name is still the `'Me'`
  bootstrap placeholder → I just created this household and haven't said who I am →
  show the creator onboarding (welcome → your name → optional people → optional
  partner invite → first Tell).
- `'partner'` — I'm a joined **member** and my name is still the `'Member'`
  placeholder → I accepted an invite → show the shorter partner-join experience
  (confirm my name → the household I joined + who's here → into the app).
- `'done'` — my canonical person has a real (non-placeholder) name → I've been
  established → straight into the product, **on any device**, even if localStorage
  was cleared.

Why this matters: the previous gate keyed off the local **baby row**, which meant a
joining partner (landing in a household that already had a baby) skipped onboarding
entirely and never confirmed their identity, while a returning user could be
re-onboarded after clearing storage. Keying off authoritative identity fixes both.

Once a first-run flow is actively underway it owns the screen until it explicitly
hands off (`dismissOnboarding`), so the mid-flow identity write — which flips
`firstRun` to `'done'` — doesn't tear the remaining optional steps away.

### The name step cannot falsely complete

Both journeys set the canonical name through the trusted `renameMe` RPC and **only
advance when it actually succeeds**. A failed identity write shows a retryable error
and keeps you on the step — the household is never left showing a placeholder while
the UI pretends the name was saved. Skipping naming entirely does not fabricate an
identity: the placeholder remains (and you're nudged in Settings), and because
`firstRun` is derived from the real name, you'll be invited to finish next time.

### Partner joining reuses Step 7 — no duplication

The invited partner's account is linked to their **existing** HouseholdPerson by the
Step 7 `accept_household_invitation` RPC (run at sign-in via the invitation-aware auth
bootstrap). The join experience creates **no** household, **no** new person, and
**no** duplicate membership — it only sets the name and shows what already exists.

### Invitations: generated, not delivered

MamaHQ never sends an invite. The People screen and the onboarding invite step
generate a private link (`/join/<token>`, the token is a credential) and offer
native share / copy so the human sends it themselves. Copy says "copied", the OS
share sheet is used when available, and the UI says **"copy this link and send it"** —
never "invitation sent". Invite links/tokens are never logged or sent to monitoring.
States shown are the real ones: **Not invited → Invite ready / pending → Joined.**

## Auth ≠ local prototype

The `/app` shell is auth-gated (`AuthGate`): a signed-out user sees the sign-in screen,
**never** a local-only prototype masquerading as a real shared household. Real, durable,
shared household state always requires authentication; localStorage is only a read-cache
/ offline fallback while signed in, and the store for the signed-out marketing/demo path.
(No auth rewrite was performed; the existing email-OTP flow already surfaces sign-in on
sign-out / session loss.)
