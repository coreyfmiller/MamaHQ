import { Prototype } from '@/components/mama/prototype'

// The app. Public visitors land on the marketing page at `/`; this route is
// Mama HQ itself — onboarding on first run, then the Today/Baby/Inbox/Me tabs.
// State is persisted locally (localStorage); there is no backend.
export default function AppPage() {
  return <Prototype />
}
