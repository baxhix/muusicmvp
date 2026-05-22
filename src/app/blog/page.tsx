import Link from 'next/link';
import { getFeaturedPost, getRecentPosts } from '@/data/blog/posts';
import FeaturedPost from '@/components/blog/FeaturedPost';
import PostCard from '@/components/blog/PostCard';
import styles from './page.module.css';

/**
 * /blog — Home do blog.
 *
 * Estrutura: featured post no topo + grade de 6 posts recentes.
 * CTA "Ver todos" leva pra /blog/posts (lista completa).
 *
 * Server component — pure data + JSX, sem state. Dará pra
 * promover a `revalidate = N` (ISR) quando o backend cair.
 */
export default function BlogHomePage() {
  const featured = getFeaturedPost();
  const recents = getRecentPosts(6);

  return (
    <div className={styles.page}>
      {/* ── Featured ────────────────────────────── */}
      {featured && (
        <section className={styles.featuredSection} aria-label="Post em destaque">
          <FeaturedPost post={featured} />
        </section>
      )}

      {/* ── Recentes ────────────────────────────── */}
      <section className={styles.recentSection} aria-labelledby="recents-heading">
        <div className={styles.recentHead}>
          <h2 id="recents-heading" className={styles.sectionHeading}>
            Últimos posts
          </h2>
          <Link href="/blog/posts" className={styles.seeAll}>
            Ver todos →
          </Link>
        </div>
        <div className={styles.grid}>
          {recents.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
