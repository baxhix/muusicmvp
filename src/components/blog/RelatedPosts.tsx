import type { BlogPostListItem } from '@/types/blog';
import PostCard from './PostCard';
import styles from './RelatedPosts.module.css';

/**
 * RelatedPosts — bloco que fecha a página de detalhe.
 * Grid de 3 PostCards (mesma categoria primeiro, fallback pra
 * mais recentes). Em mobile colapsa pra 1 coluna.
 */
export default function RelatedPosts({
  posts,
}: {
  posts: BlogPostListItem[];
}) {
  if (posts.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="related-heading">
      <h2 id="related-heading" className={styles.heading}>
        Continue lendo
      </h2>
      <div className={styles.grid}>
        {posts.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </div>
    </section>
  );
}
