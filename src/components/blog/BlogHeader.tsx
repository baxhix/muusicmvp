import Link from 'next/link';
import styles from './BlogHeader.module.css';

/**
 * Header do blog público.
 *
 * Minimal, à la Medium — brand à esquerda, nav simples à
 * direita. Sticky com bg semi-transparente + backdrop-filter
 * pra dar leitura sobre conteúdo longo sem perder contexto de
 * onde o usuário está.
 */
export default function BlogHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/blog" className={styles.brand} aria-label="Fanverse Blog">
          <span className={styles.brandWord}>Fanverse</span>
          <span className={styles.brandTag}>Blog</span>
        </Link>
        <nav className={styles.nav} aria-label="Blog">
          <Link href="/blog" className={styles.navLink}>
            Home
          </Link>
          <Link href="/blog/posts" className={styles.navLink}>
            Todos os posts
          </Link>
          <Link href="/" className={styles.navLinkAccent}>
            ← Voltar ao app
          </Link>
        </nav>
      </div>
    </header>
  );
}
