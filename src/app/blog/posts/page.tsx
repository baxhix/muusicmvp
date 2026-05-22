'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAllPosts } from '@/data/blog/posts';
import PostCard from '@/components/blog/PostCard';
import styles from './page.module.css';

/**
 * /blog/posts — Lista completa, com busca client-side.
 *
 * Aceita `?q=` na URL pra deep-link de busca (vinda do header
 * do blog ou de links externos). O input é controlado e
 * sincroniza com o query param via router.replace pra que F5
 * preserve a busca + URL fique compartilhável.
 *
 * Filtro: title + subtitle + excerpt + autor + categoria.
 */
export default function BlogPostsListPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initial = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(initial);
  const allPosts = useMemo(() => getAllPosts(), []);

  // Sync state ↔ URL. Replace (não push) pra não poluir
  // histórico de navegação com cada keystroke.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = setTimeout(() => {
      const sp = new URLSearchParams(window.location.search);
      const q = query.trim();
      if (q) sp.set('q', q);
      else sp.delete('q');
      const qs = sp.toString();
      router.replace(qs ? `/blog/posts?${qs}` : '/blog/posts', { scroll: false });
    }, 200);
    return () => clearTimeout(t);
  }, [query, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allPosts;
    return allPosts.filter((p) => {
      const hay = [
        p.title,
        p.subtitle ?? '',
        p.excerpt ?? '',
        p.authorName,
        p.categoryName,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [query, allPosts]);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.heading}>Todos os posts</h1>
        <p className={styles.tag}>
          {allPosts.length}{' '}
          {allPosts.length === 1 ? 'post publicado' : 'posts publicados'}
          {' '}— do mais recente ao mais antigo.
        </p>

        {/* Search field — visível, prominente. Sincroniza com
         *  ?q= e filtra client-side. */}
        <form
          className={styles.searchForm}
          role="search"
          onSubmit={(e) => e.preventDefault()}
          aria-label="Buscar nos posts"
        >
          <span className={styles.searchIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Buscar por título, autor ou categoria…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus={initial.length > 0}
            aria-label="Buscar posts"
          />
          {query && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => setQuery('')}
              aria-label="Limpar busca"
              title="Limpar"
            >
              ×
            </button>
          )}
        </form>

        {query.trim() && (
          <p className={styles.searchResult}>
            {filtered.length}{' '}
            {filtered.length === 1 ? 'resultado para' : 'resultados para'}{' '}
            <em>“{query.trim()}”</em>
          </p>
        )}
      </header>

      {filtered.length > 0 ? (
        <section className={styles.grid}>
          {filtered.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </section>
      ) : (
        <div className={styles.empty}>
          <p>Nenhum post encontrado para <em>“{query.trim()}”</em>.</p>
          <button
            type="button"
            className={styles.emptyAction}
            onClick={() => setQuery('')}
          >
            Limpar busca
          </button>
        </div>
      )}
    </div>
  );
}
