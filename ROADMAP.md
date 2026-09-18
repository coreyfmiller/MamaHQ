# MamaHQ — Roadmap & Deferred Work

## 🎯 THE CORE — what we're driving toward
MamaHQ is the family's operating system, with **Mom kept visible**. It is not a
baby tracker; the baby is one area of a shared household brain. Every feature
decision gets checked against this table. The **Contextual Assistant** is the
connective tissue that makes the separate areas behave like one system.

| Area | Primary job | Example | Status |
| --- | --- | --- | --- |
| **Tell MamaHQ / AI Inbox** | Get things out of Mom's head instantly | "We're low on diapers, dentist Tuesday, and remind James to grab milk." | 🟡 Capture→review→commit shipped w/ a rule-based extractor + voice/photo sources. AI (Gemini) extractor not wired. Doesn't yet route to grocery/meals (don't exist). |
| **Shared Calendar** | Know what's happening and who owns it | Appointments, daycare, activities, birthdays, family plans | 🟡 Appointments exist (create/edit/delete + questions, cloud-backed). Not yet a true shared *calendar* (no owner-per-event, no daycare/activity/birthday types, no month view). |
| **Tasks & Ownership** | Move responsibility to the right person | "James owns groceries this week." | 🟡 Mom tasks + partner hand-off (assignee='partner') shipped; Inbox "Handed off" tab tracks them. Real per-person ownership needs full-user partner (Tier 2) + the permissions model. |
| **Grocery** | Maintain one intelligent shared shopping list | Items added from voice, meals, family members, recurring needs | 🔴 Not built. Should be an Inbox commit target + a store, shared across the family. |
| **Meals** | Remove the "what are we eating?" decision | Weekly meals → recipes → ingredients → grocery | 🔴 Not built. Feeds the grocery list (meal → ingredients). Biggest new surface. |
| **Baby / Care** | Keep essential baby info + caregiver context | Feeding, sleep, diapers, notes, handoffs, appointments | 🟢 Core done: logs (feed/sleep/diaper/pump/med), baby profile, memories, appointments — cloud-backed. Multi-caregiver context arrives with full-user partner. |
| **Mom / First 90 Days** | Keep Mom visible | Contextual content, check-ins, recovery/wellbeing, identity, support | 🟢 Strong: daily affirmations + the 90-day daily read (audited editorial collection), Me-tab mood check-ins + her own tasks/questions. Recovery/wellbeing depth + support resources can grow. |
| **Contextual Assistant** | Connect everything | Knows what's coming, what's unfinished, what can be handled | 🔴 Not built. The unifying layer: reads across calendar/tasks/grocery/meals/baby to surface "what needs you now" + suggest hand-offs. Depends on the areas above existing. Powered by `gemini-flash-latest` (per steering); NO medical/clinical advice. |

Legend: 🟢 solid · 🟡 partial/foundation exists · 🔴 not built yet.

**Build order implication (my read):** the assistant is last because it needs
something to connect. Grocery + Meals are the biggest missing surfaces and they
chain (meals → ingredients → grocery), so they're the highest-leverage next builds.
Tasks/Ownership and the Shared Calendar mostly need *deepening* (per-person
ownership, event types) rather than net-new. The AI Inbox is the natural front
door to grocery/meals once they exist (voice → "add milk" → grocery list).

### Product philosophy (the spine — protect these)
- **"Tell MamaHQ" is the front door, not a feature.** Mom never has to know which
  module something belongs to. One sentence — typed or spoken — fans out into
  grocery + calendar + appointment questions + meals, and MamaHQ replies "I've got
  it." This multi-domain routing is the SIGNATURE experience.
- **Ownership moves mental load; it doesn't digitize a to-do list.** The win is
  "James owns groceries" (he gets the reminders, knows the schedule, handles
  exceptions — Mom is NOT notified unless there's a genuinely good reason), not
  "☐ groceries — James". Three distinct concepts: **Task** (do once), **Recurring
  responsibility** (happens repeatedly), **Ownership** (a person is accountable for
  an area).
- **The product's home sentence: "Nothing else needs your attention tonight."**
  Almost every family organizer tells Mom what to DO. MamaHQ should increasingly
  tell her what she can STOP thinking about. Content included: some days the useful
  thing is "quieter morning, nothing till 2:30, James has groceries — you don't need
  to do anything here," NOT another article.
- **Baby/Care stays lightweight on purpose — do NOT become Huckleberry.** Basic
  tracking (feed/sleep/diaper/med/growth/notes) because users expect it, but the
  real gem is **Care Handoff**: hand Sophie to James with a one-glance state card
  (last feed 6:15, last diaper 6:40, nap ended 5:20, next bottle in fridge, "a
  little fussy tonight") ending in "James has it from here" so Mom can mentally
  clock out.
- **Meals + Grocery are basically ONE system; don't overbuild recipes.** Meals just
  answers "what are we eating this week?" (Mon spaghetti, Tue tacos…). Tap a meal →
  add its ingredients to the one shared grocery list; Mom unchecks what she has.
  Recipe depth is later.
- **The Contextual Assistant is NOT "ChatGPT inside MamaHQ."** It understands the
  STRUCTURED state of the household (calendar + tasks + ownership + grocery + meals
  + baby + Mom + history). "What's going on tomorrow?" → a briefing that ties
  everything together AND ends in reassurance. Great AI here **ends in action**
  ("add these 4 dinners to the plan," "add ingredients to groceries"), not chat.

### Frozen scope (agreed)
- **NOW:** Tell MamaHQ, Shared Calendar, Tasks/Ownership, Grocery, Meals,
  lightweight Baby/Care, First 90 Days, Contextual Assistant.
- **NEXT:** caregiver handoffs, voice everywhere, widgets/live activities, deeper
  calendar integrations, recurring household intelligence, documents, photo
  intelligence (school notice→event, recipe→meal+ingredients, empty box→grocery).
- **LATER:** budgeting, photo memories, location tracking, school management,
  advanced sleep analytics, family messaging.

### ⚠️ Concerns / dependencies (RESOLVED via Kiro↔ChatGPT synthesis — see below)
1. ~~Ownership + Care Handoff REQUIRE full-user partner~~ → **CORRECTED.** Both can
   exist BEFORE accounts. Ownership = a **Person** (household member, nullable account)
   can be *assigned* ownership now ("James — Groceries · Invitation pending") and
   become *connected* ownership when he joins ("Connected ✓", reminders route to him).
   Honest as long as the UI shows assigned-vs-connected. Care Handoff v1 = generate a
   handoff card + OS **share sheet** (iMessage/WhatsApp) — James needs no app; the
   in-app "accept → James has baby ✓" version comes later. Principle: **don't confuse
   the ideal networked version with the minimum useful version.**
2. **"Tell MamaHQ" multi-domain routing NEEDS the Gemini extractor + backend — still
   true, and now ELEVATED above most UI work.** Refined architecture: the LLM is an
   **interpreter, not a database administrator**. Input → AI interprets → **structured
   proposed actions** → **validation** (date resolved? person resolved? duplicates?
   required fields? calendar conflict?) → domain services execute → confirm ("Got it.
   ✓ Diapers added ✓ Doctor appt ✓ Rash question saved ✓ Tacos planned"). This is our
   existing Inbox seam (`Extractor → ProposedItem[] → commit`) extended to more domains
   + a real validation stage. Key stays server-side; `gemini-flash-latest`.
3. **"Nothing else needs your attention tonight" — earn it with CONFIDENCE-TIERED
   language (better than "stay quiet").** Doctrine: **MamaHQ must never claim certainty
   it doesn't possess.** High confidence → "You're clear for tonight." Medium →
   "Nothing else *in MamaHQ* needs your attention tonight." Low → "Here's what MamaHQ
   has for tomorrow." Quiet sync indicator ("Updated just now ✓"). Strong reassurance
   is earned as MamaHQ becomes the family's source of truth.
4. **Meals — start DETERMINISTIC.** Static ingredient template per meal; Mom removes
   what she has. "Intelligence" = a **saved preference**, not ML: first time she edits
   the taco list → "Use this list next time? ✓". No learning infra.
5. **Critical-path unlock RE-FRAMED:** not "Tier-2 partner" specifically but the
   **HOUSEHOLD / Person model** (see architecture below). Get the *schema shape* right
   now so we never rip it apart; build the permissions/account depth incrementally,
   pulled by features — NOT as a big upfront system (avoids over-abstracting for the
   nanny/teenager before the partner is validated).

### 🏗️ ARCHITECTURE SHIFT — design MamaHQ as a SYSTEM, not screens
The real progress: the product underneath the screens is **People + responsibilities
+ time + household information + context + intelligence.** Screens (Calendar, Grocery,
Meals, Baby, Mom) sit OVER three foundational systems. Build these incrementally,
pulled by shipping features — they're a design lens, not three big upfront rewrites.

- **Household Graph** — who the people are, their relationships, account status,
  permissions, what they OWN. A **Person**: identity, relationship, account status
  (none/invited/connected), permissions, responsibilities, notification prefs. Scales
  Mom + Partner → grandparent, teen, babysitter, nanny, other caregivers, kids.
- **Action Engine** — everything MamaHQ knows needs to happen: Task / Event / Grocery
  / Meal / Reminder / baby-care item / appointment question. Each has an **owner**, a
  **when**, and a **state**. Three ownership concepts: **Task** (do once), **Recurring
  responsibility** (repeats), **Ownership** (a person accountable for an AREA).
- **Context Engine** — what MamaHQ knows right now: today, tomorrow, baby, Mom,
  household, outstanding responsibilities, recent activity, relevant content. This is
  what the Contextual Assistant reads from (grounded retrieval over structured state,
  NOT an autonomous agent).

"Tell MamaHQ" sits over all three.

### 🧭 AGREED BUILD SEQUENCE (defended order)
1. **Person/Household model + schema shape** — introduce a `people` table (household
   members, nullable `user_id`, role, ownership) and make new features write against
   it. NOT the full permissions system — just get the shape right so nothing needs a
   teardown later. (Kiro's sharpening of ChatGPT's "step 1".)
2. **Real "Tell MamaHQ" AI extraction** (interpreter→proposed actions→validate→execute
   →confirm). The signature experience; don't postpone.
3. **Connect extraction to Calendar + Tasks + Grocery + Meals** — one sentence
   genuinely manipulates the household. (Requires Grocery + Meals stores to exist —
   build those deterministic surfaces here.)
4. **Full partner account / invite** — another person participates directly.
5. **Ownership** (assigned → connected), now that the foundation is real.
6. **Care Handoff** — share-sheet version can ship earlier; connected version shines
   here.
7. **Contextual Assistant** — grounded retrieval over structured MamaHQ data first,
   not a giant agent.
8. **Confidence / reassurance layer** — only once context is reliable do we say
   "Nothing else in MamaHQ needs your attention tonight."

Note: steps 2–3 and the deterministic Grocery/Meals surfaces are NOT blocked on the
Person model beyond step 1's schema shape — so there's parallelism available.

---

Live at https://mamahq.vercel.app/app (auto-deploys on push to `main`). Backend
foundation (Supabase auth) is in; app DATA is still localStorage until the cloud
migration lands. This file tracks deferred work + reasoning.

## ▶️ TOMORROW — START HERE (fixes the sign-in email rate limit for good)
Blocked: Supabase's DEFAULT email sender is throttled to ~2–4/hr, so magic-link
sign-in hits "email rate limit exceeded" during testing. Admin-generated login
links were tried TWICE and abandoned — root cause: `@supabase/ssr` uses the PKCE
flow, and admin `generateLink` verify/hash links don't match it, so the session
never completes. Don't reopen that path.

THE FIX (Path A — permanent, ~10 min total):
1. Corey: create a free **Resend** account (resend.com) → API Keys → create → copy `re_…`.
   For sending, quickest is the built-in `onboarding@resend.dev` (only emails your own
   address — fine for testing) OR verify a domain for real sending.
2. Corey: in **Supabase dashboard → Project Settings → Authentication → SMTP Settings** →
   enable custom SMTP with Resend's SMTP creds (host `smtp.resend.com`, port 465, user
   `resend`, password = the `re_…` API key, sender = your from-address). This is the piece
   that removes the rate limit. (Alternatively raise Auth → Rate Limits, but SMTP is the real fix.)
3. Then normal "enter email → magic link" works instantly, no limit. Same Resend account also
   powers the Dad/partner email channel (below), so this unblocks two things at once.
Note: DB is currently EMPTY (all tables + users wiped) — next real sign-in = clean first-run,
so onboarding should set the correct birth date / Day count (the stale "Day 21" is gone).

## 🔑 NEEDS YOU — external accounts to unblock features
These are the ONLY things blocked on the user; everything else is buildable.

### Twilio + Resend (to turn on Dad/partner message delivery — Tier 1)
Partner store, screen, and Notifier seam are DONE. Only real send remains. To unblock:
- **Resend (email, free, ~5 min):** resend.com → sign up → API Keys → Create (copy `re_…`,
  shown once). Sender: quick = `onboarding@resend.dev` (only emails your own signup address);
  real = add + DNS-verify a domain under Domains.
- **Twilio (SMS, ~$15 free trial):** twilio.com/try-twilio → sign up → verify your phone →
  Console shows **Account SID** (`AC…`) + **Auth Token**; Phone Numbers → Buy a number (SMS-
  capable, `+1…`). Trial can only text numbers you add under Verified Caller IDs (upgrade to
  text anyone).
- Then put in `.env.local` (I'll add to Vercel): `RESEND_API_KEY`, `RESEND_FROM`,
  `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`.
- Then I build `/api/notify` (Twilio+Resend), swap `lib/notify.ts` notifier to the real
  provider, add the "hand off to Dad" action. Email-only first is fine if Twilio trial is fiddly.

## ⚠️ NEEDS TESTING / VERIFICATION (deferred, come back to these)
Built but NOT yet verified end-to-end by a human. Revisit before relying on them.
- [x] **Magic-link sign-in (live)** — VERIFIED. Real sign-in works; fixed the empty
      family_members bug it surfaced.
- [ ] **Voice capture on a real phone** — on iOS Safari AND Android Chrome: does the mic prompt
      appear; does speech transcribe live; does it keep listening through a pause; does Stop →
      editable transcript → "Sort it out" land items in Inbox review? Note which browser if it
      breaks (Web Speech support varies; server STT is the fallback plan).
- [ ] **Photo OCR on a real phone** — take a photo of a real note/appointment card: does the
      camera open, does the progress bar show, does readable text come back and land in Inbox
      review? Note device/OS if OCR is poor (server/vision OCR is the fallback).
- [ ] **Inbox extraction quality** — type several real brain dumps and check the proposed items
      are right (feed/diaper/sleep/appointment/task/question routing + amounts/times). The real
      upgrade is the Gemini extractor (below); log bad parses here as examples to test against.
- [ ] **Full-app cloud verification pass** — once, end to end while signed in: onboarding →
      babies row; appointment + question → both tables; mom mood/to-do → mom_moods/mom_items;
      memory → memories; partner → partner_contacts; then a SECOND device with same email sees it
      all (cross-device sync); then Start-over wipes the cloud rows. (Feed-log path already
      verified.)
- [x] **Appointment-question orphaning bug** — FIXED. Two parts: (1) the extractor now splits on
      commas (protecting "<day>, <time>") so "doctor Thursday, ask about rash" becomes an
      appointment + a question; (2) commit.ts commits appointments first, then attaches
      same-capture questions to that appointment's "questions to ask" list (falls back to Mom's
      general list only when no appointment was captured). Verify live once tested.

## Done
- [x] **Sleep tracking** — retroactive "log a past sleep" (from/to pickers) as the primary path,
      plus a live "Start now" timer. Today shows "Sleeping · Xh Ym" live; Stop opens an editable
      wake-time confirm (forgives forgotten stops); a "still asleep?" nudge appears after ~10h
      instead of silently counting. Durations survive reload (computed from timestamps).

## Next (agreed order)
- [x] **Me tab check-in + mom's items** — mood check-in saves per-day (localStorage `mom.v1`);
      mom's to-dos and doctor questions are real (add inline / check off / remove). Reset wipes
      them too. NOTE: "Coming up" appointment on Me is still fixture data — folded into #5 below.
- [x] **Memories** — add a photo (+ optional caption), persist, delete. Photos downscaled to
      ~640px JPEG (shared `downscaleImage` in lib/utils, also used by onboarding) to stay within
      the localStorage quota. Real grid + empty state on the Memories overlay and the Baby →
      Memories sub-tab. Reset wipes them. Store: localStorage `memories.v1`.
- [x] **Appointments** — create/edit/delete appointments (title, datetime, optional location,
      reminders toggle) with per-appointment "questions to ask" (add/check-off/remove). Store:
      localStorage `appointments.v1`. Composer screen (`appt-compose`), real detail screen
      (`appointment`) with delete confirm. Wired into Today "Coming up" (next appt + open-question
      count, or add prompt), Me "Coming up", and the Upcoming list (this week / later, real add).
      Reset clears them. NOTE: "reminders" is a stored toggle only — no real notifications yet
      (needs backend/push; see deferred). Upcoming calendar-dots mock was dropped for a real list.

## Deferred detail
- Reminders are display/intent only — actual scheduled notifications need a backend/push (tied to
  the Backend/accounts item). The toggle persists user intent for when that lands.

## 🛡️ OWNERSHIP & PERMISSIONS MODEL (decided direction; enforce with Tier-2 partner)
Guiding value: **Mama owns everything. A partner is a revocable helper — "men may come or
go." His presence only ADDS help; his absence never SUBTRACTS anything of hers.** Ownership is
non-transferable; a partner can never become owner.

Permission matrix (enforce in RLS, gated on family_members.role, when full-user partner ships):
- Owner (Mama): everything — add/edit/delete all data, reset/start-over, delete account, add a
  partner, set their access, and REMOVE a partner instantly (no confirmation from him, no notice).
- Partner (member): can SEE shared baby data (if Mama enables) and ADD logs / complete handed-off
  tasks. CANNOT: delete or edit Mama's data, edit the baby profile, reset/start-over/delete
  anything family-wide, remove Mama or another partner, export/take data. CAN remove himself
  (just leaves) — which deletes NOTHING (his added logs/memories belong to the family, they stay).
- Removing a partner (by Mama, or he leaves): access ends immediately; all data he added remains.
- Enforcement must be at the DATABASE (RLS role checks), not just hidden UI — a real guarantee.
- Family always has exactly one owner; role can't be reassigned to a member.

Two OPEN QUESTIONS (Corey to decide when energy allows; my recommendations noted):
1. Is the "Me" tab (Mama's moods, her own doctor questions, check-ins) fully PRIVATE from a
   partner, even a full user? → RECOMMEND YES (private). It's her space; she shouldn't have to
   scrub reflections when someone leaves.
2. Partner writes: append-only, or edit/delete his own additions? → RECOMMEND (a) append-only
   (add but never edit/delete anything) — simplest, safest, no quiet alterations.

Buildable NOW (safe, front-end, no new roles): reassuring ownership COPY on the Partner screen and
the reset/"Start over" screen — e.g. "You own everything here. A partner can help, but can never
delete your data or reset your account — and you can remove them anytime, which never deletes
anything you've saved." (Not yet built — pending the two answers above, though copy could ship
regardless.)

## Backend track (in progress)
- [x] **Auth foundation** — Supabase magic-link sign-in, family auto-created on first sign-in,
      auth gate, sign-out. VERIFIED LIVE (real sign-in works; caught + fixed an empty
      family_members bug that was blocking all writes via RLS).
- [x] **Cloud data migration** — all stores (profile/baby, logs, appointments+questions, mom,
      memories, captures, partner) read/write Supabase when signed in, localStorage fallback when
      signed out; optimistic writes; reset wipes cloud family data. VERIFIED: a logged feed
      lands in the `logs` table. Data layer in `lib/supabase/data.ts`. (First-sign-in local→cloud
      import was intentionally skipped — start fresh in cloud.)
- [~] **Dad as contact (Tier 1)** — DONE except real delivery: partner store (cloud-backed
      `partner_contacts`), a real Partner screen (add/edit name/phone/email + SMS/email notify
      toggles, remove), a Notifier seam (`lib/notify.ts`, no-op provider), AND the hand-off flow:
      task `assignee` ('partner') on `mom_items` (migration `0007_task_assignee.sql`, applied),
      `addTaskAssigned()` in `mom.tsx` firing the notifier best-effort, a "Hand off to [Partner]"
      option on the + / Quick Log screen, and a "Handed off" tab in the Inbox that tracks each
      duty (done toggle + remove + honest "delivery not on yet" note).
      REMAINING (needs accounts): a `/api/notify` route calling **Twilio** (SMS) + **Resend**
      (email), then swap `notifier` in `lib/notify.ts` to the real provider — no UI/caller
      changes needed. Needs: Twilio account + number; Resend key. Email-only first is fine.
- [ ] **Dad as full user (Tier 2)** — invite flow, link his account to the same family/baby.
- [ ] **Real reminders** — scheduled sends (cron/queue) once messaging exists.
- [ ] **Gemini extractor** — swap local extractor for AI behind the same `Extractor` seam
      (per gemini-flash-latest steering). AI chat-back intentionally OUT for now (medical-advice risk).

## Hard / deferred (need design or backend)

### Inbox — capture → review → commit (SIGNATURE FEATURE) — BUILT (local extractor)
- Real pipeline shipped. Architecture (the durable part):
  - `components/mama/inbox/types.ts` — stable contracts: `ProposedItem` (log/appointment/task/
    question/note) + `Extractor` interface `(rawText) => ProposedItem[] | Promise<...>`.
  - `components/mama/inbox/local-extractor.ts` — deterministic rule-based extractor (clause
    splitting, time parsing, feed/diaper/sleep/pump/med/appointment/task/question classification).
    Free, private, testable. Implements `Extractor`.
  - `components/mama/inbox/store.tsx` — persisted captures (localStorage `captures.v1`),
    status proposed|committed|dismissed, edit/toggle proposed items.
  - `components/mama/inbox/commit.ts` — `useCommit` maps approved items → real stores
    (logs/appointments/mom). The ONLY place proposals meet concrete stores.
  - Inbox UI: composer (type; mic/camera route to voice/photo), "To review" editable checklist
    per capture, "Added" history. Voice/Photo are wired sources emitting placeholder text
    (no STT/OCR yet) so the same pipeline runs end to end.
- SWAP TO AI LATER: implement a `GeminiExtractor` against the same `Extractor` interface and
  point `store.tsx`'s `extractor` const at it (via a backend route, per gemini-flash-latest
  steering). Nothing else changes — review queue + commit are provider-agnostic.
- VOICE IS REAL: `components/mama/inbox/transcribe.ts` defines a `Transcriber` capability seam
  with a browser Web Speech provider (`webSpeechTranscriber`). Voice screen live-transcribes,
  shows interim text, lets you edit the transcript, then `addCapture(text,'voice')`. Graceful
  fallback to a text box when unsupported (e.g. Firefox) or mic permission is denied. Swapping
  to server STT (Whisper/Gemini) later = new provider behind the same seam, no UI change.
- PHOTO IS REAL: `components/mama/inbox/ocr.ts` defines an `Ocr` capability seam with a
  Tesseract.js provider (`tesseractOcr`, pinned tesseract.js@7.0.0, dynamic-imported so the
  heavy bundle only loads on first capture; worker cached across calls). Photo screen: take/
  choose a photo (file input capture="environment"), downscale, OCR with a progress bar, then
  an editable review of the extracted text → `addCapture(text,'photo')`. Falls back to typing
  when OCR finds no text or errors. Swap to server/vision OCR later behind the same seam.
  NOTE: pnpm blocked tesseract.js's postinstall build script (ERR_PNPM_IGNORED_BUILDS) — that's
  fine, browser usage loads worker/core from CDN at runtime; no approval needed.
- STILL TODO for full fidelity: the Gmail source — just feeds `addCapture(text, 'gmail')`
  (needs backend/OAuth). Same capability-provider pattern.

## Platform shape (keep this discipline)
SOURCES (type/voice/photo/gmail) → normalize to raw text → Extractor (local now, Gemini later)
→ commit into real stores. Capabilities (transcribe, OCR, extract) are swappable providers
behind interfaces; sources are thin adapters that call addCapture(text, source). Local/free
now, server/AI later, with no UI churn.

### Gmail integration (watch inbox for appointments, etc.)
- Feasible but OUT OF SCOPE now — it breaks the no-backend model. Requires:
  - Google Cloud project + OAuth consent screen; Gmail read scopes need Google verification/
    security review before more than a few test users.
  - A server to hold tokens and run the watch. Gmail push (`watch` API) needs a Google
    Pub/Sub topic + a public webhook endpoint — cannot live in the browser/localStorage.
  - An extraction layer (same parsing/AI work the Inbox needs anyway).
- Plan: build local capture sources first; when ready, Gmail becomes just another source
  feeding the same Inbox review queue.

### Backend / accounts (the thing that unlocks the above)
- Everything is localStorage today: single device, no sync, no real accounts.
- The deleted Supabase-backed app (git commit `fb24899`) is a reference for schema/auth if/when
  we reintroduce a backend.
- Needed before: multi-device sync, Gmail, partner sharing with real data, push reminders.

### Other static screens (probably fine to leave static for now)
- **Partner view**, **Beyond Day 90** — informational; low priority to make dynamic.
