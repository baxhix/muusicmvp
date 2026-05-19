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
  // First name only, used in the "Olá, X" greeting on the left
  // side of the info bar. `name` is "First Last" in our seed;
  // splitting on whitespace and taking [0] gives the first
  // token. Fallback "fã" when the auth state hasn't resolved
  // yet so the greeting line still reads naturally.
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? 'fã';

  if (!isMobile) return null;

  return (
    <div className={styles.chrome} aria-hidden="false">
      <div className={styles.headerBg} aria-hidden="true" />
      <div className={styles.brand} aria-hidden="false">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-ana.png"
          alt="Ana Castela"
          className={styles.logo}
        />
        <span className={styles.brandLabel} aria-label="Fanverse">
          FANVERSE
        </span>
      </div>
      <div
        className={styles.infoBar}
        role="status"
        aria-label={`Olá, ${firstName}. Você tem ${fanpoints.toLocaleString('pt-BR')} Fanpoints`}
      >
        {/* Greeting — gray "Olá," + white bold first name on the
          * LEFT side of the info bar. Mirrors the typography of
          * the Fanpoints chip on the right so the two reads as
          * a balanced pair. */}
        <span className={styles.greeting}>
          <span className={styles.greetingLabel}>Olá,</span>
          <span className={styles.greetingName}>{firstName}</span>
        </span>
        {/* Fanpoints chip — moved to the RIGHT side per product
          * feedback. `.infoBar` uses `justify-content:
          * space-between`, so the first child (greeting) lands
          * on the left and this one on the right naturally. */}
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
      </div>
    </div>
  );
}
