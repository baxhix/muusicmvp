'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AppShellProvider, useAppShell } from '@/lib/app/AppShellContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import BottomNav from '@/components/app/BottomNav';
import TopBar from '@/components/app/TopBar';
import ArtistBox from '@/components/app/ArtistBox';
import LiveChatStack from '@/components/app/LiveChatStack';
import MobileRouteHeader from '@/components/app/MobileRouteHeader';
import NowPlaying from '@/components/app/NowPlaying';
import PlaylistModal from '@/components/app/PlaylistModal';
import NotificationBell from '@/components/app/NotificationBell';
import SuperchatTrigger from '@/components/app/SuperchatTrigger';
import SuperfansPanel from '@/components/app/SuperfansPanel';
import AnaCheckInPanel from '@/components/app/AnaCheckInPanel';
import AnaFlightPanel from '@/components/app/AnaFlightPanel';
import SameTrackToast from '@/components/app/SameTrackToast';
import PointsToast from '@/components/app/PointsToast';
import MilestoneNotification from '@/components/app/MilestoneNotification';
import AchievementCelebration from '@/components/app/AchievementCelebration';
import SocialAchievementToast from '@/components/app/SocialAchievementToast';
import { useFanpointMilestones } from '@/hooks/useFanpointMilestones';
import styles from './layout.module.css';

/**
 * Persistent shell for every `/app/*` route — Phase 3 of the
 * route refactor.
 *
 * Everything that should outlive a route change lives in this
 * file: the Globe (with desktop-persistent / mobile-conditional
 * mounting), TopBar, BottomNav, NowPlaying mini-bar, right-rail
 * secondary actions cluster (Notif / Playlist / Superfãs),
 * SuperchatTrigger, NotificationBell, PlaylistModal,
 * AnaCheckInPanel modal, plus every toast.
 *
 * Routes (children) just render their content inside `.mapLayer`
 * — typically a position:fixed panel that overlays the basemap.
 *
 * (The /app/select pre-app gate that used to bypass this shell
 * was retired alongside the universe-picker page; new visitors
 * auto-land on the Ana Castela default — see UniverseContext.)
 */

const Globe = dynamic(() => import('@/components/app/Globe'), { ssr: false });

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShellProvider>
      <Shell>{children}</Shell>
    </AppShellProvider>
  );
}

/**
 * Inner shell — split into its own component so we can call
 * `useAppShell()` (which requires the provider to be mounted
 * above us). Holds all the persistent JSX + the one or two
 * shell-level side-effects (Fanpoint milestones).
 */
function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const {
    chat,
    chatUnreadCount,
    onlineUserIds,
    activeOverlay,
    setActiveOverlay,
    setShowPlaylist,
    songIdx,
    setSongIdx,
    setPlayerExpanded,
    setPlayerSize,
    playerHidden,
    setPlayerHidden,
    anaModalPayload,
    closeAnaCheckIn,
    anaFlightModalPayload,
    closeAnaFlight,
    feedOpen,
  } = useAppShell();
  // Watches the viewer's Fanpoints balance for 100-multiple
  // crossings and dispatches `app:milestone-fp` so the
  // MilestoneNotification banner can pop globally.
  useFanpointMilestones();

  // Globe mount strategy:
  //   - Desktop: always mounted (sits behind every route as
  //     ambient context, exactly like before the refactor).
  //   - Mobile: only on /app — every other route fully unmounts
  //     the WebGL canvas so GPU/RAM/battery are freed.
  const showGlobe = pathname === '/app' || !isMobile;
  const showPlaylist = activeOverlay === 'playlist';
  const showNotifications = activeOverlay === 'notifications';
  // Superfãs as a layer-on-top overlay (same shape as Playlist /
  // Notificações). Mobile keeps the route-based /app/ranking flow
  // for deep-linking + the BottomNav crown — only show as overlay
  // when we're NOT already sitting on that route, otherwise the
  // panel would double-mount with two instances competing.
  const showSuperfans =
    activeOverlay === 'superfans' && !pathname.startsWith('/app/ranking');
  const superchat = chat.conversations.find((c) => c.type === 'group') ?? null;

  // Chat detail = a specific conversation is open inside /app/chat.
  // When true on mobile, we hide the BottomNav + persistent header
  // chrome (ArtistBox pill, right-rail action cluster, Superchat
  // floater, NowPlaying / restore pill) so the LiveChatPanel can
  // take the full viewport and the on-screen keyboard never has to
  // fight the navbar for the input row. Desktop ignores this — the
  // chat panel is a 420px side rail there, nothing to hide.
  const chatDetailOpen =
    pathname.startsWith('/app/chat') && chat.activeId !== null;
  const hideShellChrome = chatDetailOpen && isMobile;

  // Home = /app. Every other route is a "subpage" that, on mobile,
  // gets the MobileRouteHeader (back arrow + centered title + drag-
  // down) and HIDES the persistent Fanverse header chrome (ArtistBox
  // pill, right-rail action cluster, SuperchatTrigger). Per product
  // feedback the header should "ficar apenas na home" on mobile —
  // subpages already have their own back / title, so the persistent
  // chrome would just compete with that.
  const onHome = pathname === '/app';
  const hideMobileHeader = isMobile && !onHome;
  // Mobile route header — shown on every non-home /app route, but
  // NOT when chat detail is open (LiveChatPanel takes the whole
  // viewport there and has its own back arrow).
  const showMobileRouteHeader = isMobile && !onHome && !chatDetailOpen;

  return (
    <>
      {/* Globe — under everything, conditional. Placeholder painted
       *  behind so the cold-mount on /app doesn't flash a blank
       *  background while Mapbox bootstraps. */}
      <div className={styles.globePlaceholder} aria-hidden="true" />
      {showGlobe && <Globe />}

      {/* Back to landing */}
      <Link href="/" className={styles.backBtn} aria-label="Voltar para início">
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </Link>

      {/* App shell (TopBar + map layer + BottomNav). Routes render
       *  inside `.mapLayer` via {children}. */}
      <div className={styles.shell}>
        {!hideShellChrome && (
          <TopBar
            onProfileOpen={() => router.push('/app/perfil')}
            onEditProfileOpen={() => router.push('/app/perfil')}
            onDeleteAccountOpen={() => router.push('/app/perfil')}
          />
        )}

        {/* Mobile route header — back arrow + centered title +
         *  drag-down → /app. Shows on every non-home /app route
         *  on mobile; hidden on home, on desktop, and while a
         *  chat detail is open (LiveChatPanel has its own). */}
        {showMobileRouteHeader && <MobileRouteHeader />}

        <div className={styles.mapLayer}>
          {/* Right-rail cluster — content diverges by viewport.
           *
           * Desktop: Chat + Playlist. Notificações + Superfãs got
           *   promoted out of here into the BottomNav per product
           *   feedback ("Mapa, Feed, Superfã, Comunidade e
           *   Notificações"), so the cluster keeps only the
           *   surfaces still without a navbar slot.
           *
           * Mobile: only the Chat / Send icon stays. The
           *   Notificações button was removed from this cluster
           *   per product feedback; notifications surface through
           *   the BottomNav's red unread badge on the chat slot
           *   instead.
           *
           * The cluster is also hidden when the Feed drawer is
           * open (mobile + desktop) — per product feedback the
           * message icon competes visually with the feed content,
           * and reaching chat while reading the feed isn't a
           * common path. Closing the feed brings the cluster
           * back automatically. */}
          {!hideShellChrome && !hideMobileHeader && !feedOpen && (
            <div className={styles.topBar}>
              {isMobile ? (
                <button
                  type="button"
                  className={`${styles.shortcutBtn} ${pathname.startsWith('/app/chat') ? styles.shortcutBtnActive : ''}`}
                  onClick={() => {
                    if (pathname.startsWith('/app/chat')) {
                      router.push('/app');
                    } else {
                      router.push('/app/chat');
                    }
                  }}
                  aria-label={pathname.startsWith('/app/chat') ? 'Fechar conversas' : 'Conversas'}
                  aria-pressed={pathname.startsWith('/app/chat')}
                  title="Conversas"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21.5 2.5L11 13M21.5 2.5L14.5 21.5L10.5 13L2 9L21.5 2.5z" />
                  </svg>
                  {chatUnreadCount > 0 && (
                    <span className={styles.shortcutBtnBadge} aria-hidden="true">
                      {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                    </span>
                  )}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={`${styles.shortcutBtn} ${pathname.startsWith('/app/chat') ? styles.shortcutBtnActive : ''}`}
                    onClick={() => {
                      // Toggle the chat surface: tap once opens the
                      // ConversationsSidebar route, tap again returns
                      // to the map. Mirrors the right-rail "toggle"
                      // shape of the other entries in this cluster.
                      if (pathname.startsWith('/app/chat')) {
                        router.push('/app');
                      } else {
                        router.push('/app/chat');
                      }
                    }}
                    aria-label={pathname.startsWith('/app/chat') ? 'Fechar conversas' : 'Conversas'}
                    aria-pressed={pathname.startsWith('/app/chat')}
                    title="Conversas"
                  >
                    {/* Paper-airplane (Send) glyph — Instagram-DM
                     *  pattern. Outline-stroke at the same 1.7 weight
                     *  as the surrounding right-rail icons so the
                     *  whole cluster reads as one icon set. */}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21.5 2.5L11 13M21.5 2.5L14.5 21.5L10.5 13L2 9L21.5 2.5z" />
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
                </>
              )}
            </div>
          )}

          {/* NotificationBell — controlled, hidden trigger. The
           *  visible affordance is the bell button in the right
           *  rail above; it dispatches `app:open-notifications`
           *  which the shell provider translates into
           *  activeOverlay='notifications'. */}
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

          {/* Route content lands here. position:fixed panels work
           *  the same way they did before the refactor. */}
          {children}
        </div>

        {!hideShellChrome && <BottomNav />}
      </div>

      {/* ArtistBox (Fanverse identity + missions panel) — on
       *  desktop it stays persistent across every /app/* route so
       *  the Fanpoints + entry to the benefits drawer stay visible
       *  on chat, comunidades, perfil, etc. On mobile per product
       *  feedback it lives ONLY on home (/app) — subpages have the
       *  MobileRouteHeader instead. Also always hidden when a chat
       *  detail is open. */}
      {!hideShellChrome && !hideMobileHeader && <ArtistBox />}

      {/* Avatar dock for the latest 3 conversations. Lives in the
       *  layout (not on /app's page.tsx) so the dock stays visible
       *  when the user routes to Superfãs, Comunidades, Perfil,
       *  etc. — clicking the crown used to unmount the dock and
       *  effectively hide the user's recent chats. On mobile the
       *  dock is gated to home only (subpages take the full screen
       *  and the right rail is gone). The chat-detail-open path
       *  hides it too because LiveChatPanel covers the dock there. */}
      {!hideShellChrome && !hideMobileHeader && (
        <LiveChatStack
          conversations={chat.conversations}
          activeId={chat.activeId}
          onlineUserIds={onlineUserIds}
          onOpen={(conversationId) => {
            chat.open(conversationId);
            router.push('/app/chat');
          }}
        />
      )}

      {/* Superchat trigger — top-right floater, persistent on
       *  desktop. Hidden on mobile entirely when not on home,
       *  same rationale as the ArtistBox pill. */}
      {!hideShellChrome && !hideMobileHeader && (
        <div className={styles.superchatTriggerSlot}>
          <SuperchatTrigger
            onClick={() => router.push('/app/superchat')}
            unreadCount={superchat?.unreadCount ?? 0}
          />
        </div>
      )}

      {/* NowPlaying mini-bar — on desktop it persists across every
       *  route so the user can keep playing while reading chat /
       *  comunidade. On mobile per product feedback the player
       *  lives ONLY on home (/app); every subpage has its own
       *  surface to focus on (chat composer, leaderboard, etc.)
       *  and a docked player there competes with their content +
       *  the BottomNav gradient scrim. When dismissed, the restore
       *  pill follows the same visibility rule. */}
      {!hideShellChrome && !hideMobileHeader && (playerHidden ? (
        <button
          type="button"
          className={styles.playerRestorePill}
          onClick={() => setPlayerHidden(false)}
          aria-label="Mostrar player"
          title="Mostrar player"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 3v8.5a2.5 2.5 0 1 1-1.6-2.3" />
            <path d="M6 3l7-1.5v8.5a2.5 2.5 0 1 1-1.6-2.3" />
          </svg>
        </button>
      ) : (
        <NowPlaying
          onExpandChange={setPlayerExpanded}
          onSizeChange={setPlayerSize}
          songIdx={songIdx}
          onSongIdxChange={setSongIdx}
          onOpenPlaylist={() => setShowPlaylist(true)}
          onDismiss={() => setPlayerHidden(true)}
        />
      ))}

      <PlaylistModal
        open={showPlaylist}
        onClose={() => setShowPlaylist(false)}
        currentIdx={songIdx}
        onSelect={setSongIdx}
      />

      {/* Superfãs as a layered overlay — desktop right-rail uses
       *  this path instead of router.push('/app/ranking') so the
       *  Feed (and anything else on /app/page.tsx) stays mounted
       *  underneath. The route version is still available for
       *  mobile BottomNav + deep links; we guard the overlay
       *  against double-mounting via `showSuperfans` excluding the
       *  /app/ranking pathname. */}
      {showSuperfans && (
        <SuperfansPanel
          open
          onClose={() =>
            setActiveOverlay((curr) =>
              curr === 'superfans' ? null : curr,
            )
          }
        />
      )}

      {/* Ana check-in modal — opens when the user clicks a pin on
       *  the globe. State + scheduler live in AppShellProvider. */}
      <AnaCheckInPanel
        payload={anaModalPayload}
        onClose={closeAnaCheckIn}
      />

      {/* Tour Portugal flight modal — opens when the user clicks
       *  the airplane marker on the great-circle path. The flight
       *  state is published every minute by AppShellProvider so the
       *  modal's progress bar + hours-remaining stay live while
       *  open. */}
      <AnaFlightPanel
        payload={anaFlightModalPayload}
        onClose={closeAnaFlight}
      />

      {/* Persistent toasts — render at the shell level so rewards,
       *  achievements, milestones, and "X listening the same
       *  track" all surface regardless of which route the user is
       *  on. */}
      <SameTrackToast />
      <PointsToast />
      <MilestoneNotification />
      <AchievementCelebration />
      <SocialAchievementToast />
    </>
  );
}
