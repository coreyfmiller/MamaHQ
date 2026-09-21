// MamaHQ — 404 (Beta Phase 1). A calm, on-brand "not found" instead of the default.

import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] w-full items-center justify-center bg-[oklch(0.93_0.018_82)] p-6">
      <div className="w-full max-w-[404px] rounded-[2rem] border border-black/5 bg-background p-8 text-center shadow-[0_40px_80px_-30px_rgba(38,50,56,0.4)]">
        <h1 className="font-serif text-[22px] font-semibold tracking-tight text-foreground">
          We couldn&apos;t find that page
        </h1>
        <p className="mx-auto mt-3 max-w-[18rem] text-[15px] leading-relaxed text-muted-foreground">
          The link may be old or mistyped. Everything in your household is still where you left it.
        </p>
        <Link
          href="/app"
          className="mt-7 block w-full rounded-full bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
        >
          Back to MamaHQ
        </Link>
      </div>
    </main>
  )
}
