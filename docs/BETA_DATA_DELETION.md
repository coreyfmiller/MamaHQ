# MamaHQ — Beta Data Deletion & Support Procedure (operator-facing)

**Audience:** the closed-beta operator (Corey). **Not** a user-facing document.

For the first ~10 invited families, MamaHQ does **not** ship a self-service "delete my
account" button. Permanent deletion is **operator-managed**: a family asks, and we delete
it for them by hand in Supabase. This document is the reliable, safe procedure for doing
that. Note two distinct operations that need different authorization — **deleting a
household's shared data** (justified by any member's request) vs **deleting a person's
auth account/login** (only for the user who asked to delete their own account). Section 1
spells out the difference; do not treat them as the same action.

> Why operator-managed is acceptable for this beta: the population is tiny and directly
> supported, the app never falsely claims a user can self-delete (Settings → Danger zone
> says "Start over isn't account deletion… contact beta support"), and the deletion below
> is a single cascading action, not a fragile multi-table script.

---

## 0. What "Start over" is NOT

"Start over" (Settings → Danger zone → the reset screen) is a **product feature for the
signed-in user**, not a deletion request. It clears the baby profile, logs, mood/to-dos/
questions, memories and grocery for the user's family, but by design it does **NOT**:

- delete the family/household itself, the account, or membership;
- remove RPC-protected shared records — **tasks, task_events, calendar_events,
  calendar_event_participants, care_handoffs, care_responsibility, household_invitations,
  notifications** survive it (they have no client DELETE policy; a client delete matches
  zero rows under RLS). The reset copy is now honest about this.

So a "please delete my account and everything" request is handled here, not by telling
the family to press Start over.

---

## 1. Data model facts that make this safe

Every family-scoped table references `public.families(id)` **`ON DELETE CASCADE`**
(verified across migrations 0001–0013). That includes: `family_members`, `household_people`,
`babies`, `logs`, `mom_moods`, `mom_items`, `memories`, `captures`, `partner_contacts`,
`appointments`, `appointment_questions`, `grocery_items`, `household_items`,
`household_item_observations`, `purchase_events`, `tasks`, `task_events`, `calendar_events`,
`calendar_event_participants`, `care_responsibility`, `care_handoffs`,
`household_invitations`, `notifications`.

**Consequence:** deleting the single `public.families` row removes *all* of that family's
data in one cascade — including the RPC-protected tables that "Start over" cannot touch.
No table-by-table script is required, and FK ordering is handled by the cascade.

`public.families.owner_id` and `public.family_members.user_id` reference `auth.users(id)`
`ON DELETE CASCADE` in the other direction — so if you instead delete the `auth.users`
row for the OWNER first, that family (and its cascade) goes with it.

### Deleting household DATA ≠ deleting a person's ACCOUNT (read this before Step 5)

These are two different operations and they need different authorization:

- **Household data deletion** — remove the family's shared data (Step 4). One request
  from a household member is enough to justify wiping *that household's* data.
- **Account (auth identity) deletion** — remove a person's *login*. This may ONLY be done
  for a user who **themselves** asked for their account to be deleted. Do NOT delete
  another adult's auth account just because their household was deleted. If Mom asks to
  delete "my account and our data," that authorizes deleting the household data + **Mom's**
  auth account — NOT the partner's login, unless the partner also asked.

**Multi-membership hazard (schema fact):** `family_members`'s primary key is
`(family_id, user_id)`, so the data model allows ONE auth user to belong to MORE THAN ONE
family. `family_members.user_id` is `ON DELETE CASCADE` toward `auth.users`, so deleting an
auth account also removes that person's membership in **every** family — including any
unrelated household. Therefore, before deleting ANY auth account, confirm that user is not
a member of another family (Step 5b). Deleting the family row (Step 4) never touches other
families; only auth-account deletion carries this cross-household risk.

---

## 2. Procedure — permanent account + household deletion

Do this in the **Supabase dashboard** for the MamaHQ **production** project (SQL editor +
Authentication → Users). Read every verification step before running any `delete`.

### Step 1 — Identify the requesting user (never guess)
- In **Authentication → Users**, find the user by the email the request came from. Record
  their `user id` (a UUID). Do **not** proceed on a name alone.

### Step 2 — Identify their family/household
Run (read-only):
```sql
select f.id as family_id, f.owner_id
from public.families f
join public.family_members m on m.family_id = f.id
where m.user_id = '<REQUESTER_USER_ID>';
```
- Expect **exactly one** family for a beta user. If zero, they have no household (only an
  auth user — skip to Step 5). If more than one, stop and investigate before deleting
  anything.

### Step 3 — Confirm you have the RIGHT household (guard against deleting the wrong one)
Run (read-only) and eyeball the people + baby against what the family described:
```sql
select display_name, relationship, user_id is not null as has_account
from public.household_people
where family_id = '<FAMILY_ID>'
order by created_at;

select name, birth_date from public.babies where family_id = '<FAMILY_ID>';

select user_id from public.family_members where family_id = '<FAMILY_ID>';
```
- Verify the household people / baby name match the family who asked. Note **every**
  `user_id` in `family_members` — a household can have more than one member account
  (e.g. Mom + partner). You will delete an auth account ONLY for a person who **themselves**
  asked for their account to be deleted (see Step 5) — not automatically for every member.

### Step 4 — Delete the family (cascades all family-scoped data)
Once confident:
```sql
delete from public.families where id = '<FAMILY_ID>';
```
This cascade-deletes household_people, babies, logs, mom_*, memories, captures,
grocery/household-memory, tasks/task_events, calendar_events/participants,
care_*, invitations, notifications, partner_contacts, appointments — everything above.

### Step 5 — Delete auth account(s) — ONLY for users who asked, and only if safe
Delete an auth account (a person's login) **only** for a user who explicitly requested
*their own account* be deleted. This is separate from the household-data deletion in
Step 4, which is already done.

- If the request was "delete our whole household and both our accounts," and BOTH adults
  asked, delete both. If only Mom asked to delete her account, delete **only Mom's** —
  leave the partner's login alone (their household data is gone, but their account is
  theirs to delete).
- Account-less household people have no auth account — there is nothing to delete in
  Authentication → Users for them (Person ≠ Account). Step 4 already removed their
  `household_people` row via cascade.

**Step 5a — decide the set.** From Step 3's `family_members.user_id` list, keep only the
user(s) who personally requested account deletion.

**Step 5b — multi-membership safety check (run before deleting each auth user).** Because
one auth user can belong to more than one family, confirm the user you're about to delete
is not still a member of another household:
```sql
select family_id from public.family_members where user_id = '<AUTH_USER_ID>';
```
- After Step 4 this should return **zero** rows for a single-household user. If it returns
  any OTHER `family_id`, that person is also in another household — do **NOT** delete their
  auth account (it would cascade away their membership there too). Only their data in the
  deleted family is gone; leave the account.

**Step 5c — delete.** In **Authentication → Users**, delete only the confirmed, safe
user id(s). (Deleting the owner's auth user would also cascade the family via `owner_id`,
but Step 4 already deleted the family, so order no longer matters.)

### Step 6 — Ask the user to clear their device (optional, their action)
Some data also lives in **their browser's localStorage** (signed-out fallback copies:
`mamahq.proto.*`). We cannot clear that remotely. Tell the family they can sign out and
clear site data, or it clears itself on that device over time. It is per-device and not
shared/household data.

---

## 3. Verify deletion
Run (read-only) — all should return **0**:
```sql
select count(*) from public.families where id = '<FAMILY_ID>';
select count(*) from public.family_members where family_id = '<FAMILY_ID>';
select count(*) from public.household_people where family_id = '<FAMILY_ID>';
select count(*) from public.logs where family_id = '<FAMILY_ID>';
select count(*) from public.tasks where family_id = '<FAMILY_ID>';
select count(*) from public.calendar_events where family_id = '<FAMILY_ID>';
select count(*) from public.care_handoffs where family_id = '<FAMILY_ID>';
select count(*) from public.notifications where family_id = '<FAMILY_ID>';
```
Confirm the auth user(s) no longer appear in Authentication → Users.

---

## 4. Record the request (without retaining sensitive content)
Keep a minimal, content-free log entry, e.g.:
> `2026-…: deletion request from <family_id redacted-to-you>, completed <date>, verified 0 rows.`

Do **NOT** copy household content (names, logs, notes, Tell text, photos, emails) into any
tracking doc, commit, or issue. Record only that a request was made and completed.

---

## 5. Guardrails (read before every deletion)
- **One family at a time.** Never run a `delete` without the specific `<FAMILY_ID>`.
- **Never** `delete from public.families` without a `where id =` clause.
- Confirm household identity (Step 3) against what the family told you before Step 4.
- If Step 2 returns more than one family for a user, or the household people don't match,
  **stop** and investigate — do not delete.
- **Never delete an auth account except for a user who asked for their OWN account to be
  deleted.** Household-data deletion (Step 4) and account deletion (Step 5) are separate;
  do not delete a partner's login just because the household was wiped. Always run the
  Step 5b multi-membership check before deleting any auth user.
- This is manual production data work: double-check you are in the **production** project,
  not local/staging, and that you have the right project selected.

---

## 6. Beta support channel
There is **no in-product support email configured** in code. Communicate the support
contact (however the beta invites are coordinated — e.g. the email/channel used to invite
each family) out-of-band as part of beta onboarding. The in-app copy intentionally says
only "contact beta support" and does not fabricate an address.
