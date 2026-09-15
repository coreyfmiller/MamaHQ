export type Category =
  | 'feed'
  | 'sleep'
  | 'diaper'
  | 'nursing'
  | 'pumping'
  | 'medication'
  | 'appointment'
  | 'task'
  | 'note'
  | 'reminder'

export interface TimelineEvent {
  id: string
  category: Category
  title: string
  detail?: string
  time: string
}

export interface RightNowItem {
  category: Category
  label: string
  value: string
  live?: boolean
}

export interface ExtractionItem {
  id: string
  category: Category
  title: string
  detail: string
}

export const baby = {
  name: 'Emma',
  age: '3 weeks old',
  photo: '/images/baby-emma.png',
}

export const rightNow: RightNowItem[] = [
  { category: 'feed', label: 'Last feed', value: '4 oz \u00b7 1h 14m ago' },
  { category: 'sleep', label: 'Sleeping', value: 'Since 8:32 AM \u00b7 1h 9m', live: true },
  { category: 'diaper', label: 'Last diaper', value: 'Wet \u00b7 2h 3m ago' },
]

export const todayTimeline: TimelineEvent[] = [
  { id: 't1', category: 'diaper', title: 'Wet diaper', time: '2:14 PM' },
  { id: 't2', category: 'feed', title: 'Bottle', detail: '4 oz', time: '2:00 PM' },
  { id: 't3', category: 'sleep', title: 'Nap', detail: '54 min', time: '12:42 PM \u2013 1:36 PM' },
  { id: 't4', category: 'nursing', title: 'Nursing', detail: '14 min', time: '11:50 AM' },
  { id: 't5', category: 'diaper', title: 'Dirty diaper', time: '9:20 AM' },
  { id: 't6', category: 'feed', title: 'Bottle', detail: '3 oz', time: '8:15 AM' },
]

export const todayTasks = [
  { id: 'k1', label: 'Pick up formula' },
  { id: 'k2', label: 'Call pharmacy' },
]

export const doctorAppointment = {
  title: 'Doctor appointment',
  time: '11:00 AM',
  dateLong: 'Thursday, Apr 11',
  timeRange: '11:00 AM \u2013 11:30 AM',
  locationName: 'Riverside Pediatrics',
  locationAddress: '123 Maple St, Toronto',
  questions: [
    { id: 'q1', label: 'Feeding discomfort' },
    { id: 'q2', label: 'Rash on chest' },
    { id: 'q3', label: 'Vitamin D?' },
  ],
  reminders: ['1 day before', '1 hour before'],
}

export const brainDump = {
  author: 'You',
  time: '2 min ago',
  text:
    'She had 4oz around 2, wet diaper after that, we\u2019re low on formula and remind me about the doctor tomorrow.',
}

export const inboxFound: ExtractionItem[] = [
  { id: 'f1', category: 'feed', title: 'Bottle', detail: '4 oz \u00b7 2:00 PM' },
  { id: 'f2', category: 'diaper', title: 'Diaper', detail: 'Wet \u00b7 ~2:15 PM' },
  { id: 'f3', category: 'task', title: 'Buy formula', detail: 'Add to your list' },
  { id: 'f4', category: 'appointment', title: 'Doctor appointment', detail: 'Tomorrow \u00b7 11:00 AM' },
]

export const photoExtraction: {
  group: string
  category: Category
  items: { id: string; title: string; detail?: string }[]
}[] = [
  {
    group: 'Appointment',
    category: 'appointment',
    items: [{ id: 'p1', title: 'Emma\u2019s doctor visit', detail: 'Thursday \u00b7 11:00 AM' }],
  },
  {
    group: 'Questions',
    category: 'note',
    items: [
      { id: 'p2', title: 'Ask about rash' },
      { id: 'p3', title: 'Ask about feeding discomfort' },
    ],
  },
  { group: 'Task', category: 'task', items: [{ id: 'p4', title: 'Pick up formula' }] },
  { group: 'Reminder', category: 'reminder', items: [{ id: 'p5', title: 'Call pharmacy' }] },
  { group: 'Note', category: 'note', items: [{ id: 'p6', title: 'Vitamin D?' }] },
]

export const moods = [
  { id: 'tired', label: 'Tired', icon: 'moon' as const },
  { id: 'okay', label: 'Okay', icon: 'sun' as const },
  { id: 'good', label: 'Good', icon: 'smile' as const },
  { id: 'great', label: 'Great', icon: 'star' as const },
]

export const meTasks = [
  { id: 'm1', label: 'Take medication' },
  { id: 'm2', label: 'Eat something' },
  { id: 'm3', label: 'Call doctor' },
]

export const meComingUp = {
  title: 'Postpartum appointment',
  when: 'Thursday \u00b7 10:30 AM',
}

export const doctorQuestions = [
  { id: 'd1', label: 'Breastfeeding discomfort' },
  { id: 'd2', label: 'Headaches at night' },
  { id: 'd3', label: 'Medication question' },
]

export const upcoming = {
  thisWeek: [
    { id: 'u1', day: 'Thursday 11', title: 'Postpartum appointment', time: '10:30 AM', category: 'appointment' as Category },
    { id: 'u2', day: 'Friday 12', title: 'Pick up formula', time: '', category: 'task' as Category },
    { id: 'u3', day: 'Saturday 13', title: 'Family visit', time: '2:00 PM', category: 'note' as Category },
  ],
  later: [
    { id: 'u4', day: 'Apr 20', title: 'Emma\u2019s vaccines', time: '1:00 PM', category: 'appointment' as Category },
    { id: 'u5', day: 'Apr 28', title: 'Partner away', time: 'All day', category: 'note' as Category },
  ],
}

export const memories = [
  { id: 'me1', title: '3 weeks old', note: 'Already so loved.', photo: '/images/baby-feet.png' },
  { id: 'me2', title: 'First nap on daddy', note: 'Out cold in minutes.', photo: '/images/memory-sleeping.png' },
  { id: 'me3', title: 'Tiny hands', note: 'Holding on tight.', photo: '/images/newborn-hand.png' },
]

export const partner = {
  name: 'Alex',
  recent: [
    { id: 'pr1', category: 'feed' as Category, title: 'Bottle', detail: '4 oz', time: '2:00 PM' },
    { id: 'pr2', category: 'diaper' as Category, title: 'Wet diaper', detail: '', time: '2:14 PM' },
    { id: 'pr3', category: 'sleep' as Category, title: 'Nap', detail: '54 min', time: '12:42 PM' },
  ],
  today: [
    { id: 'pt1', category: 'appointment' as Category, title: 'Doctor appointment', time: '11:00 AM' },
  ],
  todayTasks: [{ id: 'ptk1', label: 'Pick up formula' }],
}

export const stages = [
  { id: 's1', name: 'Newborn', range: '0\u20133 months', icon: 'baby' as const },
  { id: 's2', name: 'Infant', range: '3\u201312 months', icon: 'rattle' as const },
  { id: 's3', name: 'Toddler', range: '1\u20133 years', icon: 'blocks' as const },
  { id: 's4', name: 'Preschool', range: '3\u20135 years', icon: 'crayon' as const },
  { id: 's5', name: 'School age', range: '5\u201312 years', icon: 'backpack' as const },
  { id: 's6', name: 'Teen', range: '12+', icon: 'headphones' as const },
]

export const reminders = [
  {
    id: 'r1',
    title: 'Emma\u2019s doctor appointment is tomorrow at 11 AM.',
    body: 'You saved 3 questions to ask.',
    primary: 'View appointment',
  },
  {
    id: 'r2',
    title: 'You wanted to remember to pick up formula today.',
    body: '',
    primary: 'Mark done',
  },
]
