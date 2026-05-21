'use client';

import Sparkles from './Sparkles';
import styles from './SectionTwo.module.css';

/**
 * Section 2 — mock pra avaliar o reveal de avatares.
 *
 * Conteúdo textual segue as typography rules:
 *   - Headline 1 palavra ALL CAPS 80px ("MÚSICA").
 *   - Frase >2 palavras em Inter 16px cinza ("Cada música
 *     leva você a alguém").
 *
 * Avatares vivem na <AvatarConstellation /> page-level — esta
 * section só serve de gatilho pro IntersectionObserver via
 * `id="section-2"` + `data-section="2"`.
 */
export default function SectionTwo() {
  return (
    <section
      id="section-2"
      data-section="2"
      className={styles.section}
    >
      <Sparkles count={32} seed={21} />

      <div className={styles.center}>
        <h2 className={styles.headline}>MÚSICA</h2>
        <p className={styles.phrase}>Cada música leva você a alguém</p>
      </div>
    </section>
  );
}
