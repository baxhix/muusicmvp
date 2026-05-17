'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import TopBar from '@/components/app/TopBar';
// FilterTabs no longer rendered in /app's topBar — kept the file in
// the codebase for potential re-introduction without an extra round
// of cleanup.
import LiveChatStack from '@/components/app/LiveChatStack';
import LiveChatPanel from '@/components/app/LiveChatPanel';
import ConversationsSidebar from '@/components/app/ConversationsSidebar';
import CommunityPanel from '@/components/app/CommunityPanel';
import GroupMembersPanel from '@/components/app/GroupMembersPanel';
import ArtistBox from '@/components/app/ArtistBox';
import UserPicker from '@/components/app/UserPicker';
import NowPlaying from '@/components/app/NowPlaying';
import ListeningTogether from '@/components/app/ListeningTogether';
import FloatingUsers from '@/components/app/FloatingUsers';
import BottomNav from '@/components/app/BottomNav';
import FeedPanel from '@/components/app/FeedPanel';
import ProfilePanel, { type ProfileUser } from '@/components/app/ProfilePanel';
import SuperfansPanel from '@/components/app/SuperfansPanel';
// SideBar removed from this screen — logo strip is no longer rendered.
import Onboarding from '@/components/app/Onboarding';
// LocateButton removed from this screen — geo prompt is no longer rendered.
import EditProfileModal from '@/components/app/EditProfileModal';
import DeleteAccountModal from '@/components/app/DeleteAccountModal';
import PlaylistModal from '@/components/app/PlaylistModal';
import NotificationBell from '@/components/app/NotificationBell';
// HeroOrb retired entirely per product feedback. The component
// + its shader files stay in src/components/app/HeroOrb/ in case
// the team wants to revisit a hero animation later, but it's not
// rendered anywhere in /app anymore.
import SuperchatTrigger from '@/components/app/SuperchatTrigger';
import SuperchatPanel from '@/components/app/SuperchatPanel';
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

import { useChatLiveWithFakes } from '@/hooks/useChatLiveWithFakes';
import {
  FAKE_ANA_CONVERSATION_ID,
  FAKE_ANA_NOW_PLAYING,
  FAKE_ANA_USER_ID,
  FAKE_CENTRAL_CONVERSATION_ID,
  FAKE_CENTRAL_NOW_PLAYING,
  FAKE_CENTRAL_USER_ID,
} from '@/lib/fakeAna';
import { useLocationSync } from '@/hooks/useLocationSync';
import { useLiveUsers } from '@/hooks/useLiveUsers';
import { useAuth } from '@/lib/auth/AuthContext';
import { useTracksCatalog } from '@/hooks/useTracksCatalog';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUniverse } from '@/lib/universe/UniverseContext';
import { globeStore } from '@/lib/globeStore';
import { useRouter } from 'next/navigation';

import styles from './page.module.css';

const Globe = dynamic(() => import('@/components/app/Globe'), { ssr: false });

export default function AppPage() {
  const { user: authUser } = useAuth();
  const { universeId, hydrated: universeHydrated } = useUniverse();
  const router = useRouter();
  const chat = useChatLiveWithFakes();
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
  const { users: liveUsers, totalRegistered } = useLiveUsers();
  // Stable Set of currently-online user ids, passed to LiveChatStack
  // so each avatar can render a green/gray presence dot. Memoized so
  // the child doesn't see a new reference on every render — only
  // when the actual roster changes (by ids list).
  const onlineUserIds = useMemo(
    // Both fake contacts (Ana + Central) always read as online — VIP
    // affordances, otherwise their dashes would misleadingly look
    // gray when they're constantly active.
    () =>
      new Set([
        ...liveUsers.map((u) => u.id),
        FAKE_ANA_USER_ID,
        FAKE_CENTRAL_USER_ID,
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liveUsers.map((u) => u.id).join('|')],
  );
  const [playerExpanded, setPlayerExpanded] = useState(false);
  // Default to `horizontal` so the player + ArtistBox share the
  // same 296px column width at left:68. Mini collapses the player
  // to just the play button which made the two cards look
  // mismatched at rest; horizontal is also the more informative
  // resting state (track title + artist + transport visible).
  const [playerSize, setPlayerSize] = useState<'mini' | 'horizontal' | 'expanded' | 'video'>('horizontal');
  const [showProfile, setShowProfile] = useState(false);
  /**
   * Which user the profile panel currently displays. `null` means
   * "the logged-in user" — that's the default whenever the panel is
   * opened via the navbar/topbar. Set to another id when the user
   * clicks a presence pin on the globe; the ProfilePanel then renders
   * that user's data (fetched via useUserProfile below) with the
   * other-user button set (Acenar / Enviar mensagem).
   */
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  /** Singleton overlay coordinator. Only one of these surfaces can
   *  be open at a time — opening any of them auto-closes whichever
   *  is currently open. Notifications is included here too even
   *  though the component manages its own visible state, because
   *  we pass `open` + `onOpenChange` as a controlled prop.
   *
   *  'chat' and 'community' both open in the right column slot
   *  (same geometry as FeedPanel). Per product feedback they sit
   *  ABOVE the Feed via z-index — the Feed stays mounted in the
   *  background and is simply covered while one of them is open.
   *  Singleton-only-among-overlays still applies, so opening Chat
   *  closes Community and vice-versa. */
  type ActiveOverlay =
    | null
    | 'superfans'
    | 'playlist'
    | 'superchat'
    | 'notifications'
    | 'chat'
    | 'community'
    | 'profile';
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>(null);
  const showSuperfans     = activeOverlay === 'superfans';
  const showPlaylist      = activeOverlay === 'playlist';
  const showSuperchat     = activeOverlay === 'superchat';
  const showNotifications = activeOverlay === 'notifications';
  const showChat          = activeOverlay === 'chat';
  const showCommunity     = activeOverlay === 'community';

  // Per-overlay setShow helpers — preserve the boolean shape the
  // existing call sites use. Setting true swaps to that overlay
  // (closing any other); setting false only clears the state if
  // THIS overlay is the active one (so closing Playlist while
  // Notifications is open doesn't bounce Notifications shut).
  const setShowSuperfans = (v: boolean) => {
    if (v) setActiveOverlay('superfans');
    else setActiveOverlay((curr) => (curr === 'superfans' ? null : curr));
  };
  const setShowPlaylist = (v: boolean) => {
    if (v) setActiveOverlay('playlist');
    else setActiveOverlay((curr) => (curr === 'playlist' ? null : curr));
  };
  const setShowSuperchat = (v: boolean) => {
    if (v) setActiveOverlay('superchat');
    else setActiveOverlay((curr) => (curr === 'superchat' ? null : curr));
  };
  const setShowChat = (v: boolean) => {
    if (v) setActiveOverlay('chat');
    else setActiveOverlay((curr) => (curr === 'chat' ? null : curr));
  };
  const setShowCommunity = (v: boolean) => {
    if (v) setActiveOverlay('community');
    else setActiveOverlay((curr) => (curr === 'community' ? null : curr));
  };

  // Listen for the BottomNav's notification trigger — routes
  // through the same coordinator so opening notifications closes
  // any other open overlay. (Comunidade no longer needs a listener
  // here: the dock shortcut now toggles through the
  // `onCommunityToggle` prop on LiveChatStack instead of firing a
  // CustomEvent, so the parent owns the open/closed state directly.)
  useEffect(() => {
    const onOpenNotif = () => setActiveOverlay('notifications');
    window.addEventListener('app:open-notifications', onOpenNotif);
    return () => window.removeEventListener('app:open-notifications', onOpenNotif);
  }, []);

  // Mirror of FeedPanel's internal `minimized` flag, kept here so
  // the right-rail dock can paint the Feed shortcut's active state
  // in sync. The Feed dispatches `app:feed-state-change` whenever
  // its open/closed state flips (header click or `app:toggle-feed`
  // shortcut); we just listen and copy. Default `true` matches the
  // Feed's "lands expanded" default.
  const [feedOpen, setFeedOpen] = useState(true);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ open: boolean }>).detail;
      if (detail && typeof detail.open === 'boolean') {
        setFeedOpen(detail.open);
      }
    };
    window.addEventListener('app:feed-state-change', handler);
    return () => window.removeEventListener('app:feed-state-change', handler);
  }, []);

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

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  // Separate from showUserPicker because the UserPicker renders in
  // a different mode (with name field + multi-select + Create CTA).
  // Both pickers share the same modal component, just keyed by which
  // flag is true.
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  // Members roster for the currently-active group. Driven by the
  // kebab "Ver membros" item; closed via X or after the user leaves.
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  // When the kebab "Adicionar membro" trigger is fired we open the
  // SingleProps UserPicker variant. Reuses the same modal that
  // starts DMs; on pick we POST /members instead of openDmWith.
  const [addingMemberToGroup, setAddingMemberToGroup] = useState<string | null>(null);
  // Full-list conversations drawer — opens from the dock's "ver
  // tudo" overflow trigger. The dock itself only shows the latest
  // few DMs so the user can reach the rest without scrolling.
  // ConversationsSidebar visibility is now part of the activeOverlay
  // singleton above (showChat / setShowChat) — kept the local name
  // out to avoid two sources of truth for the same UI slot.
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

  // Asks for browser geolocation on first authenticated load (per session).
  // Server snaps to city centroid + per-user jitter; exact GPS isn't stored.
  useLocationSync();

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

  // Wire pin-click on the globe → open that user's profile.
  useEffect(() => {
    globeStore.registerOpenUserProfile((userId) => {
      setViewingUserId(userId);
      setShowProfile(true);
    });
  }, []);

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

  // Fetch the full profile (identity + fanpoints + streams + now-playing)
  // for whichever user the panel is showing. We fetch own AND other —
  // both routes through the same endpoint so the same data shape feeds
  // both the own-profile and other-user-profile renders.
  const profileTargetId =
    viewingUserId ?? (showProfile ? authUser?.id ?? null : null);
  const { profile: viewingProfile } = useUserProfile(profileTargetId);

  // Build the ProfileUser shape consumed by ProfilePanel. When the
  // remote profile has loaded, we use its values (fanpoints, streams,
  // city, etc.); otherwise we fall back to the local auth record so the
  // first paint isn't empty. The flag `isOwnProfile` is derived from
  // whether viewingUserId points at the logged-in user.
  const isOwnProfile =
    viewingUserId === null || viewingUserId === (authUser?.id ?? '__never__');
  const displayedUser: ProfileUser = viewingProfile
    ? {
        id: viewingProfile.id,
        name:
          viewingProfile.name?.trim() ||
          viewingProfile.email?.split('@')[0] ||
          'Anônimo',
        city: viewingProfile.city ?? '—',
        state: viewingProfile.countryCode ?? '',
        streams: viewingProfile.streams,
        fanpoints: viewingProfile.fanpoints,
        img:
          viewingProfile.avatarUrl ??
          `https://i.pravatar.cc/72?u=${viewingProfile.id}`,
        isOnline: viewingProfile.isOnline,
        nowPlaying: viewingProfile.nowPlaying
          ? {
              title: viewingProfile.nowPlaying.title,
              artist: viewingProfile.nowPlaying.artist,
            }
          : undefined,
      }
    : {
        id: authUser?.id ?? 'me',
        name: authUser?.name ?? authUser?.email?.split('@')[0] ?? 'Você',
        city: authUser?.city ?? '—',
        state: authUser?.countryCode ?? '',
        streams: 0,
        fanpoints: 0,
        img:
          authUser?.avatarUrl ??
          `https://i.pravatar.cc/72?u=${authUser?.id ?? 'me'}`,
        isOnline: true,
        nowPlaying: undefined,
      };

  const activeConversation =
    chat.conversations.find((c) => c.id === chat.activeId) ?? null;

  // Pull the live now-playing for the OTHER user in the active DM —
  // drives the "now playing" line in the chat panel header. When the
  // user is offline or hasn't been seen with a track, this is null;
  // LiveChatPanel falls back to a deterministic mock for that case.
  // SPECIAL CASES: the fake Ana + Central conversations always show
  // their featured tracks regardless of presence.
  const activeOtherNowPlaying = (() => {
    if (activeConversation?.id === FAKE_ANA_CONVERSATION_ID) {
      return FAKE_ANA_NOW_PLAYING;
    }
    if (activeConversation?.id === FAKE_CENTRAL_CONVERSATION_ID) {
      return FAKE_CENTRAL_NOW_PLAYING;
    }
    const otherId = activeConversation?.otherUser?.id;
    if (!otherId) return null;
    const liveOther = liveUsers.find((u) => u.id === otherId);
    if (!liveOther?.nowPlaying) return null;
    return {
      title: liveOther.nowPlaying.title,
      artist: liveOther.nowPlaying.artist,
    };
  })();

  // Superchat lives in the same conversation list as DMs (type='group').
  // Pluck it so the trigger pill can show its unread count badge and the
  // panel can call markRead through useChatLive.
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
          onProfileOpen={() => setShowProfile(true)}
          onEditProfileOpen={() => setShowEditProfile(true)}
          onDeleteAccountOpen={() => setShowDeleteAccount(true)}
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
              className={`${styles.shortcutBtn} ${showSuperfans ? styles.shortcutBtnActive : ''}`}
              onClick={() => setShowSuperfans(!showSuperfans)}
              aria-label="Superfãs"
              aria-pressed={showSuperfans}
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

        <BottomNav
          /* Mobile-first primary navigation:
             Mapa | Feed | Chat | Comunidade | Perfil. Every
             primary surface gets its own slot — no overlap with
             the top-right secondary cluster (notif / playlist /
             superfans / superchat) and no redundancy with the
             ConversationsSidebar / CommunityPanel trigger areas. */
          onChatOpen={() => setShowChat(!showChat)}
          onCommunityOpen={() => setShowCommunity(!showCommunity)}
          onFeedToggle={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('app:toggle-feed'));
            }
          }}
          onProfileOpen={() => setShowProfile(true)}
          activeOverlay={
            showProfile && !viewingUserId ? 'profile' : activeOverlay
          }
          feedOpen={feedOpen}
          /* Sum of DM unread counts across all conversations. The
             total drives the red badge on the Chat slot. */
          chatUnreadCount={chat.conversations.reduce(
            (sum, c) => sum + (c.type === 'dm' ? c.unreadCount : 0),
            0,
          )}
        />
      </div>

      {/* Superchat entry point — top-right slot, anchored to the
          Feed's right-column edge so the trigger reads as the
          action header for that area of the app. Used to live
          inside the centered topBar above; moved here per product
          feedback ("acima do box do feed"). */}
      <div className={styles.superchatTriggerSlot}>
        <SuperchatTrigger
          onClick={() => setShowSuperchat(true)}
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
      <ConversationsSidebar
        open={showChat}
        conversations={chat.conversations}
        activeId={chat.activeId}
        onlineUserIds={onlineUserIds}
        onClose={() => setShowChat(false)}
        onOpenConversation={chat.open}
        onNewConversation={() => {
          setShowChat(false);
          setShowUserPicker(true);
        }}
        onNewGroup={() => {
          setShowChat(false);
          setShowGroupPicker(true);
        }}
      />
      {/* Comunidade / Fórum — placeholder shell rendered in the same
          right-column slot. Opens via the dock's "Comunidade"
          shortcut (CustomEvent `app:open-community`). Actual forum
          functionality ships in a follow-up. */}
      <CommunityPanel
        open={showCommunity}
        onClose={() => setShowCommunity(false)}
      />
      <LiveChatPanel
        conversation={activeConversation}
        messages={chat.messages}
        loading={chat.loadingMessages}
        otherNowPlaying={activeOtherNowPlaying}
        onClose={chat.close}
        onSend={chat.send}
        onReact={chat.react}
        onOpenMembers={() => setShowGroupMembers(true)}
        onLeaveGroup={async () => {
          // Direct call — confirm + DELETE the caller's membership.
          // After success, close the chat panel so the user lands
          // back on the map / feed.
          if (!activeConversation || !authUser) return;
          if (!window.confirm('Sair desse grupo? Você não receberá mais mensagens dele.')) return;
          try {
            const res = await fetch(
              `/api/conversations/${activeConversation.id}/members/${authUser.id}`,
              { method: 'DELETE', credentials: 'include' },
            );
            if (!res.ok) {
              window.alert('Não foi possível sair do grupo.');
              return;
            }
            chat.close();
          } catch (err) {
            console.error('leave group failed:', err);
          }
        }}
      />

      {/* Members roster — opened from the kebab "Ver membros" entry
          when the active conversation is a group. */}
      <GroupMembersPanel
        open={showGroupMembers && activeConversation?.type === 'group'}
        conversationId={activeConversation?.type === 'group' ? activeConversation.id : null}
        currentUserId={authUser?.id ?? ''}
        myRole={activeConversation?.myRole ?? null}
        onClose={() => setShowGroupMembers(false)}
        onAddMember={() => {
          if (!activeConversation) return;
          setAddingMemberToGroup(activeConversation.id);
        }}
        onLeft={() => {
          // After the user leaves: close everything + refresh list
          setShowGroupMembers(false);
          chat.close();
          void chat.refreshConversations();
        }}
        onImageUpdated={() => {
          // Pull a fresh conversations list so the dock + sidebar +
          // chat header pick up the new imageUrl. The members panel
          // itself doesn't need a refresh since the image isn't in
          // its payload.
          void chat.refreshConversations();
        }}
      />
      <UserPicker
        open={showUserPicker}
        onClose={() => setShowUserPicker(false)}
        onPick={(uid) => chat.openDmWith(uid)}
      />
      <UserPicker
        open={showGroupPicker}
        mode="group"
        onClose={() => setShowGroupPicker(false)}
        onCreateGroup={async ({ name, memberIds }) => {
          await chat.createGroup({ name, memberIds });
          setShowGroupPicker(false);
        }}
      />

      {/* "Adicionar membro" — single-pick UserPicker that POSTs to
          /api/conversations/:id/members. Open only while
          addingMemberToGroup carries the active conversation id. */}
      <UserPicker
        open={addingMemberToGroup !== null}
        onClose={() => setAddingMemberToGroup(null)}
        onPick={async (uid) => {
          const convId = addingMemberToGroup;
          if (!convId) return;
          try {
            const res = await fetch(
              `/api/conversations/${convId}/members`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ userId: uid }),
              },
            );
            if (!res.ok) {
              const data = (await res.json().catch(() => ({}))) as { error?: string };
              window.alert(
                data.error === 'user_not_found'
                  ? 'Usuário não encontrado.'
                  : 'Não foi possível adicionar o membro.',
              );
              return;
            }
            // Refresh the conversations list so the dock/sidebar
            // pick up the new memberCount + any related metadata.
            // The members panel itself re-fetches on open via its
            // useEffect; toggle to force a fresh fetch.
            setAddingMemberToGroup(null);
            setShowGroupMembers(false);
            setTimeout(() => setShowGroupMembers(true), 30);
            void chat.refreshConversations();
          } catch (err) {
            console.error('add member failed:', err);
          }
        }}
      />
      <ListeningTogether playerExpanded={playerExpanded} playerSize={playerSize} />

      {showProfile
        ? <ProfilePanel
            user={displayedUser}
            isOwnProfile={isOwnProfile}
            onClose={() => {
              setShowProfile(false);
              // Reset to "own" so the next navbar open lands on the
              // logged user, not the last-viewed other user.
              setViewingUserId(null);
            }}
            onEditProfile={() => setShowEditProfile(true)}
            onOpenMessages={() => setShowSuperchat(true)}
            onSendMessage={(uid) => {
              setShowProfile(false);
              setViewingUserId(null);
              chat.openDmWith(uid);
            }}
            onWave={(uid, label) => {
              // For now, only client-side acknowledgment — backend
              // event will land in a follow-up. The toast lives on
              // the chat thread surface so the user sees it without
              // an additional UI primitive.
              console.log(`wave → ${uid} (${label})`);
            }}
            onReport={(uid, label) => {
              console.log(`report → ${uid} (${label})`);
            }}
          />
        : <FeedPanel />
      }

      <SuperfansPanel
        open={showSuperfans}
        onClose={() => setShowSuperfans(false)}
      />

      <EditProfileModal
        open={showEditProfile}
        onClose={() => setShowEditProfile(false)}
      />

      <DeleteAccountModal
        open={showDeleteAccount}
        onClose={() => setShowDeleteAccount(false)}
        userName="Ana Beatriz"
      />

      <PlaylistModal
        open={showPlaylist}
        onClose={() => setShowPlaylist(false)}
        currentIdx={songIdx}
        onSelect={setSongIdx}
      />

      {/* LocateButton (bottom-left geolocation pill) removed per
          product feedback — it competed with the player for the
          bottom-left corner and most users now share location at
          onboarding. Re-add via this same spot if it comes back. */}

      {/* NotificationBell + SuperchatTrigger are rendered inline inside the
          topBar so they don't overlap the username at the top-right. The
          SuperchatPanel that they open stays here so it overlays everything. */}
      <SuperchatPanel
        open={showSuperchat}
        onClose={() => setShowSuperchat(false)}
        onMarkRead={() => {
          if (superchat) void chat.markRead(superchat.id);
        }}
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
