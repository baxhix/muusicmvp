import Link from 'next/link';
import type { BlogPostListItem } from '@/types/blog';
import PostMeta from './PostMeta';
import styles from './FeaturedPost.module.css';

/**
 * FeaturedPost — bloco hero da home do blog.
 *
 * Layout horizontal em viewport larga: cover à esquerda, texto
 * à direita. Em mobile colapsa pra coluna vertical — cover em
 * cima, texto embaixo. Hover na cover: leve scale + brightness.
 */
export default function FeaturedPost({ post }: { post: BlogPostListItem }) {
  return (
    <article className={styles.featured}>
      <Link
        href={`/blog/${post.slug}`}
        className={styles.coverLink}
        aria-label={`Ler: ${post.title}`}
      >
        {post.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImageUrl}
            alt={post.coverImageAlt ?? ''}
            className={styles.coverImg}
          />
        ) : (
          <div className={styles.coverFallback} />
        )}
      </Link>

      <div className={styles.body}>
        <Link
          href={`/blog/categoria/${post.categorySlug}`}
          className={styles.category}
        >
          {post.categoryName}
        </Link>

        <h1 className={styles.title}>
          <Link href={`/blog/${post.slug}`} className={styles.titleLink}>
            {post.title}
          </Link>
        </h1>

        {post.subtitle && (
          <p className={styles.subtitle}>{post.subtitle}</p>
        )}

        <PostMeta
          authorName={post.authorName}
          authorAvatarUrl={post.authorAvatarUrl}
          authorSlug={post.authorSlug}
          publishedAt={post.publishedAt}
          readingTimeMinutes={post.readingTimeMinutes}
          size="md"
        />
      </div>
    </article>
  );
}
