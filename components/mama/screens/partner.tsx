'use client'

import { useState } from 'react'
import { Hand, Heart } from 'lucide-react'
import { useNav } from '../context'
import { CategoryChip } from '../event-meta'
import { Card, CardLabel, CheckBox, Screen, Scroll, Segmented, StatusBar, TopBar } from '../ui'
import { partner } from '@/lib/mama-data'

export function PartnerScreen() {
  const { closeOverlay } = useNav()
  const [tab, setTab] = useState<'today' | 'week'>('today')
  return (
    <Screen>
      <StatusBar />
      <TopBar onBack={closeOverlay} />
      <Scroll className="space-y-4 px-6 pb-8">
        <header className="pt-1">
          <h1 className="flex items-center gap-2 font-serif text-[26px] font-semibold tracking-tight">
            Hi {partner.name} <Hand className="size-6 text-peach" strokeWidth={1.75} />
          </h1>
          <p className="mt-1 text-[15px] text-muted-foreground">Here&apos;s what&apos;s new.</p>
        </header>

        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'This week' },
          ]}
        />

        <Card className="space-y-1">
          <CardLabel className="mb-1 text-foreground">Recent activity</CardLabel>
          <div className="divide-y divide-border/60">
            {partner.recent.map((e) => (
              <div key={e.id} className="flex items-center gap-3.5 py-2.5">
                <CategoryChip category={e.category} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold leading-tight">
                    {e.title}
                    {e.detail && <span className="font-normal text-muted-foreground"> &middot; {e.detail}</span>}
                  </p>
                </div>
                <span className="text-[13px] text-muted-foreground">{e.time}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-2">
          <CardLabel className="text-foreground">Today</CardLabel>
          {partner.today.map((e) => (
            <div key={e.id} className="flex items-center gap-3.5 py-1">
              <CategoryChip category={e.category} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-tight">{e.title}</p>
                <p className="text-[13px] text-muted-foreground">{e.time}</p>
              </div>
            </div>
          ))}
          <div className="border-t border-border/60 pt-1">
            {partner.todayTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2">
                <CheckBox checked={false} />
                <span className="text-[15px]">{t.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <p className="flex items-center justify-center gap-1.5 pt-2 font-serif text-[16px] font-medium">
          You&apos;re both in this <Heart className="size-4 fill-blush text-blush" />
        </p>
      </Scroll>
    </Screen>
  )
}
