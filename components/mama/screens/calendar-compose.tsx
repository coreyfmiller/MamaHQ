'use client'

import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useNav } from '../context'
import { useHousehold, type HouseholdPerson } from '../household'
import { useCalendar } from '../calendar'
import { toLocalInput, fromLocalInput } from '../logs'
import { Card, CardLabel, Screen, Scroll, StatusBar, TopBar } from '../ui'

// Step 10 — create/edit a calendar event. Uses normal structured fields (no NLP).
// Event = what/when; participants = who it's about; responsible = who's handling it
// (a designation, not an acceptance). People are real HouseholdPeople.

const NONE = '__none__'

// Default a new timed event to the next sensible hour (tomorrow 10:00 local).
function defaultStart(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  return d.toISOString()
}
// YYYY-MM-DD for a date input, from an ISO or now+1.
function defaultDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export function CalendarComposeScreen() {
  const { selectedEventId, openOverlay, closeOverlay, showToast } = useNav()
  const { events, create, update, remove } = useCalendar()
  const { people, me } = useHousehold()

  const editing = useMemo(() => events.find((e) => e.id === selectedEventId) ?? null, [events, selectedEventId])

  const [title, setTitle] = useState(editing?.title ?? '')
  const [allDay, setAllDay] = useState(editing?.allDay ?? false)
  const [start, setStart] = useState(editing && !editing.allDay && editing.startsAt ? toLocalInput(editing.startsAt) : toLocalInput(defaultStart()))
  const [end, setEnd] = useState(editing && !editing.allDay && editing.endsAt ? toLocalInput(editing.endsAt) : '')
  const [startDate, setStartDate] = useState(editing && editing.allDay && editing.startDate ? editing.startDate : defaultDate())
  const [endDate, setEndDate] = useState(editing && editing.allDay && editing.endDate ? editing.endDate : '')
  const [location, setLocation] = useState(editing?.location ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [participants, setParticipants] = useState<string[]>(editing?.participantIds ?? [])
  const [responsible, setResponsible] = useState<string>(editing?.responsiblePersonId ?? NONE)
  const [busy, setBusy] = useState(false)

  const toggleParticipant = (id: string) => {
    setParticipants((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
  }

  const save = async () => {
    if (!title.trim() || busy) return
    setBusy(true)
    const common = {
      title: title.trim(),
      allDay,
      startsAt: allDay ? null : fromLocalInput(start),
      endsAt: allDay ? null : end ? fromLocalInput(end) : null,
      startDate: allDay ? startDate : null,
      endDate: allDay ? (endDate || null) : null,
      location: location.trim() || null,
      notes: notes.trim() || null,
      responsiblePersonId: responsible === NONE ? null : responsible,
      participantIds: participants,
    }
    const res = editing
      ? await update(editing.id, {
          ...common,
          clearResponsible: responsible === NONE,
          replaceParticipants: true,
        })
      : await create(common)
    setBusy(false)
    if (res.ok) {
      showToast(editing ? 'Event updated' : 'Event added')
      openOverlay('calendar')
    } else {
      showToast(res.error ? `Couldn't save: ${res.error}` : "Couldn't save event")
    }
  }

  const del = async () => {
    if (!editing || busy) return
    setBusy(true)
    const res = await remove(editing.id)
    setBusy(false)
    showToast(res.ok ? 'Event deleted' : "Couldn't delete")
    if (res.ok) openOverlay('calendar')
  }

  return (
    <Screen>
      <StatusBar />
      <TopBar
        variant="close"
        title={editing ? 'Edit event' : 'Add event'}
        onBack={() => (editing ? openOverlay('calendar') : closeOverlay())}
        right={
          <button
            onClick={save}
            disabled={!title.trim() || busy}
            className="rounded-full bg-primary px-4 py-1.5 text-[14px] font-semibold text-primary-foreground disabled:opacity-40"
          >
            Save
          </button>
        }
      />
      <Scroll className="space-y-4 px-6 pb-8">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add event, e.g. Dentist"
          className="w-full rounded-xl border border-border bg-card px-3 py-3 text-[17px] font-medium text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={!editing}
        />

        {/* When */}
        <Card className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-[15px] font-medium">All day</span>
            <button
              onClick={() => setAllDay((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition-colors ${allDay ? 'bg-primary' : 'bg-muted'}`}
              aria-pressed={allDay}
              aria-label="All-day event"
            >
              <span className={`absolute top-0.5 size-5 rounded-full bg-card transition-transform ${allDay ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </label>

          {allDay ? (
            <div className="space-y-2.5">
              <div>
                <CardLabel className="mb-1.5">Date</CardLabel>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[14px] outline-none focus:border-primary" />
              </div>
              <div>
                <CardLabel className="mb-1.5">End date (optional, for multi-day)</CardLabel>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[14px] outline-none focus:border-primary" />
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div>
                <CardLabel className="mb-1.5">Starts</CardLabel>
                <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[14px] outline-none focus:border-primary" />
              </div>
              <div>
                <CardLabel className="mb-1.5">Ends (optional)</CardLabel>
                <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[14px] outline-none focus:border-primary" />
              </div>
            </div>
          )}
        </Card>

        {/* Who is this for? */}
        <Card className="space-y-2">
          <CardLabel className="text-foreground">Who&apos;s this for?</CardLabel>
          {people.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No household people yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {people.map((p) => (
                <PersonChip key={p.id} person={p} meId={me?.id ?? null} active={participants.includes(p.id)} onClick={() => toggleParticipant(p.id)} />
              ))}
            </div>
          )}
        </Card>

        {/* Who's handling it? */}
        <Card className="space-y-2">
          <CardLabel className="text-foreground">Who&apos;s handling it?</CardLabel>
          <div className="flex flex-wrap gap-2">
            <ResponsibleChip label="No one" active={responsible === NONE} onClick={() => setResponsible(NONE)} />
            {people.map((p) => (
              <ResponsibleChip
                key={p.id}
                label={me && p.id === me.id ? 'Me' : p.displayName}
                active={responsible === p.id}
                onClick={() => setResponsible(p.id)}
              />
            ))}
          </div>
        </Card>

        {/* Details */}
        <Card className="space-y-2.5">
          <div>
            <CardLabel className="mb-1.5">Location (optional)</CardLabel>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Dr. Smith Dental"
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[14px] outline-none placeholder:text-muted-foreground/60 focus:border-primary" />
          </div>
          <div>
            <CardLabel className="mb-1.5">Notes (optional)</CardLabel>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-[14px] outline-none placeholder:text-muted-foreground/60 focus:border-primary" />
          </div>
        </Card>

        {editing && (
          <button
            onClick={del}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-destructive/40 py-3 text-[15px] font-semibold text-destructive transition-colors active:bg-destructive/5 disabled:opacity-40"
          >
            <Trash2 className="size-4" /> Delete event
          </button>
        )}
      </Scroll>
    </Screen>
  )
}

function PersonChip({ person, meId, active, onClick }: { person: HouseholdPerson; meId: string | null; active: boolean; onClick: () => void }) {
  const label = meId && person.id === meId ? 'Me' : person.displayName
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
        active ? 'border-primary bg-sage-soft text-primary' : 'border-border/70 bg-card text-muted-foreground'
      }`}
    >
      {label}
    </button>
  )
}

function ResponsibleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
        active ? 'border-primary bg-sage-soft text-primary' : 'border-border/70 bg-card text-muted-foreground'
      }`}
    >
      {label}
    </button>
  )
}
