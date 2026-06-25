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
      {/* Scrim full-width atrás dos CTAs fixos (mobile). Fica FORA do
       *  `.heroMobileCtas` porque aquele container tem transform (animação
       *  de entrada) — e transform vira containing block do position:fixed,
       *  limitando o scrim à largura do container (gerava o "corte"). Como
       *  filho direto do `.hero` (sem transform) o fixed cobre 100vw. */}
      <div className={styles.heroMobileScrim} aria-hidden="true" />
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
          {/* Ícone mic-vocal (lucide) — escala com a fonte via 1em. */}
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
            <path d="m11 7.601-5.994 8.19a1 1 0 0 0 .1 1.298l.817.818a1 1 0 0 0 1.314.087L15.09 12" />
            <path d="M16.5 21.174C15.5 20.5 14.372 20 13 20c-2.058 0-3.928 2.356-6 2-2.072-.356-2.775-3.369-1.5-4.5" />
            <circle cx="16" cy="7" r="5" />
          </svg>
          Sou artista
        </a>
        <a
          href="/auth"
          className={`${styles.heroMobileCta} ${styles.heroMobileCtaPrimary}`}
        >
          {/* Ícone log-in (lucide.dev/icons/log-in) inline. */}
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
      </div>
    </section>
  );
}
