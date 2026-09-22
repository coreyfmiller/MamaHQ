# MamaHQ — Beta Data Deletion & Support Procedure (operator-facing)

**Audience:** the closed-beta operator (Corey). **Not** a user-facing document.

For the first ~10 invited families, MamaHQ does **not** ship a self-service "delete my
account" button. Permanent account + household deletion is **operator-managed**: a family
asks, and we delete it for them by hand in Supabase. This document is the reliable,
safe procedure for doing that.

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
row for the OWNER first, that family (and its cascade) goes with it. For a full
account+household deletion we remove BOTH the family row and the member auth users.

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
  (e.g. Mom + partner). You will delete the auth users for the members who asked to be
  removed (usually all of them for a full-household deletion).

### Step 4 — Delete the family (cascades all family-scoped data)
Once confident:
```sql
delete from public.families where id = '<FAMILY_ID>';
```
This cascade-deletes household_people, babies, logs, mom_*, memories, captures,
grocery/household-memory, tasks/task_events, calendar_events/participants,
care_*, invitations, notifications, partner_contacts, appointments — everything above.

### Step 5 — Delete the auth account(s)
In **Authentication → Users**, delete each member `user_id` you confirmed in Step 3 that
the family asked to remove (for a full deletion, all of them). This removes the login
identity. (Deleting the owner's auth user would also cascade the family via `owner_id`,
but we already deleted the family explicitly in Step 4 so the order is safe either way.)

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
- This is manual production data work: double-check you are in the **production** project,
  not local/staging, and that you have the right project selected.

---

## 6. Beta support channel
There is **no in-product support email configured** in code. Communicate the support
contact (however the beta invites are coordinated — e.g. the email/channel used to invite
each family) out-of-band as part of beta onboarding. The in-app copy intentionally says
only "contact beta support" and does not fabricate an address.
