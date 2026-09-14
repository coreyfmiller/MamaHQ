import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PhoneFrame } from './phone-frame'
import { TodayScreen } from './today-screen'
import { RotatingImage } from './rotating-image'

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 lg:grid-cols-2 lg:gap-8 lg:pb-28 lg:pt-20">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
            A calm copilot for the first 90 days
          </span>

          <h1 className="mt-6 text-balance font-serif text-5xl leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            Motherhood is a lot. Your app shouldn&apos;t be.
          </h1>

          <p className="mt-6 text-pretty text-lg leading-relaxed text-muted-foreground">
            Mama HQ brings the first 90 days together—feeds, sleep, appointments, reminders, questions,
            lists, memories, and everything running through your head.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/app"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Start your first 90 days
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-card px-7 text-base font-medium text-foreground transition-colors hover:bg-muted"
            >
              See how it works
            </a>
          </div>

          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            You take care of the baby. <span className="text-foreground">Mama HQ helps take care of everything else.</span>
          </p>
        </div>

        <div className="flex items-center justify-center gap-4 sm:gap-6">
          <div className="hidden shrink-0 sm:block">
            <PhoneFrame className="scale-[0.78] lg:scale-90">
              <TodayScreen />
            </PhoneFrame>
          </div>
          <div className="w-[280px] shrink-0 scale-[0.78] lg:scale-90">
            <RotatingImage />
          </div>
        </div>
      </div>
    </section>
  )
}
