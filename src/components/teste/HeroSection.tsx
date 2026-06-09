'use client';

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
      {/* Sparkles removido — substituído pelo star field global em
       *  <GalaxyBackdrop /> (canvas único, mesma densidade visual). */}

      {/* Grid 3 rows: headline (row 1) — gap fixo de 180px
       *  (row 2, com a frase de apoio sobreposta no topo) —
       *  mockup de phones (row 3). Assim o TOPO do mockup
       *  fica exatamente 180px abaixo da BASE do headline,
       *  independente do tamanho do texto da frase. */}
      <div className={styles.center}>
        {/* Per spec atualizado:
         *   linha 1: "Universo do"
         *   linha 2: "Superfã" (mesma fonte/peso, fica
         *            inline-block como uma 2ª linha do headline,
         *            não um caption à parte). */}
        <h1 className={styles.headline}>
          Universo do<br />Superfã
        </h1>
        <p className={styles.phrase}>
          O lugar perfeito de conexão entre o Artista e o Fã
        </p>
        {/* CTA mobile — só aparece em mobile per spec atualizado
         *  "No mobile, deixe esse CTA abaixo do headline Superfãs".
         *  No desktop o CTA vive na Navbar; no mobile a navbar
         *  esconde o CTA e mostramos aqui. Lux estática atrás
         *  (só muda cor, não posição) — mesmo padrão do Navbar. */}
        <a href="/auth" className={styles.heroMobileCta}>
          Meu Fanverse
        </a>
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
