'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import LiveChatStack from '@/components/app/LiveChatStack';
import ListeningTogether from '@/components/app/ListeningTogether';
import FloatingUsers from '@/components/app/FloatingUsers';
import FeedPanel from '@/components/app/FeedPanel';
import Onboarding from '@/components/app/Onboarding';

import { useAppShell } from '@/lib/app/AppShellContext';

/**
 * Map landing — `/app`.
 *
 * Phase 3 of the route refactor: this page is now a thin set of
 * map-specific decorations + the feed bottom-sheet. Everything
 * persistent (Globe, TopBar, BottomNav, NowPlaying, toasts,
 * AnaCheckIn modal, right-rail cluster, SuperchatTrigger) lives
 * in /app/layout.tsx.
 *
 * The shell layout already renders the Globe + the {children}
 * slot in `.mapLayer`. This page's job is to add the decorations
 * that ONLY make sense over the globe (avatar dock, artist box,
 * floating users, "listening together" pill, feed drawer).
 *
 * Map data wiring (live presence push, ana check-ins, etc.)
 * moved to AppShellProvider so it runs even when the user is on
 * another route (so the next visit to /app already has the
 * markers in place).
 */
export default function AppPage() {
  const shell = useAppShell();
  const router = useRouter();

  // Hello-world listener for the heart "aceno" event the Globe
  // dispatches when a user toggles the heart on a presence pin.
  // Kept here (vs. provider) because the real backend call will
  // be a POST to /api/wave and that's a per-user-action effect,
  // not shell-level state.
  useEffect(() => {
    const onUserWaved = (e: Event) => {
      const detail = (e as CustomEvent<{ userId: string; name: string }>).detail;
      if (!detail) return;
      // TODO: POST /api/wave { targetUserId: detail.userId }
      console.log(`wave (from map heart) → ${detail.userId} (${detail.name})`);
    };
    window.addEventListener('app:user-waved', onUserWaved);
    return () => window.removeEventListener('app:user-waved', onUserWaved);
  }, []);

  return (
    <>
      {/* Onboarding overlay — shows on first visit until dismissed. */}
      <Onboarding />

      {/* ArtistBox moved to /app/layout.tsx so the Fanverse pill
          stays visible while the user is on chat/comunidades/etc. */}

      {/* Avatar dock for the latest 3 conversations. Clicking an
          avatar both selects the conversation (chat.open) AND
          routes to /app/chat so the LiveChatPanel — which is only
          mounted under that route — actually appears. Previously
          we only flipped the activeId, which silently set the
          state but left the user on the empty map with nothing
          to show. */}
      <LiveChatStack
        conversations={shell.chat.conversations}
        activeId={shell.chat.activeId}
        onlineUserIds={shell.onlineUserIds}
        onOpen={(conversationId) => {
          shell.chat.open(conversationId);
          router.push('/app/chat');
        }}
      />

      {/* Deterministic screen-positioned avatars of every online
          user — these are NOT geo-anchored, the lat/lng markers
          on the Globe are. FloatingUsers is the always-visible
          roster. */}
      <FloatingUsers />

      {/* "Pessoas ouvindo o mesmo" pill — positions itself based
          on the persistent player's current footprint, hence the
          playerExpanded + playerSize props from shell context. */}
      <ListeningTogether
        playerExpanded={shell.playerExpanded}
        playerSize={shell.playerSize}
      />

      {/* Feed bottom-sheet — drawer that overlays the right column
          of the map. Toggle via the BottomNav Feed slot or the
          `app:toggle-feed` CustomEvent. */}
      <FeedPanel />
    </>
  );
}
