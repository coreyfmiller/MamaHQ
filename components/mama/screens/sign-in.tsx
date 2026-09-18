'use client'

import { useState } from 'react'
import { Heart, MailCheck } from 'lucide-react'
import { useAuth } from '../auth'
import { LeafSprig } from '../decor'
import { Screen, Scroll, StatusBar } from '../ui'

// Magic-link sign-in: enter email → receive a link → click it → you're in.
// No passwords. On first sign-in the AuthProvider creates the family.
export function SignInScreen() {
  const { sendMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())

  const submit = async () => {
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    const res = await sendMagicLink(email)
    setBusy(false)
    if (res.ok) setSent(true)
    else setError(res.error ?? 'Something went wrong. Try again.')
  }

  return (
    <Screen>
      <StatusBar />
      <LeafSprig className="pointer-events-none absolute -right-6 -top-2 h-40 w-24 rotate-12 opacity-70" />
      <Scroll className="flex flex-col px-7">
        <div className="mt-2 flex items-center gap-1.5">
          <Heart className="size-4 fill-blush text-blush" />
          <span className="font-serif text-xl font-semibold tracking-tight">MamaHQ</span>
        </div>

        {sent ? (
          <div className="mt-16 flex flex-col items-center text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-sage-soft text-sage">
              <MailCheck className="size-7" strokeWidth={1.5} />
            </span>
            <h1 className="mt-5 font-serif text-[24px] font-semibold tracking-tight">Check your email</h1>
            <p className="mx-auto mt-2 max-w-[17rem] text-[15px] leading-relaxed text-muted-foreground">
              We sent a sign-in link to <span className="font-semibold text-foreground">{email.trim()}</span>.
              Open it on this device to continue.
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-6 text-[14px] font-medium text-primary"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <>
            <div className="mt-10">
              <h1 className="text-balance font-serif text-[28px] leading-tight font-semibold tracking-tight">
                Welcome to MamaHQ.
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                Sign in with your email — we&apos;ll send you a secure link, no password needed.
              </p>
            </div>

            <div className="mt-8">
              <input
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-[16px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
              />
              {error && <p className="mt-2 px-1 text-[13px] text-destructive">{error}</p>}
              <button
                onClick={submit}
                disabled={!valid || busy}
                className="mt-4 h-14 w-full rounded-full bg-primary text-[16px] font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] transition-transform active:scale-[0.99] disabled:opacity-40"
              >
                {busy ? 'Sending…' : 'Send me a link'}
              </button>
            </div>
          </>
        )}
      </Scroll>
    </Screen>
  )
}
