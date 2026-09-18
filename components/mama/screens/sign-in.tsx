'use client'

import { useRef, useState } from 'react'
import { Heart, ArrowLeft } from 'lucide-react'
import { useAuth } from '../auth'
import { LeafSprig } from '../decor'
import { Screen, Scroll, StatusBar } from '../ui'

// Email OTP sign-in: enter email → get a 6-digit code → type it in → you're in.
// No links, no redirects, no passwords — works the same on web and in a native
// (Capacitor) shell. On first sign-in the AuthProvider creates the family.
type Step = 'email' | 'code'

export function SignInScreen() {
  const { sendCode, verifyCode } = useAuth()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const codeRef = useRef<HTMLInputElement>(null)

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
  const codeValid = /^\d{6}$/.test(code.trim())

  const send = async () => {
    if (!emailValid || busy) return
    setBusy(true)
    setError(null)
    const res = await sendCode(email)
    setBusy(false)
    if (res.ok) {
      setStep('code')
      setTimeout(() => codeRef.current?.focus(), 50)
    } else {
      setError(res.error ?? 'Something went wrong. Try again.')
    }
  }

  const verify = async () => {
    if (!codeValid || busy) return
    setBusy(true)
    setError(null)
    const res = await verifyCode(email, code)
    setBusy(false)
    // On success, onAuthStateChange flips the app into signed-in; nothing more to do.
    if (!res.ok) setError(res.error ?? 'That code didn’t work. Check it and try again.')
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

        {step === 'email' ? (
          <>
            <div className="mt-10">
              <h1 className="text-balance font-serif text-[28px] leading-tight font-semibold tracking-tight">
                Welcome to MamaHQ.
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                Enter your email and we&apos;ll send you a 6-digit code — no password needed.
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
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-[16px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
              />
              {error && <p className="mt-2 px-1 text-[13px] text-destructive">{error}</p>}
              <button
                onClick={send}
                disabled={!emailValid || busy}
                className="mt-4 h-14 w-full rounded-full bg-primary text-[16px] font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] transition-transform active:scale-[0.99] disabled:opacity-40"
              >
                {busy ? 'Sending…' : 'Send me a code'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-8">
              <button
                onClick={() => {
                  setStep('email')
                  setCode('')
                  setError(null)
                }}
                className="mb-4 flex items-center gap-1.5 text-[14px] font-medium text-muted-foreground"
              >
                <ArrowLeft className="size-4" /> Back
              </button>
              <h1 className="text-balance font-serif text-[26px] leading-tight font-semibold tracking-tight">
                Enter your code
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                We sent a 6-digit code to <span className="font-semibold text-foreground">{email.trim()}</span>.
                It may take a moment to arrive.
              </p>
            </div>

            <div className="mt-8">
              <input
                ref={codeRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && verify()}
                placeholder="123456"
                className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-center text-[24px] font-semibold tracking-[0.4em] text-foreground outline-none placeholder:tracking-normal placeholder:text-muted-foreground/50 focus:border-primary"
              />
              {error && <p className="mt-2 px-1 text-[13px] text-destructive">{error}</p>}
              <button
                onClick={verify}
                disabled={!codeValid || busy}
                className="mt-4 h-14 w-full rounded-full bg-primary text-[16px] font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] transition-transform active:scale-[0.99] disabled:opacity-40"
              >
                {busy ? 'Verifying…' : 'Verify & sign in'}
              </button>
              <button
                onClick={send}
                disabled={busy}
                className="mt-3 w-full text-center text-[14px] font-medium text-primary disabled:opacity-40"
              >
                Resend code
              </button>
            </div>
          </>
        )}
      </Scroll>
    </Screen>
  )
}
