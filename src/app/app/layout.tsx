'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AppShellProvider, useAppShell } from '@/lib/app/AppShellContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import BottomNav from '@/components/app/BottomNav';
import TopBar from '@/components/app/TopBar';
import NowPlaying from '@/components/app/NowPlaying';
import PlaylistModal from '@/components/app/PlaylistModal';
import NotificationBell from '@/components/app/NotificationBell';
import SuperchatTrigger from '@/components/app/SuperchatTrigger';
import AnaCheckInPanel from '@/components/app/AnaCheckInPanel';
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
 * `/app/select` is the one exception: it's a pre-app gate that
 * doesn't need any of this. The early-return below sends select
 * back as a plain pass-through so the AppShellProvider's chat
 * websocket + globe + persistent UI don't spin up during a 5-
 * second universe pick.
 */

const Globe = dynamic(() => import('@/components/app/Globe'), { ssr: false });

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname === '/app/select') return <>{children}</>;

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
    activeOverlay,
    setActiveOverlay,
    setShowPlaylist,
    songIdx,
    setSongIdx,
    setPlayerExpanded,
    setPlayerSize,
    anaModalPayload,
    closeAnaCheckIn,
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
  const superchat = chat.conversations.find((c) => c.type === 'group') ?? null;

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
        <TopBar
          onProfileOpen={() => router.push('/app/perfil')}
          onEditProfileOpen={() => router.push('/app/perfil')}
          onDeleteAccountOpen={() => router.push('/app/perfil')}
        />

        <div className={styles.mapLayer}>
          {/* Right-rail secondary actions cluster — persistent
           *  affordances for the surfaces that don't fit the
           *  5-slot BottomNav. */}
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

        <BottomNav />
      </div>

      {/* Superchat trigger — top-right floater, persistent. */}
      <div className={styles.superchatTriggerSlot}>
        <SuperchatTrigger
          onClick={() => router.push('/app/superchat')}
          unreadCount={superchat?.unreadCount ?? 0}
        />
      </div>

      {/* NowPlaying mini-bar — persists across every route so the
       *  user can keep playing while reading chat / comunidade. */}
      <NowPlaying
        onExpandChange={setPlayerExpanded}
        onSizeChange={setPlayerSize}
        songIdx={songIdx}
        onSongIdxChange={setSongIdx}
        onOpenPlaylist={() => setShowPlaylist(true)}
      />

      <PlaylistModal
        open={showPlaylist}
        onClose={() => setShowPlaylist(false)}
        currentIdx={songIdx}
        onSelect={setSongIdx}
      />

      {/* Ana check-in modal — opens when the user clicks a pin on
       *  the globe. State + scheduler live in AppShellProvider. */}
      <AnaCheckInPanel
        payload={anaModalPayload}
        onClose={closeAnaCheckIn}
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
