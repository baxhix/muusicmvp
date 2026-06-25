import ApplePhone from './ApplePhone';
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
         *   linha 1: "O Universo do"
         *   linha 2: "Superfã" (mesma fonte/peso, fica
         *            inline-block como uma 2ª linha do headline,
         *            não um caption à parte). */}
        <h1 className={styles.headline}>
          O Universo do<br />Superfã
        </h1>
        {/* Lead: frase de apoio. Wrapper ocupa a row 2 do grid
         *  (align-start), preservando o Y dos phones na row 3.
         *  (O CTA "Entrar com código" foi removido per spec.) */}
        <div className={styles.heroLead}>
          <p className={styles.phrase}>
            O lugar perfeito de conexão{' '}
            <br className={styles.phraseBreakMobile} />
            entre o Artista e o Fã
          </p>
        </div>
        <div className={styles.phonesWrap}>
          {/* Mockup de celular com o brilho animado estilo "Apple
           *  Intelligence" (gradiente girando nas bordas + bloom
           *  externo respirando). Substitui o PNG dos 3 smartphones. */}
          <ApplePhone />
        </div>
      </div>
      {/* CTAs mobile — DOIS botões flutuantes fixos no rodapé (só
       *  aparecem em mobile; no desktop vivem na Navbar). VIVEM FORA
       *  do `.center` de propósito: o `.center` é position:relative +
       *  z-index:5 (stacking context), então qualquer filho fixed ficava
       *  preso nesse nível e era coberto pelas sections seguintes (z=5,
       *  depois no DOM), avatares (30), navbar (50) e megamenu (60-80).
       *  Como filhos diretos do `.hero` (que NÃO cria stacking context),
       *  o z-index alto vale no contexto raiz e os CTAs ficam por cima
       *  de tudo. Ambos pretos (per feedback). */}
      <div className={styles.heroMobileCtas}>
        <a
          href="/para-artistas"
          className={`${styles.heroMobileCta} ${styles.heroMobileCtaSecondary}`}
        >
          Sou artista
        </a>
        <a
          href="/auth"
          className={`${styles.heroMobileCta} ${styles.heroMobileCtaPrimary}`}
        >
          Sou Fã
        </a>
      </div>
    </section>
  );
}
