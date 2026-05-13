'use client';

import styles from './SingleBanner.module.css';

interface Props {
  /** Click handler for the "Entre no Superchat!" CTA inside the
   *  banner. Wired in /app/page.tsx to setShowSuperchat(true). */
  onOpenSuperchat: () => void;
}

/**
 * "Agora ou Nunca" single promo — fixed-position horizontal pill
 * anchored just BELOW the centered filter strip in the header. No
 * longer links out to YouTube; the banner is now a presentational
 * surface and the in-pill button opens the Superchat where fans
 * discuss the song.
 *
 * Visual language follows the existing platform identity:
 *   - Translucent dark gradient + saturated backdrop blur.
 *   - Continuous (very subtle) yellow→red gleam sweeping across.
 *   - Pulsing red "live" dot in the listener badge.
 *   - Pill silhouette (border-radius: 999px).
 */
export default function SingleBanner({ onOpenSuperchat }: Props) {
  return (
    <div className={styles.banner}>
      {/* Cover art on the left. Image preserved via object-fit so
          the square crop reads cleanly. */}
      <span className={styles.coverWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/single.png"
          alt=""
          className={styles.cover}
          draggable={false}
        />
      </span>

      {/* Text column — title over artists. The listener badge moved
          to the right-hand actions column so it sits directly under
          the CTA. */}
      <span className={styles.textBlock}>
        <span className={styles.title}>Agora ou Nunca</span>
        <span className={styles.subtitle}>Ana Castela &amp; Pedro Sampaio</span>
      </span>

      {/* Actions column — CTA button on top, listener badge under
          it so the "X are already here" social proof lands right
          after the user reads the verb. */}
      <div className={styles.actionsBlock}>
        <button
          type="button"
          className={styles.ctaBtn}
          onClick={onOpenSuperchat}
          aria-label="Entre no Superchat"
        >
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            fill="currentColor"
            aria-hidden="true"
            className={styles.ctaIcon}
          >
            <path d="M4 2.5v11l9-5.5z" />
          </svg>
          <span>Entre no Superchat!</span>
        </button>

        <span className={styles.badge}>
          <span className={styles.badgeDot} aria-hidden="true" />
          <strong className={styles.badgeCount}>12.988</strong>
          <span className={styles.badgeLabel}>pessoas ouvindo</span>
        </span>
      </div>
    </div>
  );
}
