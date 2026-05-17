'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import TopBar from '@/components/app/TopBar';
// FilterTabs no longer rendered in /app's topBar — kept the file in
// the codebase for potential re-introduction without an extra round
// of cleanup.
import LiveChatStack from '@/components/app/LiveChatStack';
import ArtistBox from '@/components/app/ArtistBox';
import NowPlaying from '@/components/app/NowPlaying';
import ListeningTogether from '@/components/app/ListeningTogether';
import FloatingUsers from '@/components/app/FloatingUsers';
import FeedPanel from '@/components/app/FeedPanel';
// SideBar removed from this screen — logo strip is no longer rendered.
import Onboarding from '@/components/app/Onboarding';
// LocateButton removed from this screen — geo prompt is no longer rendered.
import PlaylistModal from '@/components/app/PlaylistModal';
import NotificationBell from '@/components/app/NotificationBell';
// HeroOrb retired entirely per product feedback. The component
// + its shader files stay in src/components/app/HeroOrb/ in case
// the team wants to revisit a hero animation later, but it's not
// rendered anywhere in /app anymore.
import SuperchatTrigger from '@/components/app/SuperchatTrigger';
import AnaCheckInPanel from '@/components/app/AnaCheckInPanel';
import { ANA_CHECKINS } from '@/data/anaCheckIns';
import { ANA_SHOWS } from '@/data/anaShows';
import type { AnaCheckInPayload } from '@/lib/globeStore';
import SameTrackToast from '@/components/app/SameTrackToast';
import PointsToast from '@/components/app/PointsToast';
import MilestoneNotification from '@/components/app/MilestoneNotification';
import { useFanpointMilestones } from '@/hooks/useFanpointMilestones';
import AchievementCelebration from '@/components/app/AchievementCelebration';
import SocialAchievementToast from '@/components/app/SocialAchievementToast';

import { useAppShell } from '@/lib/app/AppShellContext';
import { FAKE_ANA_USER_ID, FAKE_CENTRAL_USER_ID } from '@/lib/fakeAna';
import { useAuth } from '@/lib/auth/AuthContext';
import { useTracksCatalog } from '@/hooks/useTracksCatalog';
import { useUniverse } from '@/lib/universe/UniverseContext';
import { globeStore } from '@/lib/globeStore';
import { useRouter } from 'next/navigation';

import styles from './page.module.css';

const Globe = dynamic(() => import('@/components/app/Globe'), { ssr: false });

export default function AppPage() {
  const { user: authUser } = useAuth();
  const { universeId, hydrated: universeHydrated } = useUniverse();
  const router = useRouter();
  // Chat realtime + activeOverlay coordinator + feedOpen mirror
  // are now hosted by /app/layout.tsx via AppShellProvider so the
  // state survives navigations between sibling routes (Phase 1 of
  // the routing refactor). The local API surface stays identical
  // — this hook just returns the same shape page.tsx used to own.
  const shell = useAppShell();
  const chat = shell.chat;
  // Watches the viewer's Fanpoints balance for 100-multiple
  // crossings and dispatches `app:milestone-fp` so the
  // MilestoneNotification banner can pop. Hook is sealed —
  // returns nothing; the rendering is fully driven by the event.
  useFanpointMilestones();

  // Universe gate: once the localStorage read has resolved and the
  // user is authenticated, redirect to the selection screen if they
  // haven't picked a universe yet. `hydrated` is critical — without
  // it we'd bounce to /select on every fresh load before the persisted
  // choice is read.
  useEffect(() => {
    if (!universeHydrated) return;
    if (!authUser) return; // unauthenticated path handled elsewhere
    if (!universeId) {
      router.replace('/app/select');
    }
  }, [universeHydrated, authUser, universeId, router]);
  // Live presence + onlineUserIds + total registered come from the
  // shell provider (Phase 2 hoist) so the websocket subscription
  // isn't duplicated by every sibling route. LiveChatStack still
  // wants the Set form for the green-dot indicator.
  const { liveUsers, totalRegistered, onlineUserIds } = shell;
  const [playerExpanded, setPlayerExpanded] = useState(false);
  // Default to `horizontal` so the player + ArtistBox share the
  // same 296px column width at left:68. Mini collapses the player
  // to just the play button which made the two cards look
  // mismatched at rest; horizontal is also the more informative
  // resting state (track title + artist + transport visible).
  const [playerSize, setPlayerSize] = useState<'mini' | 'horizontal' | 'expanded' | 'video'>('horizontal');
  // Profile UI is now a route — `/app/perfil` (own) + `/app/u/[id]`
  // (other). The Globe's pin-click handler below routes to the
  // matching path instead of toggling local state. Phase 2.
  // Only modals remaining as singleton-overlay coordinated state:
  //   - Notifications (NotificationBell controlled component)
  //   - Playlist (PlaylistModal)
  // All other surfaces (chat / community / superchat / ranking /
  // profile) are routes now — opening them is `router.push`, the
  // active-overlay slot stays null for those.
  const { activeOverlay, setActiveOverlay, setShowPlaylist } = shell;
  const showPlaylist      = activeOverlay === 'playlist';
  const showNotifications = activeOverlay === 'notifications';

  // FeedPanel's open/min state — lifted to AppShellProvider, which
  // listens to `app:feed-state-change` and exposes the boolean here.
  // The shortcut buttons + BottomNav read it via the destructured
  // `feedOpen` below.
  const { feedOpen } = shell;

  // Heart waves dispatched from the expanded user marker on the
  // Globe. When the dedicated `/api/wave` endpoint ships, route
  // the POST here so the receiver actually gets a notification on
  // their NotificationBell. For now we just log — matching the
  // existing ProfilePanel "Acenar" stub. The visual ack (heart
  // turning red) is handled inside Globe.tsx.
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

  // Chat-related sub-modals (UserPicker, GroupMembersPanel) +
  // EditProfileModal / DeleteAccountModal were moved into their
  // respective route pages (/app/chat, /app/perfil). page.tsx
  // now owns just the map-local state.
  const [songIdx, setSongIdx] = useState(0);

  /* ── Ana Castela check-in simulation ─────────────────────────
   *
   * Every CHECKIN_INTERVAL_MS the scheduler picks the next city
   * from ANA_CHECKINS (round-robin) and publishes it to the
   * globe via globeStore.setAnaCheckIn(payload). The pin stays
   * on the map until either:
   *   (a) the user opens + closes the modal — then it lingers
   *       for CHECKIN_LINGER_MS and auto-clears.
   *   (b) the next interval ticks and replaces it.
   *
   * `nextIndex` is held in a ref so the round-robin cursor
   * survives re-renders without forcing an effect retrigger.
   * The first check-in spawns 4 seconds after mount — a tiny
   * delay so the page has a chance to settle before the
   * attention-grabbing pin lands. */
  const [anaModalPayload, setAnaModalPayload] =
    useState<AnaCheckInPayload | null>(null);

  // Geolocation sync now fires once inside the AppShellProvider.
  // No-op here intentionally — kept this comment block as a
  // pointer for future maintainers grepping for the old call.

  // Current track of the logged-in player — drives the audio-bars indicator
  // on the "Você" badge. Source of truth is `songIdx` controlled here and
  // passed into <NowPlaying />.
  const { tracks: catalog } = useTracksCatalog();
  const currentTrack = catalog[songIdx] ?? null;

  // Drop a "Você" badge on the Globe at the user's persisted (jittered)
  // city-level location whenever lat/lng, avatar OR the current track
  // change. Cleans the marker on logout. The Globe registers its handler
  // on map load, so this effect re-runs once authUser arrives.
  useEffect(() => {
    if (authUser?.lat != null && authUser?.lng != null) {
      globeStore.setUserLocation({
        coords: { lat: authUser.lat, lng: authUser.lng },
        avatarUrl: authUser.avatarUrl,
        name: 'Você',
        trackTitle: currentTrack?.title ?? null,
        trackArtist: currentTrack?.artist ?? null,
      });
    } else {
      globeStore.setUserLocation(null);
    }
  }, [
    authUser?.lat,
    authUser?.lng,
    authUser?.avatarUrl,
    currentTrack?.title,
    currentTrack?.artist,
  ]);

  // Render every other online user with location as a badge on the globe.
  // The server-side per-user jitter (~4 km within the city centroid) keeps
  // overlapping avatars visually separated when zoomed in. We filter out
  // the current user (already shown as the "Você" badge above) and any
  // users without coords.
  useEffect(() => {
    const mapped = liveUsers
      .filter((u) => u.lat != null && u.lng != null && u.id !== authUser?.id)
      .map((u) => ({
        id: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
        lat: u.lat as number,
        lng: u.lng as number,
        trackTitle: u.nowPlaying?.title ?? null,
        trackArtist: u.nowPlaying?.artist ?? null,
      }));
    globeStore.setLiveUsers(mapped);
  }, [liveUsers, authUser?.id]);

  // Push the total registered head-count to the globe so it can scatter
  // ambient "fan presence" dots around Paraná — independent from the
  // live presence markers above, which only show users currently online.
  useEffect(() => {
    globeStore.setTotalRegistered(totalRegistered);
  }, [totalRegistered]);

  // Wire pin-click on the globe → route to that user's profile.
  // Profile is a dedicated route now (Phase 2), so we navigate
  // instead of toggling a local modal. The handler captures
  // `router` in the effect's closure — it stays stable from
  // useRouter() so we don't need to add it as a dep.
  useEffect(() => {
    globeStore.registerOpenUserProfile((userId) => {
      router.push(`/app/u/${userId}`);
    });
  }, [router]);

  // Publish the static list of upcoming Ana shows once on mount.
  // Each one becomes a small date-chip pin on the globe; the
  // Globe owns the click-to-reveal popover entirely. When the
  // shows move from `src/data/anaShows.ts` to a real backend
  // feed, swap this useEffect for the matching fetch.
  useEffect(() => {
    globeStore.setAnaShows(ANA_SHOWS);
  }, []);

  /* ── Ana Castela check-in scheduler ─────────────────────────
   *
   * Cadence + linger constants live here so the simulation can
   * be tuned in one place. When the real backend lands, this
   * scheduler is what gets replaced by a websocket subscription
   * pushing the payloads from the server.
   *
   *   CHECKIN_INTERVAL_MS — 2 min between new check-ins
   *   CHECKIN_INITIAL_DELAY_MS — first pin appears after this
   *   CHECKIN_LINGER_MS — how long the pin stays after the user
   *                      closes the modal (then auto-clears)
   */
  const CHECKIN_INTERVAL_MS = 2 * 60 * 1000;
  const CHECKIN_INITIAL_DELAY_MS = 4 * 1000;
  const CHECKIN_LINGER_MS = 60 * 1000;

  // Round-robin cursor + a ref for the auto-clear timer so we
  // can cancel it if the user re-opens the same check-in within
  // the linger window.
  const anaCursorRef = useRef(0);
  const anaLingerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (ANA_CHECKINS.length === 0) return;

    /** Build a payload from the cursor position + stamp `id` and
     *  `startedAt`. The id encodes the slot index so reopens
     *  during the same tick are stable. */
    const spawn = () => {
      const idx = anaCursorRef.current % ANA_CHECKINS.length;
      const template = ANA_CHECKINS[idx];
      anaCursorRef.current += 1;
      const payload: AnaCheckInPayload = {
        id: `ana-${idx}-${Date.now()}`,
        city: template.city,
        state: template.state,
        lng: template.lng,
        lat: template.lat,
        caption: template.caption ?? null,
        media: template.media,
        startedAt: new Date().toISOString(),
      };
      // Spawning a new check-in cancels any pending linger from
      // the previous one — the new pin takes the slot immediately.
      if (anaLingerRef.current) {
        clearTimeout(anaLingerRef.current);
        anaLingerRef.current = null;
      }
      globeStore.setAnaCheckIn(payload);
    };

    const initTimer = setTimeout(spawn, CHECKIN_INITIAL_DELAY_MS);
    const interval = setInterval(spawn, CHECKIN_INTERVAL_MS);
    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
      if (anaLingerRef.current) clearTimeout(anaLingerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wire pin-click on the globe → open the AnaCheckIn modal.
  useEffect(() => {
    globeStore.registerOpenAnaCheckIn((payload) => {
      setAnaModalPayload(payload);
      // If the user reopens during a linger window, cancel the
      // auto-clear — they're clearly still engaged with this pin.
      if (anaLingerRef.current) {
        clearTimeout(anaLingerRef.current);
        anaLingerRef.current = null;
      }
    });
  }, []);

  /**
   * Close handler for the AnaCheckInPanel modal. Closes the
   * panel immediately and starts the 60s linger timer; when it
   * fires we clear the pin from the globe AND drop the cached
   * payload from state.
   */
  const handleAnaCheckInClose = () => {
    setAnaModalPayload(null);
    if (anaLingerRef.current) clearTimeout(anaLingerRef.current);
    anaLingerRef.current = setTimeout(() => {
      globeStore.setAnaCheckIn(null);
      anaLingerRef.current = null;
    }, CHECKIN_LINGER_MS);
  };

  // Superchat lives in the same conversation list as DMs (type='group').
  // Pluck it so the trigger pill (top-right) can show its unread badge.
  // The full Superchat surface is /app/superchat (route), so we don't
  // need to thread the conversation any further than this.
  const superchat = chat.conversations.find((c) => c.type === 'group') ?? null;

  return (
    <>
      <Globe />

      {/* Back to landing */}
      <Link href="/" className={styles.backBtn} aria-label="Voltar para início">
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </Link>

      {/* App Shell */}
      <div className={styles.shell}>
        <TopBar
          onProfileOpen={() => router.push('/app/perfil')}
          /* Edit + delete modals now live inside /app/perfil; the
             topbar avatar just routes there and lets the user
             initiate them from the panel. */
          onEditProfileOpen={() => router.push('/app/perfil')}
          onDeleteAccountOpen={() => router.push('/app/perfil')}
        />
        {/* <StatusToggle /> */}

        {/* Map Layer */}
        <div className={styles.mapLayer}>
          {/* Top center row: filter pills + Superchat CTA + notifications
              side-by-side. Ranking (Superfãs) is reachable via the
              BottomNav crown icon — no longer duplicated up here. */}
          {/* topBar now hosts the SECONDARY action shortcuts —
              Notificações, Playlist (Músicas) and Superfãs
              (Ranking) — as a vertical column on the right rail.
              The PRIMARY surfaces (Mapa / Feed / Chat / Comunidade
              / Perfil) live in the BottomNav below, so the right
              rail can stay focused on the actions that don't fit
              the 5-slot mobile-first nav. SuperchatTrigger has
              its own dedicated slot a few pixels above this row
              (see `superchatTriggerSlot` further down). */}
          <div className={styles.topBar}>
            <button
              type="button"
              className={`${styles.shortcutBtn} ${showNotifications ? styles.shortcutBtnActive : ''}`}
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('app:open-notifications'));
                }
              }}
              aria-label="Notificações"
              aria-pressed={showNotifications}
              title="Notificações"
            >
              <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 9a6 6 0 0 1 12 0v3.4l1.4 2.6H3.6L5 12.4Z" />
                <path d="M9 18a2 2 0 0 0 4 0" />
              </svg>
            </button>

            <button
              type="button"
              className={`${styles.shortcutBtn} ${showPlaylist ? styles.shortcutBtnActive : ''}`}
              onClick={() => setShowPlaylist(!showPlaylist)}
              aria-label="Músicas"
              aria-pressed={showPlaylist}
              title="Músicas"
            >
              <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 4.5v13l11-6.5z" />
              </svg>
            </button>

            <button
              type="button"
              className={styles.shortcutBtn}
              onClick={() => router.push('/app/ranking')}
              aria-label="Superfãs"
              title="Superfãs (Ranking)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3.5 8.5l2 9.5h13l2-9.5-5 3.5-3.5-7-3.5 7-5-3.5z" />
                <path d="M6.5 21h11" />
              </svg>
            </button>
          </div>

          {/* NotificationBell stays mounted (its panel + event
              listener are needed) but renders without the trigger
              glyph. The visible entry point now lives in the
              BottomNav notifications slot, which dispatches the
              'app:open-notifications' CustomEvent the bell
              listens to. Controlled mode — the parent's overlay
              coordinator owns the open state so opening another
              surface auto-closes the bell panel (and vice-versa).
              IMPORTANT: rendered OUTSIDE `.topBar` because the
              topBar uses `transform: translateX(-50%)`, which
              creates a containing block for `position: fixed`
              descendants — that was anchoring the panel to the
              topBar's coordinate space and pushing it off the top
              of the viewport. Hoisting the bell to the mapLayer
              level lets the panel's `position: fixed` resolve
              against the actual viewport. */}
          <NotificationBell
            hideTrigger
            open={showNotifications}
            onOpenChange={(next) => {
              if (next) setActiveOverlay('notifications');
              else
                setActiveOverlay((curr) =>
                  curr === 'notifications' ? null : curr,
                );
            }}
          />

          {/* Floating overlay of every real online user — anchored to
              deterministic screen positions so the roster is always visible
              regardless of how the globe is rotated. Real lat/lng markers
              are owned by <Globe /> via globeStore.setLiveUsers. */}
          <FloatingUsers />
        </div>
        {/* BottomNav now lives in /app/layout.tsx so it persists
            across every sibling route (Phase 2). page.tsx is just
            the map landing — no nav rendering here anymore. */}
      </div>

      {/* Superchat entry point — top-right slot, anchored to the
          Feed's right-column edge so the trigger reads as the
          action header for that area of the app. Used to live
          inside the centered topBar above; moved here per product
          feedback ("acima do box do feed"). */}
      <div className={styles.superchatTriggerSlot}>
        <SuperchatTrigger
          onClick={() => router.push('/app/superchat')}
          unreadCount={superchat?.unreadCount ?? 0}
        />
      </div>

      {/* Now playing — fora do shell pra ficar acima do FeedPanel no mobile */}
      <NowPlaying
        onExpandChange={setPlayerExpanded}
        onSizeChange={setPlayerSize}
        songIdx={songIdx}
        onSongIdxChange={setSongIdx}
        onOpenPlaylist={() => setShowPlaylist(true)}
      />

      {/* SideBar (left-edge logo strip) intentionally removed —
          product feedback wanted the top-left corner cleaner. The
          universe switcher that used to live there moved into the
          TopBar user drawer already, so there's no orphaned action. */}

      {/* Artist identity box — fixed top-left card showing the
          current Fanverse + the user's daily missions panel.
          Self-positioned (top:42 / left:68); collapses to a header
          row + progress bar by default, expands to reveal the
          missions list when clicked. */}
      <ArtistBox />

      <LiveChatStack
        /* The chat / feed / comunidade shortcuts that used to live
           inside this dock moved to the centered topBar above.
           The dock is now strictly a vertical column of the 3
           latest conversation avatars. */
        conversations={chat.conversations}
        activeId={chat.activeId}
        onlineUserIds={onlineUserIds}
        onOpen={chat.open}
      />
      {/* ConversationsSidebar, CommunityPanel, LiveChatPanel,
       *  GroupMembersPanel, UserPicker, SuperchatPanel,
       *  SuperfansPanel, ProfilePanel, EditProfileModal +
       *  DeleteAccountModal all moved into their dedicated routes
       *  (Phase 2). Page.tsx just renders the map landing now. */}
      <ListeningTogether playerExpanded={playerExpanded} playerSize={playerSize} />

      {/* Map landing's "right column" — the feed panel sits over
       *  the globe as a bottom-sheet. Other routes own their own
       *  content; nothing else renders here. */}
      <FeedPanel />

      <PlaylistModal
        open={showPlaylist}
        onClose={() => setShowPlaylist(false)}
        currentIdx={songIdx}
        onSelect={setSongIdx}
      />

      {/* Ana Castela check-in modal — opens when the user taps the
       *  rotating check-in pin on the globe. Driven by globeStore
       *  via the scheduler effect above. */}
      <AnaCheckInPanel
        payload={anaModalPayload}
        onClose={handleAnaCheckInClose}
      />
      {/* Ranking (SuperfansPanel) opens via the BottomNav crown icon
          — the inline RankingButton that used to sit in the topBar
          row was removed; the panel below is what actually opens. */}

      {/* Floating queue of "X is listening to the same song" notifications,
          driven by socket `notify:new` events of kind 'same_track'. Each
          toast holds 6s, then fades out. */}
      <SameTrackToast />

      {/* "+N Fanpoints" toast — listens for the `app:points-awarded`
          event that awardPoints() (src/lib/rewards.ts) dispatches
          on every engagement reward (like, comment, send, chat
          iniciado, 3 streams). Mounted once globally so any nested
          component firing the helper gets the toast without
          re-wiring. */}
      <PointsToast />

      {/* Top-center milestone banner — fires when the viewer's
          Fanpoints balance crosses any 100-multiple. Sibling to
          PointsToast but rendered at the TOP edge so the round-
          number celebration reads as the bigger moment. The
          useFanpointMilestones hook above is what drives it. */}
      <MilestoneNotification />

      {/* Self-celebration when the logged-in user crosses a point
          milestone — confetti + centered congrats line, ~7s. */}
      <AchievementCelebration />

      {/* Social proof — small toast when ANY user crosses a milestone. */}
      <SocialAchievementToast />

      <Onboarding />
    </>
  );
}
