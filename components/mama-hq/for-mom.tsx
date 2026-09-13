import Image from 'next/image'

const prompts = [
  'Have you eaten?',
  'Want to step outside for a few minutes?',
  'Anything you want your partner to handle today?',
  'How are you feeling today?',
]

export function ForMom() {
  return (
    <section id="for-mom" className="py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Don&apos;t forget mom
          </p>
          <h2 className="mt-4 text-balance font-serif text-4xl leading-tight text-foreground sm:text-5xl">
            There&apos;s a mom in there too.
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
            When a baby arrives, everyone asks about the baby. Mama HQ remembers that you&apos;re going
            through something enormous too.
          </p>

          <ul className="mt-8 space-y-3">
            {prompts.map((prompt) => (
              <li
                key={prompt}
                className="rounded-2xl border border-border bg-accent/40 px-5 py-4 font-serif text-lg text-foreground"
              >
                {prompt}
              </li>
            ))}
          </ul>
        </div>

        <div className="order-1 lg:order-2">
          <div className="overflow-hidden rounded-[2rem] border border-border/60 shadow-[0_30px_60px_-30px_rgba(80,55,40,0.4)]">
            <Image
              src="/images/mom-portrait.png"
              alt="A mother resting quietly by a window, holding a glass of water"
              width={900}
              height={1000}
              className="h-[420px] w-full object-cover sm:h-[560px]"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
