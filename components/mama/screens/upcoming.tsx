'use client'

import { Plus, CalendarDays } from 'lucide-react'
import { useNav } from '../context'
import { useAppointments, upcomingAppointments, relativeDay, shortTime, isThisWeek, openQuestionCount, type Appointment } from '../appointments'
import { CategoryChip } from '../event-meta'
import { Screen, Scroll, StatusBar, TopBar } from '../ui'

function EventRow({ appt, onOpen }: { appt: Appointment; onOpen: () => void }) {
  const open = openQuestionCount(appt)
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3.5 rounded-2xl border border-border/70 bg-card p-3.5 text-left shadow-sm transition-transform active:scale-[0.99]"
    >
      <CategoryChip category="appointment" />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-muted-foreground">
          {relativeDay(appt.whenISO)} · {shortTime(appt.whenISO)}
        </p>
        <p className="text-[15px] font-semibold leading-tight">{appt.title}</p>
        {open > 0 && (
          <p className="text-[12px] font-medium text-primary">
            {open} thing{open === 1 ? '' : 's'} to ask
          </p>
        )}
      </div>
    </button>
  )
}

export function UpcomingScreen() {
  const { closeOverlay, openAppointment, composeAppointment } = useNav()
  const { appointments } = useAppointments()
  const list = upcomingAppointments(appointments)
  const thisWeek = list.filter((a) => isThisWeek(a.whenISO))
  const later = list.filter((a) => !isThisWeek(a.whenISO))

  return (
    <Screen>
      <StatusBar />
      <TopBar title="Upcoming" onBack={closeOverlay} />
      <Scroll className="space-y-5 px-6 pb-24">
        {list.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-blue-soft text-blue">
              <CalendarDays className="size-7" strokeWidth={1.5} />
            </span>
            <h2 className="mt-5 font-serif text-[22px] font-medium">Nothing scheduled.</h2>
            <p className="mt-2 max-w-[15rem] text-[15px] leading-relaxed text-muted-foreground">
              Add appointments and MamaHQ will keep the questions you want to ask.
            </p>
          </div>
        ) : (
          <>
            {thisWeek.length > 0 && (
              <section className="space-y-2.5">
                <h2 className="px-1 font-serif text-[17px] font-medium">This week</h2>
                {thisWeek.map((a) => (
                  <EventRow key={a.id} appt={a} onOpen={() => openAppointment(a.id)} />
                ))}
              </section>
            )}
            {later.length > 0 && (
              <section className="space-y-2.5">
                <h2 className="px-1 font-serif text-[17px] font-medium">Later</h2>
                {later.map((a) => (
                  <EventRow key={a.id} appt={a} onOpen={() => openAppointment(a.id)} />
                ))}
              </section>
            )}
          </>
        )}
      </Scroll>

      <button
        onClick={() => composeAppointment(null)}
        aria-label="Add an appointment"
        className="absolute bottom-8 right-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_12px_30px_-8px_var(--primary)] transition-transform active:scale-95"
      >
        <Plus className="size-6" strokeWidth={2} />
      </button>
    </Screen>
  )
}
