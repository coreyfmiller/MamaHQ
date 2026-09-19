# MamaHQ — Current Product Limitations

An explicit, honest statement of what does **not** exist yet, so future work (and
future readers) never assume these capabilities are present. This complements
`docs/TECHNICAL_DEBT.md` (which tracks the path forward) — this file is the "as-of
today, this is NOT here" record. Verified against the actual codebase in Step 5C.

Do not describe any of the below as implemented in docs, UI copy, marketing, or bot
knowledge until it actually ships.

| Capability | Status | Reality today |
|---|---|---|
| **Second authenticated household adult** | IMPLEMENTED (Step 7) | Secure invitations (hashed one-time token, expiry), transactional acceptance that links the existing person and joins the same household, invitation-aware bootstrap, People UI with account status, and hardened membership/identity RLS. One active household per user; member-removal workflow deferred. See `docs/HOUSEHOLD_MEMBERSHIP.md`. |
| **Realtime sync** | NOT IMPLEMENTED | No Supabase realtime subscriptions. Changes require a manual refetch; a second device won't live-update. |
| **Offline support** | NOT IMPLEMENTED | No IndexedDB, no offline state, no mutation queue, no reconciliation. Online-only. |
| **Care Handoff — external delivery** | NOT IMPLEMENTED | Assignment exists; no SMS/email/WhatsApp/iMessage/share is sent. `lib/notify.ts` is a no-op seam. |
| **Care Handoff — acknowledgment** | NOT IMPLEMENTED | No "I've got it", no receipt, no authenticated recipient. |
| **LLM-powered Tell MamaHQ** | NOT IMPLEMENTED | Capture uses deterministic rule-based extraction only. `openai` is a dependency but is imported nowhere. |
| **Tell MamaHQ → Grocery integration** | NOT IMPLEMENTED | Capture does not feed the Grocery resolver; no multi-item grocery parse from free text. |
| **Meals** | NOT IMPLEMENTED | No tables, domain, or UI. |
| **Kitchen** | NOT IMPLEMENTED | No such surface. |
| **Contextual Assistant** | NOT IMPLEMENTED | No assistant; depends on LLM + cross-person awareness that don't exist. |
| **Household Grocery Memory (Step 6)** | PARTIAL (infra implemented) | Step 6 added `household_items` (variants), an observation ledger, conservative learning + thresholds, explicit "Make this my usual", enrichment that fills blanks without overriding explicit input, and restore-reversal — all family-scoped with RLS. Not yet surfaced as a "Usually Buy" screen; brand/store enrichment deferred. See `docs/HOUSEHOLD_GROCERY_MEMORY.md`. |

## Related known gaps (see TECHNICAL_DEBT.md)

- **PurchaseEvent snapshot** now captures `canonical_item_id`, `resolved_attributes`,
  `package_size`, `package_type`, and `unmatched_modifiers` (resolved in Step 6,
  migration 0008) — the prerequisite for Household Grocery Memory is satisfied.
- **Usually Buy / Recently Bought, Shopping Mode, store ordering, barcode** — none
  exist.

## What DOES exist (for contrast)

So this file isn't misread as "nothing works": the Grocery intelligence stack
(catalog → search → resolver → action resolution → domain execution → completion →
purchase event) is implemented, deterministic, and covered by automated tests; auth
(email OTP), the single-owner family/household model, and the manual Grocery list
(add/autocomplete/duplicate/edit/complete/restore) are implemented. See the Step 5C
report and the Situation Report for the full status matrix.

## Note on FundyLogic / Vapi

Some repository steering describes a **FundyLogic** voice-bot (Vapi) content-sync
governance rule. **That is a different project.** MamaHQ has **no Vapi voice bot**,
no `@vapi-ai/*` dependency, and no voice-bot content to keep in sync. The FundyLogic
Vapi rule does **not** apply to MamaHQ. (MamaHQ's only "voice" feature is on-device
speech capture for Tell MamaHQ, which is unrelated to Vapi.)
