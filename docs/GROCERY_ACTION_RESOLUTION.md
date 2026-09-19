# MamaHQ Grocery — Action Resolution & Duplicate Handling (Step 5B)

## Responsibility
The Action Resolver answers: **given a resolved proposal + the current ACTIVE list,
what should happen to the list?** It produces a `ValidatedGroceryAction`; a separate
executor performs the mutation. Pure, deterministic, no AI, no purchase history, no
household intelligence — active list only.

## Boundary
```
raw phrase → Grocery Resolver (Step 5A) → ProposedGroceryItem   ("what is this?")
ProposedGroceryItem + ActiveGroceryList → Action Resolver (5B) → ValidatedGroceryAction ("what to do")
ValidatedGroceryAction → executor/store → atomic DB op          ("do it safely")
```
Manual entry and (later) Tell MamaHQ / voice / AI all converge on `resolveGroceryAction`
→ `planGroceryAction` → execution. Files: `lib/grocery/actions/{types,identity,duplicates,resolve-action,execute-action}.ts`.

## Validated Action contract
`{ type, proposal, targetItemId?, incrementBy?, resultingQuantity?, reason,
confidence, requiresConfirmation, confirmationChoices?, clientActionId }`.
Types: **ADD_NEW** (matched, nothing comparable) · **ADD_CUSTOM** (canonical-null,
not on list) · **INCREMENT_EXISTING** (same identity active) · **ADD_SEPARATE**
(same concept, meaningful conflict) · **REQUIRES_CONFIRMATION** (ambiguous / invalid
structure — never auto-mutates). `clientActionId` is a per-attempt UUID used for
idempotent execution.

## Duplicate identity
Two items are the SAME operational item iff their identity signatures match:
```
canonical id + sorted attributes + package size (value+unit) + package type
             + normalized unmatched modifiers
```
For canonical-null CUSTOM items, identity is the **normalized display name** only.
Canonical identity is the PRIMARY signal — display-name equality is not used once a
concept exists. Comparison is against ACTIVE items only (completed rows are never
touched — no resurrection; purchase history is never consulted).

## Attribute comparison
Same concept + different meaningful attributes (2% vs whole; red vs green; size 4 vs
5; boneless vs bone-in) → **ADD_SEPARATE**. Never silently merged. Attributes are the
concept-specific ones the resolver extracted and the concept declares.

## Package comparison
Same concept + different `package_size` (2L vs 4L; 500g vs 1kg) or `package_type`
(can vs case) → **ADD_SEPARATE**. Same package size + same concept → INCREMENT.

## Unknown modifiers
Unresolved words the user typed (e.g. "natrel", "kirkland") are preserved as
`unmatched_modifiers`. Same concept + different modifiers → **ADD_SEPARATE** — we
never discard something the user explicitly said. ("Natrel milk" vs "Milk" → separate.)

## Custom duplicate rules
Custom items are first-class. Duplicate detection uses **deterministic normalized
text equality** only (case/whitespace/punctuation/diacritics folded): "Purple Dragon
Cereal" == "purple dragon cereal" → INCREMENT. Unrelated custom text → ADD_CUSTOM. No
fuzzy merging of custom items.

## Quantity semantics
**ADD semantics only.** `incrementBy` = the proposal's stated count, or the
operational default **1** when unspecified. `resultingQuantity = existing +
incrementBy`. "2 milk" onto "Milk ×1" → +2 → 3; bare "milk" onto "Milk ×1" → +1 → 2.
The resolver keeps the honest distinction between explicit and unspecified quantity;
the Action layer applies the +1 default. Measure quantities ("1 kg", "4L") describe
the item's SIZE, not "how many", so they add a single line (increment by 1) and the
size is preserved as package detail. There is deliberately **no SET-quantity
language** — that's a future explicit action.

## Confidence / ambiguity
`proposal.ambiguous` (a known shared alias like `turnip`/`gummies`) →
**REQUIRES_CONFIRMATION** with candidate choices + "add as typed". `invalidStructure`
(a measure unit whose dimension the concept doesn't allow — "4 litres toilet paper")
→ **REQUIRES_CONFIRMATION** (add as a note), never persisting nonsensical structured
units. Everything else auto-resolves.

## Persistence contract (migration 0007)
`grocery_items` gained (operational snapshots, NOT catalog mutations; survive catalog
changes):
- `resolved_attributes jsonb` — `[{ attribute_id, value }]` (2%, size 4, red…).
- `package_size jsonb` — `{ value, unit }` | null (so "two 4L milks" keeps its 4L).
- `package_type text` — a package unit ('can','bag',…) | null.
- `unmatched_modifiers jsonb` — the user's unresolved words.
- `client_action_id text` — idempotency key of the last mutation on the row.
These provide machine understanding (duplicate comparison) + human continuity
(display snapshot in `display_name`). No column-per-attribute, no fake catalog rows.

## Idempotency & atomicity
`increment_grocery_item(p_item_id, p_delta, p_client_action_id)` (SECURITY DEFINER,
authorizes via `is_family_member(item.family_id)`) does the bump in ONE statement
(`quantity = quantity + delta` under `FOR UPDATE`) — no read-modify-write race. It is
**idempotent**: a repeat call with the same `client_action_id` is a no-op returning
the current quantity. **Verified live:** +1 then +2 → 4 (atomic); replaying the same
action id stays put (idempotent); a non-member call is rejected and the quantity is
unchanged. Inserts also carry a `client_action_id`. The formal offline mutation queue
is a later step; this gives correct behavior under simple retries today.

## Attribution & provenance
New items keep `added_by_person_id` (the acting household person). Increments do NOT
overwrite original attribution. Provenance stays `manual` / `autocomplete` — resolver
use does NOT mean AI (Tell MamaHQ will supply its own provenance later).

## UI integration
Two paths converge in `screens/grocery.tsx` `AddRow`: (A) pick an autocomplete result
→ canonical proposal; (B) type a natural phrase + Enter → Grocery Resolver. Both →
`addResolved(proposal)` → resolveAction → plan → execute. Feedback is a lightweight
toast ("Added Milk", "Milk → 3", "Added … separately"). REQUIRES_CONFIRMATION shows a
compact inline "Did you mean…" with candidate choices + "add as typed". Custom fallback
is always available; keyboard ↑/↓/Enter/Escape + touch preserved. Edit/remove/complete/
restore/completed section unchanged.

## Tests (`npm run test:grocery-actions`)
18 passed, 0 failed — the full decision matrix: ADD_NEW; same-canonical INCREMENT +1;
explicit-qty INCREMENT +2→3; different canonical ADD_NEW; attribute conflict
ADD_SEPARATE; colour conflict; diaper-size conflict; package-size conflict; same
package size INCREMENT; custom exact dup; custom non-dup; unknown modifier (Natrel)
ADD_SEPARATE + preserved; completed item ignored → ADD_NEW; ambiguous →
REQUIRES_CONFIRMATION; invalid unit → REQUIRES_CONFIRMATION; clientActionId present.
Resolver (38), Search (55), catalog (417/0) all remain green; tsc + `next build` pass.

## Not built (later)
Household Grocery Memory, usual brand/size/quantity, Usually/Recently Bought,
purchase-history ranking, correction memory, Tell MamaHQ, AI, Meals, realtime, offline
mutation queue, shopping mode, barcode, recurring/store intelligence.

## Recommended next step
Household Grocery Memory (usual product/size/quantity + brand learning) layered on top
of this proposal→action seam, and/or Tell MamaHQ using the same `resolveGroceryAction`
path. Not started.
