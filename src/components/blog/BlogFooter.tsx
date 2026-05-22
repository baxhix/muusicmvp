import Link from 'next/link';
import styles from './BlogFooter.module.css';

export default function BlogFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div>
          <div className={styles.brand}>Fanverse Blog</div>
          <p className={styles.tag}>
            Histórias do universo dos superfãs — bastidores, lançamentos,
            cultura e comunidade.
          </p>
        </div>
        <nav className={styles.nav} aria-label="Rodapé">
          <Link href="/blog" className={styles.link}>Home</Link>
          <Link href="/blog/posts" className={styles.link}>Todos os posts</Link>
          <Link href="/" className={styles.link}>App Fanverse</Link>
        </nav>
        <div className={styles.copy}>
          © {year} Fanverse · Feito com muita música
        </div>
      </div>
    </footer>
  );
}
