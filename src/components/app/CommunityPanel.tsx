'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api/client';
import type {
  ApiCommunityCard,
  ApiCommunityDetail,
  ApiCommunityMember,
  ApiCommunityTopic,
  ApiCommunityTopicComment,
} from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useCommunities } from '@/hooks/useCommunities';
import styles from './CommunityPanel.module.css';

/**
 * Communities (forum) panel — a view-state machine that hosts the
 * full Comunidade flow inside the right-column slot the other
 * overlays share (FeedPanel, ConversationsSidebar, NotificationBell).
 *
 * Three views, navigable in-place:
 *
 *   1. 'list'   — searchable list of communities, with "Bombando"
 *                 trending badges + Participar/Sair CTA per card.
 *                 Users with ≥10k Fanpoints get a "Nova comunidade"
 *                 CTA pinned to the header.
 *
 *   2. 'detail' — single community: header card with image/name/
 *                 member count + a "Ver participantes" affordance
 *                 (member-only), then the topics list with its
 *                 own search field. Members get a "Novo tópico"
 *                 CTA. The creator gets a "Apagar comunidade" kebab
 *                 action.
 *
 *   3. 'topic'  — single topic forum: title + author + body +
 *                 inline comments + comment composer. The composer
 *                 is locked behind community membership.
 *
 * The panel exposes the standard `open` + `onClose` props; the
 * page's activeOverlay coordinator owns those. Internal view
 * transitions stay self-contained.
 */
interface CommunityPanelProps {
  open: boolean;
  onClose: () => void;
}

type View =
  | { kind: 'list' }
  | { kind: 'detail'; slug: string }
  | { kind: 'topic'; slug: string; topicId: string };

/** Minimum Fanpoints required to spawn a new community. Mirrors the
 *  server-side constant in `src/server/communities/queries.ts`. */
const CREATE_FP_THRESHOLD = 10_000;

/** Format helper for relative time in a single line. */
function relativeTime(iso: string): string {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return 'agora';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}min`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function CommunityPanel({ open, onClose }: CommunityPanelProps) {
  const [view, setView] = useState<View>({ kind: 'list' });

  // Reset to the list view ~360ms after the panel closes so
  // re-opening always starts at the top of the flow. The 360ms
  // matches the panel's exit animation so the previous view
  // stays painted while the slide-down plays.
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => setView({ kind: 'list' }), 360);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Escape: back if drilled, close if at list.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (view.kind === 'topic') setView({ kind: 'detail', slug: view.slug });
      else if (view.kind === 'detail') setView({ kind: 'list' });
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, view, onClose]);

  return (
    <aside
      className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
      role="dialog"
      aria-label="Comunidade"
      aria-hidden={!open}
    >
      {view.kind === 'list' && (
        <CommunityListView onClose={onClose} onOpenCommunity={(slug) => setView({ kind: 'detail', slug })} />
      )}
      {view.kind === 'detail' && (
        <CommunityDetailView
          slug={view.slug}
          onBack={() => setView({ kind: 'list' })}
          onOpenTopic={(topicId) => setView({ kind: 'topic', slug: view.slug, topicId })}
          onClose={onClose}
        />
      )}
      {view.kind === 'topic' && (
        <TopicDetailView
          slug={view.slug}
          topicId={view.topicId}
          onBack={() => setView({ kind: 'detail', slug: view.slug })}
          onClose={onClose}
        />
      )}
    </aside>
  );
}

/* ── Shared header bits ──────────────────────────────────────── */

function HeaderBar({
  title,
  onBack,
  onClose,
}: {
  title: string;
  onBack?: () => void;
  onClose: () => void;
}) {
  return (
    <header className={styles.header}>
      {onBack && (
        <button
          type="button"
          className={styles.backBtn}
          onClick={onBack}
          aria-label="Voltar"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <h2 className={styles.title}>{title}</h2>
      <button
        type="button"
        className={styles.closeBtn}
        onClick={onClose}
        aria-label="Fechar"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </header>
  );
}

/* ── View 1: Community list ──────────────────────────────────── */

function CommunityListView({
  onClose,
  onOpenCommunity,
}: {
  onClose: () => void;
  onOpenCommunity: (slug: string) => void;
}) {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.id ?? null);
  const canCreate = (profile?.fanpoints ?? 0) >= CREATE_FP_THRESHOLD;

  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const { items, loading, refresh } = useCommunities({
    enabled: true,
    search: query,
  });

  // Toggle join — fired from the per-card CTA. Refreshes the list
  // on settle so memberCount + isMember reflect the new state.
  const onToggleJoin = useCallback(
    async (card: ApiCommunityCard) => {
      try {
        if (card.isMember) {
          await api.post(`/api/communities/${card.slug}/leave`);
        } else {
          await api.post(`/api/communities/${card.slug}/join`);
        }
        await refresh();
      } catch (err) {
        console.error('toggle join failed:', err);
      }
    },
    [refresh],
  );

  return (
    <>
      <HeaderBar title="Comunidades" onClose={onClose} />

      <div className={styles.body}>
        <div className={styles.searchRow}>
          <svg
            className={styles.searchIcon}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="5" />
            <path d="M14 14l-3-3" />
          </svg>
          <input
            type="search"
            className={styles.searchField}
            placeholder="Buscar comunidade…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>

        {canCreate && (
          <button
            type="button"
            className={styles.primaryCta}
            onClick={() => setCreateOpen(true)}
          >
            + Nova comunidade
          </button>
        )}
        {!canCreate && profile?.fanpoints !== undefined && (
          <p className={styles.gateNote}>
            Acumule {CREATE_FP_THRESHOLD.toLocaleString('pt-BR')} Fanpoints
            para criar a sua própria comunidade.
          </p>
        )}

        {loading && items.length === 0 ? (
          <div className={styles.emptyState}>Carregando…</div>
        ) : items.length === 0 ? (
          <div className={styles.emptyState}>
            {query ? `Nenhuma comunidade para "${query}".` : 'Nenhuma comunidade ainda.'}
          </div>
        ) : (
          <ul className={styles.cardList}>
            {items.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={styles.communityCard}
                  onClick={() => onOpenCommunity(c.slug)}
                >
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt="" className={styles.cardThumb} />
                  ) : (
                    <span className={styles.cardThumbPlaceholder} aria-hidden="true" />
                  )}
                  <div className={styles.cardBody}>
                    <div className={styles.cardTitleRow}>
                      <span className={styles.cardTitle}>{c.name}</span>
                      {c.isTrending && (
                        <span className={styles.trendingBadge} aria-label="Comunidade bombando">
                          🔥 Bombando
                        </span>
                      )}
                    </div>
                    <span className={styles.cardMeta}>
                      {c.memberCount.toLocaleString('pt-BR')} {c.memberCount === 1 ? 'membro' : 'membros'}
                      {' · '}
                      {c.topicCount.toLocaleString('pt-BR')} {c.topicCount === 1 ? 'tópico' : 'tópicos'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`${styles.joinPill} ${c.isMember ? styles.joinPillJoined : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      void onToggleJoin(c);
                    }}
                    aria-label={c.isMember ? 'Sair da comunidade' : 'Participar da comunidade'}
                  >
                    {c.isMember ? 'Saiu' : 'Participar'}
                  </button>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {createOpen && (
        <CreateCommunityModal
          onClose={() => setCreateOpen(false)}
          onCreated={(slug) => {
            setCreateOpen(false);
            void refresh();
            onOpenCommunity(slug);
          }}
        />
      )}
    </>
  );
}

/* ── View 2: Community detail (topics list) ──────────────────── */

function CommunityDetailView({
  slug,
  onBack,
  onOpenTopic,
  onClose,
}: {
  slug: string;
  onBack: () => void;
  onOpenTopic: (topicId: string) => void;
  onClose: () => void;
}) {
  const [community, setCommunity] = useState<ApiCommunityDetail | null>(null);
  const [topics, setTopics] = useState<ApiCommunityTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [det, top] = await Promise.all([
        api.get<{ community: ApiCommunityDetail }>(`/api/communities/${slug}`),
        api.get<{ items: ApiCommunityTopic[] }>(
          `/api/communities/${slug}/topics${query.trim() ? `?search=${encodeURIComponent(query.trim())}` : ''}`,
        ),
      ]);
      setCommunity(det.community);
      setTopics(top.items);
    } catch (err) {
      console.error('community detail fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [slug, query]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onToggleJoin = useCallback(async () => {
    if (!community) return;
    try {
      if (community.isMember) {
        await api.post(`/api/communities/${slug}/leave`);
      } else {
        await api.post(`/api/communities/${slug}/join`);
      }
      await refresh();
    } catch (err) {
      console.error('toggle join failed:', err);
    }
  }, [community, slug, refresh]);

  if (!community) {
    return (
      <>
        <HeaderBar title="Comunidade" onBack={onBack} onClose={onClose} />
        <div className={styles.body}>
          <div className={styles.emptyState}>{loading ? 'Carregando…' : 'Não encontrada.'}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <HeaderBar title={community.name} onBack={onBack} onClose={onClose} />

      <div className={styles.body}>
        <div className={styles.communityHeaderCard}>
          {community.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={community.imageUrl} alt="" className={styles.detailThumb} />
          ) : (
            <span className={styles.detailThumbPlaceholder} aria-hidden="true" />
          )}
          <div className={styles.detailMeta}>
            <p className={styles.detailMetaLine}>
              {community.memberCount.toLocaleString('pt-BR')} {community.memberCount === 1 ? 'membro' : 'membros'}
              {community.isTrending && <span className={styles.trendingInline}> · 🔥 Bombando</span>}
            </p>
            {community.description && (
              <p className={styles.detailDescription}>{community.description}</p>
            )}
            <div className={styles.detailActions}>
              <button
                type="button"
                className={`${styles.joinPill} ${community.isMember ? styles.joinPillJoined : ''}`}
                onClick={onToggleJoin}
              >
                {community.isMember ? 'Sair' : 'Participar'}
              </button>
              {community.isMember && (
                <button
                  type="button"
                  className={styles.ghostPill}
                  onClick={() => setShowMembers(true)}
                >
                  Ver participantes
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={styles.searchRow}>
          <svg
            className={styles.searchIcon}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="5" />
            <path d="M14 14l-3-3" />
          </svg>
          <input
            type="search"
            className={styles.searchField}
            placeholder="Buscar tópico…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>

        {community.isMember && (
          <button
            type="button"
            className={styles.primaryCta}
            onClick={() => setCreateOpen(true)}
          >
            + Novo tópico
          </button>
        )}

        {topics.length === 0 ? (
          <div className={styles.emptyState}>
            {query ? `Nenhum tópico para "${query}".` : 'Ainda sem tópicos. Abra o primeiro!'}
          </div>
        ) : (
          <ul className={styles.topicList}>
            {topics.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={styles.topicRow}
                  onClick={() => onOpenTopic(t.id)}
                >
                  <span className={styles.topicTitle}>{t.title}</span>
                  <span className={styles.topicMeta}>
                    {t.authorName ?? 'Anônimo'} · {relativeTime(t.createdAt)} ·{' '}
                    {t.commentCount} {t.commentCount === 1 ? 'comentário' : 'comentários'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {createOpen && (
        <CreateTopicModal
          slug={slug}
          onClose={() => setCreateOpen(false)}
          onCreated={(topicId) => {
            setCreateOpen(false);
            void refresh();
            onOpenTopic(topicId);
          }}
        />
      )}

      {showMembers && (
        <MembersModal slug={slug} onClose={() => setShowMembers(false)} />
      )}
    </>
  );
}

/* ── View 3: Topic detail (forum) ────────────────────────────── */

function TopicDetailView({
  slug,
  topicId,
  onBack,
  onClose,
}: {
  slug: string;
  topicId: string;
  onBack: () => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [topic, setTopic] = useState<ApiCommunityTopic | null>(null);
  const [community, setCommunity] = useState<ApiCommunityDetail | null>(null);
  const [comments, setComments] = useState<ApiCommunityTopicComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refreshComments = useCallback(async () => {
    try {
      const res = await api.get<{ items: ApiCommunityTopicComment[] }>(
        `/api/communities/${slug}/topics/${topicId}/comments`,
      );
      setComments(res.items);
    } catch (err) {
      console.error('topic comments fetch failed:', err);
    }
  }, [slug, topicId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get<{ topic: ApiCommunityTopic }>(`/api/communities/${slug}/topics/${topicId}`),
      api.get<{ community: ApiCommunityDetail }>(`/api/communities/${slug}`),
      api.get<{ items: ApiCommunityTopicComment[] }>(
        `/api/communities/${slug}/topics/${topicId}/comments`,
      ),
    ])
      .then(([t, c, cm]) => {
        if (cancelled) return;
        setTopic(t.topic);
        setCommunity(c.community);
        setComments(cm.items);
      })
      .catch((err) => {
        if (!cancelled) console.error('topic view fetch failed:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, topicId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    try {
      await api.post(`/api/communities/${slug}/topics/${topicId}/comments`, { body });
      setDraft('');
      await refreshComments();
    } catch (err) {
      console.error('comment submit failed:', err);
      if (err instanceof ApiError && err.status === 403) {
        alert('Você precisa fazer parte da comunidade para comentar.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <HeaderBar title="Tópico" onBack={onBack} onClose={onClose} />

      <div className={styles.body}>
        {loading || !topic ? (
          <div className={styles.emptyState}>Carregando…</div>
        ) : (
          <>
            <article className={styles.topicHero}>
              <h3 className={styles.topicHeroTitle}>{topic.title}</h3>
              <div className={styles.topicHeroMeta}>
                {topic.authorAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={topic.authorAvatar} alt="" className={styles.topicHeroAvatar} />
                ) : (
                  <span className={styles.topicHeroAvatarPlaceholder} aria-hidden="true" />
                )}
                <span className={styles.topicHeroAuthor}>
                  {topic.authorName ?? 'Anônimo'}
                </span>
                <span className={styles.topicHeroDot} aria-hidden="true">·</span>
                <span className={styles.topicHeroTime}>{relativeTime(topic.createdAt)}</span>
              </div>
              {topic.body && <p className={styles.topicHeroBody}>{topic.body}</p>}
            </article>

            <ul className={styles.commentList}>
              {comments.length === 0 ? (
                <li className={styles.emptyComments}>Seja o primeiro a comentar.</li>
              ) : (
                comments.map((c) => (
                  <li key={c.id} className={styles.commentRow}>
                    {c.author.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.author.avatarUrl} alt="" className={styles.commentAvatar} />
                    ) : (
                      <span className={styles.commentAvatarPlaceholder} aria-hidden="true" />
                    )}
                    <div className={styles.commentBody}>
                      <span className={styles.commentAuthor}>
                        {c.author.name ?? 'Anônimo'}
                      </span>
                      <span className={styles.commentTime}>{relativeTime(c.createdAt)}</span>
                      <p className={styles.commentText}>
                        {c.deletedAt ? 'Comentário removido.' : c.body}
                      </p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </>
        )}
      </div>

      {community?.isMember && user && !loading && topic && (
        <form className={styles.composer} onSubmit={handleSubmit}>
          <input
            className={styles.composerField}
            type="text"
            placeholder="Comentar…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={submitting}
            maxLength={2000}
          />
          <button
            type="submit"
            className={styles.composerSubmit}
            disabled={!draft.trim() || submitting}
            aria-label="Enviar comentário"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 8L2 2l3 6-3 6 12-6z" />
            </svg>
          </button>
        </form>
      )}
    </>
  );
}

/* ── Modals ──────────────────────────────────────────────────── */

function CreateCommunityModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (slug: string) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ id: string; slug: string }>(
        '/api/communities',
        {
          name: name.trim(),
          description: description.trim() || null,
          imageUrl: imageUrl.trim() || null,
        },
      );
      onCreated(res.slug);
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as { error?: string } | null;
        setError(body?.error ?? `HTTP ${err.status}`);
      } else {
        setError('network_error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <form
        className={styles.modal}
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={styles.modalTitle}>Nova comunidade</h3>
        <label className={styles.modalField}>
          <span>Nome</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
            autoFocus
          />
        </label>
        <label className={styles.modalField}>
          <span>Descrição (opcional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
          />
        </label>
        <label className={styles.modalField}>
          <span>URL da imagem (opcional)</span>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
            maxLength={500}
          />
        </label>
        {error && (
          <p className={styles.modalError}>
            {error === 'insufficient_fanpoints'
              ? `Você precisa de ${CREATE_FP_THRESHOLD.toLocaleString('pt-BR')} Fanpoints.`
              : `Erro: ${error}`}
          </p>
        )}
        <div className={styles.modalActions}>
          <button type="button" className={styles.modalCancel} onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" className={styles.modalSubmit} disabled={!name.trim() || submitting}>
            {submitting ? 'Criando…' : 'Criar'}
          </button>
        </div>
      </form>
    </div>
  );
}

function CreateTopicModal({
  slug,
  onClose,
  onCreated,
}: {
  slug: string;
  onClose: () => void;
  onCreated: (topicId: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ id: string }>(
        `/api/communities/${slug}/topics`,
        { title: title.trim(), body: body.trim() || null },
      );
      onCreated(res.id);
    } catch (err) {
      if (err instanceof ApiError) {
        const ebody = err.body as { error?: string } | null;
        setError(ebody?.error ?? `HTTP ${err.status}`);
      } else {
        setError('network_error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <form className={styles.modal} onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Novo tópico</h3>
        <label className={styles.modalField}>
          <span>Título</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
            autoFocus
          />
        </label>
        <label className={styles.modalField}>
          <span>Mensagem (opcional)</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
            rows={5}
          />
        </label>
        {error && (
          <p className={styles.modalError}>
            {error === 'not_a_member'
              ? 'Você precisa entrar na comunidade para criar tópicos.'
              : `Erro: ${error}`}
          </p>
        )}
        <div className={styles.modalActions}>
          <button type="button" className={styles.modalCancel} onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" className={styles.modalSubmit} disabled={!title.trim() || submitting}>
            {submitting ? 'Criando…' : 'Criar'}
          </button>
        </div>
      </form>
    </div>
  );
}

function MembersModal({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<ApiCommunityMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ items: ApiCommunityMember[] }>(`/api/communities/${slug}/members`)
      .then((res) => {
        if (!cancelled) setMembers(res.items);
      })
      .catch((err) => {
        if (!cancelled) console.error('members fetch failed:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Participantes</h3>
        {loading ? (
          <div className={styles.emptyState}>Carregando…</div>
        ) : members.length === 0 ? (
          <div className={styles.emptyState}>Ainda sem participantes.</div>
        ) : (
          <ul className={styles.memberList}>
            {members.map((m) => (
              <li key={m.userId} className={styles.memberRow}>
                {m.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatarUrl} alt="" className={styles.memberAvatar} />
                ) : (
                  <span className={styles.memberAvatarPlaceholder} aria-hidden="true" />
                )}
                <span className={styles.memberName}>
                  {m.name ?? m.email.split('@')[0]}
                  {m.isCreator && <span className={styles.memberCreatorTag}> · criador</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.modalActions}>
          <button type="button" className={styles.modalCancel} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
