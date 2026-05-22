'use client';

import Sparkles from './Sparkles';
import SectionCTA from './SectionCTA';
import styles from './SectionThree.module.css';

/**
 * Section 3 — mock final pra fechar a constelação.
 *
 * Conteúdo textual segue as typography rules:
 *   - Headline 1 palavra ALL CAPS 80px ("PERTENCER").
 *   - Frase >2 palavras em Inter 16px cinza.
 *
 * Avatares vivem na <AvatarConstellation /> — esta section é
 * só gatilho de scroll via `id="section-3"`.
 */
export default function SectionThree() {
  return (
    <section
      id="section-3"
      data-section="3"
      className={styles.section}
    >
      <Sparkles count={36} seed={42} />

      <div className={styles.center}>
        <h2 className={styles.headline}>PERTENCER</h2>
        <p className={styles.phrase}>
          Descubra, conecte e pertença a uma comunidade
        </p>
        <SectionCTA />
      </div>
    </section>
  );
}
