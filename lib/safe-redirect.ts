// MamaHQ — safe post-auth redirect target (PR6). Pure + deterministic.
//
// The auth callback reads `?next=` from the URL. Passing that straight to
// window.location.replace is an OPEN REDIRECT: an attacker could craft a sign-in link
// that bounces a freshly-authenticated user to an external phishing page. We only
// ever allow a SAME-ORIGIN application path; anything else falls back to /app.

export const DEFAULT_AFTER_AUTH = '/app'

/**
 * Return `next` only if it is a safe, same-origin, absolute-path app route.
 * Rejected (→ DEFAULT_AFTER_AUTH):
 *   * missing / empty / non-string
 *   * absolute or scheme URLs ("https://evil.com", "javascript:…", "data:…")
 *   * protocol-relative ("//evil.com") and backslash tricks ("/\\evil.com", "\\\\evil")
 *   * anything not starting with a single "/"
 *   * control characters / whitespace smuggling
 * The result is resolved against a fixed dummy origin to confirm it stays on-origin.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (typeof next !== 'string') return DEFAULT_AFTER_AUTH
  const raw = next.trim()
  if (!raw) return DEFAULT_AFTER_AUTH
  // Control characters (incl. tab/newline, which browsers strip inside URLs).
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return DEFAULT_AFTER_AUTH
  if (!raw.startsWith('/')) return DEFAULT_AFTER_AUTH
  // "//host" and "/\host" are treated as protocol-relative by browsers.
  if (raw.startsWith('//') || raw.startsWith('/\\')) return DEFAULT_AFTER_AUTH
  if (raw.includes('\\')) return DEFAULT_AFTER_AUTH
  const base = 'https://mamahq.invalid'
  let url: URL
  try {
    url = new URL(raw, base)
  } catch {
    return DEFAULT_AFTER_AUTH
  }
  if (url.origin !== base) return DEFAULT_AFTER_AUTH
  return `${url.pathname}${url.search}${url.hash}`
}
