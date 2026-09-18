# MamaHQ — Roadmap & Deferred Work

Live at https://mamahq.vercel.app/app (auto-deploys on push to `main`). Backend
foundation (Supabase auth) is in; app DATA is still localStorage until the cloud
migration lands. This file tracks deferred work + reasoning.

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
- [ ] **Voice capture on a real phone** — duplication + quick-stop fixes shipped; verify on
      iOS Safari and Android Chrome specifically.
- [ ] **Photo OCR on a real phone** — camera capture + Tesseract read; verify on-device.
- [ ] **Inbox extraction quality** — the local rule-based extractor's parsing of real dumps
      (feed/diaper/sleep/appointment/task/question routing) hasn't been exercised much.
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

## Backend track (in progress)
- [x] **Auth foundation** — Supabase magic-link sign-in, family auto-created on first sign-in,
      auth gate, sign-out. VERIFIED LIVE (real sign-in works; caught + fixed an empty
      family_members bug that was blocking all writes via RLS).
- [x] **Cloud data migration** — all stores (profile/baby, logs, appointments+questions, mom,
      memories, captures, partner) read/write Supabase when signed in, localStorage fallback when
      signed out; optimistic writes; reset wipes cloud family data. VERIFIED: a logged feed
      lands in the `logs` table. Data layer in `lib/supabase/data.ts`. (First-sign-in local→cloud
      import was intentionally skipped — start fresh in cloud.)
- [~] **Dad as contact (Tier 1)** — DONE except delivery: partner store (cloud-backed
      `partner_contacts`), a real Partner screen (add/edit name/phone/email + SMS/email notify
      toggles, remove), and a Notifier seam (`lib/notify.ts`, no-op provider) ready for real send.
      REMAINING (needs accounts): a `/api/notify` route calling **Twilio** (SMS) + **Resend**
      (email), swap `notifier` to the real provider, and task `assignee` + hand-off action.
      Needs: Twilio account + number; Resend key.
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
