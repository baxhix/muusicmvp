'use client';

import { useState } from 'react';
import styles from './AudioPost.module.css';

const BARS = Array.from({ length: 15 });

export default function AudioPost() {
  const [playing, setPlaying] = useState(false);

  return (
    <div className={styles.card}>
      <div className={styles.inner}>

        {/* Avatar — /public/ana-castela-fanverse-hero.jpg per product feedback.
            The previous src was a Spotify-CDN URL; switching to the
            local file means AudioPost ships with the build (no
            third-party dependency for the preview thumbnail). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ana-castela-fanverse-hero.jpg"
          alt="Ana Castela"
          className={styles.avatar}
        />

        {/* Middle */}
        <div className={styles.middle}>
          <span className={styles.title}>Áudio da Ana!</span>

          <div className={styles.waveRow}>
            <div className={`${styles.wave} ${!playing ? styles.wavePaused : ''}`}>
              {BARS.map((_, i) => (
                <div key={i} className={styles.bar} />
              ))}
            </div>
            <span className={styles.duration}>3:34</span>
          </div>
        </div>

        {/* Play / Pause */}
        <button
          className={styles.playBtn}
          onClick={() => setPlaying(p => !p)}
          aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'}
        >
          {playing ? (
            /* Pause icon */
            <svg viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="2" width="3.5" height="12" rx="1.2"/>
              <rect x="9.5" y="2" width="3.5" height="12" rx="1.2"/>
            </svg>
          ) : (
            /* Play icon */
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2.5l10 5.5-10 5.5V2.5z"/>
            </svg>
          )}
        </button>

      </div>
    </div>
  );
}
