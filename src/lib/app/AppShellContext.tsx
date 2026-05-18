'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useChatLiveWithFakes } from '@/hooks/useChatLiveWithFakes';
import { useLiveUsers } from '@/hooks/useLiveUsers';
import { useLocationSync } from '@/hooks/useLocationSync';
import { useTracksCatalog } from '@/hooks/useTracksCatalog';
import {
  FAKE_ANA_USER_ID,
  FAKE_CENTRAL_USER_ID,
} from '@/lib/fakeAna';
import { useAuth } from '@/lib/auth/AuthContext';
import { useUniverse } from '@/lib/universe/UniverseContext';
import { useRouter } from 'next/navigation';
import {
  globeStore,
  type AnaCheckInPayload,
  type AnaFlightPayload,
} from '@/lib/globeStore';
import { ANA_CHECKINS } from '@/data/anaCheckIns';
import { getFlightState } from '@/lib/anaFlight';
import { useBrainstormFlags } from '@/lib/brainstormFlags';
import { ANA_SHOWS } from '@/data/anaShows';

/**
 * App-shell context — the seam between the persistent layout
 * (`/app/layout.tsx`) and the route content. Anything that should
 * survive route transitions (chat realtime + unread counters, the
 * active-overlay coordinator, feed open/close mirror) lives here.
 *
 * Why a context instead of just useState in page.tsx?
 *
 *   - Phase 1 of the route refactor (current). The state lives in
 *     the persistent layout component. /app/page.tsx (the map) and
 *     all future sibling routes (/app/chat, /app/comunidades, etc.)
 *     consume the same instance — no duplication of the chat
 *     websocket, no extra re-renders on route change, unread badge
 *     stays accurate across navigations.
 *
 *   - Phase 2 will move BottomNav into the layout and route the
 *     surfaces via router.push instead of `setActiveOverlay`. The
 *     `activeOverlay` field stays here as a transition tool — pages
 *     can opt into either modal OR route-based open, and we
 *     migrate one surface at a time.
 *
 * Today (Phase 1) — this provider is mounted by /app/layout.tsx
 * and the only consumer is /app/page.tsx. Behaviour is identical
 * to the old "all state local to page.tsx" world.
 */

/** Identifies the one singleton overlay currently mounted over the
 *  app shell. Null means "none — the user is on the map landing". */
export type ActiveOverlay =
  | null
  | 'superfans'
  | 'playlist'
  | 'superchat'
  | 'notifications'
  | 'chat'
  | 'community'
  | 'profile';

type ChatLive = ReturnType<typeof useChatLiveWithFakes>;
type LiveUsers = ReturnType<typeof useLiveUsers>;
type LocationSync = ReturnType<typeof useLocationSync>;

interface AppShellValue {
  /** Live chat state (conversations, messages, typing, send, etc.). */
  chat: ChatLive;
  /** Online users + total registered count. Single subscription
   *  for the whole shell — Globe pushes to its source, panels
   *  read from it, no duplicated polling. */
  liveUsers: LiveUsers['users'];
  totalRegistered: LiveUsers['totalRegistered'];
  /** Stable Set of currently-online user ids (live presence +
   *  fake Ana/Central). Used by ConversationsSidebar to paint the
   *  green presence dot on contact rows. */
  onlineUserIds: Set<string>;
  /** Geolocation sync — fired once at shell mount, exposed for
   *  the BottomNav's "centralizar no meu local" button. */
  locationSync: LocationSync;
  /** Which singleton overlay is currently open. */
  activeOverlay: ActiveOverlay;
  /** Raw setter — accepts both direct values and the React-style
   *  `(prev) => next` updater so call-sites can do conditional
   *  closes like `setActiveOverlay(curr => curr === 'X' ? null : curr)`. */
  setActiveOverlay: Dispatch<SetStateAction<ActiveOverlay>>;
  /** Helpers mirroring the previous `setShow*` API surface. The
   *  rules are unchanged: setting `true` swaps to that overlay
   *  (closing any other); setting `false` only clears if the
   *  matching overlay is currently active. */
  setShowSuperfans: (v: boolean) => void;
  setShowPlaylist: (v: boolean) => void;
  setShowSuperchat: (v: boolean) => void;
  setShowChat: (v: boolean) => void;
  setShowCommunity: (v: boolean) => void;
  /** Source-of-truth for whether the Feed bottom-sheet is open.
   *  Lives in the shell provider (not inside FeedPanel) so the
   *  state survives navigation — if the user is on /app/ranking
   *  and clicks the Feed slot, BottomNav can flip `feedOpen` to
   *  true BEFORE the router push, and the freshly-mounted
   *  FeedPanel on /app reads that intent and lands expanded.
   *  Previously the toggle was an event (`app:toggle-feed`) that
   *  FeedPanel had to be already mounted to receive — the gap
   *  between dispatch and re-mount silently dropped the intent. */
  feedOpen: boolean;
  setFeedOpen: Dispatch<SetStateAction<boolean>>;
  /** Total non-read DMs across all conversations — drives the
   *  red badge on the Chat slot of the BottomNav. Computed live
   *  from `chat.conversations` so consumers don't have to redo
   *  the reduce themselves. */
  chatUnreadCount: number;
  /** Index into the registered tracks catalog — current song the
   *  user is playing. Persistent across routes so the NowPlaying
   *  mini-bar in the shell layout can keep playing while the user
   *  reads chat / community / etc. */
  songIdx: number;
  setSongIdx: Dispatch<SetStateAction<number>>;
  /** Player visual states — driven by NowPlaying, read by
   *  ListeningTogether (which positions itself based on the
   *  player's current footprint to avoid overlap). */
  playerExpanded: boolean;
  setPlayerExpanded: Dispatch<SetStateAction<boolean>>;
  playerSize: 'mini' | 'horizontal' | 'expanded' | 'video';
  setPlayerSize: Dispatch<SetStateAction<'mini' | 'horizontal' | 'expanded' | 'video'>>;
  /** Whether the user has explicitly dismissed the NowPlaying
   *  mini-bar (drag-to-hide). Persisted to localStorage so the
   *  preference survives reloads. When true, NowPlaying renders
   *  a small restore-pill instead of the full bar. */
  playerHidden: boolean;
  setPlayerHidden: Dispatch<SetStateAction<boolean>>;
  /** Ana check-in modal payload — non-null while the modal is
   *  open. Setting null closes it AND starts the 60s linger
   *  before the pin auto-clears from the globe. */
  anaModalPayload: AnaCheckInPayload | null;
  /** Payload for the Tour Portugal flight modal — non-null while
   *  the user has tapped the airplane marker on the globe. Carries
   *  the current progress / position / hours-remaining so the
   *  panel can render the live state without recomputing it. */
  anaFlightModalPayload: AnaFlightPayload | null;
  closeAnaFlight: () => void;
  /** Close the Ana check-in modal (with the linger timer). */
  closeAnaCheckIn: () => void;
}

const AppShellContext = createContext<AppShellValue | null>(null);

/** Ana check-in scheduling constants — module-scoped so the
 *  useEffect/useCallback hooks below don't need them in their
 *  dependency arrays. */
const CHECKIN_INTERVAL_MS = 2 * 60 * 1000;
const CHECKIN_INITIAL_DELAY_MS = 4 * 1000;
const CHECKIN_LINGER_MS = 60 * 1000;

/**
 * Provider — mounted by /app/layout.tsx. Owns the heavy state
 * (chat hook + activeOverlay coordinator) so consumers stay light.
 * The provider itself is intentionally side-effect-free; the chat
 * hook owns its websocket lifecycle, this just exposes its output.
 */
export function AppShellProvider({ children }: { children: ReactNode }) {
  const chat = useChatLiveWithFakes();
  const live = useLiveUsers();
  const locationSync = useLocationSync();
  const { user: authUser } = useAuth();
  const { universeId, hydrated: universeHydrated } = useUniverse();
  const router = useRouter();
  const { tracks: catalog } = useTracksCatalog();
  // Brainstorm flags — read here so the flight scheduler below
  // can gate publication on `anaFlight`. Subscribers re-render
  // when the toggle flips, so flipping the flag in the panel
  // immediately tears down (or rebuilds) the on-globe overlay.
  const { flags: brainstormFlags } = useBrainstormFlags();

  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>(null);

  // ── Player state — persistent across routes so the NowPlaying
  // mini-bar keeps playing while the user is on chat/community/etc.
  // The actual <NowPlaying> component is mounted by the shell layout.
  const [songIdx, setSongIdx] = useState(0);
  const [playerExpanded, setPlayerExpanded] = useState(false);
  // Horizontal is the default — same width as ArtistBox + most
  // informative resting state (title + artist + transport).
  const [playerSize, setPlayerSize] = useState<
    'mini' | 'horizontal' | 'expanded' | 'video'
  >('horizontal');
  // Player hidden state — the user can drag the mini bar off
  // screen to free up the bottom-left corner. Persisted to
  // localStorage so the choice sticks across reloads. SSR-safe:
  // initial state is `false`; the persisted value is read in an
  // effect after hydration so the server HTML always matches.
  const [playerHidden, setPlayerHidden] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('muusic.playerHidden.v1');
      if (raw === 'true') setPlayerHidden(true);
    } catch {
      // Quota / private mode — silent fallback.
    }
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        'muusic.playerHidden.v1',
        playerHidden ? 'true' : 'false',
      );
    } catch {
      // Quota / private mode — silent fallback.
    }
  }, [playerHidden]);
  const currentTrack = catalog[songIdx] ?? null;

  // ── Universe gate — redirect to /app/select if the user hasn't
  // picked a universe yet. Lives here so EVERY /app/* route is
  // gated, not just /app (the map). Hydrated check prevents the
  // first-render bounce before localStorage is read.
  useEffect(() => {
    if (!universeHydrated) return;
    if (!authUser) return;
    if (!universeId) {
      router.replace('/app/select');
    }
  }, [universeHydrated, authUser, universeId, router]);

  // Online ids — fake Ana/Central are always online (VIPs), real
  // online users come from the live subscription. Stable Set
  // identity by joining ids so consumers' memo'd deps work.
  const onlineUserIds = useMemo(
    () =>
      new Set<string>([
        ...live.users.map((u) => u.id),
        FAKE_ANA_USER_ID,
        FAKE_CENTRAL_USER_ID,
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live.users.map((u) => u.id).join('|')],
  );

  // ── Helper setters — boolean-flavoured shims that preserve
  // the call shape the previous page.tsx used. They live in the
  // provider rather than in each consumer so reference identity
  // stays stable across renders. ────────────────────────────────
  const setShowSuperfans = useCallback((v: boolean) => {
    if (v) setActiveOverlay('superfans');
    else setActiveOverlay((curr) => (curr === 'superfans' ? null : curr));
  }, []);
  const setShowPlaylist = useCallback((v: boolean) => {
    if (v) setActiveOverlay('playlist');
    else setActiveOverlay((curr) => (curr === 'playlist' ? null : curr));
  }, []);
  const setShowSuperchat = useCallback((v: boolean) => {
    if (v) setActiveOverlay('superchat');
    else setActiveOverlay((curr) => (curr === 'superchat' ? null : curr));
  }, []);
  const setShowChat = useCallback((v: boolean) => {
    if (v) setActiveOverlay('chat');
    else setActiveOverlay((curr) => (curr === 'chat' ? null : curr));
  }, []);
  const setShowCommunity = useCallback((v: boolean) => {
    if (v) setActiveOverlay('community');
    else setActiveOverlay((curr) => (curr === 'community' ? null : curr));
  }, []);

  // ── Feed open mirror ──────────────────────────────────────────
  // Feed open-state is now owned HERE (was inside FeedPanel as a
  // local `minimized` flag). FeedPanel reads `feedOpen` from this
  // provider and BottomNav can flip it directly, so the intent
  // survives the navigation gap between routes — see the docstring
  // on `setFeedOpen` above. Default true = expanded on desktop;
  // the effect below collapses it on initial mobile load so the
  // map gets the full viewport on first paint.
  const [feedOpen, setFeedOpen] = useState(true);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(max-width: 768px)').matches) {
      setFeedOpen(false);
    }
  }, []);

  // ── Unread aggregation ────────────────────────────────────────
  // Sum across all DM conversations only — groups are excluded
  // because Superchat (the only group today) has its own indicator.
  const chatUnreadCount = useMemo(
    () =>
      chat.conversations.reduce(
        (sum, c) => sum + (c.type === 'dm' ? c.unreadCount : 0),
        0,
      ),
    [chat.conversations],
  );

  // ── Cross-component CustomEvent → state bridges ───────────────
  // The notification panel is opened via `app:open-notifications`
  // for historical reasons (multiple decoupled triggers fire the
  // same event). We continue that pattern here in the provider so
  // any consumer (including future ones) gets it for free.
  useEffect(() => {
    const onOpenNotif = () => setActiveOverlay('notifications');
    window.addEventListener('app:open-notifications', onOpenNotif);
    return () => window.removeEventListener('app:open-notifications', onOpenNotif);
  }, []);

  // ── Globe pushers ─────────────────────────────────────────────
  // These run regardless of which route the user is on. If Globe
  // is unmounted (mobile non-map routes), globeStore.setX buffers
  // and replays on the next mount — see globeStore.ts. Net effect:
  // the map is always up-to-date the moment it's visible.

  // Logged-in user pin (the "Você" badge on the globe).
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

  // Other online users — filter self, map to the live-presence shape.
  useEffect(() => {
    const mapped = live.users
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
  }, [live.users, authUser?.id]);

  // Ambient Paraná dots — head-count of registered users.
  useEffect(() => {
    globeStore.setTotalRegistered(live.totalRegistered);
  }, [live.totalRegistered]);

  // Globe pin → route to user profile. The pin lives in Globe.tsx;
  // it calls globeStore.openUserProfile(userId) which lands here.
  useEffect(() => {
    globeStore.registerOpenUserProfile((userId) => {
      router.push(`/app/u/${userId}`);
    });
  }, [router]);

  // Static list of upcoming Ana shows — published once. Globe
  // draws them as orange dots + zoom-gated labels.
  useEffect(() => {
    globeStore.setAnaShows(ANA_SHOWS);
  }, []);

  // ── Ana Castela check-in scheduler ────────────────────────────
  // Round-robin through the preset cities every 2 minutes. The
  // first pin spawns 4s after mount so the page has a beat to
  // settle. The scheduler runs at the shell level so check-ins
  // continue to rotate even when the user is on a non-map route
  // — when they navigate back to /app, the latest pin is already
  // in place on the globe.
  //
  // Constants live at module scope (see CHECKIN_*_MS above) so
  // they don't trip react-hooks/exhaustive-deps inside the
  // useCallback that consumes CHECKIN_LINGER_MS.
  const anaCursorRef = useRef(0);
  const anaLingerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [anaModalPayload, setAnaModalPayload] =
    useState<AnaCheckInPayload | null>(null);

  useEffect(() => {
    if (ANA_CHECKINS.length === 0) return;
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

  // Globe pin click → open AnaCheckIn modal. The handler also
  // cancels any in-flight linger from a previous close, so reopens
  // during the 60s grace stay sticky.
  useEffect(() => {
    globeStore.registerOpenAnaCheckIn((payload) => {
      setAnaModalPayload(payload);
      if (anaLingerRef.current) {
        clearTimeout(anaLingerRef.current);
        anaLingerRef.current = null;
      }
    });
  }, []);

  const closeAnaCheckIn = useCallback(() => {
    setAnaModalPayload(null);
    if (anaLingerRef.current) clearTimeout(anaLingerRef.current);
    anaLingerRef.current = setTimeout(() => {
      globeStore.setAnaCheckIn(null);
      anaLingerRef.current = null;
    }, CHECKIN_LINGER_MS);
  }, []);

  // ── Ana Tour Portugal flight ────────────────────────────────
  //
  // Wall-clock-driven animation of Ana's plane from Londrina →
  // Lisboa. The full 8h journey + 4h post-arrival pause forms a
  // 12h cycle that loops perpetually (see `getFlightState`), so
  // every viewer sees a plane somewhere on the path no matter
  // when they open the app.
  //
  // We tick the payload to globeStore every 60s — the user spec
  // says "hourly is enough", but a 60s tick keeps the line +
  // marker visually current to the minute (great-circle progress
  // per minute is barely a single pixel on screen, so this is
  // basically free) AND ensures the hours-remaining counter in
  // the open modal stays alive without its own timer.
  const [anaFlightModalPayload, setAnaFlightModalPayload] =
    useState<AnaFlightPayload | null>(null);
  const anaFlightModalPayloadRef = useRef<AnaFlightPayload | null>(null);
  anaFlightModalPayloadRef.current = anaFlightModalPayload;
  const anaFlightEnabled = brainstormFlags.anaFlight;
  useEffect(() => {
    // Brainstorm flag gate — when the experimental Tour Portugal
    // feature is disabled, tear down the overlay (clear globe
    // markers, drop any open modal) and bail out before
    // scheduling the tick. Flipping the flag back on re-mounts
    // the scheduler via the [anaFlightEnabled] dep below.
    if (!anaFlightEnabled) {
      globeStore.setAnaFlight(null);
      setAnaFlightModalPayload(null);
      return;
    }
    const publish = () => {
      const s = getFlightState();
      const payload: AnaFlightPayload = {
        progress: s.progress,
        arrived: s.arrived,
        position: { lng: s.position.lng, lat: s.position.lat },
        bearingDeg: s.bearingDeg,
        traveledPath: s.traveledPath,
        remainingPath: s.remainingPath,
        hoursRemaining: s.hoursRemaining,
      };
      globeStore.setAnaFlight(payload);
      // If the modal is currently open, keep its label in sync
      // with the latest progress / hours-remaining without
      // requiring the user to close + reopen.
      if (anaFlightModalPayloadRef.current) {
        setAnaFlightModalPayload(payload);
      }
    };
    publish();
    const id = setInterval(publish, 60 * 1000);
    return () => clearInterval(id);
  }, [anaFlightEnabled]);

  // Globe airplane click → open the Tour Portugal panel. No
  // linger / scheduler interplay here (unlike check-ins) — the
  // flight is persistent, so closing the panel just drops the
  // modal without affecting the marker.
  useEffect(() => {
    globeStore.registerOpenAnaFlight((payload) => {
      setAnaFlightModalPayload(payload);
    });
  }, []);

  const closeAnaFlight = useCallback(() => {
    setAnaFlightModalPayload(null);
  }, []);

  const value: AppShellValue = useMemo(
    () => ({
      chat,
      liveUsers: live.users,
      totalRegistered: live.totalRegistered,
      onlineUserIds,
      locationSync,
      activeOverlay,
      setActiveOverlay,
      setShowSuperfans,
      setShowPlaylist,
      setShowSuperchat,
      setShowChat,
      setShowCommunity,
      feedOpen,
      setFeedOpen,
      chatUnreadCount,
      songIdx,
      setSongIdx,
      playerExpanded,
      setPlayerExpanded,
      playerSize,
      setPlayerSize,
      playerHidden,
      setPlayerHidden,
      anaModalPayload,
      closeAnaCheckIn,
      anaFlightModalPayload,
      closeAnaFlight,
    }),
    [
      chat,
      live.users,
      live.totalRegistered,
      onlineUserIds,
      locationSync,
      activeOverlay,
      setShowSuperfans,
      setShowPlaylist,
      setShowSuperchat,
      setShowChat,
      setShowCommunity,
      feedOpen,
      chatUnreadCount,
      songIdx,
      playerExpanded,
      playerSize,
      playerHidden,
      anaModalPayload,
      anaFlightModalPayload,
      closeAnaFlight,
      closeAnaCheckIn,
    ],
  );

  return (
    <AppShellContext.Provider value={value}>
      {children}
    </AppShellContext.Provider>
  );
}

/**
 * Hook — consume the shell state from any /app sub-route or
 * persistent shell component. Throws if used outside the provider
 * (always a bug — the provider is mounted by /app/layout.tsx).
 */
export function useAppShell(): AppShellValue {
  const ctx = useContext(AppShellContext);
  if (!ctx) {
    throw new Error(
      'useAppShell must be used inside <AppShellProvider> (mounted by /app/layout.tsx)',
    );
  }
  return ctx;
}
