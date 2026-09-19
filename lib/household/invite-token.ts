// MamaHQ — invitation token helpers (Step 7).
//
// An invitation token is a CREDENTIAL. The client generates a high-entropy token,
// shares it in the invite LINK, and sends only its SHA-256 hash to the server. The
// server stores/compares the hash only, so the plaintext token never exists at rest
// and a DB read cannot recover a usable token.
//
// Runtime: Web Crypto (`crypto.getRandomValues` + `crypto.subtle.digest`), available
// in browsers and Node 18+. No secrets, no network.

const TOKEN_BYTES = 32 // 256 bits of entropy

/** Generate a high-entropy, URL-safe invitation token (base64url, no padding). */
export function generateInviteToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

/** SHA-256 hex digest of a token — what the server stores/compares. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const b64 = typeof btoa !== 'undefined' ? btoa(bin) : Buffer.from(bytes).toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Build the shareable invite URL for a token. Path-based so the token never lands
 *  in a query string that servers/proxies routinely log. */
export function inviteUrl(origin: string, token: string): string {
  const base = origin.replace(/\/$/, '')
  return `${base}/join/${token}`
}
