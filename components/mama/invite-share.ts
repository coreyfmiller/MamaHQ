// MamaHQ — invite sharing helpers (Beta Phase 2).
//
// An invitation URL is a CREDENTIAL: it contains the plaintext token. So these
// helpers NEVER log the URL and NEVER send it anywhere — MamaHQ does not deliver
// invites. It only puts the link on the clipboard (or into the OS share sheet) so
// the human can send it themselves through a channel they choose. That is why the
// UI must say "copy this link and send it" and never "invitation sent".

/** True when the Web Share API is usable (mobile browsers, some desktops). */
export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

export type ShareResult = 'shared' | 'copied' | 'failed'

/**
 * Try to hand the invite link to the user for THEM to send:
 *   1. Native share sheet when available (they pick Messages/WhatsApp/etc.).
 *   2. Otherwise copy to clipboard.
 * Never throws; never logs the URL/token. Returns what actually happened so the
 * caller can show HONEST feedback:
 *   'shared' — the OS share sheet was opened (or dismissed). We deliberately do NOT
 *              claim delivery here: opening a share sheet — or the user cancelling
 *              it (AbortError) — is not proof anything was sent, so callers show no
 *              "sent"/"copied" confirmation for this result.
 *   'copied' — no native share; the link was placed on the clipboard.
 *   'failed' — no native share and the clipboard write failed (caller should show
 *              the link for manual selection, never a false success).
 */
export async function shareInvite(url: string, personName?: string): Promise<ShareResult> {
  const title = 'Join our household on MamaHQ'
  const text = personName
    ? `${personName}, join our household on MamaHQ:`
    : 'Join our household on MamaHQ:'

  if (canNativeShare()) {
    try {
      await navigator.share({ title, text, url })
      return 'shared'
    } catch (e) {
      // AbortError = the user dismissed the sheet on purpose: do nothing, not an
      // error. Any other failure falls through to a clipboard copy.
      if (e instanceof DOMException && e.name === 'AbortError') return 'shared'
      // fall through to copy
    }
  }

  return (await copyInvite(url)) ? 'copied' : 'failed'
}

/** Copy the invite link to the clipboard. Returns success. Never logs the URL. */
export async function copyInvite(url: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
      return true
    }
  } catch {
    // clipboard blocked (permissions/insecure context) — report failure so the UI
    // can show the link for manual selection instead of a false success.
  }
  return false
}
