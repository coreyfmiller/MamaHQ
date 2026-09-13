import { Plus } from 'lucide-react'

function Circle() {
  return <span className="mt-1 size-4 shrink-0 rounded-full border-[1.5px] border-muted-foreground/50" />
}

export function TodayScreen() {
  return (
    <div className="flex h-[560px] flex-col px-5 pb-4 pt-14 text-left">
      <p className="font-serif text-xl leading-tight text-foreground">Good morning, Emma.</p>
      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">Day 17</p>

      <div className="mt-6 flex-1 space-y-5 overflow-hidden">
        <section>
          <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">Today</h3>
          <div className="mt-2 space-y-2 text-sm">
            <p className="flex gap-2 text-foreground">
              <span className="tabular-nums text-muted-foreground">9:30 AM</span> Pediatrician
            </p>
            <p className="flex gap-2 text-foreground">
              <span className="tabular-nums text-muted-foreground">2:00 PM</span> Sarah bringing dinner
            </p>
          </div>
        </section>

        <section>
          <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">
            Don&apos;t forget
          </h3>
          <ul className="mt-2 space-y-2 text-sm text-foreground">
            <li className="flex gap-2">
              <Circle /> Buy diapers
            </li>
            <li className="flex gap-2">
              <Circle /> Ask about the rash
            </li>
            <li className="flex gap-2">
              <Circle /> Wash pumping parts
            </li>
          </ul>
        </section>

        <section className="rounded-2xl bg-accent/60 p-3.5">
          <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-accent-foreground">
            For you
          </h3>
          <ul className="mt-2 space-y-2 text-sm text-foreground">
            <li className="flex gap-2">
              <Circle /> Drink some water
            </li>
            <li className="flex gap-2">
              <Circle /> Eat something
            </li>
            <li className="flex gap-2">
              <Circle /> Take ten minutes outside
            </li>
          </ul>
        </section>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-full bg-muted px-4 py-2.5 text-[0.72rem] font-medium text-muted-foreground">
        <span>Feed</span>
        <span className="text-border">·</span>
        <span>Sleep</span>
        <span className="text-border">·</span>
        <span>Diaper</span>
        <span className="text-border">·</span>
        <span>Pump</span>
        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Plus className="size-3.5" />
        </span>
      </div>
    </div>
  )
}
