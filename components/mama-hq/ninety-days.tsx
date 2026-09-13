const stages = [
  { day: 'Day 6', title: 'Finding your rhythm' },
  { day: 'Day 23', title: 'You\u2019re learning each other' },
  { day: 'Day 51', title: 'New routines are forming' },
  { day: 'Day 90', title: 'Look how far you\u2019ve come' },
]

export function NinetyDays() {
  return (
    <section id="ninety-days" className="py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Your first 90 days
          </p>
          <h2 className="mt-4 text-balance font-serif text-4xl leading-tight text-foreground sm:text-5xl">
            No two weeks feel the same.
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
            Mama HQ gives you a simple home for each day—what happened, what&apos;s coming, what you need,
            and the little things you don&apos;t want to forget.
          </p>
        </div>

        <ol className="relative mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="absolute left-0 right-0 top-3 hidden h-px bg-border lg:block" aria-hidden="true" />
          {stages.map((stage, index) => (
            <li key={stage.day} className="relative">
              <div className="flex items-center gap-3 lg:block">
                <span className="relative z-10 flex size-6 items-center justify-center rounded-full border border-primary bg-background text-[0.6rem] font-semibold text-primary">
                  {index + 1}
                </span>
              </div>
              <div className="mt-4 lg:mt-6">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{stage.day}</p>
                <p className="mt-2 font-serif text-xl text-foreground">{stage.title}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
