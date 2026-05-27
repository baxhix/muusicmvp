'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api/client';
import type {
  ApiCommunityCard,
  ApiCommunityCommentReactionResult,
  ApiCommunityDetail,
  ApiCommunityMember,
  ApiCommunityMemberPreview,
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
 *                 trending badges + a three-dot kebab menu per card
 *                 holding "Editar nome" (creator only) / Sair /
 *                 Denunciar. The "Nova comunidade" CTA pins to the
 *                 footer for users with ≥10k Fanpoints.
 *
 *   2. 'detail' — single community: header with creator avatar +
 *                 description + member avatar stack ("X membros /
 *                 Ver todos"), kebab menu (Editar nome / Sair /
 *                 Denunciar) in the title bar, then the topics list
 *                 with its own search. The "Novo tópico" CTA pins
 *                 to the footer for members.
 *
 *   3. 'topic'  — single topic forum: the topic title becomes the
 *                 panel header (no inline title card), author meta
 *                 above the body, comments with ❤️ reactions and
 *                 inline reply threading.
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
  // re-opening always starts at the top of the flow.
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
          onLeftCommunity={() => setView({ kind: 'list' })}
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
  trailing,
}: {
  title: string;
  onBack?: () => void;
  onClose: () => void;
  /** Optional trailing slot (kebab menu, etc.) shown left of the close button. */
  trailing?: React.ReactNode;
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
      {trailing}
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

/* ── Reusable kebab menu ─────────────────────────────────────── */

type KebabAction = {
  /** Unique key per menu instance. */
  key: string;
  label: string;
  onClick: () => void;
  /** Render in red — for destructive / "report" intent. */
  destructive?: boolean;
};

function KebabMenu({
  actions,
  label = 'Mais ações',
}: {
  actions: KebabAction[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Click-outside close. Pointer events so it works on touch too.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // Defer one tick so the click that opened the menu doesn't
    // immediately close it via the outside-click handler.
    const t = setTimeout(() => {
      document.addEventListener('pointerdown', onDown);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <div className={styles.kebabRoot} ref={rootRef}>
      <button
        type="button"
        className={styles.kebabBtn}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
      >
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="8" cy="3" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="8" cy="13" r="1.4" />
        </svg>
      </button>
      {open && (
        <div className={styles.kebabMenu} role="menu">
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              role="menuitem"
              className={`${styles.kebabItem} ${a.destructive ? styles.kebabItemDanger : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                a.onClick();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
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
  const [renameTarget, setRenameTarget] = useState<ApiCommunityCard | null>(null);
  const { items, loading, refresh } = useCommunities({
    enabled: true,
    search: query,
  });

  const onLeave = useCallback(
    async (card: ApiCommunityCard) => {
      try {
        await api.post(`/api/communities/${card.slug}/leave`);
        await refresh();
      } catch (err) {
        if (err instanceof ApiError && err.status === 400) {
          alert('O criador da comunidade não pode sair. Apague a comunidade.');
        } else {
          console.error('leave failed:', err);
        }
      }
    },
    [refresh],
  );

  const onJoin = useCallback(
    async (card: ApiCommunityCard) => {
      try {
        await api.post(`/api/communities/${card.slug}/join`);
        await refresh();
      } catch (err) {
        console.error('join failed:', err);
      }
    },
    [refresh],
  );

  const onReport = useCallback((card: ApiCommunityCard) => {
    // No reporting backend for communities yet — just acknowledge.
    alert(`Comunidade "${card.name}" reportada. Obrigado!`);
  }, []);

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

        {loading && items.length === 0 ? (
          <div className={styles.emptyState}>Carregando…</div>
        ) : items.length === 0 ? (
          <div className={styles.emptyState}>
            {query ? `Nenhuma comunidade para "${query}".` : 'Nenhuma comunidade ainda.'}
          </div>
        ) : (
          <ul className={styles.cardList}>
            {items.map((c) => {
              const isCreator = c.creatorId === user?.id;
              const actions: KebabAction[] = [];
              if (isCreator) {
                actions.push({
                  key: 'edit',
                  label: 'Editar nome',
                  onClick: () => setRenameTarget(c),
                });
              }
              if (c.isMember && !isCreator) {
                actions.push({
                  key: 'leave',
                  label: 'Sair',
                  onClick: () => void onLeave(c),
                });
              }
              if (!c.isMember) {
                actions.push({
                  key: 'join',
                  label: 'Participar',
                  onClick: () => void onJoin(c),
                });
              }
              actions.push({
                key: 'report',
                label: 'Denunciar',
                onClick: () => onReport(c),
                destructive: true,
              });

              return (
                <li key={c.id}>
                  <div className={styles.communityCard}>
                    <button
                      type="button"
                      className={styles.cardOpenBtn}
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
                        {/* Secondary chip row — surfaces additional
                          * "this community is bumping" signals per
                          * product feedback. Today only fires for
                          * trending communities; future signals
                          * (newcomer surge, region-of-day, etc.)
                          * just append to this row. */}
                        {c.isTrending && (
                          <div className={styles.cardChipsRow}>
                            <span className={styles.cardChip}>
                              Mais ativa hoje
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                    {/* Discreet "Entrar" button per product feedback
                        ("Inclua o botão Entrar junto no cards de
                        lista de comunidades discretamente,
                        seguindo a ID atual"). Sibling of
                        `cardOpenBtn` so it has its own click target
                        (nesting <button> inside <button> is invalid
                        HTML). Only renders for non-members; once
                        the viewer joins it disappears and the
                        kebab carries the "Sair" action instead. */}
                    {!c.isMember && (
                      <button
                        type="button"
                        className={styles.cardJoinPill}
                        onClick={() => void onJoin(c)}
                        aria-label={`Entrar na comunidade ${c.name}`}
                      >
                        <svg
                          viewBox="0 0 16 16"
                          width="12"
                          height="12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          aria-hidden="true"
                        >
                          <path d="M8 3v10M3 8h10" />
                        </svg>
                        Entrar
                      </button>
                    )}
                    <KebabMenu actions={actions} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Floating action button — circular "+" pinned to the
        * bottom-right corner of the panel. Replaces the older
        * full-width "Nova comunidade" footer CTA per product
        * feedback. The gating note (when the user doesn't have
        * enough points) stays in the footer position so users
        * know WHY the FAB isn't available. */}
      {canCreate ? (
        <button
          type="button"
          className={styles.fab}
          onClick={() => setCreateOpen(true)}
          aria-label="Nova comunidade"
          title="Nova comunidade"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      ) : profile?.fanpoints !== undefined ? (
        <footer className={styles.footer}>
          <p className={styles.gateNote}>
            Acumule {CREATE_FP_THRESHOLD.toLocaleString('pt-BR')} Fanpoints
            para criar a sua própria comunidade.
          </p>
        </footer>
      ) : null}

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

      {renameTarget && (
        <RenameCommunityModal
          slug={renameTarget.slug}
          initialName={renameTarget.name}
          onClose={() => setRenameTarget(null)}
          onSaved={() => {
            setRenameTarget(null);
            void refresh();
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
  onLeftCommunity,
  onClose,
}: {
  slug: string;
  onBack: () => void;
  onOpenTopic: (topicId: string) => void;
  onLeftCommunity: () => void;
  onClose: () => void;
}) {
  const [community, setCommunity] = useState<ApiCommunityDetail | null>(null);
  const [topics, setTopics] = useState<ApiCommunityTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);

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

  const onJoin = useCallback(async () => {
    try {
      await api.post(`/api/communities/${slug}/join`);
      await refresh();
    } catch (err) {
      console.error('join failed:', err);
    }
  }, [slug, refresh]);

  const onLeave = useCallback(async () => {
    try {
      await api.post(`/api/communities/${slug}/leave`);
      // Go back to the list — leaving the detail of a community
      // you just left feels weird (the "Novo tópico" CTA flips off).
      onLeftCommunity();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        alert('O criador da comunidade não pode sair. Apague a comunidade.');
      } else {
        console.error('leave failed:', err);
      }
    }
  }, [slug, onLeftCommunity]);

  const onReport = useCallback(() => {
    if (!community) return;
    alert(`Comunidade "${community.name}" reportada. Obrigado!`);
  }, [community]);

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

  // Kebab actions for the detail header. Editar shows only for the
  // creator; Sair only for non-creator members; Denunciar always.
  const headerActions: KebabAction[] = [];
  if (community.isCreator) {
    headerActions.push({
      key: 'edit',
      label: 'Editar nome',
      onClick: () => setRenameOpen(true),
    });
  }
  if (community.isMember && !community.isCreator) {
    headerActions.push({
      key: 'leave',
      label: 'Sair',
      onClick: () => void onLeave(),
    });
  }
  headerActions.push({
    key: 'report',
    label: 'Denunciar',
    onClick: () => onReport(),
    destructive: true,
  });

  return (
    <>
      <HeaderBar
        title={community.name}
        onBack={onBack}
        onClose={onClose}
        trailing={<KebabMenu actions={headerActions} />}
      />

      <div className={styles.body}>
        {/* Compact community summary — description + member avatar
            stack + Participar CTA when the viewer hasn't joined yet.
            The "por <Creator>" line that used to lead this section
            was removed per product feedback ("Avatar + por marcelo
            De Mari. Deixe apenas a linha de baixo: avatar + 1
            membro + ver todos") — the bottom MembersStack already
            carries an avatar strip + member count + "Ver todos", so
            the creator strip above was redundant.
            The 🔥 Bombando badge that used to ride inline on the
            creator line was dropped too — the LIST card already
            shows the trending pill, so the detail view doesn't need
            to re-state it. */}
        <section className={styles.communitySummary}>
          {community.description && (
            <p className={styles.detailDescription}>{community.description}</p>
          )}

          <MembersStack
            previews={community.memberPreviews}
            memberCount={community.memberCount}
            onViewAll={() => setShowMembers(true)}
          />

          {!community.isMember && (
            <button
              type="button"
              className={styles.joinPill}
              onClick={onJoin}
            >
              Participar
            </button>
          )}
        </section>

        {/* Search bar hidden when the community has nothing to
            search (zero topics + no active query) per product
            feedback ("Remova a busca quando não houver tópicos").
            Once the user types into the field, `query` becomes
            non-empty and the search input stays visible even if
            the server returns no matches — that way the user can
            still see + clear what they typed. */}
        {(topics.length > 0 || query !== '') && (
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

      {/* Footer: smaller "Novo tópico" CTA below the topics list. */}
      {community.isMember && (
        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.footerCta}
            onClick={() => setCreateOpen(true)}
          >
            + Novo tópico
          </button>
        </footer>
      )}

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

      {renameOpen && (
        <RenameCommunityModal
          slug={slug}
          initialName={community.name}
          onClose={() => setRenameOpen(false)}
          onSaved={() => {
            setRenameOpen(false);
            void refresh();
          }}
        />
      )}
    </>
  );
}

/** 5-avatar stack with a "+N" chip and "X membros · Ver todos" CTA. */
function MembersStack({
  previews,
  memberCount,
  onViewAll,
}: {
  previews: ApiCommunityMemberPreview[];
  memberCount: number;
  onViewAll: () => void;
}) {
  const shown = previews.slice(0, 5);
  const overflow = Math.max(memberCount - shown.length, 0);
  return (
    <button
      type="button"
      className={styles.membersStackRow}
      onClick={onViewAll}
      aria-label="Ver todos os participantes"
    >
      <div className={styles.membersStack}>
        {shown.map((m) =>
          m.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={m.id}
              src={m.avatarUrl}
              alt=""
              className={styles.membersStackAvatar}
            />
          ) : (
            <span
              key={m.id}
              className={`${styles.membersStackAvatar} ${styles.membersStackAvatarFallback}`}
              aria-hidden="true"
            >
              {(m.name ?? '?').slice(0, 1).toUpperCase()}
            </span>
          ),
        )}
        {overflow > 0 && (
          <span className={styles.membersStackMore} aria-hidden="true">
            +{overflow}
          </span>
        )}
      </div>
      <span className={styles.membersStackLabel}>
        {memberCount.toLocaleString('pt-BR')} {memberCount === 1 ? 'membro' : 'membros'}
        <span className={styles.membersStackDot}>·</span>
        <span className={styles.membersStackLink}>Ver todos</span>
      </span>
    </button>
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
  /** Top-level comment being replied to. Null = posting top-level. */
  const [replyTarget, setReplyTarget] = useState<ApiCommunityTopicComment | null>(
    null,
  );

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
      await api.post(
        `/api/communities/${slug}/topics/${topicId}/comments`,
        {
          body,
          parentCommentId: replyTarget?.id ?? null,
        },
      );
      setDraft('');
      setReplyTarget(null);
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

  // Optimistic ❤️ toggle — flips the local cache immediately and
  // reconciles with the server response.
  const onToggleReaction = useCallback(
    async (commentId: string) => {
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                reactions: {
                  count: c.reactions.mine
                    ? Math.max(c.reactions.count - 1, 0)
                    : c.reactions.count + 1,
                  mine: !c.reactions.mine,
                },
              }
            : c,
        ),
      );
      try {
        const res = await api.post<ApiCommunityCommentReactionResult>(
          `/api/communities/${slug}/topics/${topicId}/comments/${commentId}/reactions`,
          {},
        );
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? { ...c, reactions: { count: res.count, mine: res.mine } }
              : c,
          ),
        );
      } catch (err) {
        console.error('reaction toggle failed:', err);
        // Rollback on error.
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  reactions: {
                    count: c.reactions.mine
                      ? Math.max(c.reactions.count - 1, 0)
                      : c.reactions.count + 1,
                    mine: !c.reactions.mine,
                  },
                }
              : c,
          ),
        );
      }
    },
    [slug, topicId],
  );

  // Group replies under their parent so the renderer can do
  // 1 level of inline nesting. Anything malformed (orphan parent_id)
  // falls back to top-level so it still shows.
  const topLevel = comments.filter((c) => !c.parentCommentId);
  const repliesByParent = new Map<string, ApiCommunityTopicComment[]>();
  for (const c of comments) {
    if (c.parentCommentId) {
      const arr = repliesByParent.get(c.parentCommentId) ?? [];
      arr.push(c);
      repliesByParent.set(c.parentCommentId, arr);
    }
  }

  return (
    <>
      {/* The topic title IS the header now — no inline title card. */}
      <HeaderBar
        title={topic?.title ?? 'Tópico'}
        onBack={onBack}
        onClose={onClose}
      />

      <div className={styles.body}>
        {loading || !topic ? (
          <div className={styles.emptyState}>Carregando…</div>
        ) : (
          <>
            {/* Author meta + body, no card surrounding. */}
            <div className={styles.topicMetaRow}>
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

            <ul className={styles.commentList}>
              {topLevel.length === 0 ? (
                <li className={styles.emptyComments}>Seja o primeiro a comentar.</li>
              ) : (
                topLevel.map((c) => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    replies={repliesByParent.get(c.id) ?? []}
                    canInteract={!!community?.isMember && !!user}
                    onReply={() => setReplyTarget(c)}
                    onToggleReaction={onToggleReaction}
                  />
                ))
              )}
            </ul>
          </>
        )}
      </div>

      {community?.isMember && user && !loading && topic && (
        <form className={styles.composer} onSubmit={handleSubmit}>
          {replyTarget && (
            <div className={styles.replyBanner}>
              <span>
                Respondendo a <strong>{replyTarget.author.name ?? 'Anônimo'}</strong>
              </span>
              <button
                type="button"
                className={styles.replyCancel}
                onClick={() => setReplyTarget(null)}
                aria-label="Cancelar resposta"
              >
                ×
              </button>
            </div>
          )}
          <div className={styles.composerInputRow}>
            <input
              className={styles.composerField}
              type="text"
              placeholder={replyTarget ? 'Sua resposta…' : 'Comentar…'}
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
          </div>
        </form>
      )}
    </>
  );
}

/** One comment row + its inline reply thread. */
function CommentRow({
  comment,
  replies,
  canInteract,
  onReply,
  onToggleReaction,
}: {
  comment: ApiCommunityTopicComment;
  replies: ApiCommunityTopicComment[];
  canInteract: boolean;
  onReply: () => void;
  onToggleReaction: (commentId: string) => void;
}) {
  return (
    <li className={styles.commentRow}>
      {comment.author.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={comment.author.avatarUrl} alt="" className={styles.commentAvatar} />
      ) : (
        <span className={styles.commentAvatarPlaceholder} aria-hidden="true" />
      )}
      <div className={styles.commentBody}>
        <div className={styles.commentHead}>
          <span className={styles.commentAuthor}>
            {comment.author.name ?? 'Anônimo'}
          </span>
          <span className={styles.commentTime}>{relativeTime(comment.createdAt)}</span>
        </div>
        <p className={styles.commentText}>
          {comment.deletedAt ? 'Comentário removido.' : comment.body}
        </p>
        {!comment.deletedAt && (
          <div className={styles.commentActions}>
            <button
              type="button"
              className={`${styles.reactionBtn} ${comment.reactions.mine ? styles.reactionBtnActive : ''}`}
              onClick={() => canInteract && onToggleReaction(comment.id)}
              disabled={!canInteract}
              aria-label={comment.reactions.mine ? 'Remover curtida' : 'Curtir'}
            >
              <span aria-hidden="true">{comment.reactions.mine ? '❤️' : '🤍'}</span>
              {comment.reactions.count > 0 && (
                <span className={styles.reactionCount}>{comment.reactions.count}</span>
              )}
            </button>
            <button
              type="button"
              className={styles.replyBtn}
              onClick={onReply}
              disabled={!canInteract}
            >
              Responder
            </button>
          </div>
        )}

        {replies.length > 0 && (
          <ul className={styles.replyList}>
            {replies.map((r) => (
              <li key={r.id} className={styles.replyRow}>
                {r.author.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.author.avatarUrl} alt="" className={styles.replyAvatar} />
                ) : (
                  <span className={styles.replyAvatarPlaceholder} aria-hidden="true" />
                )}
                <div className={styles.replyBody}>
                  <div className={styles.commentHead}>
                    <span className={styles.commentAuthor}>{r.author.name ?? 'Anônimo'}</span>
                    <span className={styles.commentTime}>{relativeTime(r.createdAt)}</span>
                  </div>
                  <p className={styles.commentText}>
                    {r.deletedAt ? 'Comentário removido.' : r.body}
                  </p>
                  {!r.deletedAt && (
                    <div className={styles.commentActions}>
                      <button
                        type="button"
                        className={`${styles.reactionBtn} ${r.reactions.mine ? styles.reactionBtnActive : ''}`}
                        onClick={() => canInteract && onToggleReaction(r.id)}
                        disabled={!canInteract}
                        aria-label={r.reactions.mine ? 'Remover curtida' : 'Curtir'}
                      >
                        <span aria-hidden="true">{r.reactions.mine ? '❤️' : '🤍'}</span>
                        {r.reactions.count > 0 && (
                          <span className={styles.reactionCount}>{r.reactions.count}</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
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

function RenameCommunityModal({
  slug,
  initialName,
  onClose,
  onSaved,
}: {
  slug: string;
  initialName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/api/communities/${slug}`, { name: name.trim() });
      onSaved();
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
        <h3 className={styles.modalTitle}>Editar nome</h3>
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
        {error && (
          <p className={styles.modalError}>
            {error === 'forbidden'
              ? 'Apenas o criador pode editar.'
              : `Erro: ${error}`}
          </p>
        )}
        <div className={styles.modalActions}>
          <button type="button" className={styles.modalCancel} onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button
            type="submit"
            className={styles.modalSubmit}
            disabled={!name.trim() || submitting || name.trim() === initialName}
          >
            {submitting ? 'Salvando…' : 'Salvar'}
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
