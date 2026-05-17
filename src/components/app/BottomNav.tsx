'use client';

import { usePathname } from 'next/navigation';
import { useLocationSync } from '@/hooks/useLocationSync';
import { useAuth } from '@/lib/auth/AuthContext';
import { globeStore } from '@/lib/globeStore';
import styles from './BottomNav.module.css';

/** Which of the singleton overlays is currently open in /app.
 *  Mirrors the `ActiveOverlay` union in app/page.tsx — kept as a
 *  loose string union here so BottomNav stays decoupled from the
 *  page's local types. The active-dot under each icon lights up
 *  for the matching value.
 *
 *  After the mobile refactor every primary surface (chat, feed,
 *  community) has a dedicated slot here, so the union grew to
 *  cover them. Secondary overlays (superfans / playlist /
 *  superchat / notifications) light no dot in this row — they
 *  open from the TopBar cluster on the right side of the screen.
 */
export type BottomNavActiveOverlay =
  | null
  | 'superfans'
  | 'playlist'
  | 'superchat'
  | 'notifications'
  | 'chat'
  | 'community'
  | 'feed'
  | 'profile';

interface BottomNavProps {
  onProfileOpen?: () => void;
  /** Toggle / open the conversations sidebar (DMs + group). */
  onChatOpen?: () => void;
  /** Toggle / open the communities forum panel. */
  onCommunityOpen?: () => void;
  /** Open the feed panel — fires `app:toggle-feed` since the
   *  FeedPanel owns its own minimized/open state internally. */
  onFeedToggle?: () => void;
  /** Which overlay is currently open — drives the active-dot under
   *  the matching nav icon so the user always knows which modal is
   *  on screen. Null when no overlay is open (only the map slot may
   *  still light up via pathname). */
  activeOverlay?: BottomNavActiveOverlay;
  /** True when the FeedPanel is in its open (non-minimized) state.
   *  Drives the Feed slot's active-dot independently of `activeOverlay`
   *  because the feed is a non-modal bottom-sheet, not a singleton. */
  feedOpen?: boolean;
  /** Unread DM count — drives the red badge on the Chat slot. */
  chatUnreadCount?: number;
}

export default function BottomNav({
  onProfileOpen,
  onChatOpen,
  onCommunityOpen,
  onFeedToggle,
  activeOverlay = null,
  feedOpen = false,
  chatUnreadCount = 0,
}: BottomNavProps = {}) {
  const pathname = usePathname();

  const { user } = useAuth();
  const { status, request } = useLocationSync();
  const hasCoords = user?.lat != null && user?.lng != null;
  const locating = status === 'requesting';

  const handleMapClick = () => {
    if (hasCoords && user) {
      globeStore.flyTo([user.lng as number, user.lat as number], 11);
    } else {
      request();
    }
  };

  const mapTooltip = locating
    ? 'Localizando…'
    : hasCoords
      ? 'Centralizar no meu local'
      : 'Compartilhar localização';

  const onMap = pathname === '/app' && activeOverlay === null && !feedOpen;

  return (
    <nav className={styles.nav} aria-label="Navegação principal">
      <div className={styles.inner}>
        {/* Mapa — active when no other surface is taking over. */}
        <button
          type="button"
          className={`${styles.item} ${onMap ? styles.itemActive : ''}`}
          onClick={handleMapClick}
          disabled={locating}
          aria-label={mapTooltip}
          data-tooltip={mapTooltip}
        >
          <svg viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M3 11h16M11 3c-2 2.5-3 5-3 8s1 5.5 3 8M11 3c2 2.5 3 5 3 8s-1 5.5-3 8"
              stroke="currentColor"
              strokeWidth="1.6"
            />
          </svg>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>Mapa</span>
        </button>

        {/* Feed — toggles the bottom-sheet via the `app:toggle-feed`
            CustomEvent the FeedPanel listens to. Active-dot lights
            up while the panel is in its open (non-minimized) state. */}
        <button
          type="button"
          className={`${styles.item} ${feedOpen ? styles.itemActive : ''}`}
          onClick={onFeedToggle}
          aria-label={feedOpen ? 'Fechar feed' : 'Abrir feed'}
          data-tooltip={feedOpen ? 'Fechar feed' : 'Feed'}
        >
          <svg viewBox="0 0 22 22" fill="none">
            <rect x="4" y="4" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M7.5 9h7M7.5 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>Feed</span>
        </button>

        {/* Chat — opens ConversationsSidebar. The unread-count
            badge sits at the top-right of the icon when > 0. */}
        <button
          type="button"
          className={`${styles.item} ${styles.itemCenter} ${activeOverlay === 'chat' ? styles.itemActive : ''}`}
          onClick={onChatOpen}
          aria-label="Abrir conversas"
          data-tooltip="Chat"
        >
          <span className={styles.iconWrap}>
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M21 12a8 8 0 1 1-3.5-6.6L21 4l-1.2 3.5A7.96 7.96 0 0 1 21 12z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {chatUnreadCount > 0 && (
              <span className={styles.unreadBadge}>
                {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
              </span>
            )}
          </span>
          <span className={styles.dot} aria-hidden="true" />
        </button>

        {/* Comunidade — opens CommunityPanel. */}
        <button
          type="button"
          className={`${styles.item} ${activeOverlay === 'community' ? styles.itemActive : ''}`}
          onClick={onCommunityOpen}
          aria-label="Abrir comunidades"
          data-tooltip="Comunidade"
        >
          <svg viewBox="0 0 22 22" fill="none">
            <path
              d="M4 7a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H9l-3 2.5V13H6a2 2 0 0 1-2-2z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 14a2 2 0 0 0 2 2h2l2 1.5V16a2 2 0 0 0 2-2v-3"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>Comunidade</span>
        </button>

        {/* Perfil — opens ProfilePanel. The avatar (or fallback
            icon) reads as the "me" affordance. */}
        <button
          type="button"
          className={`${styles.item} ${activeOverlay === 'profile' ? styles.itemActive : ''}`}
          onClick={onProfileOpen}
          aria-label="Abrir perfil"
          data-tooltip="Perfil"
        >
          <svg viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M4 19c1.4-3.2 4-5 7-5s5.6 1.8 7 5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>Perfil</span>
        </button>
      </div>
    </nav>
  );
}
