# Mama HQ — Information Architecture Review (Step 3)

Documentation only. No code changed. This reviews the **existing** IA against `PRODUCT.md`,
`SAFETY.md`, and the Step 2 journeys, then validates or challenges it. The rule for this step is
*review, don't restart* — the app already has a working IA, so we justify or refine it rather than
invent a new one.

Legend: `CURRENT` = exists today · `TARGET` = required, not yet built · `NO BACKEND` = later step.

---

## 1. Navigation — validated (with a deliberate challenge)

**Current primary navigation (CURRENT):** a fixed bottom tab bar with five destinations —
**Today · Baby · Inbox · Plan · Memories** (`components/app/bottom-nav.tsx`). This matches
`PRODUCT.md`'s mandated five and the 3:17 AM north star (thumb-reachable, few destinations).

### Challenge: should it be fewer than five?
I considered collapsing to four (merging **Baby** into **Today**, since Today already shows baby
status + quick logging). **Rejected.** Reasoning:
- **Today** answers *"what's happening right now / what must I remember"* — a glanceable home.
- **Baby** is the *history/detail* surface (the full log timeline, editing, corrections — Step 7).
Merging them would either bloat Today into a dashboard (violates "calmer, not busier") or bury
history. Keeping them separate keeps each screen single-purpose. **Five is correct.**

### Challenge: do Partner and Visits deserve tabs?
**No.** Adding them would make 6–7 tabs, crowding the thumb zone and diluting focus. They are
**contextual/secondary destinations**, not everyday hubs:
- **Visits** is reached *from an appointment* (in Plan/Today) — it's a mode you enter to prepare
  for a specific visit, not a place you live. It lives **adjacent to Plan**, opened from an
  appointment.
- **Partner** is set up occasionally and then mostly passive for Mom (she assigns; the partner
  acts). It lives in **Settings/Account-level space**, surfaced from Today when relevant
  ("2 things assigned to Matt"), not as a primary tab. (NO BACKEND until Steps 5/11.)
- **Settings / Account / Family** (profile, baby, sign-out, future export/delete, partner invite)
  live **outside the five tabs**, reached from a header affordance on Today.

**Decision: the five primary tabs stay exactly as they are. Partner, Visits, and Settings are
secondary destinations reached contextually.** This honors `PRODUCT.md` ("account/family/settings
live outside the primary nav; Partner and Visits may live adjacent to the five-tab nav").

---

## 2. Route map

### Public (unauthenticated)
- `/` — marketing landing (`app/page.tsx` → `components/mama-hq/*`). CURRENT.

### App (authenticated, gated)
- `/app` — the product shell (`app/app/page.tsx` → `components/app/mama-hq-app.tsx`). CURRENT.
  Currently a **single client route** that swaps tabs in state (not per-tab URLs).

### Auth / API
- `/auth/callback` — OAuth code exchange. CURRENT.
- `/api/state` (GET), `/api/log` (POST/PATCH), `/api/plan` (POST/PATCH), `/api/memory`
  (POST/DELETE), `/api/inbox` (POST). CURRENT.
- `proxy.ts` — session refresh middleware. CURRENT.

### Routing decision: keep tabs as in-app state, not nested routes (for now)
The app renders one gated route (`/app`) and switches tabs via React state. **Keep this for V1.**
- Pros: instant tab switches, one place owns state (`mama-hq-app.tsx`), simplest mental model,
  no per-tab data-loading complexity while everything comes from one `/api/state` fetch.
- Cons: no deep-linking to a tab, no browser back-between-tabs, tab not in the URL.
- **TARGET (revisit at Step 4/later):** if deep-linking or shareable sub-screens (a specific
  appointment, the Visit sheet, a memory) become valuable, promote to nested routes
  (`/app/today`, `/app/plan`, `/app/visits/[appointmentId]`, etc.). Not needed to hit the V1
  journeys; note it and move on.

**Secondary destinations (TARGET), when built:**
- Visit sheet — opened from an appointment; either a modal/sheet over Plan or `/app/visits/[id]`.
- Partner setup + "how to help" — under Settings/Account space; partner's own gated view later.
- Settings/Account/Family — a sheet or `/app/settings` opened from Today's header.

---

## 3. Screen hierarchy

```
/                      Public landing (SiteHeader, Hero, BrainDump, NinetyDays,
                       Features, ForMom, ShareLoad, CtaFooter)

/app  (auth gate)
 ├─ [signed out]  → SignIn (Continue with Google)
 ├─ [checking]    → Loading
 └─ [signed in]   → MamaHqApp shell
     ├─ Today      (home / glanceable status + quick log + today items + Mom check-in)
     │    └─ LogSheet (feed | diaper | pump)         ← also reachable from quick actions
     │    └─ [TARGET] Settings/Account entry (header)
     ├─ Baby       (history/timeline, editing, corrections)     [PARTIAL — Step 7]
     ├─ Inbox      (brain dump → proposal review → commit)
     ├─ Plan       (appointments+questions, tasks, questions, shopping lists)
     │    └─ [TARGET] Visit sheet (from an appointment)          [Step 12]
     │    └─ [TARGET] manual add/edit item                       [Step 9]
     └─ Memories   (add moment, list) + [TARGET] photos, timeline [Step 13]

[TARGET, secondary]
 ├─ Settings / Account / Family (profile, baby, partner invite, export, delete, sign-out)
 ├─ Partner setup + partner's "Here's how you can help today" view  [Steps 5/11]
 └─ Day-90 retrospective "Your First 90 Days"                        [Step 14]
```

---

## 4. Component hierarchy (current + planned)

**App shell (owns state + persistence):** `mama-hq-app.tsx`
- holds `AppState`, auth status, tab; exposes `Actions` (addLog, endSleep, commitCapture,
  updatePlanItem, addMemory, deleteMemory) to tabs. Tabs stay declarative.

**Primary tab components (CURRENT):**
- `today-tab.tsx` → uses `LogSheet`, status cards, quick actions, sections, "For you" check-in.
- `baby-tab.tsx` → history view (to be hardened in Step 7).
- `inbox-tab.tsx` → composer + proposal rows.
- `plan-tab.tsx` → grouped sections (appointments/tasks/questions/shopping), check toggles.
- `memories-tab.tsx` → add composer + memory rows.

**Shared within app:** `bottom-nav.tsx`, `log-sheet.tsx`, `sign-in.tsx`.

**Marketing (CURRENT):** `components/mama-hq/*` (landing only; not used inside `/app`).

**Planned components (TARGET):** `VisitSheet`, `PlanItemEditor` (manual add/edit), `PartnerSetup`
+ `PartnerHelpView`, `SettingsSheet`, `MemoryPhoto`, `Day90Retrospective`, `Onboarding`.

---

## 5. Shared UI primitives — consolidation opportunity

Today the app is hand-rolled Tailwind (clean, consistent), with only `components/ui/button.tsx`
from shadcn. Recurring patterns appear across tabs and should become **named primitives** in Step 4
to keep the growing surface consistent and fast to build:

- **BottomSheet** — the modal sheet pattern (currently only in `log-sheet.tsx`); reuse for Visit
  sheet, Settings, manual add.
- **Segmented** — the segmented control (currently local to `log-sheet.tsx`); used by feed/pump and
  future editors.
- **CheckToggle** — the round check control (currently local to `plan-tab.tsx`); used by Plan,
  Memories confirm, Partner tasks.
- **Section / SectionHeader** — the uppercase-tracked section header (reimplemented in several
  tabs); unify.
- **StatusCard**, **QuickAction**, **ListRow**, **EmptyState** — repeated shapes worth extracting.
- **AmountChips** (TARGET) — for the Flow B bottle-speed fix.

**Decision:** extract these into a small `components/app/ui/` set during Step 4 (a refactor, not a
rebuild — behavior preserved). Do not adopt the full shadcn suite wholesale; keep the bespoke warm
design, just DRY the repeats.

---

## 6. State requirements

**CURRENT:** a single `AppState` (`baby`, `logs`, `plan`, `captures`, `memories`) loaded once from
`/api/state` and owned by `mama-hq-app.tsx`. Mutations are **optimistic** (update local state, then
fire the API PATCH/POST). Relative times refresh on a 30s interval. Auth status drives
checking/signed-out/signed-in.

**Assessment:** appropriate for V1's data volume (single family, 90 days). Keep it.

**TARGET considerations (documented, not built):**
- As Partner Mode lands (Step 5/11), state may need light real-time/refresh so Mom sees a partner's
  completion (polling on focus, or Supabase realtime). Note it; don't build now.
- Active timers (feed session Step 7, sleep already) must derive elapsed from persisted timestamps,
  never from client-only counters, so they survive reload — this is a state *derivation* rule.
- Error/undo: optimistic updates need a consistent rollback + "Undo" affordance (Step 7).
- If routes are promoted per-tab later, consider per-surface data loading instead of one big fetch.

---

## 7. Responsive behavior

**CURRENT:** mobile-first. On phones the app is full-bleed; on ≥sm screens it renders a centered
`max-w-md` **phone-frame column** with a sticky bottom nav (decided in the earlier landing/app
split). The marketing landing is fully responsive (grid → single column on mobile).

**Decision:** keep the phone-frame-on-desktop approach — Mama HQ is a phone product; the desktop
frame reads as intentional rather than a stretched web app. Revisit only if a genuine desktop/
tablet use case appears (not a V1 goal).

---

## 8. IA decisions locked this step

1. **Primary nav stays exactly five:** Today, Baby, Inbox, Plan, Memories.
2. **Today ≠ Baby** stays split (glanceable home vs. history/detail).
3. **Visits** is a contextual mode opened from an appointment (adjacent to Plan), not a tab.
4. **Partner** lives in Settings/Account space + contextual surfacing, not a tab (NO BACKEND yet).
5. **Settings/Account/Family** live outside the five tabs, from Today's header.
6. **Routing:** keep single `/app` route with state-driven tabs for V1; promote to nested routes
   only if deep-linking/shareable sub-screens become necessary.
7. **Extract shared primitives** (BottomSheet, Segmented, CheckToggle, Section, StatusCard,
   QuickAction, ListRow, EmptyState, AmountChips) in Step 4 as a refactor.
8. **Keep single `AppState` + optimistic mutations**; add realtime only when Partner Mode needs it.
9. **Keep mobile-first phone-frame-on-desktop** responsive model.

## 9. Open questions (do not block Step 4)
- Should the Visit sheet be a modal over Plan or its own route (affects deep-linking/print)?
- Where exactly does the Day-90 entry point live — surfaced on Today near day 90, or its own
  Memories sub-screen?
- Confirm Settings is a bottom sheet vs. a route.
