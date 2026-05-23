'use client';

import Sparkles from './Sparkles';
import styles from './HeroSection.module.css';

/**
 * Section 1 — hero.
 *
 * Conteúdo per typography rules fixadas com o produto:
 *   - Headline: 1 palavra, ALL CAPS, 80px, Peace Sans, centro.
 *   - Frase (>2 palavras): Inter 16px, cinza.
 *
 * Os avatares NÃO vivem mais aqui — foram lifted pra
 * <AvatarConstellation /> no nível da page, com position: fixed
 * e reveal via scroll. A section fica responsável apenas pelo
 * conteúdo textual + sparkles próprio + servir de target pro
 * IntersectionObserver.
 */
export default function HeroSection() {
  return (
    <section
      id="section-1"
      data-section="1"
      className={styles.hero}
    >
      <Sparkles count={28} seed={9} />

      {/* Grid 3 rows: headline (row 1) — gap fixo de 180px
       *  (row 2, com a frase de apoio sobreposta no topo) —
       *  mockup de phones (row 3). Assim o TOPO do mockup
       *  fica exatamente 180px abaixo da BASE do headline,
       *  independente do tamanho do texto da frase. */}
      <div className={styles.center}>
        <h1 className={styles.headline}>Superfãs</h1>
        <p className={styles.phrase}>
          O lugar certo para criar conexões
        </p>
        <div className={styles.phonesWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/teste/phones-mockup.png"
            alt="Três smartphones mostrando o app Fanverse"
            className={styles.phonesImg}
            loading="eager"
          />
        </div>
      </div>
    </section>
  );
}
