import type { Metadata } from 'next';
import { getAllPosts } from '@/data/blog/posts';
import PostCard from '@/components/blog/PostCard';
import styles from './page.module.css';

/**
 * /blog/posts — Lista completa de todos os posts publicados.
 *
 * Diferente da home: SEM featured tratamento, todos os posts
 * em grade uniforme. Server component, fácil de evoluir pra
 * paginação com searchParams quando o catálogo crescer.
 */

export const metadata: Metadata = {
  title: 'Todos os posts — Fanverse Blog',
  description:
    'Lista completa dos posts do blog Fanverse: bastidores, lançamentos, cultura e comunidade.',
};

export default function BlogPostsListPage() {
  const posts = getAllPosts();

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <span className={styles.eyebrow}>Catálogo</span>
        <h1 className={styles.heading}>Todos os posts</h1>
        <p className={styles.tag}>
          {posts.length} {posts.length === 1 ? 'post publicado' : 'posts publicados'}
          {' '}— do mais recente ao mais antigo.
        </p>
      </header>

      <section className={styles.grid}>
        {posts.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </section>
    </div>
  );
}
