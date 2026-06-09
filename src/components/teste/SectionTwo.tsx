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
      <Sparkles count={13} seed={21} />

      <div className={styles.center}>
        {/* Per spec atualizado:
         *   line 1 (headline): "O mundo, a música,"
         *   line 2 (subline mesmo peso): "em tempo real"
         *   subtitle (Inter cinza 16px): explica o real-time. */}
        <h2 className={styles.headline}>O mundo, a música,</h2>
        <p className={styles.subline}>em tempo real</p>
        <p className={styles.phrase}>
          Veja, em real time, seus amigos online curtindo junto com você!
        </p>
      </div>
    </section>
  );
}
