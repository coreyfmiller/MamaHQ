# MamaHQ — Household Grocery Memory (Step 6)

The first household-learning layer for Grocery. Deterministic, private, and
conservative. **No AI/LLM/ML.** The purpose is quiet: MamaHQ gradually understands
what a grocery concept means *inside this household* so Mom doesn't have to keep
respecifying the same details.

> **Central rule:** household memory FILLS what the user did not say. It NEVER
> overrides explicit input.

## The three layers (kept strictly separate)

| Layer | Question it answers | Where it lives |
|---|---|---|
| **Global Catalog** | "What is this thing generally?" | `lib/grocery/catalog` + `canonical_items` (global, read-only) |
| **Global Resolver** | "What did the user explicitly ask for?" | `lib/grocery/resolver` (pure, household-independent) |
| **Household Memory** | "What does THIS household usually mean when info is omitted?" | `lib/grocery/household` + `household_items` (family-scoped) |
| **Action Resolver** | "Given the enriched proposal + list, what happens?" | `lib/grocery/actions` (unchanged) |

The global Resolver stays globally deterministic — `resolveGroceryPhrase("milk")`
returns the same thing for every household. Household meaning is layered on
*afterwards* by enrichment. This separation matters for testing, explainability,
future AI, multiple households, catalog correctness, and privacy.

## The pipeline (Step 6 extension)

```
User Phrase
 → Global Resolver          → ProposedGroceryItem      (what the user said)
 → Household Enrichment      → HouseholdEnrichedProposal (blanks filled, provenance kept)
 → Action Resolution         → ValidatedGroceryAction
 → Execution                 → Grocery Item
 → Completion                → Purchase Event  +  Household Observation  +  derived state
```

## Historical truth vs current knowledge (do not conflate)

- **`purchase_events`** — *historical fact*: what was purchased, when. An immutable
  snapshot (Step 6 expanded it with the structured grocery identity). Never mutated
  when preferences later change.
- **`household_item_observations`** — *evidence*: what a specific purchase told us.
  Each row traces to the `purchase_event` that produced it (auditable). Idempotent
  (unique on `(household_item_id, purchase_event_id)`).
- **`household_items`** — *current derived/explicit knowledge*: what the household
  usually means by a concept *today*. Materialized; the enrichment hot path reads
  this, never years of history.

## Multiple household variants

A household may legitimately buy several versions of one concept (2% 4L milk,
lactose-free 2L, chocolate). Each is a `household_items` row, distinguished by the
**same structured identity Step 5B uses** for duplicate handling
(`c:<id>;a:<attrs>;ps:<size>;pt:<type>;m:<mods>`, or `custom:<label>`). Insignificant
metadata never forks a new variant. One variant *may* be the concept's default
(`is_default`), enforced to at most one per `(family, canonical_item_id)` by a partial
unique index.

## Learning (conservative, deterministic)

Evidence tiers by consistent observation count (mirrored in SQL
`household_evidence_state` and TS `learning.ts`):

| Observations | State |
|---|---|
| 1 | `observed` |
| 2 | `emerging` |
| 3+ | `established` |
| explicit "make usual" | `user_set` (strongest; no 3-buy wait) |

**Default selection (no fake certainty):**
- a `user_set` variant is the default;
- else if exactly **one** established (≥3) variant exists → it is the default;
- else (zero established, OR **two+** established and none explicit) → **no default**;
  ambiguity is preserved. We deliberately do **not** use recency to invent a default
  among multiple established variants. "I don't know yet" beats a confident wrong guess.

## Explicit preference — "Make this my usual"

`set_household_usual(household_item_id)` marks a variant `user_set` + `is_default`
and clears `user_set`/`is_default` on sibling variants of the same concept (one
default rule). It's stronger than passive learning and immediate.
`clear_household_usual(...)` reverts to passive state and recomputes the default.
Minimal UI: a star control on a *bought* item in the Grocery screen.

## Enrichment precedence (field by field)

```
explicit current user input
  > explicit household preference (user_set)
  > established learned household memory
  > global/default
```

`enrichProposalWithHouseholdMemory(proposal, memory)` (pure) fills ONLY blank fields
from the default variant and records **provenance** per field
(`explicit | household_explicit | household_learned | none`) so nothing is silently
mutated. Examples (household usual = 2% / 4L):

| Input | Result |
|---|---|
| `milk` | 2% + 4L filled from memory |
| `1% milk` | **1% kept**; 4L may fill the missing size |
| `2L milk` | **2L kept**; 2% may fill the missing attribute |
| `1% 2L milk` | both kept; nothing filled |
| (household ambiguous) | nothing filled; `ambiguousHousehold = true` |

## Unknown / custom items

Custom items (`canonical_item_id = null`) are first-class. Their household variant is
keyed by normalized label (exact key only — vaguely similar names never merge). A
custom variant only enriches when it is an explicit `user_set` preference; passive
history never silently reshapes a typed custom item.

## Restore reverses learning

Completion creates a purchase event + observation + derived-state update — all in one
atomic RPC. **Restore reverses all of it**: it deletes the purchase event, deletes
the derived observation, recounts from the ledger, recomputes evidence state, and
recomputes the concept default (dropping it if evidence falls below established). An
accidental completion never permanently trains the household.

## Atomicity & idempotency

- Completion is one server-side transaction. Repeat completion of an already-completed
  item returns the existing `completion_id` and does **no** further work → no duplicate
  events, no duplicate observations, no double-counting.
- Observations are unique per `(household_item_id, purchase_event_id)`.
- Restore is idempotent (already-active is a no-op). Re-complete after restore creates
  exactly one new event + observation.

## Security / privacy (RLS)

`household_items` and `household_item_observations` are family-scoped private data with
`is_family_member(family_id)` RLS (same boundary as every other table). **Assigned
Person ≠ Authorized User** is preserved — authorization derives from
`family_members`, never from a person row. New `SECURITY DEFINER` functions
(`set_household_usual`, `clear_household_usual`, `recompute_household_default`,
`upsert_household_variant`, and the rewritten `complete/restore_grocery_item`) pin
`search_path = public`, authorize from the row's own family, and grant EXECUTE only to
`authenticated`. **No purchase history or preferences are ever sent to an LLM.**

## Performance

Household memory is loaded once per family at the store boundary and cached +
indexed (`Map` by canonical id). Enrichment is an in-memory lookup — **no network
call per autocomplete keystroke**. Search/Resolver stay local and fast. Memory is
refreshed only after events that change learning (completion / restore / make-usual).

## Current limitations (Step 6 scope)

- Enrichment fills package size, package type, and attributes; brand/store fields
  exist on the model but are filled only when a variant carries them (brand/store
  parsing from the phrase is not part of Step 6).
- Default selection is intentionally conservative; recency is available as a
  tie-breaker in code but is not used to break ambiguity among established variants.
- Enrichment respects whatever the Resolver captured. A measure size is now
  preserved regardless of position (e.g. "1% 2L milk" == "2L 1% milk"), so an
  explicit size stated after an attribute is never overwritten by household memory.
- No "Usually Buy" screen, shopping mode, store ordering, or barcode (deferred).
- Second authenticated household adult still not implemented (Step-6 memory is
  family-scoped and works for the single owner today).
