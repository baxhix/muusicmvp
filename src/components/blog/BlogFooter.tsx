import Link from 'next/link';
import styles from './BlogFooter.module.css';

/**
 * Footer do /teste.
 *
 * Estrutura per wireframe + product feedback:
 *   - 3 colunas de links (Company / Superfãs / Para Artistas)
 *     na esquerda, alinhadas ao topo.
 *   - Endereço de email "hello@fanverse.com.br" enorme à
 *     direita.
 *   - 150px de gap (CSS) entre as colunas e a palavra
 *     gigante "FANVERSE".
 *   - "FANVERSE" gigante via SVG com `textLength` +
 *     `lengthAdjust="spacingAndGlyphs"` — assim o texto
 *     escala pra ocupar 100% do container (max 1200px),
 *     independente da fonte aplicada. Aceita Peace Sans
 *     quando o .woff2 for adicionado em /fonts/, ou Inter
 *     900 como fallback.
 *
 * Política removida per product feedback ("Remova Políticas de
 * Privacidade e Termos de uso").
 */
export default function BlogFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        {/* Linha das colunas de links. O email "hello@fanverse"
         *  foi removido per product feedback — agora só as 3
         *  cols ocupam o topo do footer. */}
        <div className={styles.linksGrid}>
          <div className={styles.col}>
            <h4 className={styles.colTitle}>Company</h4>
            <a href="#sobre"    className={styles.link}>Sobre</a>
            <Link href="/blog"  className={styles.link}>Blog</Link>
            <a href="#imprensa" className={styles.link}>Imprensa</a>
          </div>
          <div className={styles.col}>
            <h4 className={styles.colTitle}>Superfãs</h4>
            <a href="#sf-1"    className={styles.link}>Manifesto</a>
            <a href="#sf-2"    className={styles.link}>Manifesto</a>
            <a href="#sf-3"    className={styles.link}>Manifesto</a>
            <a href="#sf-time" className={styles.link}>Time</a>
          </div>
          <div className={styles.col}>
            <h4 className={styles.colTitle}>Para Artistas</h4>
            <a href="#pa-1"    className={styles.link}>Manifesto</a>
            <a href="#pa-2"    className={styles.link}>Manifesto</a>
            <a href="#pa-3"    className={styles.link}>Manifesto</a>
            <a href="#pa-time" className={styles.link}>Time</a>
          </div>
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
