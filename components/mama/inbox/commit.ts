'use client'

import { useLogs } from '../logs'
import { useAppointments } from '../appointments'
import { useMom } from '../mom'
import { useInbox, type Capture } from './store'
import type { ProposedItem } from './types'

/**
 * Turns approved ProposedItems into real data. This is the only place that maps
 * the Inbox's provider-agnostic proposals onto the concrete stores, keeping the
 * extractor and review UI decoupled from where committed data ultimately lands.
 */
export function useCommit() {
  const { addLog } = useLogs()
  const { addAppointment } = useAppointments()
  const { addTask, addQuestion: addMomQuestion } = useMom()
  const { markCommitted } = useInbox()

  function commitItem(item: ProposedItem) {
    switch (item.kind) {
      case 'log':
        if (item.log) {
          addLog({
            kind: item.log.logKind,
            amount: item.log.amount,
            diaperType: item.log.diaperType,
            createdAt: item.log.whenISO, // undefined → defaults to now in the store
          })
        }
        break
      case 'appointment':
        if (item.appointment) {
          addAppointment({
            title: item.appointment.title,
            whenISO: item.appointment.whenISO,
            location: item.appointment.location,
            remindersOn: true,
          })
        }
        break
      case 'task':
        if (item.text) addTask(item.text)
        break
      case 'question':
        // A standalone question goes to Mom's "questions for my doctor" list.
        if (item.text) addMomQuestion(item.text)
        break
      case 'note':
        // Notes with no better home become a mom to-do so nothing is silently lost.
        if (item.text) addTask(item.text)
        break
    }
  }

  /** Commit every included item on a capture, then mark it committed. Returns count. */
  function commitCapture(capture: Capture): number {
    const included = capture.items.filter((i) => i.include)
    included.forEach(commitItem)
    markCommitted(capture.id)
    return included.length
  }

  return { commitCapture }
}
