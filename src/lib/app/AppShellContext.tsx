'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useChatLiveWithFakes } from '@/hooks/useChatLiveWithFakes';
import { useLiveUsers } from '@/hooks/useLiveUsers';
import { useLocationSync } from '@/hooks/useLocationSync';
import {
  FAKE_ANA_USER_ID,
  FAKE_CENTRAL_USER_ID,
} from '@/lib/fakeAna';

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
  /** Mirror of FeedPanel's internal `minimized` flag. The Feed is
   *  a non-modal bottom-sheet so it lives outside `activeOverlay`,
   *  but the BottomNav / TopBar shortcuts still need to read its
   *  open-state to drive their active-rings. */
  feedOpen: boolean;
  /** Total non-read DMs across all conversations — drives the
   *  red badge on the Chat slot of the BottomNav. Computed live
   *  from `chat.conversations` so consumers don't have to redo
   *  the reduce themselves. */
  chatUnreadCount: number;
}

const AppShellContext = createContext<AppShellValue | null>(null);

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
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>(null);

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
  // FeedPanel emits `app:feed-state-change` on its own toggles;
  // we listen here and replay the same boolean to anyone who
  // needs to know (BottomNav, TopBar shortcut). Default true =
  // matches FeedPanel's `useState(true)` initial value.
  const [feedOpen, setFeedOpen] = useState(true);
  useEffect(() => {
    const onState = (e: Event) => {
      const ce = e as CustomEvent<{ open: boolean }>;
      if (typeof ce.detail?.open === 'boolean') {
        setFeedOpen(ce.detail.open);
      }
    };
    window.addEventListener('app:feed-state-change', onState);
    return () => window.removeEventListener('app:feed-state-change', onState);
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
      chatUnreadCount,
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
