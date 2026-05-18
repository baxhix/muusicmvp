'use client';

import { useEffect } from 'react';

import ListeningTogether from '@/components/app/ListeningTogether';
import FloatingUsers from '@/components/app/FloatingUsers';
import FeedPanel from '@/components/app/FeedPanel';
import Onboarding from '@/components/app/Onboarding';
import BrainstormPanel from '@/components/app/BrainstormPanel';
import SuperliveTrigger from '@/components/app/SuperliveTrigger';
import CollectiveListeningTrigger from '@/components/app/CollectiveListeningTrigger';
import MobileHomeChrome from '@/components/app/MobileHomeChrome';

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

      {/* Mobile-only solid header background + gray divider +
          info bar below. Sits behind the ArtistBox pill + the
          right-rail cluster so the floating elements share one
          continuous surface and the strip beneath the divider
          holds whatever "outras informações" the team plugs in
          next. Unmounts on desktop and on every non-home route. */}
      <MobileHomeChrome />

      {/* ArtistBox and LiveChatStack moved to /app/layout.tsx so
          the Fanverse pill AND the 3-latest chat dock stay visible
          while the user is on chat / comunidades / superfãs /
          perfil. */}

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

      {/* Brainstorm — lightbulb trigger + toggle sheet for any
          experimental feature we want to preview without
          committing to. Mounted on /app only because every flag
          in the current registry decorates this surface (e.g.
          Tour Portugal lives on the globe); subpages have no
          experimental UI today. */}
      <BrainstormPanel />

      {/* Superlive (brainstorm-gated) — floating "AO VIVO" pill
          + modal with the simulated transmission + fake fan
          chat. Self-gates on `flags.superlive` and unmounts
          entirely when the toggle is off. */}
      <SuperliveTrigger />

      {/* Fire Arena · Audição coletiva (brainstorm-gated) —
          black pill below the Superlive trigger that opens a
          collaborative listening session for "Let's Go Rodeo"
          with a spinning vinyl + fake fan chat. Self-gates on
          `flags.collectiveListening`. */}
      <CollectiveListeningTrigger />
    </>
  );
}
