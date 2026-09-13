import Image from 'next/image'
import { Sun, Baby, Brain, CalendarCheck, MessageCircleQuestion, ListTodo, HandHeart, Camera } from 'lucide-react'

const features = [
  {
    icon: Sun,
    title: 'Today',
    description: 'See what\u2019s happening without digging through menus.',
  },
  {
    icon: Baby,
    title: 'Baby',
    description: 'Quickly log feeds, sleep, diapers and pumping. This is record keeping—not medical interpretation.',
  },
  {
    icon: Brain,
    title: 'Your Brain',
    description: 'Dump thoughts, reminders and things you can\u2019t afford to forget.',
  },
  {
    icon: CalendarCheck,
    title: 'Appointments',
    description: 'Keep Mom and baby\u2019s appointments together.',
  },
  {
    icon: MessageCircleQuestion,
    title: 'Questions',
    description: 'Capture questions whenever they occur so they\u2019re ready when you see your provider.',
  },
  {
    icon: ListTodo,
    title: 'Lists',
    description: 'Groceries, supplies, errands and household tasks.',
  },
  {
    icon: HandHeart,
    title: 'Help',
    description: 'Give partners and family members actual things they can take off your plate.',
  },
  {
    icon: Camera,
    title: 'Memories',
    description: 'Capture the tiny moments hiding inside the chaos.',
  },
]

export function Features() {
  return (
    <section id="features" className="bg-secondary/40 py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              One place for the chaos
            </p>
            <h2 className="mt-4 text-balance font-serif text-4xl leading-tight text-foreground sm:text-5xl">
              Everything you&apos;re carrying, gathered somewhere calm.
            </h2>
          </div>
          <div className="overflow-hidden rounded-3xl border border-border/60">
            <Image
              src="/images/baby-asleep.png"
              alt="A newborn baby asleep on a parent's chest"
              width={800}
              height={520}
              className="h-56 w-full object-cover"
            />
          </div>
        </div>

        <div className="mt-16 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div key={feature.title} className="border-t border-border pt-5">
              <span className="flex size-9 items-center justify-center rounded-full bg-card text-primary">
                <feature.icon className="size-[1.15rem]" />
              </span>
              <h3 className="mt-4 font-serif text-xl text-foreground">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
