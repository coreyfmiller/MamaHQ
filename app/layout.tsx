import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Mama HQ — A calm home for the first 90 days',
  description:
    'Mama HQ brings the first 90 days of motherhood together—feeds, sleep, appointments, reminders, questions, lists, memories, and everything running through your head. You take care of the baby. Mama HQ helps take care of everything else.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#f2ede2',
  width: 'device-width',
  initialScale: 1,
  // PR6 — no maximumScale: pinch-zoom must stay available (WCAG 1.4.4). iOS focus-
  // zoom is avoided instead by keeping form inputs at >= 16px.
  // viewport-fit=cover makes env(safe-area-inset-*) real, so the bottom nav, sheets
  // and the top spacer respect the notch/home indicator.
  viewportFit: 'cover',
  // On-screen keyboard resizes the layout viewport, so inputs in sheets stay visible.
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
