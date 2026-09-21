// MamaHQ — error monitoring seam (Beta Phase 1).
//
// A tiny, privacy-first, provider-agnostic wrapper for reporting UNCAUGHT errors in
// a 10-family closed beta. Design goals:
//   * PRIVACY FIRST. MamaHQ holds highly sensitive household data (baby logs, care
//     notes, grocery/task/calendar contents, emails, phone numbers, brain-dump text,
//     auth/Supabase tokens, API keys). We NEVER intentionally send any of that. We
//     report an error's type + message + stack + release/environment only, and we
//     scrub obvious sensitive tokens from the message defensively.
//   * NON-BLOCKING. Monitoring must never break the product. If no DSN is configured
//     (local dev, or production without monitoring), everything here is a safe no-op.
//     If the provider throws, we swallow it.
//   * SMALL. No custom observability platform. If `@sentry/nextjs` is installed AND a
//     DSN is present it is used (loaded lazily so it's optional); otherwise we fall
//     back to a console warning in development only.
//
// To enable in production: set NEXT_PUBLIC_SENTRY_DSN and add `@sentry/nextjs`.
// Absent either, monitoring is disabled and the app is unaffected.

const DSN =
  (typeof process !== 'undefined' &&
    (process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN)) ||
  ''

// Redact anything that looks like a secret/token/email/phone from a free-text string
// before it could ever reach the monitoring provider. Defensive only — we already
// avoid sending household payloads; this guards the error MESSAGE itself.
function scrub(input: string): string {
  if (!input) return input
  return input
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, 'sk-[redacted]') // OpenAI-style keys
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[jwt-redacted]') // JWTs
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email-redacted]')
    .replace(/(\+?\d[\d\s().-]{7,}\d)/g, '[phone-redacted]')
}

let loaded = false
let sentry: { captureException: (e: unknown, ctx?: unknown) => void } | null = null

// Lazily load the provider ONCE, only if a DSN is configured. Optional dependency:
// if `@sentry/nextjs` isn't installed, we quietly disable rather than fail the build.
async function ensureProvider(): Promise<void> {
  if (loaded) return
  loaded = true
  if (!DSN) return
  try {
    // Optional dependency — resolved at RUNTIME only. The specifier is built from a
    // variable so the bundler/TS does not statically require the package to be
    // installed; when it's absent, import() rejects and we quietly stay disabled.
    const spec = ['@sentry', 'nextjs'].join('/')
    const mod = await import(/* @vite-ignore */ /* webpackIgnore: true */ spec).catch(() => null)
    if (mod && typeof (mod as { captureException?: unknown }).captureException === 'function') {
      sentry = mod as unknown as { captureException: (e: unknown, ctx?: unknown) => void }
    }
  } catch {
    sentry = null
  }
}

/** Report an uncaught error. Safe to call anywhere; never throws, never blocks. */
export function reportError(error: unknown): void {
  try {
    const err =
      error instanceof Error
        ? Object.assign(new Error(scrub(error.message)), { name: error.name, stack: error.stack })
        : new Error(scrub(String(error)))

    if (!DSN) {
      // No monitoring configured. In development, a console warning aids debugging;
      // in production we stay silent (no telemetry, no noise).
      if (process.env.NODE_ENV !== 'production') console.warn('[monitoring:disabled]', err.message)
      return
    }
    void ensureProvider().then(() => {
      try {
        sentry?.captureException(err)
      } catch {
        // Monitoring failure must never surface to the user.
      }
    })
  } catch {
    // Absolutely never let monitoring break a caller.
  }
}
