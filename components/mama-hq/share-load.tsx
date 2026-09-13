import Image from 'next/image'
import { Check } from 'lucide-react'

function OpenItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-foreground">
      <span className="size-4 shrink-0 rounded-full border-[1.5px] border-muted-foreground/50" />
      {children}
    </li>
  )
}

function DoneItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-muted-foreground line-through">
      <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Check className="size-3" />
      </span>
      {children}
    </li>
  )
}

export function ShareLoad() {
  return (
    <section className="bg-secondary/40 py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Share the load
          </p>
          <h2 className="mt-4 text-balance font-serif text-4xl leading-tight text-foreground sm:text-5xl">
            You shouldn&apos;t have to delegate everything.
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
            Invite your partner or someone you trust, and give them real things they can take off your
            plate—no long explanations required.
          </p>

          <div className="mt-8 overflow-hidden rounded-3xl border border-border/60">
            <Image
              src="/images/partner-home.png"
              alt="A partner carrying a basket of laundry through a sunlit home"
              width={900}
              height={500}
              className="h-52 w-full object-cover"
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Mom</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <OpenItem>Pediatrician appointment</OpenItem>
              <OpenItem>Order pumping supplies</OpenItem>
            </ul>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Partner</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <DoneItem>Laundry</DoneItem>
              <OpenItem>Pick up groceries</OpenItem>
              <OpenItem>Sterilize bottles</OpenItem>
              <OpenItem>Tell visitors 2 PM works better</OpenItem>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
