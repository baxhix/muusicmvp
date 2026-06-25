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
        {/* CTA mobile — só aparece em mobile per spec atualizado
         *  "No mobile, deixe esse CTA abaixo do headline Superfãs".
         *  No desktop o CTA vive na Navbar; no mobile a navbar
         *  esconde o CTA e mostramos aqui. Lux estática atrás
         *  (só muda cor, não posição) — mesmo padrão do Navbar. */}
        <a href="/auth" className={styles.heroMobileCta}>
          <svg
            className={styles.heroCtaIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" x2="3" y1="12" y2="12" />
          </svg>
          Entrar
        </a>
        <div className={styles.phonesWrap}>
          {/* Mockup de celular com o brilho animado estilo "Apple
           *  Intelligence" (gradiente girando nas bordas + bloom
           *  externo respirando). Substitui o PNG dos 3 smartphones. */}
          <ApplePhone />
        </div>
      </div>
    </section>
  );
}
