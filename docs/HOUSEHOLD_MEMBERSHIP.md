# MamaHQ — Household Membership & Partner Access (Step 7)

The authenticated multi-adult foundation. Mom can invite another adult, who
authenticates their own account and joins the **same** household, connected to their
**existing** HouseholdPerson — while remaining a distinct person with distinct
identity and responsibilities.

> If Mom is the only person who knows, Mom is still carrying it.

## The four distinct concepts (never collapsed)

| Concept | Question | Where it lives |
|---|---|---|
| **Person** | Who is this human in the household? | `household_people` (`user_id` null = no account) |
| **Account** | How do they authenticate? | `auth.users` (Supabase, email OTP) |
| **Membership** | What household are they *authorized* to access? | `family_members` (the **security boundary**) |
| **Ownership** | What are they *responsible* for? | references to `household_people.id` (person, not user) |

**Assigned Person ≠ Authorized User** is preserved absolutely: authorization derives
**only** from an authenticated `family_members` row, never from being represented by
a `household_people` row. A person with `user_id = null` has zero access.

## Identity model

```
auth.users  ──(family_members: authorization)──►  families (household)
     │                                                  │
     └──────── household_people.user_id ────────────────┘
                (identity link; null = no account)
```

A HouseholdPerson may have `user_id = null` (account-less: Grandma, a babysitter, a
child) or `user_id = <auth user>` (a connected adult). The **same person row**
survives account activation — invitation acceptance links the existing row rather
than creating a second "James (account)".

## Roles

Deliberately minimal (no enterprise RBAC): `owner` and `member` (the existing
`family_members.role` check). Both authenticated adults participate in normal
household operations (Grocery, people, etc.). Owner-only/administrative behaviors can
be layered later; Step 7 does not build a permission matrix.

## Invitation lifecycle

```
pending ──accept──► accepted
   │
   ├──revoke──► revoked
   └──expire──► expired   (expiry is enforced at acceptance time)
```

- **create** (`create_household_invitation`): a member of the person's own family
  creates an invitation for an existing account-less person. Stores only a token
  **hash**. Returns the invitation id; the caller keeps the plaintext token for the
  link.
- **accept** (`accept_household_invitation`): the invitee proves possession of the
  token (client sends its SHA-256 hash). Transactional; see below.
- **revoke** (`revoke_household_invitation`): a family member revokes a *pending*
  invitation (token becomes unusable). Revoking an already-accepted invitation is a
  no-op — the membership stands.

## Invitation security

- **Token = credential.** High-entropy (256-bit) token generated client-side; only
  its **SHA-256 hex hash** is stored (`household_invitations.token_hash`, unique). A
  DB read cannot recover a usable token.
- **Expiry**: every invitation has `expires_at`; acceptance rejects expired tokens
  (and marks them `expired`).
- **One-time**: an accepted invitation cannot be redeemed by a different user;
  revoked/expired tokens cannot be redeemed.
- **No client-chosen family**: the target household is derived server-side from the
  validated invitation — the client never supplies a `family_id`.
- **No broad enumeration**: RLS lets a family's members view *their* invitations
  only; there is no global list. Acceptance does not require SELECT visibility (the
  RPC validates the token server-side).
- **The link is path-based** (`/join/<token>`) so the token doesn't land in query
  strings that proxies routinely log. We never log the full invite URL or plaintext.

## Acceptance transaction (all-or-nothing, idempotent)

`accept_household_invitation(token_hash)` (SECURITY DEFINER) runs one transaction:
1. authenticate caller (`auth.uid()`);
2. look up + lock the invitation by token hash;
3. **idempotent success**: if already `accepted` by *this* user → return the existing
   result; if accepted by *another* user → reject;
4. reject `revoked` / non-`pending` / expired (marking expired truthfully);
5. reject if the caller already belongs to a *different* active household (one active
   household per user — documented constraint);
6. create the `family_members(member, active)` row (idempotent via PK);
7. link the **existing** `household_people.user_id` to the caller (guarded — see
   below), or create a connected person if the invitation carried none;
8. mark the invitation `accepted` + record the accepting user.

Safe under double-click / refresh / retry / concurrent attempts: duplicate membership
is prevented by the PK + `on conflict`, and duplicate person is prevented by linking
the existing row.

## family_members hardening

The Step 1 baseline policy allowed `members_insert with check (user_id = auth.uid()
or is_family_member(family_id))` — which let **any** authenticated user insert
`(someone_elses_family, self)` and self-authorize. Step 7 replaces it with
`with check (false)`: **no direct client inserts.** Both legitimate creation paths
are SECURITY DEFINER functions that run as the table owner and bypass RLS —
`ensure_family` (owner bootstrap) and `accept_household_invitation` (member). Membership
can no longer be manufactured from the client.

## HouseholdPerson linking hardening

The blanket `household_people_all` policy let a member UPDATE any person row,
including setting `user_id = auth.uid()` to hijack an identity. Step 7 adds a
`BEFORE UPDATE OF user_id` trigger (and a `BEFORE INSERT` guard) that **rejects any
client-initiated `user_id` change/pre-link** unless a transaction-local flag
(`mamahq.allow_person_link`) is set — which only `accept_household_invitation` sets.
Normal edits (display name, relationship, phone, email) are unaffected.

## Owner bootstrap (unchanged, normalized)

The original authenticated user still gets family + owner membership + owner-person
via `ensure_family` / `ensure_owner_person` (SECURITY DEFINER, RLS-bypassing). Step 7
adds `status`/`joined_at`/`invited_at` to `family_members` (owner rows backfill to
`active`). Owner and partner now use the **same** underlying membership model — no
special-case identity system.

## Invitation-aware auth bootstrap (no accidental household)

The client bootstrap previously called `ensure_family` unconditionally on sign-in —
which for an invited user would create a **personal** household before joining the
invited one. Fixed: on sign-in, if a pending invite hash is stashed (from opening a
`/join/<token>` link), the client redeems it **first** via
`accept_household_invitation` and resolves *that* family; `ensure_family` is not
called. A normal (non-invited) user still bootstraps their own household. Order is
deterministic — not timing-based.

## Account status (durable, not display text)

The People UI derives each person's status from durable state:
- **connected** — `household_people.user_id` links to an active `family_members` row;
- **invited** — a `pending` invitation exists for the person;
- **not connected** — neither.

## Multiple-household decision

**Constrained to one active household per user** (documented + enforced): acceptance
rejects a caller who already belongs to a different active family. The schema
technically permits multiple `family_members` rows, but the app assumes exactly one
current household and resolves it deterministically. Household switching is **not**
built in Step 7.

## partner_contacts decision

`partner_contacts` (a notify-only name/phone/email helper) is **retained for
compatibility but deprecated**. The target direction is one coherent household-person
model: a partner is a `household_people` row (account-less or connected), not a
parallel `partner_contacts` record. No destructive migration in Step 7; a future
cleanup will fold any remaining partner_contacts into `household_people` and retire
the table. Tracked in `TECHNICAL_DEBT.md`.

## Member removal (deferred)

Full household separation / member-removal workflows are **not** built in Step 7.
`family_members.status` includes `removed` to support a future minimal path:
removal should revoke *authorization* (set membership `removed`) while **preserving
the HouseholdPerson identity** (historical responsibility/ownership references depend
on it). Do not delete the person. Tracked as deferred.

## Ownership foundation

Responsibility references should point at `household_people.id` (a person), never a
raw auth user id or a string like `"partner"`. `mom_items.assignee` still uses the
legacy `'partner'` string — a future migration to `assignee_person_id` is documented
in `TECHNICAL_DEBT.md`. Authorization stays on the user/account; responsibility stays
on the person.

## Shared Grocery proof (no realtime)

Both adults resolve the same family and operate on the same family-scoped data.
Verified in CI (`test-membership.ts`): owner adds a grocery item → partner sees it on
refetch; partner adds + completes an item → the purchase event and Household Grocery
Memory are family-scoped and visible to the owner. Household learning is **shared
household knowledge**, not per-user. Realtime is intentionally not built yet — a
refetch reflects the other adult's changes.

## Privacy

No household/membership data is sent to any LLM (none is used). Invitation tokens are
never logged; the invite URL is path-based and the plaintext token is not persisted.

## Current limitations

- One active household per user (no switching UI).
- Member removal deferred (status supports it; no workflow yet).
- `partner_contacts` retained-but-deprecated; `mom_items.assignee` still a string.
- Invite delivery is link-based (copy/share); no email/SMS send is required or built.
- No realtime — the second adult's changes appear on refetch.
