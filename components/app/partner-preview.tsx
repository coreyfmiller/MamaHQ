'use client'

// Partner Mode (PROTOTYPE / MOCK — no backend). Real Partner Mode requires the Step 5
// authorization-model migration (family_members/roles) and is built in Step 11. This screen
// exists only so Flow G is walkable and we can feel the "Here's how you can help today" framing.
// It uses mock data and does not read or write the database.

import { BottomSheet, Section, CheckToggle } from '@/components/app/ui'
import { useState } from 'react'

type MockTask = { id: string; title: string; done: boolean }

const MOCK_ASSIGNED: MockTask[] = [
  { id: 'p1', title: 'Pick up groceries', done: false },
  { id: 'p2', title: 'Sterilize the bottles', done: false },
  { id: 'p3', title: 'Tell visitors 2 PM works better', done: false },
  { id: 'p4', title: 'Laundry', done: true },
]

export function PartnerPreview({ onClose }: { onClose: () => void }) {
  const [tasks, setTasks] = useState<MockTask[]>(MOCK_ASSIGNED)
  const open = tasks.filter((t) => !t.done)
  const done = tasks.filter((t) => t.done)

  function toggle(id: string) {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  return (
    <BottomSheet title="Partner" onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-2xl bg-accent/50 p-4">
          <p className="font-serif text-lg text-foreground">Here’s how you can help today</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A few things taken off Mom’s plate — no long explanations needed.
          </p>
        </div>

        <Section title="For you to do">
          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground">All caught up. Thank you. 💛</p>
          ) : (
            <ul className="space-y-2">
              {open.map((t) => (
                <li key={t.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm">
                  <CheckToggle checked={t.done} onToggle={() => toggle(t.id)} label={`Mark ${t.title} done`} />
                  <span className="flex-1 text-sm text-foreground">{t.title}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {done.length > 0 && (
          <Section title="Done">
            <ul className="space-y-2">
              {done.map((t) => (
                <li key={t.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-3.5">
                  <CheckToggle checked={t.done} onToggle={() => toggle(t.id)} label={`Mark ${t.title} not done`} />
                  <span className="flex-1 text-sm text-muted-foreground line-through">{t.title}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <p className="rounded-xl border border-dashed border-border bg-card/50 p-3 text-center text-xs text-muted-foreground">
          Preview only — inviting a real partner comes with Partner Mode (needs the family-member
          authorization change first).
        </p>
      </div>
    </BottomSheet>
  )
}
