'use client';

import { useEffect } from 'react';

import MockToastRotator from '@/components/app/MockToastRotator';
import FloatingUsers from '@/components/app/FloatingUsers';
import FeedPanel from '@/components/app/FeedPanel';
import BrainstormPanel from '@/components/app/BrainstormPanel';
import SuperliveTrigger from '@/components/app/SuperliveTrigger';
import CollectiveListeningTrigger from '@/components/app/CollectiveListeningTrigger';
import ShowLiveTrigger from '@/components/app/ShowLiveTrigger';
import MobileHomeChrome from '@/components/app/MobileHomeChrome';
import MapSimulationLayer from '@/components/app/MapSimulationLayer';
import MapPulses from '@/components/app/MapPulses';
import SimulationHUD from '@/components/app/SimulationHUD';


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

      {/* Fire Arena · Show ao vivo (brainstorm-gated) — pílula
          rosa neon abaixo dos outros triggers que abre o
          ShowLiveStage: viewport vira palco com vinheta dark
          ao redor, luzes pulsando sobre o estádio (mapa visível
          por baixo), frame de transmissão acima e chat ao
          lado. Pensado pro lançamento do álbum Fire Arena na
          Arena Fonte Nova (Salvador, BA). Self-gates on
          `flags.showLive`. */}
      <ShowLiveTrigger />

      {/* Sandbox de simulação de 3.000 usuários no mapa do Brasil
       *  (brainstorm-gated). Camada visual com heatmap + clusters +
       *  dots coloridos por tier + HUD com contador online + cidade
       *  bombando. Toggle via Features em teste. NUNCA toca backend
       *  real — dataset gerado client-side determinístico. */}
      <MapSimulationLayer />
      <MapPulses />
      <SimulationHUD />
    </>
  );
}
