# Mama HQ — Data & AI Standard (ABSOLUTE, NON-NEGOTIABLE)

This file outranks every other standard, including product-standard.md. Mama HQ handles a
newborn's logged data and uses AI to organize a parent's life. Two rules are absolute and govern
every feature, screen, and model prompt. When any instinct (helpfulness, cleverness, engagement)
conflicts with this file, this file wins.

---

## RULE 1 — DESCRIBE THE USER'S DATA. NEVER CLINICALLY INTERPRET THE BABY.

Mama HQ may REPORT what the parent recorded. It must NEVER draw a clinical conclusion about the
baby's health, adequacy, or development.

ALLOWED (describing recorded data):
- "You logged 8 feeds yesterday."
- "Feeds logged: 61 · Diapers logged: 47 · Sleep sessions logged: 35"
- Counts, durations, history, timelines, and trends IN THE RECORDED DATA.

FORBIDDEN (interpreting the baby):
- "Your baby isn't feeding enough." / "Baby is sleeping too little." / "That's not enough diapers."
- Any diagnosis, medical prediction, or "should" about the baby's body.
- **No scores of any kind:** no baby health score, sleep-quality score, feeding-adequacy score,
  development score, or any derived rating that judges the child.

The line: **describe the user's data; do not clinically interpret the baby.** If a feature would
require judging whether the baby is okay, it does not belong in Mama HQ — that is the parent's
healthcare provider's job. Summaries (e.g. Visit Summary) REPORT recorded numbers only and must
carry no medical conclusions; they are for the parent to show a provider.

Clinical guidance is never invented. Any pediatric/postpartum/feeding/sleep/safety content must
come from authoritative sources and/or qualified professional review — not from the model's or
the builder's imagination.

Emergency floor: if a user's free-text input clearly describes a medical emergency, Mama HQ may
gently surface "this may need urgent care — contact your provider or emergency services," but it
does NOT diagnose and does NOT try to assess severity. Erring toward "seek professional care" is
acceptable; interpreting the baby is not.

---

## RULE 2 — AI PROPOSES. IT NEVER SILENTLY COMMITS.

AI is an invisible ORGANIZATIONAL layer, not a chatbot and not an autonomous agent.

Use AI for: intent/entity/date-time extraction, task/appointment/shopping/question extraction,
suggested categorization, memory detection, summarization. Not for routine logging (that's taps).

Every AI-generated action MUST be PROPOSED to the user and explicitly APPROVED before it is
committed. Mama HQ must NEVER silently create/modify a calendar event, task, list item, question,
appointment, or any stored record from AI output. The user sees the proposed actions, can edit or
remove each, and commits with an explicit action ("Add everything" / per-item add).

Provenance — for every Inbox capture, STORE and NEVER overwrite:
1. The original user input (verbatim, immutable).
2. The AI interpretation.
3. The proposed actions.
4. The user's modifications.
5. The approved actions.

Use STRUCTURED model outputs (typed JSON, validated) rather than free-form parsing wherever
possible. Design the AI layer behind a provider-agnostic interface so the model provider can be
changed later without touching product code.

---

## Implementation requirements

- The Inbox flow is propose → review/edit → approve → commit. There is no "auto-apply."
- The original input is stored immutably alongside interpretation and approved actions.
- Any "stats"/summary surface shows recorded counts/durations only, with wording that describes
  the log ("you logged…"), never the baby ("baby is…").
- No code path derives a health/quality/adequacy/development score. If one is proposed, reject it.
- AI calls are server-side only; the key never reaches the client.

## The test for every data/AI surface (must pass before shipping)

1. Does it only DESCRIBE recorded data, never interpret the baby's health/adequacy/development?
2. Are there zero scores/ratings/diagnoses of the child?
3. Does every AI action get proposed and explicitly approved before commit?
4. Is the original input preserved immutably with full provenance?
5. Is any clinical content sourced from authority/professional review, never invented?

If a surface can fail any of these, it does not ship.
