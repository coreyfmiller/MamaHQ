'use client'

import { useState } from 'react'
import { CalendarDays, Clock, MapPin, Plus, Trash2, X } from 'lucide-react'
import { useNav } from '../context'
import { useAppointments, longDate, shortTime } from '../appointments'
import { CategoryChip } from '../event-meta'
import { Card, CardLabel, CheckBox, Screen, Scroll, StatusBar, TopBar } from '../ui'

function DetailRow({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3.5 py-3">
      <span className="flex size-9 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-[18px]" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1 text-[15px]">{children}</div>
    </div>
  )
}

export function AppointmentScreen() {
  const { closeOverlay, selectedApptId, composeAppointment } = useNav()
  const { appointments, updateAppointment, removeAppointment, addQuestion, toggleQuestion, removeQuestion } =
    useAppointments()
  const [addingQ, setAddingQ] = useState(false)
  const [qText, setQText] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const appt = appointments.find((a) => a.id === selectedApptId)

  // The appointment may have been deleted (e.g. via this screen) — bail gracefully.
  if (!appt) {
    return (
      <Screen>
        <StatusBar />
        <TopBar variant="close" onBack={closeOverlay} />
        <div className="grid flex-1 place-items-center px-8 text-center text-muted-foreground">
          <p className="text-[15px]">This appointment is no longer here.</p>
        </div>
      </Screen>
    )
  }

  const submitQ = () => {
    if (!qText.trim()) return
    addQuestion(appt.id, qText)
    setQText('')
    setAddingQ(false)
  }

  return (
    <Screen>
      <StatusBar />
      <TopBar
        variant="close"
        onBack={closeOverlay}
        right={
          <button
            onClick={() => composeAppointment(appt.id)}
            className="pr-2 text-[15px] font-medium text-primary"
          >
            Edit
          </button>
        }
      />
      <Scroll className="space-y-4 px-6 pb-8">
        <div className="flex items-center gap-3">
          <CategoryChip category="appointment" size="lg" />
          <h1 className="font-serif text-[24px] leading-tight font-semibold tracking-tight">{appt.title}</h1>
        </div>

        <Card className="divide-y divide-border/60 py-1">
          <DetailRow icon={CalendarDays}>
            <p className="font-semibold">{longDate(appt.whenISO)}</p>
          </DetailRow>
          <DetailRow icon={Clock}>
            <p className="font-semibold">{shortTime(appt.whenISO)}</p>
          </DetailRow>
          {appt.location && (
            <DetailRow icon={MapPin}>
              <p className="font-semibold leading-tight">{appt.location}</p>
            </DetailRow>
          )}
        </Card>

        <Card className="flex items-center justify-between">
          <div>
            <p className="text-[15px] font-semibold">Reminders</p>
            <p className="text-[13px] text-muted-foreground">A day before · an hour before</p>
          </div>
          <button
            onClick={() => updateAppointment(appt.id, { remindersOn: !appt.remindersOn })}
            role="switch"
            aria-checked={appt.remindersOn}
            aria-label="Reminders"
            className={`relative h-7 w-12 rounded-full transition-colors ${appt.remindersOn ? 'bg-primary' : 'bg-border'}`}
          >
            <span
              className={`absolute top-1 size-5 rounded-full bg-card shadow transition-all ${appt.remindersOn ? 'left-6' : 'left-1'}`}
            />
          </button>
        </Card>

        <Card className="space-y-1">
          <CardLabel className="mb-1 text-foreground">Questions to ask</CardLabel>
          {appt.questions.length > 0 ? (
            <div className="divide-y divide-border/50">
              {appt.questions.map((q) => (
                <div key={q.id} className="flex items-center gap-3 py-2">
                  <button
                    onClick={() => toggleQuestion(appt.id, q.id)}
                    className="flex flex-1 items-center gap-3 text-left"
                    aria-label="Toggle asked"
                  >
                    <CheckBox checked={q.asked} />
                    <span className={`text-[15px] ${q.asked ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {q.text}
                    </span>
                  </button>
                  <button
                    onClick={() => removeQuestion(appt.id, q.id)}
                    aria-label="Remove question"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:text-destructive active:bg-muted"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-1 text-[14px] text-muted-foreground">
              Save questions here so you remember to ask at the visit.
            </p>
          )}

          {addingQ ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitQ()
                  if (e.key === 'Escape') setAddingQ(false)
                }}
                onBlur={() => (qText.trim() ? submitQ() : setAddingQ(false))}
                placeholder="e.g. Ask about the rash"
                className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
              />
              <button
                onClick={submitQ}
                className="rounded-xl bg-primary px-3.5 py-2 text-[14px] font-semibold text-primary-foreground transition-transform active:scale-95"
              >
                Add
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingQ(true)}
              className="mt-2 flex items-center gap-2 text-[14px] font-medium text-primary"
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-sage-soft">
                <Plus className="size-4" strokeWidth={2} />
              </span>
              Add a question
            </button>
          )}
        </Card>

        <p className="px-1 text-[12px] leading-relaxed text-muted-foreground">
          MamaHQ remembers your questions so you can ask your doctor. It won&apos;t answer medical
          questions for you.
        </p>

        {/* Delete — gated by a confirm so it isn't a one-tap loss. */}
        {confirmDelete ? (
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 rounded-full bg-muted py-3 text-[14px] font-semibold text-foreground"
            >
              Keep
            </button>
            <button
              onClick={() => {
                removeAppointment(appt.id)
                closeOverlay()
              }}
              className="flex-1 rounded-full bg-destructive py-3 text-[14px] font-semibold text-white"
            >
              Delete appointment
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex w-full items-center justify-center gap-2 py-2 text-[14px] font-medium text-destructive"
          >
            <Trash2 className="size-4" /> Delete appointment
          </button>
        )}
      </Scroll>
    </Screen>
  )
}
