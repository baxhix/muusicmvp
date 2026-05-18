'use client';

import { useIsMobile } from '@/hooks/useIsMobile';
import styles from './MobileHomeChrome.module.css';

/**
 * Mobile-only solid background + secondary info bar for the
 * /app home view.
 *
 * Renders three stacked horizontal strips at the very top of
 * the viewport:
 *
 *   - Header background (top 0 → 68): a solid black-tinted bar
 *     that sits BEHIND the ArtistBox Fanpoints pill on the
 *     left and the Notif/Send cluster on the right, so both
 *     floating elements share a single continuous surface
 *     instead of looking like loose floating chrome.
 *   - Gray divider (1px) at y:68.
 *   - Info bar (y:69 → 108): reserved space for "outras
 *     informações" the team will plug in (now-playing ticker,
 *     event countdown, fan-count, etc.). Placeholder copy
 *     for now so the surface reads intentional.
 *
 * Unmounts on desktop (the floating ArtistBox card + cluster
 * are already a finished visual there) and on every non-home
 * route (those use the MobileRouteHeader instead).
 */
export default function MobileHomeChrome() {
  const isMobile = useIsMobile();
  if (!isMobile) return null;

  return (
    <div className={styles.chrome} aria-hidden="true">
      <div className={styles.headerBg} />
      <div className={styles.divider} />
      <div className={styles.infoBar}>
        <span className={styles.infoTextMain}>Tour Portugal · em curso</span>
        <span className={styles.infoTextAux}>
          <span className={styles.infoDot} />
          {/* Placeholder secondary info — swap for live state when
           *  the team decides what should live here. */}
          24,8k fãs online
        </span>
      </div>
    </div>
  );
}
