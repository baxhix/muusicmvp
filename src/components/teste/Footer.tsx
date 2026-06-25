import Link from 'next/link';
import styles from './Footer.module.css';

/**
 * Footer do /teste.
 *
 * Estrutura:
 *   - 4 colunas de links (Empresa / Superfãs / Para Artistas /
 *     Conta) alinhadas à esquerda, no topo.
 *   - Barra legal abaixo: copyright + Termos de uso + Política
 *     de Privacidade.
 *   - "FANVERSE" gigante via SVG (só no desktop — escondido no
 *     mobile) que escala pra ocupar 90vw, colado na base.
 */
export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        {/* 4 colunas de links — alinhadas à esquerda. */}
        <div className={styles.linksGrid}>
          <div className={styles.col}>
            <h4 className={styles.colTitle}>Empresa</h4>
            <a href="#sobre"    className={styles.link}>Sobre</a>
            <Link href="/blog"  className={styles.link}>Blog</Link>
            <a href="#imprensa" className={styles.link}>Imprensa</a>
            <a href="#time"     className={styles.link}>Time</a>
          </div>
          <div className={styles.col}>
            <h4 className={styles.colTitle}>Superfãs</h4>
            <a href="#manifesto"   className={styles.link}>Manifesto</a>
            <a href="#comunidades" className={styles.link}>Comunidades</a>
            <a href="#fanpoints"   className={styles.link}>Fanpoints</a>
            <a href="#fire-arena"  className={styles.link}>Fire Arena</a>
          </div>
          <div className={styles.col}>
            <h4 className={styles.colTitle}>Para Artistas</h4>
            <Link href="/para-artistas" className={styles.link}>Para Artistas</Link>
            <a href="#pre-save"   className={styles.link}>Pre-save</a>
            <a href="#solucoes"   className={styles.link}>Soluções</a>
            <a href="#cases"      className={styles.link}>Cases</a>
          </div>
          <div className={styles.col}>
            <h4 className={styles.colTitle}>Conta</h4>
            <Link href="/auth" className={styles.link}>Entrar</Link>
            <Link href="/auth" className={styles.link}>Criar conta</Link>
            <a href="mailto:suporte@fanverse.com.br" className={styles.link}>Suporte</a>
            <a href="#status"   className={styles.link}>Status</a>
          </div>
        </div>

        {/* Barra legal — copyright + links de Termos / Privacidade. */}
        <div className={styles.legalBar}>
          <span className={styles.copyright}>
            © 2026 Fanverse. Todos os direitos reservados.
          </span>
          <nav className={styles.legalLinks} aria-label="Links legais">
            <Link href="/termos" className={styles.legalLink}>Termos de uso</Link>
            <Link href="/privacidade" className={styles.legalLink}>
              Política de Privacidade
            </Link>
          </nav>
        </div>
      </div>

      {/* Wordmark fora do `.inner` pra que possa ocupar 90% da
       *  VIEWPORT (não do container 1200px). Posicionado por
       *  margin-top (gap 80px) e fica colado na EXTREMIDADE
       *  FINAL DA PÁGINA — viewBox tighter (0 0 1200 200) +
       *  text y=200 garante que o BOTTOM dos glifos coincida
       *  com a borda inferior do SVG (e da página). */}
      <div className={styles.wordmarkWrap}>
        <svg
          className={styles.wordmark}
          viewBox="0 0 1200 200"
          preserveAspectRatio="xMidYEnd meet"
          aria-hidden="true"
        >
          <text
            x="0"
            y="200"
            textLength="1200"
            lengthAdjust="spacingAndGlyphs"
            className={styles.wordmarkText}
          >
            FANVERSE
          </text>
        </svg>
      </div>
    </footer>
  );
}
