'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './BlogHeader.module.css';

/**
 * Header do blog público.
 *
 * Minimal, Medium-style. Brand à esquerda + cluster (busca +
 * nav) à direita. Sticky com bg semi-transparente + backdrop
 * pra leitura sobre conteúdo longo.
 *
 * Search: form que ao submit (Enter ou click no ícone) leva
 * pra `/blog/posts?q=<query>` — a página de lista absorve o
 * param e filtra client-side.
 */
export default function BlogHeader() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/blog/posts?q=${encodeURIComponent(q)}` : '/blog/posts');
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/blog" className={styles.brand} aria-label="Fanverse Blog">
          <span className={styles.brandWord}>Fanverse</span>
          <span className={styles.brandTag}>Blog</span>
        </Link>

        <div className={styles.cluster}>
          <form
            className={styles.searchForm}
            onSubmit={onSubmit}
            role="search"
            aria-label="Buscar no blog"
          >
            <span className={styles.searchIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Buscar posts…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar posts"
            />
          </form>

          <nav className={styles.nav} aria-label="Blog">
            <Link href="/blog" className={styles.navLink}>
              Home
            </Link>
            <Link href="/blog/posts" className={styles.navLink}>
              Posts
            </Link>
            <Link href="/" className={styles.navLinkAccent}>
              ← App
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
