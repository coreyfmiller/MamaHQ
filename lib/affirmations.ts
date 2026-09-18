// MamaHQ — The First 90 Days affirmations. 90 days × 3 slots (morning/noon/night).
// Shown as a quiet card on Today, keyed to the baby's day number and time of day.
// Content is intentionally gentle and never medical advice.

export type Slot = 'morning' | 'noon' | 'night'

export interface DayAffirmations {
  morning: string
  noon: string
  night: string
}

// Index 0 unused; day 1..90 map to their entry so lookups read naturally.
export const AFFIRMATIONS: Record<number, DayAffirmations> = {
  1: {
    morning: "Everything is new today.\nYou don't need to know how to do all of this.\nYou only need to begin.",
    noon: 'Someone is taking care of your baby.\nMake sure someone is taking care of you, too.\nWater. Food. Rest. Help.',
    night: "You made it through Day 1.\nWhatever wasn't done can wait.\nYou were there. That's enough.",
  },
  2: {
    morning: "Today doesn't need a plan.\nTake it one feed, one cuddle, one hour at a time.",
    noon: 'Unclench your jaw. Drop your shoulders.\nTake one slow breath.\nYou are allowed to have needs today.',
    night: "You didn't have to do today beautifully.\nYou just had to get through it.\nAnd you did.",
  },
  3: {
    morning: "You are recovering from an enormous change.\nGoing slowly isn't falling behind.",
    noon: "Have you eaten?\nHave you had something to drink?\nCaring for yourself belongs on today's list.",
    night: "Some things went well today.\nSome probably didn't.\nNeither one defines the mother you are.",
  },
  4: {
    morning: "You don't have to prove you can handle everything.\nLet someone carry something for you.",
    noon: 'If someone asks, "What can I do?"\nGive them something.\nHelp is not a debt you have to repay.',
    night: 'You carried enough today.\nPut down what can wait until tomorrow.',
  },
  5: {
    morning: "You don't need to enjoy every moment\nto treasure this chapter of your life.",
    noon: "If today feels harder than you expected,\nthat doesn't mean you're doing it wrong.",
    night: 'You are allowed to say:\n"Today was hard."\nLove and exhaustion can exist together.',
  },
  6: {
    morning: "Your baby doesn't need a perfect version of you.\nThey need the version who keeps showing up.",
    noon: 'Lower the bar today.\nThen lower it once more.\nThis isn\u2019t an ordinary season.',
    night: "The laundry doesn't measure your love.\nNeither do the dishes.\nYou did the important things.",
  },
  7: {
    morning: 'One week.\nSeven days ago, you had never done this before.\nLook at you now.',
    noon: "Before you think about everything still to do,\nnotice everything you've already done.",
    night: "Your first week is complete.\nYou don't need to grade it.\nYou lived it.",
  },
  8: {
    morning: 'You are learning your baby.\nYour baby is learning you.\nGive both of you time.',
    noon: "You don't need to understand every cry.\nSometimes being there is the answer.",
    night: "There were moments today when you weren't sure.\nYou stayed anyway.\nThat's what matters.",
  },
  9: {
    morning: "Your old routine may be gone for a while.\nYou don't have to replace it immediately.",
    noon: 'Today can be messy.\nYour house can be messy.\nYour thoughts can be messy.',
    night: 'Nothing needs to be fixed tonight.\nRest wherever you can find it.',
  },
  10: {
    morning: "Ten days.\nYou know things about your baby today\nyou didn't know on Day 1.",
    noon: 'Someone else can hold the baby.\nSomeone else can wash the bottle.\nSomeone else can answer the message.',
    night: 'You did more today than anyone saw.\nMamaHQ saw you.',
  },
  11: {
    morning: "A difficult morning isn't a prediction\nof the rest of your day.",
    noon: 'Start the day over if you need to.\n2:17 p.m. is as good a time as any.',
    night: "A hard hour doesn't make you a bad mother.\nIt makes it a hard hour.",
  },
  12: {
    morning: 'You can love your baby completely\nand still miss parts of your old life.',
    noon: 'You are still you.\nMotherhood added something to you.\nIt didn\u2019t erase you.',
    night: "You don't have to love every minute.\nYou only have to love in the ways you can today.",
  },
  13: {
    morning: "You don't need to become the mother you imagined.\nMeet the mother you're actually becoming.",
    noon: 'Comparison has no useful job here.\nThis is your baby, your body, your family, your day.',
    night: 'There is no perfect way this day should have looked.\nLet the imaginary version go.',
  },
  14: {
    morning: "Two weeks.\nYou're still at the beginning.\nGive yourself beginning-level expectations.",
    noon: 'Before you take care of the next thing,\ncheck in with yourself.',
    night: 'Fourteen days of learning, adapting and showing up.\nThat deserves gentleness tonight.',
  },
  15: {
    morning: 'There is no prize for doing everything yourself.',
    noon: "What's one thing someone else could take off your plate today?\nLet them.",
    night: 'Being needed all day can be exhausting.\nYou are allowed to want a little space.',
  },
  16: {
    morning: 'Your needs didn\u2019t disappear\nwhen your baby arrived.',
    noon: 'Eat something you actually enjoy today, if you can.\nYou deserve more than leftovers and cold coffee.',
    night: 'You spent today caring for someone.\nOffer a little of that kindness to yourself.',
  },
  17: {
    morning: "What worked yesterday doesn't have to work today.\nYou are allowed to adjust.",
    noon: "Changing the plan isn't failing.\nIt's responding to what today needs.",
    night: 'You learned something today.\nEven if the lesson was simply, "That didn\u2019t work."',
  },
  18: {
    morning: "Today doesn't need to be productive.\nIt needs to be livable.",
    noon: 'If the only things happening today are feeding, changing, holding and resting,\nthat\u2019s a full day.',
    night: "You don't owe anyone a list of accomplishments.\nYou were present.",
  },
  19: {
    morning: 'You know more than you think you do.',
    noon: "Notice one thing you've started doing automatically.\nThat was once brand new.",
    night: "Confidence doesn't always arrive loudly.\nSometimes it looks like simply trying again.",
  },
  20: {
    morning: "Someone else's motherhood\nisn't the measuring stick for yours.",
    noon: "You are seeing snapshots of other people's lives.\nDon't compare them with your entire day.",
    night: 'Close the apps if you need to.\nYour real life is happening right here.',
  },
  21: {
    morning: 'Three weeks.\nYou\u2019re building a relationship that has never existed before.',
    noon: "You don't have to rush to the next milestone.\nThere is enough happening today.",
    night: "Three weeks of tiny moments\nhave already become part of your family's story.",
  },
  22: {
    morning: 'Not everything needs solving today.',
    noon: 'Pick the thing that actually matters.\nLet something else wait.',
    night: "Tomorrow can hold tomorrow's problems.",
  },
  23: {
    morning: 'You deserve care without having to earn it.',
    noon: 'Do one small thing for the person inside "Mom."',
    night: 'You are somebody worth taking care of, too.',
  },
  24: {
    morning: 'You are not "doing nothing."',
    noon: "You've fed, soothed, watched, listened, carried and remembered.\nInvisible work is still work.",
    night: 'A quiet day with a baby can contain a thousand acts of care.',
  },
  25: {
    morning: 'Small wins count today.',
    noon: 'A shower counts.\nLunch counts.\nFive quiet minutes count.',
    night: "Don't dismiss the little things that helped you make it through.",
  },
  26: {
    morning: 'You are allowed to protect your peace.',
    noon: 'Not every visitor needs a yes.\nNot every message needs an immediate answer.',
    night: 'Boundaries can be loving, too.',
  },
  27: {
    morning: 'Your home is allowed to look lived in.',
    noon: "Your baby isn't keeping score of the laundry.",
    night: 'A peaceful mother matters more than a perfect room.',
  },
  28: {
    morning: '"No" is a complete act of self-care.',
    noon: 'Save your energy for what actually needs you today.',
    night: "You don't need to explain every boundary you set.",
  },
  29: {
    morning: 'There will be easier days.',
    noon: "And if today isn't one of them,\nmake today smaller.",
    night: "You don't need to solve the whole season tonight.",
  },
  30: {
    morning: 'One month.\nThink about how much was unfamiliar thirty days ago.',
    noon: "Pause and notice something you've learned about your baby \u2014\nand something you've learned about yourself.",
    night: 'You made it through your first month.\nNot perfectly.\nFor real.',
  },
  31: {
    morning: "You don't need everyone's advice.",
    noon: 'Listen. Consider.\nThen choose what works for your family.',
    night: 'You are allowed to trust your own experience.',
  },
  32: {
    morning: 'Celebrate something small today.',
    noon: 'Maybe everyone got dressed.\nMaybe nobody did.\nFind your win anyway.',
    night: 'Ordinary victories deserve recognition.',
  },
  33: {
    morning: 'Trust yourself a little more today.',
    noon: "You have 32 days of experience\nthat Day-1 you didn't have.",
    night: "You won't always know the answer.\nYou can still trust yourself to look for it.",
  },
  34: {
    morning: "One difficult moment\ndoesn't get to define your whole day.",
    noon: 'If things unravel, begin again from here.',
    night: "Leave today's hardest moment where it belongs:\nin today.",
  },
  35: {
    morning: 'Your needs still belong in the family.',
    noon: 'Ask yourself what you need\nbefore automatically asking what everyone else needs.',
    night: "You don't have to disappear into motherhood.",
  },
  36: {
    morning: "You are doing more than it looks like.",
    noon: "You fed someone.\nComforted someone.\nProtected someone's tiny world.",
    night: 'That was not "nothing."\nThat was a day.',
  },
  37: {
    morning: 'The plan is allowed to change.',
    noon: "Flexibility isn't losing control.\nSometimes it's wisdom.",
    night: "Today happened the way it happened.\nYou can stop fighting the version that didn't.",
  },
  38: {
    morning: "You don't have to keep everything in your head.",
    noon: 'Write it down.\nShare it. Delegate it.\nLet technology remember something for you.',
    night: 'Your brain deserves somewhere to put things down.',
  },
  39: {
    morning: "You're getting better at this\neven when you can't see it.",
    noon: "Remember something that overwhelmed you two weeks ago.\nNotice what's different now.",
    night: 'Growth is often easier to see looking backward.',
  },
  40: {
    morning: 'Forty days of showing up.',
    noon: "You don't need a dramatic milestone today.\nBeing here is enough.",
    night: "Forty sunsets since everything changed.\nYou're still here.",
  },
  41: {
    morning: 'Your boundaries matter.',
    noon: 'Protect your time, your energy and your quiet where you can.',
    night: "You don't need to feel guilty for needing room to breathe.",
  },
  42: {
    morning: 'Six weeks.',
    noon: "You've already handled hundreds of moments\nyou once wondered how you'd handle.",
    night: 'Give some credit to the woman\nwho kept figuring it out.',
  },
  43: {
    morning: 'Today gets a fresh start.',
    noon: 'So does this afternoon.',
    night: "You don't have to carry a difficult morning into bed.",
  },
  44: {
    morning: 'Rest does not need to be earned.',
    noon: 'Sit down when you can.\nThe world can continue without your constant motion.',
    night: 'Your unfinished list is not an emergency.',
  },
  45: {
    morning: 'Halfway through the First 90 Days.',
    noon: 'Forty-five days ago, so much of this was unknown.\nLook at what feels familiar now.',
    night: "You may not notice how much you've changed.\nBut you have.",
  },
  46: {
    morning: "Your instincts don't have to be perfect to matter.",
    noon: "Pay attention to what you've learned about your baby.",
    night: 'You listened. You noticed. You responded.\nThat matters.',
  },
  47: {
    morning: 'Strong mothers ask for backup.',
    noon: 'Hand something over today\nwithout supervising how it\u2019s done.',
    night: "You don't have to be the only person who knows how.",
  },
  48: {
    morning: 'Put something down today.',
    noon: 'One task. One expectation. One unnecessary worry.\nChoose one.',
    night: 'Feel the space created by not carrying everything.',
  },
  49: {
    morning: 'Seven weeks of getting to know each other.',
    noon: 'Your baby is becoming more familiar.\nSo is this version of you.',
    night: 'You are building this relationship one ordinary day at a time.',
  },
  50: {
    morning: 'Fifty days.',
    noon: 'There are things you do now without thinking\nthat once felt enormous.',
    night: "Don't forget how brave the beginning required you to be.",
  },
  51: {
    morning: "You don't have to solve tomorrow today.",
    noon: 'Come back to the next hour.',
    night: 'Tomorrow can wait outside the bedroom door.',
  },
  52: {
    morning: "Your worth isn't measured by productivity.",
    noon: 'Being busy and being valuable\nwere never the same thing.',
    night: "You were enough before today's checklist.\nYou're enough after it.",
  },
  53: {
    morning: 'There is still room for you here.',
    noon: 'Music you like. Food you love. A friend you miss.\nReconnect with one tiny piece of yourself.',
    night: "You didn't stop being you when you became Mom.",
  },
  54: {
    morning: 'You can begin again at any time.',
    noon: 'Bad morning?\nWelcome to your new beginning.',
    night: "You don't have to take today's mistakes into tomorrow.",
  },
  55: {
    morning: 'Some seasons are about thriving.\nSome are about getting through.',
    noon: "You don't have to turn this season into a performance.",
    night: 'Surviving a demanding day is an accomplishment.',
  },
  56: {
    morning: 'Eight weeks.',
    noon: 'Think of the woman who woke up on Day 1.\nShe would be amazed by what you know now.',
    night: "You've grown alongside your baby.",
  },
  57: {
    morning: "You don't have to carry the whole mental load.",
    noon: 'Delegate the responsibility,\nnot just the task.',
    night: "You are allowed to stop being the household's reminder system.",
  },
  58: {
    morning: 'Let something else remember for you today.',
    noon: 'Put the appointment in the calendar.\nPut the task on the list.\nGet it out of your head.',
    night: "Your mind wasn't designed to be a storage closet.",
  },
  59: {
    morning: "Wanting quiet doesn't make you ungrateful.",
    noon: 'Five minutes alone can be a need,\nnot a luxury.',
    night: "Being touched and needed all day can be a lot.\nIt's okay to want space.",
  },
  60: {
    morning: 'Two months.',
    noon: 'You have spent sixty days adapting to a life\nthat changed overnight.',
    night: "You aren't the same person who started.\nYou weren't supposed to be.",
  },
  61: {
    morning: 'Notice what your baby needs.\nNotice what you need, too.',
    noon: 'Check in with yourself\nwith the same curiosity you give your baby.',
    night: 'Your feelings deserve somewhere to land.',
  },
  62: {
    morning: 'You are allowed to enjoy yourself.',
    noon: 'Laugh without feeling guilty.\nWatch something silly.\nEnjoy a moment that has nothing to do with parenting.',
    night: "Joy doesn't mean you've forgotten how hard this can be.",
  },
  63: {
    morning: 'Nine weeks.',
    noon: "So many ordinary moments\nhave quietly become your baby's beginning.",
    night: "You don't have to make every moment magical.\nOrdinary love is powerful.",
  },
  64: {
    morning: "You don't need permission to make life easier.",
    noon: 'Choose the easier option today if it helps.',
    night: "Harder doesn't automatically mean better.",
  },
  65: {
    morning: "Convenience isn't failure.",
    noon: 'Take the shortcut.\nOrder the food. Skip the unnecessary thing.',
    night: "You don't get extra points for exhaustion.",
  },
  66: {
    morning: 'You get to decide what works for your family.',
    noon: 'Advice can be useful without becoming a rule.',
    night: "You don't need everyone to understand your choices.",
  },
  67: {
    morning: "You don't owe the world a parenting explanation.",
    noon: "Protect your energy from debates you don't need.",
    night: 'Peace is sometimes choosing not to explain.',
  },
  68: {
    morning: 'You can be grateful and tired.',
    noon: 'Two feelings can be true at the same time.',
    night: "You don't have to turn exhaustion into gratitude before you're allowed to feel it.",
  },
  69: {
    morning: "Feeling overwhelmed doesn't erase your love.",
    noon: 'If today feels like too much,\nmake the next step very small.',
    night: 'A hard day says nothing about how deeply you love your baby.',
  },
  70: {
    morning: 'Seventy days.',
    noon: "You've spent seventy days learning a person\nwho couldn't tell you what they needed.",
    night: 'Give yourself credit for all the listening you\u2019ve done without words.',
  },
  71: {
    morning: "Your head doesn't have to hold everything.",
    noon: 'Move one responsibility somewhere else:\na list, calendar, person or app.',
    night: 'Put the mental clipboard down.',
  },
  72: {
    morning: 'Remember Day 1?',
    noon: 'Some things that once felt impossible\nhave quietly become ordinary.',
    night: "You've come farther than today's tiredness lets you see.",
  },
  73: {
    morning: 'Your confidence grew quietly.',
    noon: 'It grew every time you tried, adjusted and tried again.',
    night: "You don't have to feel fearless to recognize your progress.",
  },
  74: {
    morning: 'Make a little room for yourself today.',
    noon: 'Not Mom.\nNot partner.\nNot employee.\nJust you.',
    night: 'Even ten minutes that belong only to you still belong to you.',
  },
  75: {
    morning: 'Seventy-five days of caring for someone else.',
    noon: 'Remember:\nyou are someone, too.',
    night: "Speak to yourself tonight\nthe way you'd speak to someone you love.",
  },
  76: {
    morning: "You don't have to \u201cget back\u201d to who you were.",
    noon: 'You can keep parts of her\nand discover parts of someone new.',
    night: 'There is no deadline for becoming comfortable in your new life.',
  },
  77: {
    morning: "You're allowed to change.",
    noon: 'Motherhood can add to your identity\nwithout consuming it.',
    night: "You're still becoming.\nThat's not something to rush.",
  },
  78: {
    morning: "You've learned more than you realize.",
    noon: "Think about one thing you'd tell Day-1 you.",
    night: 'You became the person who could give her that advice.',
  },
  79: {
    morning: "Don't rush this season because it's difficult.",
    noon: "And don't pressure yourself to treasure every second because it's temporary.",
    night: 'You are allowed simply to live it.',
  },
  80: {
    morning: 'Eighty days.',
    noon: "You've navigated thousands of tiny unknowns.",
    night: "You didn't need every answer.\nYou kept finding the next one.",
  },
  81: {
    morning: "Trust the mother you're becoming.",
    noon: 'Not because she knows everything.\nBecause she keeps learning.',
    night: 'You can be a work in progress\nand a wonderful mother simultaneously.',
  },
  82: {
    morning: 'Perfection was never the assignment.',
    noon: 'Connection matters more than performance.',
    night: "You don't need to replay everything you could have done differently.",
  },
  83: {
    morning: "Your baby doesn't need a showroom.",
    noon: 'Leave the dishes if you need to.\nChoose the thing that matters more.',
    night: "The mess can stay.\nToday can't.",
  },
  84: {
    morning: 'Twelve weeks.',
    noon: 'Some routines formed so gradually\nyou may not have noticed them arriving.',
    night: 'What once felt completely unfamiliar\nis beginning to feel like your life.',
  },
  85: {
    morning: 'You are allowed to be proud of yourself.',
    noon: 'Not just of your baby.\nOf you.',
    night: 'You did something extraordinary\none ordinary day at a time.',
  },
  86: {
    morning: "Look at what doesn't scare you anymore.",
    noon: "Things that once made you question everything\nare now things you've handled before.",
    night: 'Experience has been accumulating quietly inside you.',
  },
  87: {
    morning: 'You have carried things nobody saw.',
    noon: 'The remembering.\nThe worrying.\nThe planning.\nThe loving.',
    night: "Invisible doesn't mean insignificant.",
  },
  88: {
    morning: "You don't need to have motherhood figured out.",
    noon: 'Nobody graduates on Day 90.',
    night: 'There will always be something new to learn.\nYou now know you can learn it.',
  },
  89: {
    morning: "Tomorrow isn't a finish line.",
    noon: "Pause today and notice the person you've become over these 89 days.",
    night: 'Tonight, remember Day 1.\nYou knew so little about what was ahead.\nAnd still, you began.',
  },
  90: {
    morning: 'Ninety days ago, everything changed.\nYou began without knowing exactly who you\u2019d become.\nLook at you now.',
    noon: "Before we celebrate the baby today,\nlet's celebrate you.\nYou learned. You adapted. You kept showing up.",
    night: 'You made it through your First 90 Days.\nNot because every day was perfect \u2014\nbecause you kept showing up.\nTomorrow is Day 91. MamaHQ is still here. \uD83E\uDD0D',
  },
}

// Evergreen fallback for Day 91+ (and any gap), so there's always something kind.
const BEYOND: DayAffirmations = {
  morning: 'You are past the first 90 days \u2014 and still showing up.\nThat was never the easy part; you did it anyway.',
  noon: "You don't need a milestone to deserve a kind word.\nHere's one: you're doing well.",
  night: 'Another day of quiet, invisible care.\nRest now. MamaHQ is still here. \uD83E\uDD0D',
}

/** Time-of-day slot from the hour: morning < 12, noon < 18, else night. */
export function slotForHour(now: Date = new Date()): Slot {
  const h = now.getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'noon'
  return 'night'
}

/** The affirmation for a given day number + time, with graceful Day 91+ fallback. */
export function pickAffirmation(day: number, now: Date = new Date()): string {
  const slot = slotForHour(now)
  const entry = day >= 1 && day <= 90 ? AFFIRMATIONS[day] : BEYOND
  return (entry ?? BEYOND)[slot]
}
