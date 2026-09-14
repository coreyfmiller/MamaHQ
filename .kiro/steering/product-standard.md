# Mama HQ — Product Standard (governing)

> **Canonical source:** the root **`PRODUCT.md`** is the primary product constitution, and
> **`ROADMAP.md`** governs sequencing. This steering file is the operational mirror of
> `PRODUCT.md`; the two agree. `SAFETY.md` outranks both. If this file ever diverges from the root
> docs, the root docs win and this file must be reconciled to them.

This is the product contract for Mama HQ. It outranks convenience, speed, and the urge to add
features. When any instinct conflicts with this file, this file wins. (The data-and-ai-standard.md
file outranks even this one — the "describe, don't diagnose" and "propose, don't auto-commit"
rules are absolute.)

## What Mama HQ is

A mobile-first app scoped EXCLUSIVELY to the **first 90 days** after a baby is born. It brings
the scattered pieces of newborn life — feeding, sleep, diapers, pumping, appointments, questions,
lists, tasks, partner coordination, small memories — into one calm place.

The promise: **"Your first 90 days. All in one place."**

It helps a mother: Remember → Organize → Prepare → Share → Remember the experience.

It is NOT an AI pediatrician, NOT diagnostic, NOT a replacement for healthcare professionals.
It organizes life around a newborn.

## Scope discipline (V1)

- First 90 days only. Do not build for toddlers, school years, or "grows with the child" here —
  that is a different product (MindfulMama). Mama HQ stays tightly focused.
- V1 navigation is exactly five: TODAY, BABY, INBOX, PLAN, MEMORIES. Do not add navigation
  destinations. Account/family/settings live outside the primary nav.
- Do not build a Google Calendar competitor. Just organize the first 90 days.
- Keep V1 focused: build the smallest slice that proves the loop, then broaden.

## The UX north star (non-negotiable)

Assume the user is **holding a newborn in one arm, operating the app with one thumb, at 3:17 AM.**

Therefore, every screen must honor:
- Large touch targets. Extremely few taps. The most common actions take 1–3 taps.
- No complicated forms, no unnecessary confirmation screens, no dense dashboards, no tiny text,
  no hidden essential actions, no excessive navigation, no feature overload.
- No chatbot required for routine tasks. Logging a feed/sleep/diaper/pump is pure taps, never a
  conversation.
- **The product should feel CALMER after opening it than before.** Warm, quiet, personal — a home
  screen, not a medical dashboard. If a screen feels clinical, busy, or judgmental, it fails.

## The product loop

CAPTURE → ORGANIZE → REMIND → SHARE → REMEMBER.
Capture fast. Organize automatically. Surface at the right time. Let others help. Preserve
meaningful moments.

## Tone toward the user (Mom)

Warm, calm, supportive, never judgmental, never alarmist, never clinical. She may be sleep
deprived, recovering, feeding in every possible way. Never assume one family structure, feeding
method, birth experience, or parenting philosophy. Support Mom; never evaluate her. Reduce her
load; never add to it. Celebrate nothing performatively — just quietly make the night easier.

## The standing quality bar (apply to every deliverable)

A Mama HQ feature is only "done" when:
- It works one-handed, one-thumb, fast, with large targets and 1–3 taps for common actions.
- Opening it feels calmer, not busier.
- It honors data-and-ai-standard.md absolutely (describe data, never interpret the baby;
  AI proposes, never silently commits).
- It never loses or corrupts a family's logged data.
- Nothing feels clinical, judgmental, or like a dashboard.
- It assumes no single family structure or feeding method.

If it does not clear this bar, it is not finished, and I say so.

## Stack / house conventions

- Next.js (App Router) + React + Tailwind v4 + shadcn, pnpm (via `corepack pnpm` on this
  machine — the plain pnpm shim is broken here), deploy on Vercel.
- AI for the Inbox extraction uses OpenAI (key provided for this project). Design the AI layer
  so the provider can be swapped later (see data-and-ai-standard.md).
- Start LOCAL-FIRST (localStorage, no auth/DB) to perfect the loop, then add real persistence.
- API keys come from the environment (`.env.local`, gitignored). Never hardcode, log, or expose
  a key to the client; AI calls are server-side only.
