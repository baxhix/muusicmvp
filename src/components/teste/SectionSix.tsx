'use client';

import Sparkles from './Sparkles';
import SectionCTA from './SectionCTA';
import styles from './SectionSix.module.css';

/**
 * Section 6 — Baixe o App.
 *
 * Última section da landing antes do footer. Headline rompe
 * a regra "1 palavra" porque o nome da section dita o
 * conteúdo: "BAIXE O APP" — 3 palavras intencionais.
 */
export default function SectionSix() {
  return (
    <section
      id="section-6"
      data-section="6"
      className={styles.section}
    >
      <Sparkles count={28} seed={219} />

      <div className={styles.center}>
        <h2 className={styles.headline}>BAIXE O APP</h2>
        <p className={styles.phrase}>
          Disponível para iOS e Android
        </p>
        <SectionCTA>Baixar app</SectionCTA>
      </div>
    </section>
  );
}
