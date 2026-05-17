'use client';

import { usePathname } from 'next/navigation';
import { AppShellProvider } from '@/lib/app/AppShellContext';
import BottomNav from '@/components/app/BottomNav';

/**
 * Persistent shell for every `/app/*` route.
 *
 * Phase 2 of the route refactor: the BottomNav now lives here so
 * it survives navigations between the map and its sibling routes
 * (chat / comunidades / superchat / ranking / perfil / u/[id]).
 * The nav itself consumes `useAppShell()` + `usePathname()` to
 * paint its active-state — there's no prop wiring from this
 * layout anymore, the architecture is fully decoupled.
 *
 * `/app/select` stays OUTSIDE the shell — that page is a pre-app
 * gate where the user picks a universe. Spawning the chat
 * websocket + rendering the BottomNav during a 5-second
 * pick-a-universe screen would be wasteful.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // The select page renders its own full-screen UI; no shell.
  if (pathname === '/app/select') return <>{children}</>;
  return (
    <AppShellProvider>
      {children}
      <BottomNav />
    </AppShellProvider>
  );
}
