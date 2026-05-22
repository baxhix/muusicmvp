import Link from 'next/link';
import type { BlogPostListItem } from '@/types/blog';
import PostMeta from './PostMeta';
import styles from './PostCard.module.css';

/**
 * PostCard — card padrão usado em grids (home + lista).
 *
 * Layout: cover 16/9 em cima, depois category badge, título,
 * excerpt e meta (autor + data + tempo de leitura). Hover
 * gentle: cover dá leve scale + title fica branco-puro. Sem
 * sombras pesadas — leitura é o foco.
 */

export interface PostCardProps {
  post: BlogPostListItem;
  /** Quando true, layout fica horizontal (lateral) — usado em
   *  related posts em viewports estreitos. Default false. */
  compact?: boolean;
}

export default function PostCard({ post, compact = false }: PostCardProps) {
  return (
    <article className={`${styles.card} ${compact ? styles.cardCompact : ''}`}>
      <Link href={`/blog/${post.slug}`} className={styles.coverLink}>
        <div className={styles.cover}>
          {post.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.coverImageUrl}
              alt={post.coverImageAlt ?? ''}
              className={styles.coverImg}
              loading="lazy"
            />
          ) : (
            <div className={styles.coverFallback} />
          )}
        </div>
      </Link>

      <div className={styles.body}>
        <Link
          href={`/blog/categoria/${post.categorySlug}`}
          className={styles.category}
        >
          {post.categoryName}
        </Link>

        <h3 className={styles.title}>
          <Link href={`/blog/${post.slug}`} className={styles.titleLink}>
            {post.title}
          </Link>
        </h3>

        {post.excerpt && (
          <p className={styles.excerpt}>{post.excerpt}</p>
        )}

        <PostMeta
          authorName={post.authorName}
          authorAvatarUrl={post.authorAvatarUrl}
          authorSlug={post.authorSlug}
          publishedAt={post.publishedAt}
          readingTimeMinutes={post.readingTimeMinutes}
          size="sm"
        />
      </div>
    </article>
  );
}
