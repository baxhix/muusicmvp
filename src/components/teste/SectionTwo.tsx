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
        {/* Per spec atualizado — 2 linhas, display weight:
         *   linha 1 (headline): "A conexão real entre"
         *   linha 2 (subline, mesmo peso): "Fã e Artista"
         *   subtitle (Inter cinza 16px): contexto. */}
        <h2 className={styles.headline}>A conexão real entre</h2>
        <p className={styles.subline}>Fã e Artista</p>
        <p className={styles.phrase}>
          Veja, em real time, seus amigos online curtindo junto com você!
        </p>
      </div>
    </section>
  );
}
