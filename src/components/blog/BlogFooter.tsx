import Link from 'next/link';
import styles from './BlogFooter.module.css';

/**
 * BlogFooter — mesmo footer do /teste, replicado pra que o
 * blog público use a mesma identidade visual (3 cols de links
 * + email destaque + policies + wordmark gigante atrás).
 *
 * Mantemos o componente em arquivo próprio (em vez de
 * cross-importar de /teste) pra que as duas árvores fiquem
 * desacopladas. Se um dia o footer divergir entre landing e
 * blog é só editar um lado.
 */
export default function BlogFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        {/* Top row: colunas de links + email destaque */}
        <div className={styles.topRow}>
          <div className={styles.linksGrid}>
            <div className={styles.col}>
              <h4 className={styles.colTitle}>Company</h4>
              <a href="#sobre"    className={styles.link}>Sobre</a>
              <Link href="/blog"  className={styles.link}>Blog</Link>
              <a href="#imprensa" className={styles.link}>Imprensa</a>
            </div>
            <div className={styles.col}>
              <h4 className={styles.colTitle}>Superfãs</h4>
              <a href="#sf-1"   className={styles.link}>Manifesto</a>
              <a href="#sf-2"   className={styles.link}>Manifesto</a>
              <a href="#sf-3"   className={styles.link}>Manifesto</a>
              <a href="#sf-time" className={styles.link}>Time</a>
            </div>
            <div className={styles.col}>
              <h4 className={styles.colTitle}>Para Artistas</h4>
              <a href="#pa-1"   className={styles.link}>Manifesto</a>
              <a href="#pa-2"   className={styles.link}>Manifesto</a>
              <a href="#pa-3"   className={styles.link}>Manifesto</a>
              <a href="#pa-time" className={styles.link}>Time</a>
            </div>
          </div>

          <a
            href="mailto:hello@fanverse.com.br"
            className={styles.email}
            aria-label="Enviar email para hello@fanverse.com.br"
          >
            hello@fanverse.com.br
          </a>
        </div>

        {/* Policy row centralizada */}
        <div className={styles.policyRow}>
          <a href="#privacidade" className={styles.policyLink}>
            Políticas de Privacidade
          </a>
          <a href="#termos" className={styles.policyLink}>
            Termos de uso
          </a>
        </div>
      </div>

      {/* Wordmark gigante atrás de tudo. aria-hidden — é só
       *  decoração visual. */}
      <div className={styles.bgWordmark} aria-hidden="true">
        FANVERSE
      </div>
    </footer>
  );
}
