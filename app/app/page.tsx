import { Prototype } from '@/components/mama/prototype'

// The app. Public visitors land on the marketing page at `/`; this route is
// Mama HQ itself. It is auth-gated (AuthGate): signed-out users see the sign-in
// screen, never a local-only prototype masquerading as a real household. Once
// signed in, shared household state is persisted in Supabase (RLS-scoped);
// localStorage is only a read-cache/offline fallback while signed in, and the
// store for the signed-out marketing/demo path. Real, durable, shared data always
// requires authentication.
export default function AppPage() {
  return <Prototype />
}
