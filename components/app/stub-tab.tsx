'use client'

export function StubTab({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-8 text-center">
      <h1 className="font-serif text-2xl text-foreground">{title}</h1>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">{note}</p>
    </div>
  )
}
