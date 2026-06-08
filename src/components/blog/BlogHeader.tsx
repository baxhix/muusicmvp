'use client';

import { useEffect, useRef, useState } from 'react';
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
  // Busca colapsada por padrão: o header mostra só o ícone. Ao
  // clicar, `searchOpen` vira true e o campo (pill) abre — a
  // mesma forma de antes. Fecha de volta no blur se estiver vazio.
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Foca o input assim que o campo abre, pra o usuário já digitar.
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/blog/posts?q=${encodeURIComponent(q)}` : '/blog/posts');
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/blog" className={styles.brand} aria-label="Fanverse Blog">
          {/* Wordmark "FANVERSE" branco — mesmo asset usado no
           *  /teste navbar pra manter consistência de marca.
           *  Altura 20px proporcional ao padding vertical 14px do
           *  header. width: auto preserva o aspect ratio. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/teste/fanverse-logo.svg"
            alt="Fanverse"
            className={styles.brandLogo}
          />
          <span className={styles.brandTag}>Blog</span>
        </Link>

        <div className={styles.cluster}>
          {/* Busca: por padrão só o ícone. Ao clicar, o campo
           *  (pill) abre — a mesma forma de antes. */}
          {searchOpen ? (
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
                ref={inputRef}
                type="search"
                className={styles.searchInput}
                placeholder="Buscar posts…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onBlur={() => {
                  if (!query.trim()) setSearchOpen(false);
                }}
                aria-label="Buscar posts"
              />
            </form>
          ) : (
            <button
              type="button"
              className={styles.searchToggle}
              onClick={() => setSearchOpen(true)}
              aria-label="Buscar no blog"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </button>
          )}

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
