'use client';

import Sparkles from './Sparkles';
import styles from './SectionArtists.module.css';

/**
 * Section "Para Artistas" — pivô da narrativa do fã pro artista. Só o H1
 * grande (Borscha + shimmer, mesmo dos outros headlines da landing).
 * Eyebrow, subtítulo e CTA foram removidos per feedback.
 */
export default function SectionArtists() {
  return (
    <section
      id="section-artists"
      data-section="artists"
      className={styles.section}
      aria-label="Para Artistas"
    >
      <Sparkles count={11} seed={47} />

      <div className={styles.inner}>
        <h2 className={styles.headline}>Para Artistas</h2>
      </div>
    </section>
  );
}
