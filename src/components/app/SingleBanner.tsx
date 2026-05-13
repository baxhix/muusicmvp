'use client';

import styles from './SingleBanner.module.css';

/**
 * "Agora ou Nunca" single promo — fixed-position horizontal banner
 * anchored just BELOW the centered filter strip in the header.
 * Click opens YouTube search for the track in a new tab.
 *
 * Visual language follows the existing platform identity:
 *   - Translucent dark gradient surface (~58% alpha) with a saturated
 *     backdrop blur. Globe / lights bleed through gently, but text
 *     stays legible.
 *   - Accent-green hover state (matches every other interactive
 *     element across the app).
 *   - Two-line text hierarchy: bold title + muted lighter-weight
 *     artists line.
 *
 * Microinteractions intentionally restrained but layered:
 *   - Lift + accent ring on hover (centering preserved).
 *   - Cover art zooms 1.06× to suggest "into the cover".
 *   - Sweeping highlight gleam crosses the banner once per hover.
 *   - Continuous play-button pulse ring, stops on hover (static
 *     glow takes over).
 *   - Slight haptic-y scale-down on press.
 */
const SINGLE_URL =
  // Drop the real Spotify/YouTube link here when it's available.
  // For now the search URL on YouTube reliably surfaces the track.
  'https://www.youtube.com/results?search_query=Ana+Castela+Pedro+Sampaio+Agora+ou+Nunca';

export default function SingleBanner() {
  return (
    <a
      href={SINGLE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.banner}
      aria-label="Ouvir Agora ou Nunca, novo single da Ana Castela e Pedro Sampaio"
    >
      {/* Cover art on the left. Image preserved via object-fit so the
          square crop reads cleanly. */}
      <span className={styles.coverWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/single.png"
          alt=""
          className={styles.cover}
          draggable={false}
        />
      </span>

      {/* Text column — title, artists, and a live "X people listening"
          badge stacked vertically. */}
      <span className={styles.textBlock}>
        <span className={styles.title}>Agora ou Nunca</span>
        <span className={styles.subtitle}>Ana Castela &amp; Pedro Sampaio</span>
        <span className={styles.badge}>
          <span className={styles.badgeDot} aria-hidden="true" />
          <strong className={styles.badgeCount}>12.988</strong>
          <span className={styles.badgeLabel}>pessoas ouvindo</span>
        </span>
      </span>

      {/* Big play CTA on the right — always visible, accent-green
          circle with the classic play glyph + a soft pulse so the
          eye gets drawn there. Whole banner is the click target;
          this just makes the affordance unmistakable. */}
      <span className={styles.playBtn} aria-hidden="true">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M4 2.5v11l9-5.5z" />
        </svg>
      </span>

      {/* Sweeping highlight gleam — fires once per hover (CSS animation
          on parent:hover), gives the banner a fresh "polish" feel. */}
      <span className={styles.gleam} aria-hidden="true" />
    </a>
  );
}
