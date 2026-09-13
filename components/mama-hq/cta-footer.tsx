import { ArrowRight } from 'lucide-react'

export function CtaFooter() {
  return (
    <>
      <section className="py-24">
        <div className="mx-auto max-w-3xl px-5 text-center">
          <h2 className="text-balance font-serif text-4xl leading-tight text-foreground sm:text-5xl">
            You take care of the baby.
            <br />
            Mama HQ takes care of everything else.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            One calm place for the first 90 days—so nothing important slips through, including you.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#start"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Start your first 90 days
              <ArrowRight className="size-4" />
            </a>
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-card px-7 text-base font-medium text-foreground transition-colors hover:bg-muted"
            >
              See how it works
            </a>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Mama HQ is an organization and support tool. It is not a medical app and does not provide
            medical advice or diagnosis.
          </p>
        </div>
      </section>

      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[0.65rem] font-semibold text-primary-foreground">
              m
            </span>
            <span className="font-serif text-base text-foreground">Mama HQ</span>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Mama HQ. Made with care.
          </p>
        </div>
      </footer>
    </>
  )
}
