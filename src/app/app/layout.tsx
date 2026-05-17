'use client';

import { usePathname } from 'next/navigation';
import { AppShellProvider } from '@/lib/app/AppShellContext';

/**
 * Persistent shell for every `/app/*` route.
 *
 * Phase 1 (current) — establishes the layout file + mounts the
 * AppShellProvider so chat realtime + the active-overlay
 * coordinator live ABOVE the page. Today the only consumer is
 * /app/page.tsx (the map), so behaviour is identical to the old
 * "all state local to page.tsx" world. The win is structural:
 * future routes (`/app/chat`, `/app/comunidades`, `/app/superchat`,
 * `/app/ranking`, `/app/perfil`, `/app/u/[id]`) can plug straight
 * in via `useAppShell()` without duplicating the chat websocket
 * or losing the unread badge on every navigation.
 *
 * Phase 2 will move BottomNav into this layout (router-based) +
 * mount Globe conditionally (always on desktop, only on `/app`
 * on mobile so other routes unmount the map and free the GPU).
 *
 * `/app/select` is intentionally OUTSIDE the provider — that page
 * is a pre-app gate where the user picks a universe. It doesn't
 * need chat realtime + spawning a websocket connection during a
 * 5-second pick-a-universe screen is wasteful. The conditional
 * below keeps the layout file lean while preserving select's
 * "no shell" rendering.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // The select page renders its own full-screen UI; no shell.
  if (pathname === '/app/select') return <>{children}</>;
  return <AppShellProvider>{children}</AppShellProvider>;
}
