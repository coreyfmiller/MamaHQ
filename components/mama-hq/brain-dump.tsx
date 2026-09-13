import { CalendarDays, Stethoscope, ShoppingBasket, ArrowRight } from 'lucide-react'

const buckets = [
  {
    icon: CalendarDays,
    label: 'Calendar',
    items: ['Thursday 10:00 — Baby appointment', 'Wednesday — Mom visiting'],
  },
  {
    icon: Stethoscope,
    label: 'Ask the doctor',
    items: ['Ask about rash'],
  },
  {
    icon: ShoppingBasket,
    label: 'Shopping',
    items: ['Diapers', 'Pumping bags'],
  },
]

export function BrainDump() {
  return (
    <section id="how-it-works" className="bg-secondary/40 py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance font-serif text-4xl leading-tight text-foreground sm:text-5xl">
            Get it out of your head.
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
            Just tell Mama HQ what&apos;s going on. We&apos;ll organize the rest.
          </p>
        </div>

        <div className="mt-14 grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr]">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              You said
            </p>
            <p className="mt-4 font-serif text-xl leading-relaxed text-foreground">
              &ldquo;Baby appointment Thursday at 10. Remind me to ask about the rash. We&apos;re almost out
              of diapers, Mom is visiting Wednesday, and I need more pumping bags.&rdquo;
            </p>
          </div>

          <div className="flex justify-center lg:flex-col">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <ArrowRight className="size-5 rotate-90 lg:rotate-0" />
            </span>
          </div>

          <div className="space-y-4">
            {buckets.map((bucket) => (
              <div key={bucket.label} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <bucket.icon className="size-4" />
                  </span>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
                    {bucket.label}
                  </h3>
                </div>
                <ul className="mt-3 space-y-1.5 pl-[2.75rem] text-sm text-muted-foreground">
                  {bucket.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
