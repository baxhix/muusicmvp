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
 *  'chat' and 'community' are included so the type aligns with
 *  the page's union, but no nav icon maps to them (both panels
 *  open from the right-rail dock, not from BottomNav). When
 *  either is the active overlay no dot lights up here. */
export type BottomNavActiveOverlay =
  | null
  | 'superfans'
  | 'playlist'
  | 'superchat'
  | 'notifications'
  | 'chat'
  | 'community';

interface BottomNavProps {
  onSuperfansOpen?: () => void;
  onProfileOpen?: () => void;
  /** Open the global Superchat panel (wired in page.tsx). */
  onSuperchatOpen?: () => void;
  /** Open the playlist modal (catalog of registered tracks). Wired
   *  in page.tsx to setShowPlaylist(true). */
  onPlaylistOpen?: () => void;
  /** Which overlay is currently open — drives the active-dot under
   *  the matching nav icon so the user always knows which modal is
   *  on screen. Null when no overlay is open (only the map slot may
   *  still light up via pathname). */
  activeOverlay?: BottomNavActiveOverlay;
}

export default function BottomNav({
  onSuperfansOpen,
  onSuperchatOpen,
  onPlaylistOpen,
  activeOverlay = null,
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

  // Open notifications by dispatching a window-level CustomEvent the
  // (now hidden) NotificationBell listens to. Keeps the trigger and
  // the panel decoupled.
  const openNotifications = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('app:open-notifications'));
  };

  return (
    <nav className={styles.nav} aria-label="Navegação principal">
      <div className={styles.inner}>
        {/* Mapa */}
        <button
          type="button"
          className={`${styles.item} ${pathname === '/app' ? styles.itemActive : ''}`}
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

        {/* Músicas (Play) — back to plain stroke icon, no tile
            wrapper. Same stroke weight + same white color as every
            other nav item so the row reads as a uniform set. */}
        <button
          type="button"
          className={`${styles.item} ${activeOverlay === 'playlist' ? styles.itemActive : ''}`}
          onClick={onPlaylistOpen}
          aria-label="Abrir lista de músicas"
          data-tooltip="Músicas"
        >
          <svg viewBox="0 0 22 22" fill="none">
            <path
              d="M7 4.5v13l11-6.5z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>Músicas</span>
        </button>

        {/* Center crown — Superfãs */}
        <button
          className={`${styles.item} ${styles.itemCenter} ${activeOverlay === 'superfans' ? styles.itemActive : ''}`}
          onClick={onSuperfansOpen}
          aria-label="Superfãs"
          data-tooltip="Superfãs"
        >
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M3.5 8.5l2 9.5h13l2-9.5-5 3.5-3.5-7-3.5 7-5-3.5z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M6.5 21h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          {/* Active-dot — shown when SuperfansPanel is open. Hidden
              by default via `.itemCenter .dot` so it doesn't sit
              under the crown; the `.itemCenter.itemActive .dot`
              override below brings it back when this slot owns the
              active overlay. */}
          <span className={styles.dot} aria-hidden="true" />
        </button>

        {/* Superchat */}
        <button
          type="button"
          className={`${styles.item} ${activeOverlay === 'superchat' ? styles.itemActive : ''}`}
          onClick={onSuperchatOpen}
          aria-label="Abrir Superchat"
          data-tooltip="Superchat"
        >
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>Chat</span>
        </button>

        {/* Notificações — single source. The top-bar bell trigger
            was removed; the panel is rendered hidden and surfaces
            here via the 'app:open-notifications' CustomEvent. */}
        <button
          type="button"
          className={`${styles.item} ${activeOverlay === 'notifications' ? styles.itemActive : ''}`}
          onClick={openNotifications}
          aria-label="Notificações"
          data-tooltip="Notificações"
        >
          <svg viewBox="0 0 22 22" fill="none">
            <path
              d="M5 9a6 6 0 0 1 12 0v3.4l1.4 2.6H3.6L5 12.4Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M9 18a2 2 0 0 0 4 0"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>Notificações</span>
        </button>
      </div>
    </nav>
  );
}
