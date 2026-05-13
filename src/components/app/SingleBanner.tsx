'use client';

import styles from './SingleBanner.module.css';

/**
 * "Agora ou Nunca" single promo — fixed-position horizontal banner
 * anchored to the top-left of the app shell, slotted between the
 * SideBar (left vertical strip) and the centered FilterTabs row.
 *
 * Visual language follows the existing platform identity:
 *   - Dark gradient surface w/ backdrop-filter blur (same as TopBar
 *     userMenu pill, ChatStack tooltip, NowPlaying card).
 *   - Accent-green hover state (matches every other interactive
 *     element across the app).
 *   - Three-line text hierarchy: kicker (uppercase muted) → title
 *     (bold white) → subtitle (muted gray) — same pattern used in
 *     the chat header now-playing line + map pin preview.
 *
 * Microinteractions intentionally restrained but layered:
 *   - Lift + accent ring on hover.
 *   - Cover art zooms 1.06× to suggest "into the cover".
 *   - Sweeping highlight gleam crosses the banner once per hover.
 *   - Continuous equalizer bars on the right echo "this is music".
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
      {/* Cover art on the left. Image is preserved via object-fit so the
          face-illustration crops cleanly when squeezed into a square. */}
      <span className={styles.coverWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/single.png"
          alt=""
          className={styles.cover}
          draggable={false}
        />
        {/* Play icon overlay — invisible until hover for the "wake up
            and listen" affordance. */}
        <span className={styles.playOverlay} aria-hidden="true">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M4 2.5v11l9-5.5z" />
          </svg>
        </span>
      </span>

      {/* Text block — kicker / title / subtitle. */}
      <span className={styles.textBlock}>
        <span className={styles.kicker}>
          <span className={styles.kickerDot} aria-hidden="true" />
          NOVO SINGLE
        </span>
        <span className={styles.title}>Agora ou Nunca</span>
        <span className={styles.subtitle}>Ana Castela × Pedro Sampaio</span>
      </span>

      {/* Equalizer microanimation on the right — communicates "music
          plays here" without needing audio. Three bars looping out of
          phase so the motion feels organic, not metronomic. */}
      <span className={styles.eq} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>

      {/* Sweeping highlight gleam — fires once per hover (CSS animation
          on parent:hover), gives the banner a fresh "polish" feel. */}
      <span className={styles.gleam} aria-hidden="true" />
    </a>
  );
}
