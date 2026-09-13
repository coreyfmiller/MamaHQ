import Link from 'next/link'

const links = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'First 90 days', href: '#ninety-days' },
  { label: 'Features', href: '#features' },
  { label: 'For mom', href: '#for-mom' },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-[0.7rem] font-semibold text-primary-foreground">
            m
          </span>
          <span className="font-serif text-lg tracking-tight text-foreground">Mama HQ</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a
          href="#start"
          className="inline-flex h-9 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Get started
        </a>
      </div>
    </header>
  )
}
