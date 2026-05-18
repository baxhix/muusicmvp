'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useIsMobile } from '@/hooks/useIsMobile';
import styles from './MobileHomeChrome.module.css';

/**
 * Mobile-only solid background + secondary info bar for the
 * /app home view.
 *
 * Renders three stacked horizontal strips at the very top of
 * the viewport:
 *
 *   - Header background (y:0 → 68): solid black band that
 *     sits behind the right-rail Notif/Send cluster, so the
 *     two icons share a continuous surface instead of looking
 *     like loose floating chrome. ArtistBox is hidden on
 *     mobile (see ArtistBox.module.css) — its Fanpoints chip
 *     moved into the info bar below.
 *   - Gray divider (1px) at y:68.
 *   - Info bar (y:69 → 105): the user's Fanpoints with the
 *     amber crown icon on the left, secondary live state
 *     (online-fan count) on the right.
 *
 * Unmounts on desktop and on every non-home route.
 */
export default function MobileHomeChrome() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.id ?? null);
  const fanpoints = profile?.fanpoints ?? 0;

  if (!isMobile) return null;

  return (
    <div className={styles.chrome} aria-hidden="false">
      <div className={styles.headerBg} aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-ana.png"
        alt="Ana Castela"
        className={styles.logo}
      />
      {/* (divider removed — header band and info bar are one
       *  continuous surface now per product feedback.) */}
      <div
        className={styles.infoBar}
        role="status"
        aria-label={`Você tem ${fanpoints.toLocaleString('pt-BR')} Fanpoints`}
      >
        <span className={styles.fanpointsChip}>
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2.5 19h19l-1.5-9-5 3.5L12 6l-3 7.5L4 10l-1.5 9z" />
          </svg>
          <span className={styles.fanpointsValue}>
            {fanpoints.toLocaleString('pt-BR')}
          </span>
          <span className={styles.fanpointsLabel}>Fanpoints</span>
        </span>
        <span className={styles.infoTextAux} aria-hidden="true">
          <span className={styles.infoDot} />
          24,8k online
        </span>
      </div>
    </div>
  );
}
