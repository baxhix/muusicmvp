'use client';

import { useEffect } from 'react';

import MockToastRotator from '@/components/app/MockToastRotator';
import FloatingUsers from '@/components/app/FloatingUsers';
import FeedPanel from '@/components/app/FeedPanel';
import MobileHomeChrome from '@/components/app/MobileHomeChrome';
/* Brainstorm + Map Simulation (BrainstormGate, BrainstormPanel,
 * Superlive/CollectiveListening/ShowLive/FindMyLove triggers,
 * MapSimulationLayer, MapPulses, SimulationHUD, MapZoomIndicator)
 * subiram pro /app/layout.tsx pra persistir em TODAS as rotas
 * /app/*, per product feedback "se ativado, deve sempre
 * aparecer; se desativado, não deve aparecer". */


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
      {/* (Onboarding overlay retired per product feedback —
          first visit lands directly on the map without a
          modal sequence.) */}

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

      {/* Rotating mock notification pills above the navbar. Cycles
          through "+455 ouvindo com você", incoming messages,
          waves, top-played track callouts, and TOP-N ranking
          announcements. Visual envelope matches SameTrackToast /
          PointsToast so the rotator's pills feel like real
          notifications. */}
      <MockToastRotator />

      {/* Feed bottom-sheet — drawer that overlays the right column
          of the map. Toggle via the BottomNav Feed slot or the
          `app:toggle-feed` CustomEvent. */}
      <FeedPanel />

      {/* Brainstorm + Map Simulation foram movidos pro shell
       *  (/app/layout.tsx) per product feedback "se ativado, deve
       *  sempre aparecer; se desativado, não deve aparecer".
       *  Mantendo aqui o componente desmontaria os ícones a cada
       *  navegação entre feed/comunidade/chat. */}
    </>
  );
}
