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
  const { addAppointment, addQuestion: addApptQuestion } = useAppointments()
  const { addTask, addQuestion: addMomQuestion } = useMom()
  const { markCommitted } = useInbox()

  /**
   * Commit every included item on a capture, then mark it committed. Returns count.
   *
   * Ordering matters: we commit the appointment(s) FIRST and remember the id of the
   * one created in this capture. Then any question captured in the same breath
   * ("doctor Thursday, ask about the rash") attaches to THAT appointment's
   * "questions to ask" list — which is the whole point of the feature. Questions
   * only fall back to Mom's general doctor-questions list when the capture has no
   * appointment to hang them on.
   */
  function commitCapture(capture: Capture): number {
    const included = capture.items.filter((i) => i.include)

    // Pass 1: appointments (so questions in this capture can attach to one).
    let apptId: string | null = null
    for (const item of included) {
      if (item.kind === 'appointment' && item.appointment) {
        const created = addAppointment({
          title: item.appointment.title,
          whenISO: item.appointment.whenISO,
          location: item.appointment.location,
          remindersOn: true,
        })
        // If several appointments were captured, questions attach to the first.
        if (!apptId) apptId = created.id
      }
    }

    // Pass 2: everything else.
    for (const item of included) {
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
        case 'task':
          if (item.text) addTask(item.text)
          break
        case 'question':
          if (item.text) {
            // Attach to the appointment from this same capture if there is one;
            // otherwise it's a standalone question for Mom's doctor list.
            if (apptId) addApptQuestion(apptId, item.text)
            else addMomQuestion(item.text)
          }
          break
        case 'note':
          // Notes with no better home become a mom to-do so nothing is silently lost.
          if (item.text) addTask(item.text)
          break
        case 'appointment':
          // Already handled in pass 1.
          break
      }
    }

    markCommitted(capture.id)
    return included.length
  }

  return { commitCapture }
}
