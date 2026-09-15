import { cn } from '@/lib/utils'

/** A subtle, restrained botanical sprig used sparingly as brand texture. */
export function LeafSprig({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 200"
      fill="none"
      aria-hidden="true"
      className={cn('text-sage', className)}
    >
      <path
        d="M60 196 C60 150 60 96 60 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />
      {[
        { y: 150, up: false },
        { y: 122, up: true },
        { y: 96, up: false },
        { y: 72, up: true },
        { y: 50, up: false },
        { y: 30, up: true },
      ].map((leaf, i) => (
        <path
          key={i}
          d={
            leaf.up
              ? `M60 ${leaf.y} C40 ${leaf.y - 6} 24 ${leaf.y - 20} 20 ${leaf.y - 40} C42 ${leaf.y - 34} 56 ${leaf.y - 20} 60 ${leaf.y}`
              : `M60 ${leaf.y} C80 ${leaf.y - 6} 96 ${leaf.y - 20} 100 ${leaf.y - 40} C78 ${leaf.y - 34} 64 ${leaf.y - 20} 60 ${leaf.y}`
          }
          fill="currentColor"
          opacity={0.16 + i * 0.03}
        />
      ))}
    </svg>
  )
}
