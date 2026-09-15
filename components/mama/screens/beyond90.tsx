'use client'

import { Baby, Backpack, GraduationCap, Headphones, Palette, ToyBrick, type LucideIcon } from 'lucide-react'
import { useNav } from '../context'
import { Screen, Scroll, StatusBar, TopBar } from '../ui'
import { LeafSprig } from '../decor'
import { stages } from '@/lib/mama-data'

const icons: Record<string, LucideIcon> = {
  baby: Baby,
  rattle: ToyBrick,
  blocks: ToyBrick,
  crayon: Palette,
  backpack: Backpack,
  headphones: Headphones,
}

const stageIcon: LucideIcon[] = [Baby, ToyBrick, ToyBrick, Palette, Backpack, GraduationCap]

export function Beyond90Screen() {
  const { closeOverlay } = useNav()
  return (
    <Screen className="relative">
      <StatusBar />
      <TopBar onBack={closeOverlay} />
      <LeafSprig className="pointer-events-none absolute -left-6 bottom-6 h-40 w-24 -rotate-12 opacity-50" />
      <Scroll className="px-6 pb-8">
        <div className="mt-2 text-center">
          <h1 className="font-serif text-[26px] leading-tight font-semibold tracking-tight">
            Same app.
            <br />
            Different seasons.
          </h1>
        </div>

        <ul className="mt-7 space-y-2.5">
          {stages.map((s, i) => {
            const Icon = stageIcon[i] ?? icons[s.icon] ?? Baby
            return (
              <li
                key={s.id}
                className="flex items-center gap-3.5 rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm"
              >
                <span className="flex size-10 items-center justify-center rounded-2xl bg-sage-soft text-sage">
                  <Icon className="size-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold leading-tight">{s.name}</p>
                  <p className="text-[13px] text-muted-foreground">{s.range}</p>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="mt-8 rounded-3xl bg-sage-soft/60 p-5 text-center">
          <p className="text-balance font-serif text-[18px] leading-snug font-medium">
            MamaHQ grows with your family.
          </p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
            The tools change. The promise doesn&apos;t.
          </p>
        </div>
      </Scroll>
    </Screen>
  )
}
