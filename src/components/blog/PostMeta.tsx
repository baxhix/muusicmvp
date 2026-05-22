import Link from 'next/link';
import styles from './PostMeta.module.css';

/**
 * PostMeta — autor (avatar + nome) + data + tempo de leitura.
 *
 * Mesma forma do meta-cluster do Medium. Avatar circular pequeno,
 * texto ao lado, separadores discretos por bullet (•).
 */

export interface PostMetaProps {
  authorName: string;
  authorAvatarUrl?: string | null;
  authorSlug: string;
  publishedAt: string;
  readingTimeMinutes: number;
  /** sm = listing/card; md = featured/detail hero; lg = byline
   *  expandida na página do post (com bio). */
  size?: 'sm' | 'md' | 'lg';
  /** Quando true, mostra a bio do autor (só lg). */
  authorBio?: string | null;
}

function formatPostDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year:
      d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function PostMeta({
  authorName,
  authorAvatarUrl,
  authorSlug,
  publishedAt,
  readingTimeMinutes,
  size = 'sm',
  authorBio,
}: PostMetaProps) {
  const avatarSize = size === 'sm' ? 26 : size === 'md' ? 36 : 44;
  return (
    <div
      className={[
        styles.meta,
        size === 'sm' && styles.metaSm,
        size === 'md' && styles.metaMd,
        size === 'lg' && styles.metaLg,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Link
        href={`/blog/autor/${authorSlug}`}
        className={styles.authorLink}
        aria-label={`Ver perfil de ${authorName}`}
      >
        <span
          className={styles.avatar}
          style={{ width: avatarSize, height: avatarSize }}
        >
          {authorAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={authorAvatarUrl}
              alt={authorName}
              className={styles.avatarImg}
            />
          ) : (
            <span className={styles.avatarInitials}>
              {getInitials(authorName)}
            </span>
          )}
        </span>
        <span className={styles.authorBody}>
          <span className={styles.authorName}>{authorName}</span>
          {size === 'lg' && authorBio && (
            <span className={styles.authorBio}>{authorBio}</span>
          )}
          <span className={styles.row}>
            <time className={styles.date} dateTime={publishedAt}>
              {formatPostDate(publishedAt)}
            </time>
            <span className={styles.sep} aria-hidden="true">·</span>
            <span className={styles.reading}>
              {readingTimeMinutes} min de leitura
            </span>
          </span>
        </span>
      </Link>
    </div>
  );
}
