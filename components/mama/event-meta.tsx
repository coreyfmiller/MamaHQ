import {
  Milk,
  Moon,
  Droplets,
  Droplet,
  Heart,
  Pill,
  CalendarDays,
  ShoppingBag,
  StickyNote,
  Bell,
  type LucideIcon,
} from 'lucide-react'
import type { Category } from '@/lib/mama-data'

interface Meta {
  Icon: LucideIcon
  /** soft background tint for the icon chip */
  chip: string
  /** icon / accent foreground color */
  fg: string
}

const map: Record<Category, Meta> = {
  feed: { Icon: Milk, chip: 'bg-peach-soft', fg: 'text-peach' },
  sleep: { Icon: Moon, chip: 'bg-blue-soft', fg: 'text-blue' },
  diaper: { Icon: Droplets, chip: 'bg-sage-soft', fg: 'text-sage' },
  nursing: { Icon: Heart, chip: 'bg-blush-soft', fg: 'text-blush' },
  pumping: { Icon: Droplet, chip: 'bg-beige-soft', fg: 'text-beige' },
  medication: { Icon: Pill, chip: 'bg-blush-soft', fg: 'text-blush' },
  appointment: { Icon: CalendarDays, chip: 'bg-blue-soft', fg: 'text-blue' },
  task: { Icon: ShoppingBag, chip: 'bg-beige-soft', fg: 'text-beige' },
  note: { Icon: StickyNote, chip: 'bg-sage-soft', fg: 'text-sage' },
  reminder: { Icon: Bell, chip: 'bg-peach-soft', fg: 'text-peach' },
}

export function categoryMeta(category: Category): Meta {
  return map[category]
}

export function CategoryChip({
  category,
  size = 'md',
}: {
  category: Category
  size?: 'sm' | 'md' | 'lg'
}) {
  const { Icon, chip, fg } = categoryMeta(category)
  const box = size === 'lg' ? 'size-11' : size === 'sm' ? 'size-8' : 'size-9'
  const icon = size === 'lg' ? 'size-5' : size === 'sm' ? 'size-4' : 'size-[18px]'
  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-2xl ${chip} ${fg}`}
    >
      <Icon className={icon} strokeWidth={1.75} />
    </span>
  )
}
