import { SiteHeader } from '@/components/mama-hq/site-header'
import { Hero } from '@/components/mama-hq/hero'
import { BrainDump } from '@/components/mama-hq/brain-dump'
import { NinetyDays } from '@/components/mama-hq/ninety-days'
import { Features } from '@/components/mama-hq/features'
import { ForMom } from '@/components/mama-hq/for-mom'
import { ShareLoad } from '@/components/mama-hq/share-load'
import { CtaFooter } from '@/components/mama-hq/cta-footer'

// Public marketing landing. The front door for anyone who isn't signed in yet.
// Every "Start" / "Get started" call-to-action routes to /app, which gates on auth.
export default function HomePage() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <BrainDump />
        <NinetyDays />
        <Features />
        <ForMom />
        <ShareLoad />
        <CtaFooter />
      </main>
    </div>
  )
}
