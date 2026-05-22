import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getAllPostSlugs,
  getPostBySlug,
  getRelatedPosts,
} from '@/data/blog/posts';
import PostMeta from '@/components/blog/PostMeta';
import ReadingExperience from '@/components/blog/ReadingExperience';
import ShareBar from '@/components/blog/ShareBar';
import RelatedPosts from '@/components/blog/RelatedPosts';
import FloatingByline from '@/components/blog/FloatingByline';
import styles from './page.module.css';

/**
 * /blog/[slug] — detalhe do post.
 *
 * Server component que faz lookup pelo slug, renderiza o hero
 * (categoria + título + subtítulo + meta + cover), o corpo
 * com tipografia de leitura, share bar fixa e bloco de
 * relacionados. Pre-renderiza estaticamente (generateStaticParams)
 * — vira ISR quando o backend cair.
 */

interface Props {
  params: Promise<{ slug: string }>;
}

/** Pre-render de todos os slugs no build — bundle SSG. */
export async function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

/** Metadata por post — title + description + OG. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: 'Post não encontrado — Fanverse Blog' };

  const title = post.seo.metaTitle ?? `${post.title} — Fanverse Blog`;
  const description = post.seo.metaDescription ?? post.excerpt ?? post.title;
  const ogImage = post.seo.ogImageUrl ?? post.coverImageUrl ?? undefined;

  return {
    title,
    description,
    keywords: post.seo.focusKeywords,
    alternates: post.seo.canonicalUrl
      ? { canonical: post.seo.canonicalUrl }
      : undefined,
    openGraph: {
      title,
      description,
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [post.authorName],
      images: ogImage ? [{ url: ogImage }] : undefined,
      siteName: 'Fanverse',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const related = getRelatedPosts(post.id, 3);

  return (
    <article className={styles.page}>
      {/* ── Hero ────────────────────────────── */}
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <Link
            href={`/blog/categoria/${post.categorySlug}`}
            className={styles.category}
          >
            {post.categoryName}
          </Link>
          <h1 className={styles.title}>{post.title}</h1>
          {post.subtitle && (
            <p className={styles.subtitle}>{post.subtitle}</p>
          )}
          <div className={styles.byline}>
            <PostMeta
              authorName={post.authorName}
              authorAvatarUrl={post.authorAvatarUrl}
              authorSlug={post.authorSlug}
              publishedAt={post.publishedAt}
              readingTimeMinutes={post.readingTimeMinutes}
              size="md"
            />
            <div className={styles.shareSlot}>
              <ShareBar title={post.title} />
            </div>
          </div>
        </div>
      </header>

      {/* ── Cover ───────────────────────────── */}
      {post.coverImageUrl && (
        <figure className={styles.cover}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverImageUrl}
            alt={post.coverImageAlt ?? ''}
            className={styles.coverImg}
          />
          {post.coverImageAlt && (
            <figcaption className={styles.coverCaption}>
              {post.coverImageAlt}
            </figcaption>
          )}
        </figure>
      )}

      {/* ── Corpo + rail flutuante ─────────────
       *  Grid de 3 colunas: empty | prose 680px | empty. Em
       *  viewports >=1100px o left gutter renderiza o
       *  FloatingByline (sticky, com reading progress); em
       *  telas mais estreitas o CSS esconde os gutters e a
       *  prose ocupa a coluna sozinha.
       *
       *  data-prose-body é a âncora que o FloatingByline usa
       *  pra calcular o progresso de leitura. */}
      <div className={styles.bodyWrap}>
        <aside className={styles.railSlot} aria-label="Sobre o autor e compartilhar">
          <FloatingByline
            authorName={post.authorName}
            authorAvatarUrl={post.authorAvatarUrl}
            authorSlug={post.authorSlug}
            title={post.title}
          />
        </aside>
        <div data-prose-body className={styles.proseSlot}>
          {/* ReadingExperience embrulha PostBody, expõe A-/A+
           *  controls (persistidos em localStorage) e renderiza
           *  o top progress bar fixed que cresce conforme o
           *  leitor desce o scroll. */}
          <ReadingExperience html={post.bodyHtml} />
        </div>
        <div className={styles.railRightSpace} aria-hidden="true" />
      </div>

      {/* ── Tags ────────────────────────────── */}
      {post.tags.length > 0 && (
        <div className={styles.tagsRow}>
          {post.tags.map((t) => (
            <Link
              key={t.id}
              href={`/blog/tag/${t.slug}`}
              className={styles.tag}
            >
              {t.name}
            </Link>
          ))}
        </div>
      )}

      {/* ── Author footer (bio expandida) ───── */}
      <aside className={styles.authorCard}>
        <PostMeta
          authorName={post.authorName}
          authorAvatarUrl={post.authorAvatarUrl}
          authorSlug={post.authorSlug}
          publishedAt={post.publishedAt}
          readingTimeMinutes={post.readingTimeMinutes}
          size="lg"
          authorBio={post.authorBio}
        />
      </aside>

      {/* ── Share repetido no fim ────────────── */}
      <div className={styles.shareBottom}>
        <ShareBar title={post.title} />
      </div>

      {/* ── Relacionados ─────────────────────── */}
      <RelatedPosts posts={related} />
    </article>
  );
}
