'use client';

import { usePathname } from 'next/navigation';
import { useLocationSync } from '@/hooks/useLocationSync';
import { useAuth } from '@/lib/auth/AuthContext';
import { globeStore } from '@/lib/globeStore';
import styles from './BottomNav.module.css';

interface BottomNavProps {
  onSuperfansOpen?: () => void;
  onProfileOpen?: () => void;
  /** Open the global Superchat panel (wired in page.tsx). */
  onSuperchatOpen?: () => void;
  /** Open the playlist modal (catalog of registered tracks). Wired
   *  in page.tsx to setShowPlaylist(true). */
  onPlaylistOpen?: () => void;
}

export default function BottomNav({
  onSuperfansOpen,
  onProfileOpen,
  onSuperchatOpen,
  onPlaylistOpen,
}: BottomNavProps = {}) {
  const pathname = usePathname();

  // Map icon now mirrors the bottom-left LocateButton: first click
  // (no coords yet) prompts the browser for geolocation + posts to
  // /api/me/location; subsequent clicks just fly the globe to the
  // user's stored coords. Same hook, same handler shape.
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

  return (
    <nav className={styles.nav} aria-label="Navegação principal">
      <div className={styles.inner}>
        {/* Mapa — now behaves like LocateButton in the bottom-left
            corner: requests permission OR centers on the user. No
            longer a router link since we're already on /app
            whenever this bar is visible. */}
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
              strokeWidth="1.3"
            />
          </svg>
          <div className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>Mapa</span>
        </button>

        {/* Músicas — opens the PlaylistModal with the catalog of
            registered tracks. The old "Feed" landmark was passive
            (the FeedPanel surface is already the resting view in
            page.tsx); promoting this slot to a real action gives
            the user a one-tap path into the music library. */}
        <button
          type="button"
          className={styles.item}
          onClick={onPlaylistOpen}
          aria-label="Abrir lista de músicas"
          data-tooltip="Músicas"
        >
          {/* Music list icon — stacked lines + a music note on the
              right tail, reads as "playlist" / "library". */}
          <svg viewBox="0 0 22 22" fill="none">
            <path
              d="M3 5h11M3 11h11M3 17h7"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="M19 7v9.2"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <circle
              cx="17.4"
              cy="16.7"
              r="1.7"
              fill="currentColor"
              stroke="none"
            />
          </svg>
          <div className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>Músicas</span>
        </button>

        {/* Center crown button — opens Ranking/Superfans */}
        <button
          className={`${styles.item} ${styles.itemCenter}`}
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
        </button>

        {/* Chat → opens the Superchat panel */}
        <button
          type="button"
          className={styles.item}
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
          <div className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>Chat</span>
        </button>

        {/* Profile */}
        <button
          className={`${styles.item} ${pathname === '/app/profile' ? styles.itemActive : ''}`}
          onClick={onProfileOpen}
          aria-label="Perfil"
          data-tooltip="Perfil"
        >
          <svg viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M4 19c0-3.5 3-6 7-6s7 2.5 7 6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <div className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>Perfil</span>
        </button>
      </div>
    </nav>
  );
}
