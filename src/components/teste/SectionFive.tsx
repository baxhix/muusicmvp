'use client';

import Sparkles from './Sparkles';
import SectionCTA from './SectionCTA';
import styles from './SectionFive.module.css';

/**
 * Section 5 — Artistas.
 *
 * Conteúdo textual segue as typography rules:
 *   - Headline 1 palavra ALL CAPS ("ARTISTAS").
 *   - Frase >2 palavras em Inter 16px cinza.
 *
 * Avatares vivem na <AvatarConstellation /> page-level — esta
 * section só serve de gatilho via id="section-5".
 */
export default function SectionFive() {
  return (
    <section
      id="section-5"
      data-section="5"
      className={styles.section}
    >
      <Sparkles count={32} seed={134} />

      <div className={styles.center}>
        <h2 className={styles.headline}>ARTISTAS</h2>
        <p className={styles.phrase}>
          O lugar onde a sua arte encontra quem importa
        </p>
        <SectionCTA />
      </div>
    </section>
  );
}
