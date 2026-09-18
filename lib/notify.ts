// Notify capability seam. Sending a message to Dad (SMS/email) is a swappable
// provider — exactly like the Extractor / Transcriber / Ocr seams. Today: a no-op
// provider that just logs (no Twilio/Resend account yet). Later: a real provider
// backed by a server route calling Twilio (SMS) + Resend (email). The app calls
// `notifier.sendSms/sendEmail`; it never needs to know which implementation runs.

export interface NotifyResult {
  ok: boolean
  /** 'unconfigured' when no real provider is wired yet — lets the UI explain gently. */
  reason?: 'unconfigured' | 'error'
  error?: string
}

export interface Notifier {
  /** Whether a real send channel is configured (false for the no-op provider). */
  isConfigured: () => boolean
  sendSms: (to: string, body: string) => Promise<NotifyResult>
  sendEmail: (to: string, subject: string, body: string) => Promise<NotifyResult>
}

// No-op provider: records intent so the flow is exercisable end-to-end, but nothing
// is actually delivered until Twilio/Resend are configured behind a server route.
export const noopNotifier: Notifier = {
  isConfigured: () => false,
  async sendSms(to, body) {
    console.info('[notify:noop] SMS →', to, body)
    return { ok: false, reason: 'unconfigured' }
  },
  async sendEmail(to, subject, body) {
    console.info('[notify:noop] EMAIL →', to, subject, body)
    return { ok: false, reason: 'unconfigured' }
  },
}

// Active provider. Swap to a real Twilio/Resend-backed provider (calling a
// /api/notify route) once those accounts exist — no caller changes needed.
export const notifier: Notifier = noopNotifier

/** Compose a friendly hand-off message from mom to the partner. */
export function handoffMessage(fromName: string, task: string): string {
  return `${fromName || 'Your partner'} asked (via MamaHQ): ${task}`
}
