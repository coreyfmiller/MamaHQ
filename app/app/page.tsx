import { MamaHqApp } from '@/components/app/mama-hq-app'

// The gated product. Public visitors land on the marketing page at `/`;
// this route is the actual Mama HQ app, shown once signed in (and shows the
// sign-in screen when signed out).
export default function AppPage() {
  return <MamaHqApp />
}
