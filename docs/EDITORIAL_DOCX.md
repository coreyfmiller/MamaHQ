# MamaHQ — Editorial `.docx` Decision

## The file
`public/MamaHQ_First_90_Days_Editorial_Collection.docx` — currently **untracked** in
git.

## Findings (verified in Step 5C)
- **Runtime dependency?** **No.** The First-90-Days daily reads are fully inlined as
  TypeScript in `lib/daily-reads.ts` (`ALL_READS`). That file's header comment says it
  was *generated from* the `.docx`, but the app imports the `.ts`, never the document.
  Nothing in the codebase reads the `.docx` at build or runtime.
- **Editorial source?** Yes — it is the human-authored, safety-reviewed source that
  the `.ts` reads were transcribed from.
- **Anything sensitive?** It is editorial prose (parenting content), not secrets or
  PII. Low sensitivity. But it is placed under `public/`, which Next.js serves as
  **static, publicly downloadable** assets. Committing it there would publish the raw
  document at a guessable URL — almost certainly not intended.
- **Belongs in source control?** Editorial *source* is reasonable to version, but
  **not inside `public/`**.

## Recommendation (not executed in Step 5C — no large content move here)
1. **Do not commit the `.docx` at its current `public/` path.** Leaving it untracked
   is acceptable for now; committing it under `public/` would publicly expose it.
2. If you want the source versioned, move it out of `public/` to a non-served
   location (e.g. `docs/editorial/` or `content/editorial/`) in a **separate,
   deliberate content-management change** — not as part of this hardening step
   (Step 5C §43 explicitly says not to make a large content change here).
3. The runtime source of truth remains `lib/daily-reads.ts`; keep regenerating that
   from the document rather than shipping the document.

## Step 5C action taken
- The `.docx` is **excluded** from the Step 5C commit (it remains untracked). No
  content move was performed. This decision is recorded here and in the report.
