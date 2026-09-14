'use client'

import { Home, Inbox, Baby, Heart } from 'lucide-react'

// Simplified V1 nav: Today (command center) · Baby (factual log) · Inbox (the hero capture) ·
// Me (Mom's own things). Plan is now infrastructure surfaced through Today/Me; Memories is
// reached contextually. See docs / ROADMAP R2.
export type Tab = 'today' | 'baby' | 'inbox' | 'me'

const TABS: { id: Tab; label: string; Icon: typeof Home }[] = [
  { id: 'today', label: 'Today', Icon: Home },
  { id: 'baby', label: 'Baby', Icon: Baby },
  { id: 'inbox', label: 'Inbox', Icon: Inbox },
  { id: 'me', label: 'Me', Icon: Heart },
]

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="sticky inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur">
      <ul className="flex items-stretch justify-around px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id
          return (
            <li key={id} className="flex-1">
              <button
                onClick={() => onChange(id)}
                aria-current={active ? 'page' : undefined}
                aria-label={label}
                className={`flex w-full flex-col items-center gap-1 rounded-xl py-2 transition-colors ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon className={`h-6 w-6 ${active ? 'fill-primary/10' : ''}`} strokeWidth={active ? 2.4 : 1.8} />
                <span className="text-[11px] font-medium">{label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
