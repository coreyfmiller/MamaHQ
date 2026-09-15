'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { initialOf } from './profile'

/**
 * Shows the baby's photo when one exists; otherwise a calm initial-in-a-circle
 * so a photo is never required. Sizing is caller-controlled via className.
 */
export function NameAvatar({
  name,
  photo,
  className,
  textClassName,
}: {
  name: string
  photo?: string
  className?: string
  textClassName?: string
}) {
  if (photo) {
    return (
      <span className={cn('relative overflow-hidden rounded-full', className)}>
        <Image src={photo} alt={`${name}'s photo`} fill sizes="96px" className="object-cover" />
      </span>
    )
  }
  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-full bg-sage-soft font-serif font-semibold text-sage',
        className,
      )}
      aria-label={name}
    >
      <span className={cn('leading-none', textClassName)}>{initialOf(name)}</span>
    </span>
  )
}
