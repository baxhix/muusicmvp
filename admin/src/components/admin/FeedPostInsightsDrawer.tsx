'use client';

import { useEffect, useMemo, useState } from 'react';
import Drawer from '@/components/ui/Drawer';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import {
  IconHeart,
  IconMessage,
  IconEye,
  IconTrendingUp,
  IconTrash,
  IconEyeOff,
  IconFlag,
  IconCheckCircle,
} from '@/components/icons';
import type { FeedItem } from '@/types';
import { formatRelative } from '@/lib/format';
import styles from './FeedPostInsightsDrawer.module.css';

/**
 * Drawer that surfaces engagement insights for a single feed
 * post. Two halves per product feedback "Inclua um ícone na
 * lista de análise de dados para mostrar os dados envolvendo
 * o engajamento daquele post como likes, comentários,
 * impressões (esse pode ser mocado). Não só quantitativo, mas
 * qualitativo também. Pois o moderador poderá gerir os
 * comentários através dessa tela.":
 *
 *   - **Quantitative** — top-row stat cards (likes, comments,
 *     impressions, reach, engagement rate). Likes + comment
 *     counts come from the FeedItem (real DB-backed values
 *     when the backend supplies them); impressions / reach /
 *     engagement rate are deterministically derived from the
 *     post id so the numbers stay stable across reloads
 *     without needing a real analytics endpoint yet.
 *
 *   - **Qualitative** — moderator-facing comment list with
 *     inline actions (hide, delete, flag). Comments are mock
 *     today, seeded by the same id-hash so each post owns a
 *     predictable sample set. When the real
 *     `/api/admin/feed/:id/comments` endpoint lands, swap the
 *     `buildMockComments()` call for the fetch — JSX is
 *     agnostic.
 */

export interface FeedPostInsightsDrawerProps {
  post: FeedItem | null;
  open: boolean;
  onClose: () => void;
}

interface MockComment {
  id: string;
  authorName: string;
  authorAvatar?: string | null;
  createdAt: string;
  body: string;
  /** Local-only flags so the moderator can toggle visibility /
   *  mark a comment as deleted without an actual backend call. */
  hidden?: boolean;
  deleted?: boolean;
  flagged?: boolean;
}

/* Deterministic 32-bit FNV-1a hash — same shape FloatingUsers
 * uses, copied locally so the admin doesn't pull from the
 * main app's util tree. */
function stableHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Pseudo-random number in [0,1) seeded from the post id +
 *  a salt so different metric fields don't collide. */
function seededFloat(seed: string, salt: string): number {
  return ((stableHash(seed + salt) % 100000) / 100000);
}

const MOCK_AUTHORS = [
  'Camila Ribeiro',
  'Daniel Costa',
  'Patrícia Almeida',
  'Luan Ferreira',
  'Mariana Lopes',
  'Rafael Souza',
  'Beatriz Ramos',
  'João Pedro',
];

const MOCK_BODIES = [
  'Top demais isso aqui! Já compartilhei com a galera.',
  'Boa! Curti o ângulo da segunda foto, parece show de cinema.',
  'Esperando ansiosa pelo próximo show 🤠',
  'A energia dela é única, sempre arrepia.',
  'Achei a edição um pouco apressada, mas o conteúdo compensa.',
  'Spam: clique aqui pra ganhar XYZ',
  'Avisem a próxima cidade da turnê pls!',
  'Que produção linda, parabéns ao time todo.',
];

/** Build a stable, deterministic batch of mock comments tied
 *  to this post's id. Same id → same comments across reloads,
 *  so the moderator's "this post is noisy" judgment doesn't
 *  shift between refreshes. */
function buildMockComments(postId: string): MockComment[] {
  const count = 4 + Math.floor(seededFloat(postId, 'count') * 5); // 4-8
  const out: MockComment[] = [];
  for (let i = 0; i < count; i++) {
    const seed = `${postId}-${i}`;
    const author = MOCK_AUTHORS[Math.floor(seededFloat(seed, 'a') * MOCK_AUTHORS.length)];
    const body = MOCK_BODIES[Math.floor(seededFloat(seed, 'b') * MOCK_BODIES.length)];
    const hoursAgo = 1 + Math.floor(seededFloat(seed, 'h') * 48);
    const createdAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
    out.push({
      id: seed,
      authorName: author,
      createdAt,
      body,
      // Flag the 6th body (spam-style) regardless of where it
      // lands so moderators always have an obvious target row.
      flagged: body.startsWith('Spam'),
    });
  }
  return out;
}

/** Format a big number with thousands separator. Brazilian
 *  Portuguese uses dots — same convention the rest of the
 *  admin uses for `toLocaleString('pt-BR')`. */
function fmt(n: number): string {
  return n.toLocaleString('pt-BR');
}

export default function FeedPostInsightsDrawer({
  post,
  open,
  onClose,
}: FeedPostInsightsDrawerProps) {
  // Local-only moderation state. The drawer mutates this set
  // on hide/delete clicks so the moderator sees the row
  // change immediately — when the real moderation endpoint
  // ships, replace the local setters with a service call +
  // optimistic update.
  const [comments, setComments] = useState<MockComment[]>([]);
  // Reset the comment list whenever a new post is opened so
  // moderating post A doesn't carry stale state into post B.
  // useEffect (não useMemo) porque é um side-effect (setState),
  // não uma computação — useMemo aqui era um anti-pattern.
  useEffect(() => {
    setComments(post ? buildMockComments(post.id) : []);
  }, [post]);

  // Quantitative — real fields from the FeedItem when present,
  // mock numbers otherwise.
  const stats = useMemo(() => {
    if (!post) return null;
    const likes = (post as unknown as { likes?: number }).likes ?? 0;
    const realLikes = likes > 0 ? likes : Math.floor(120 + seededFloat(post.id, 'likes') * 4800);
    const realComments = post.commentCount ?? Math.floor(8 + seededFloat(post.id, 'comments') * 220);
    const impressions = Math.floor(1500 + seededFloat(post.id, 'imp') * 42000);
    const reach = Math.floor(impressions * (0.55 + seededFloat(post.id, 'reach') * 0.35));
    const engagement = realLikes + realComments;
    const rate = impressions > 0 ? (engagement / impressions) * 100 : 0;
    return {
      likes: realLikes,
      comments: realComments,
      impressions,
      reach,
      ratePct: rate,
    };
  }, [post]);

  const updateComment = (id: string, patch: Partial<MockComment>) => {
    setComments((curr) => curr.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  if (!post || !stats) return null;

  const visibleCount = comments.filter((c) => !c.deleted).length;
  const hiddenCount = comments.filter((c) => c.hidden && !c.deleted).length;
  const flaggedCount = comments.filter((c) => c.flagged && !c.deleted).length;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Insights do post"
      description={
        post.description
          ? post.description.slice(0, 90) +
            (post.description.length > 90 ? '…' : '')
          : `${post.type ?? 'post'} · ${formatRelative(post.publishedAt ?? post.createdAt)}`
      }
      size="lg"
    >
      <div className={styles.body}>
        {/* ── Quantitative ─────────────────────────────────── */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Engajamento</h3>
          <div className={styles.statGrid}>
            <div className={styles.statCard}>
              <span className={styles.statIcon}>
                <IconHeart size={16} />
              </span>
              <span className={styles.statValue}>{fmt(stats.likes)}</span>
              <span className={styles.statLabel}>Likes</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statIcon}>
                <IconMessage size={16} />
              </span>
              <span className={styles.statValue}>{fmt(stats.comments)}</span>
              <span className={styles.statLabel}>Comentários</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statIcon}>
                <IconEye size={16} />
              </span>
              <span className={styles.statValue}>{fmt(stats.impressions)}</span>
              <span className={styles.statLabel}>Impressões</span>
              <span className={styles.statHint}>mock</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statIcon}>
                <IconEye size={16} />
              </span>
              <span className={styles.statValue}>{fmt(stats.reach)}</span>
              <span className={styles.statLabel}>Alcance</span>
              <span className={styles.statHint}>mock</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statIcon}>
                <IconTrendingUp size={16} />
              </span>
              <span className={styles.statValue}>
                {stats.ratePct.toFixed(1)}%
              </span>
              <span className={styles.statLabel}>Taxa de engajamento</span>
            </div>
          </div>
        </section>

        {/* ── Qualitative — comments + moderator actions ─── */}
        <section className={styles.section}>
          <div className={styles.commentsHeader}>
            <h3 className={styles.sectionTitle}>Comentários</h3>
            <div className={styles.commentsSummary}>
              <span className={styles.summaryPill}>{visibleCount} visíveis</span>
              {hiddenCount > 0 && (
                <span className={styles.summaryPillMute}>
                  {hiddenCount} ocultos
                </span>
              )}
              {flaggedCount > 0 && (
                <span className={styles.summaryPillWarn}>
                  {flaggedCount} marcados
                </span>
              )}
            </div>
          </div>

          {comments.length === 0 ? (
            <p className={styles.emptyState}>
              Sem comentários ainda neste post.
            </p>
          ) : (
            <ul className={styles.commentList}>
              {comments.map((c) => (
                <li
                  key={c.id}
                  className={[
                    styles.commentRow,
                    c.deleted && styles.commentDeleted,
                    c.hidden && styles.commentHidden,
                    c.flagged && styles.commentFlagged,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <Avatar name={c.authorName} src={c.authorAvatar ?? undefined} size="sm" />
                  <div className={styles.commentBody}>
                    <div className={styles.commentMeta}>
                      <span className={styles.commentAuthor}>
                        {c.authorName}
                      </span>
                      <span className={styles.commentDate}>
                        {formatRelative(c.createdAt)}
                      </span>
                      {c.flagged && !c.deleted && (
                        <span className={styles.commentTag}>marcado</span>
                      )}
                      {c.hidden && !c.deleted && (
                        <span className={styles.commentTagMute}>oculto</span>
                      )}
                      {c.deleted && (
                        <span className={styles.commentTagMute}>apagado</span>
                      )}
                    </div>
                    <p className={styles.commentText}>
                      {c.deleted ? '[comentário removido]' : c.body}
                    </p>
                  </div>
                  {!c.deleted && (
                    <div className={styles.commentActions}>
                      {c.flagged ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          aria-label="Aprovar"
                          title="Aprovar"
                          onClick={() => updateComment(c.id, { flagged: false })}
                        >
                          <IconCheckCircle size={14} />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          aria-label="Marcar"
                          title="Marcar"
                          onClick={() => updateComment(c.id, { flagged: true })}
                        >
                          <IconFlag size={14} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        aria-label={c.hidden ? 'Mostrar' : 'Ocultar'}
                        title={c.hidden ? 'Mostrar' : 'Ocultar'}
                        onClick={() => updateComment(c.id, { hidden: !c.hidden })}
                      >
                        <IconEyeOff size={14} />
                      </Button>
                      <Button
                        variant="dangerGhost"
                        size="sm"
                        iconOnly
                        aria-label="Apagar"
                        title="Apagar"
                        onClick={() => updateComment(c.id, { deleted: true })}
                      >
                        <IconTrash size={14} />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Drawer>
  );
}
