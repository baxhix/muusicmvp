'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import Skeleton from './Skeleton';
import TruncatedText from './TruncatedText';
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
import {
  SHOW_COMMUNITIES,
  getShowCommunityCard,
  getShowCommunityDetail,
  getShowCommunityTopics,
  getShowCommunityTopic,
  getShowTopicComments,
  isShowCommunitySlug,
} from '@/data/showCommunities';
import styles from './CommunityPanel.module.css';

/** Ícone de 1 membro (single user) — usado quando memberCount === 1. */
function IconMemberSingle() {
  return (
    <svg
      className={styles.cardMetaIcon}
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="5.4" r="2.6" />
      <path d="M3.4 13c0-2.3 2.1-3.9 4.6-3.9s4.6 1.6 4.6 3.9" />
    </svg>
  );
}

/** Ícone de vários membros (two users) — usado quando memberCount > 1. */
function IconMemberGroup() {
  return (
    <svg
      className={styles.cardMetaIcon}
      viewBox="0 0 20 16"
      width="16"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="5.4" r="2.5" />
      <path d="M2.2 13c0-2.2 2.1-3.8 4.8-3.8S11.8 10.8 11.8 13" />
      <path d="M13 3.1a2.5 2.5 0 0 1 0 4.7" />
      <path d="M14.2 9.5c1.9.35 3.3 1.7 3.3 3.5" />
    </svg>
  );
}

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
  | { kind: 'create' }
  | { kind: 'detail'; slug: string }
  | { kind: 'topic'; slug: string; topicId: string };

/** Minimum Fanpoints required to spawn a new community. Mirrors the
 *  server-side constant in `src/server/communities/queries.ts`. */
/* Threshold pra criar comunidade — 10k → 200 per spec "mude a
 * regra para criação de comunidade para 200 Fanpoints". */
const CREATE_FP_THRESHOLD = 200;

/** Format helper for relative time in a single line. */
function relativeTime(iso: string): string {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return 'agora';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}min`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

/**
 * Posts nas últimas 24h exibidos no card (🔥 + seta verde + número).
 *
 * O backend ainda não rastreia contagem por janela — só `lastActivityAt`
 * + `isTrending` (heurístico). Até existir uma agregação real, derivamos
 * um número DETERMINÍSTICO por comunidade (hash do id + viés pelo
 * topicCount) pra ficar estável entre renders/sessões e parecer
 * correlacionado com o tamanho da comunidade. Só renderiza em cards
 * trending, então é sempre um valor "alto" plausível. */
function postsLast24h(id: string, topicCount: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  /* 8..41 de base, com um empurrãozinho proporcional aos tópicos. */
  return 8 + (h % 34) + Math.min(12, Math.floor(topicCount / 4));
}

export default function CommunityPanel({ open, onClose }: CommunityPanelProps) {
  const [view, setView] = useState<View>({ kind: 'list' });

  /* Fechar com saída discreta: marca `closing` (remove o .panelOpen
   *  → o painel reproduz a transição de saída de 320ms) e só então
   *  navega/desmonta. Sem isso o onClose roteava na hora ("seco"). */
  const [closing, setClosing] = useState(false);
  const handleClose = useCallback(() => {
    setClosing(true);
    window.setTimeout(onClose, 300);
  }, [onClose]);

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
      else if (view.kind === 'create') setView({ kind: 'list' });
      else handleClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, view, handleClose]);

  /* Per feedback "quando eu entro em um tópico de comunidade e
   * clico na seta de voltar, ele volta para a home e não ao item
   * anterior": no mobile a back arrow visível é a do
   * MobileRouteHeader (a `.header` interna do panel está hidden
   * via media query). Esse handler intercepta o CustomEvent
   * `app:route-back` que o MobileRouteHeader dispatcha, e em views
   * nested (topic/detail/create) chama preventDefault pra que o
   * back do header não navegue pra `/app`, e em vez disso volte
   * 1 nível no view-state machine — espelhando o handler de
   * Escape acima.
   *
   * Em view 'list' deixa passar (sem preventDefault) — o
   * MobileRouteHeader cai pro fallback router.push('/app'). */
  useEffect(() => {
    if (!open) return;
    const onRouteBack = (e: Event) => {
      if (view.kind === 'topic') {
        e.preventDefault();
        setView({ kind: 'detail', slug: view.slug });
      } else if (view.kind === 'detail') {
        e.preventDefault();
        setView({ kind: 'list' });
      } else if (view.kind === 'create') {
        e.preventDefault();
        setView({ kind: 'list' });
      }
      /* view.kind === 'list': não intercepta, deixa o
       * MobileRouteHeader rotear pra /app naturalmente. */
    };
    window.addEventListener('app:route-back', onRouteBack);
    return () => window.removeEventListener('app:route-back', onRouteBack);
  }, [open, view]);

  return (
    <aside
      className={`${styles.panel} ${open && !closing ? styles.panelOpen : ''}`}
      role="dialog"
      aria-label="Comunidade"
      aria-hidden={!open}
    >
      {view.kind === 'list' && (
        <CommunityListView
          onClose={handleClose}
          onOpenCommunity={(slug) => setView({ kind: 'detail', slug })}
          onOpenCreate={() => setView({ kind: 'create' })}
        />
      )}
      {view.kind === 'create' && (
        <CommunityCreateView
          onBack={() => setView({ kind: 'list' })}
          onClose={handleClose}
          onCreated={(slug) => setView({ kind: 'detail', slug })}
        />
      )}
      {view.kind === 'detail' && (
        <CommunityDetailView
          slug={view.slug}
          onBack={() => setView({ kind: 'list' })}
          onOpenTopic={(topicId) => setView({ kind: 'topic', slug: view.slug, topicId })}
          onLeftCommunity={() => setView({ kind: 'list' })}
          onClose={handleClose}
        />
      )}
      {view.kind === 'topic' && (
        <TopicDetailView
          slug={view.slug}
          topicId={view.topicId}
          onBack={() => setView({ kind: 'detail', slug: view.slug })}
          onClose={handleClose}
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
  centerTitle,
  stacked,
  stackedTitle,
}: {
  title: string;
  onBack?: () => void;
  onClose: () => void;
  /** Optional trailing slot (kebab menu, etc.) shown left of the close button. */
  trailing?: React.ReactNode;
  /** Quando true, o título recebe `text-align: center`. Usado pelas
   *  subviews simétricas (back + título + close) — ex: "Nova
   *  comunidade" — per product feedback "centralize o nome da
   *  seção no centro do box no header". Default false porque a
   *  view 'list' não tem back (assimétrico), e centralizar
   *  deixaria o texto fora do centro visual. */
  centerTitle?: boolean;
  /** Layout em COLUNA: seta de voltar em cima, título embaixo
   *  alinhado à esquerda e em 24px, SEM a seta de fechar à direita.
   *  Usado só pela tela "Nova comunidade". */
  stacked?: boolean;
  /** Igual ao stacked (título 24px embaixo, à esquerda) MAS mantém os
   *  controles da direita (kebab + fechar) na primeira linha. Usado no
   *  detalhe de comunidade existente. */
  stackedTitle?: boolean;
}) {
  return (
    <header className={`${styles.header} ${stacked ? styles.headerStacked : ''} ${stackedTitle ? styles.headerStackedTitle : ''}`}>
      {onBack && (
        <button
          type="button"
          className={styles.backBtn}
          onClick={onBack}
          aria-label="Voltar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <h2
        className={`${styles.title} ${centerTitle ? styles.titleCentered : ''} ${stacked ? styles.titleStacked : ''}`}
      >
        {title}
      </h2>
      {trailing}
      {/* Seta de fechar à direita — omitida no layout stacked (Nova
       *  comunidade) per feedback "remova a seta que está à direita". */}
      {!stacked && (
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Fechar"
        >
          {/* Seta à direita (substitui o X), igual ao drawer Minha Conta. */}
          <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3.5 9h11M10 4.5l4.5 4.5-4.5 4.5" />
          </svg>
        </button>
      )}
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
  onOpenCreate,
}: {
  onClose: () => void;
  onOpenCommunity: (slug: string) => void;
  /** Solicita ao parent que troque pra view 'create' inline.
   *  Substitui o `setCreateOpen(true)` que abria o CreateCommunityModal
   *  como overlay — agora vira subview do próprio painel. */
  onOpenCreate: () => void;
}) {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.id ?? null);
  const canCreate = (profile?.fanpoints ?? 0) >= CREATE_FP_THRESHOLD;

  const [query, setQuery] = useState('');
  /* Per spec "adicione duas tabs, semelhante às tabs que existem
   * em Chat, com os nomes Geral e Shows". 'general' = lista do
   * backend (atual); 'shows' = SHOW_COMMUNITIES mocados (read-only
   * — só admin cria via equipe). Filtro acontece após o fetch:
   * o hook segue puxando do servidor pra que membership de
   * comunidades gerais reflita corretamente. */
  const [activeTab, setActiveTab] = useState<'general' | 'shows'>('general');
  const [renameTarget, setRenameTarget] = useState<ApiCommunityCard | null>(null);
  const { items, loading, refresh } = useCommunities({
    enabled: true,
    search: query,
  });

  /* Lista final exibida: depende da tab. Shows também respeita
   * o search (case-insensitive sobre name+description). */
  const displayedItems: ApiCommunityCard[] =
    activeTab === 'shows'
      ? SHOW_COMMUNITIES.filter((c) => {
          if (!query.trim()) return true;
          const q = query.trim().toLowerCase();
          return (
            c.name.toLowerCase().includes(q) ||
            (c.description ?? '').toLowerCase().includes(q)
          );
        })
      : items;

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

        {/* Tabs Geral | Shows — badges idênticos ao filtro de período
         *  (Hoje/Semana/Mês/Ano) do modal Ranking Fanverse: pílula
         *  branca translúcida, ativa = fundo mais claro + texto
         *  branco. Snap puro (sem pill animado). */}
        <div
          className={styles.tabsRow}
          role="tablist"
          aria-label="Tipo de comunidade"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'general'}
            className={styles.tabBtn}
            onClick={() => setActiveTab('general')}
          >
            Geral
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'shows'}
            className={styles.tabBtn}
            onClick={() => setActiveTab('shows')}
          >
            Shows
          </button>
        </div>

        {loading && activeTab === 'general' && items.length === 0 ? (
          <div style={{ padding: '8px 16px' }}>
            <Skeleton count={6} height={72} gap={10} ariaLabel="Carregando comunidades" />
          </div>
        ) : displayedItems.length === 0 ? (
          <div className={styles.emptyState}>
            {query
              ? `Nenhuma comunidade para "${query}".`
              : activeTab === 'shows'
                ? 'Nenhuma comunidade de show no momento.'
                : 'Nenhuma comunidade ainda.'}
          </div>
        ) : (
          <ul className={styles.cardList}>
            {displayedItems.map((c) => {
              const isCreator = c.creatorId === user?.id;
              /* Show communities são read-only do ponto de vista
               *  do user — só admin gerencia. Skip edit/leave/join
               *  e deixa só Denunciar no kebab. */
              const isShow = isShowCommunitySlug(c.slug);
              const posts24h = postsLast24h(c.id, c.topicCount);
              const actions: KebabAction[] = [];
              if (isCreator && !isShow) {
                actions.push({
                  key: 'edit',
                  label: 'Editar nome',
                  onClick: () => setRenameTarget(c),
                });
              }
              if (c.isMember && !isCreator && !isShow) {
                actions.push({
                  key: 'leave',
                  label: 'Sair',
                  onClick: () => void onLeave(c),
                });
              }
              if (!c.isMember && !isShow) {
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
                  {/* whileHover: card sobe 2px + escala 1.01 ao
                   *  hover desktop. Spring snappy. tap state pra
                   *  feedback de press (mobile + desktop). */}
                  <motion.div
                    className={styles.communityCard}
                    whileHover={{ y: -2, scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                  >
                    <button
                      type="button"
                      className={styles.cardOpenBtn}
                      onClick={() => onOpenCommunity(c.slug)}
                    >
                      {c.imageUrl ? (
                        <span className={styles.cardThumbWrap}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.imageUrl} alt="" className={styles.cardThumb} />
                          {/* Badge "TOUR 2026" — só nas show
                           *  communities, per spec "com um badge
                           *  TOUR 2026 pequeno na parte de baixo". */}
                          {isShowCommunitySlug(c.slug) && (
                            <span className={styles.cardThumbBadge} aria-hidden="true">
                              TOUR 2026
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className={styles.cardThumbPlaceholder} aria-hidden="true" />
                      )}
                      <div className={styles.cardBody}>
                        <div className={styles.cardTitleRow}>
                          <TruncatedText className={styles.cardTitle}>{c.name}</TruncatedText>
                        </div>
                        <span className={styles.cardMeta}>
                          {/* "N membro(s)" → número + ícone: 1 user se
                            * for 1, dois users se for mais de um. */}
                          <span className={styles.cardMetaMembers}>
                            {c.memberCount.toLocaleString('pt-BR')}
                            {c.memberCount === 1 ? <IconMemberSingle /> : <IconMemberGroup />}
                          </span>
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
                            {/* 🔥 + seta verde + nº de posts nas últimas
                              * 24h (no lugar do antigo chip "Mais ativa
                              * hoje"). Número via postsLast24h (mock
                              * determinístico — ver helper). */}
                            <span
                              className={styles.activityStat}
                              aria-label={`${posts24h} posts nas últimas 24 horas`}
                            >
                              <span aria-hidden="true">🔥</span>
                              <svg
                                className={styles.activityArrow}
                                viewBox="0 0 24 24"
                                fill="none"
                                aria-hidden="true"
                              >
                                <path
                                  d="M12 19V5M12 5l-6 6M12 5l6 6"
                                  stroke="currentColor"
                                  strokeWidth="2.4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              <span className={styles.activityCount}>{posts24h}</span>
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
                        aria-label={`Participar na comunidade ${c.name}`}
                      >
                        {/* "Entrar" → "Participar" + estilo gradient-border
                         * per spec "substitua o cta Entrar por Participar
                         * com o mesmo estilo de botão que tem no meu
                         * perfil/comunidades". Label dentro de
                         * .cardJoinPillLabel pra ficar acima do gradient. */}
                        <span className={styles.cardJoinPillLabel}>Participar</span>
                      </button>
                    )}
                    <KebabMenu actions={actions} />
                  </motion.div>
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
          onClick={onOpenCreate}
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

      {/* O modal de "Nova comunidade" virou subview inline do
       *  CommunityPanel (`view.kind === 'create'`) per product
       *  feedback "usar o mesmo espaço, estilo e posição" do
       *  painel hospedeiro. O parent dispara `onOpenCreate()` —
       *  controla a navegação via view-state. */}

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

/* ── View 1.5: Create community (subview inline) ─────────────────
 * Substitui o antigo `CreateCommunityModal` overlay per product
 * feedback "o modal de nova comunidade pode ser adaptado pra a
 * experiencia ser no box que já está aberto, usar o mesmo espaço,
 * estilo e posição". O form ocupa o painel inteiro com header
 * (← Voltar) e CTA "Criar" no rodapé. Reutiliza as classes
 * `.modalField` etc do CSS module porque elas só estilizam
 * inputs/labels — não dependem do `.modalBackdrop`. */
function CommunityCreateView({
  onBack,
  onClose,
  onCreated,
}: {
  onBack: () => void;
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
    <>
      <HeaderBar
        title="Nova comunidade"
        onBack={onBack}
        onClose={onClose}
        stacked
      />
      <form className={styles.body} onSubmit={handleSubmit}>
        <label className={styles.modalField}>
          <span>Nome</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
            autoFocus
            disabled={submitting}
          />
        </label>
        <label className={styles.modalField}>
          <span>Descrição (opcional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={4}
            disabled={submitting}
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
            disabled={submitting}
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
          <button
            type="button"
            className={styles.modalCancel}
            onClick={onBack}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className={styles.modalSubmit}
            disabled={!name.trim() || submitting}
          >
            {submitting ? 'Criando…' : 'Criar'}
          </button>
        </div>
      </form>
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
      /* Short-circuit pra show communities: dados vêm do mock
       *  local. Mantém o mesmo shape (ApiCommunityDetail +
       *  ApiCommunityTopic[]) pro renderer não precisar saber a
       *  origem. Filter do search idem ao backend (case-insensitive
       *  sobre title+body). */
      if (isShowCommunitySlug(slug)) {
        const det = getShowCommunityDetail(slug);
        const allTopics = getShowCommunityTopics(slug);
        const q = query.trim().toLowerCase();
        const top = q
          ? allTopics.filter(
              (t) =>
                t.title.toLowerCase().includes(q) ||
                (t.body ?? '').toLowerCase().includes(q),
            )
          : allTopics;
        setCommunity(det);
        setTopics(top);
        return;
      }
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
        <HeaderBar title="Comunidade" onBack={onBack} onClose={onClose} stackedTitle />
        <div className={styles.body}>
          <div className={styles.emptyState}>{loading ? 'Carregando…' : 'Não encontrada.'}</div>
        </div>
      </>
    );
  }

  // Kebab actions for the detail header. Editar shows only for the
  // creator; Sair only for non-creator members; Denunciar always.
  // Show communities são read-only — sem edit/sair, só Denunciar.
  const isShow = isShowCommunitySlug(slug);
  const headerActions: KebabAction[] = [];
  if (community.isCreator && !isShow) {
    headerActions.push({
      key: 'edit',
      label: 'Editar nome',
      onClick: () => setRenameOpen(true),
    });
  }
  if (community.isMember && !community.isCreator && !isShow) {
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
        stackedTitle
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

      {/* Footer: smaller "Novo tópico" CTA below the topics list.
       *  Hidden em show communities — só admin cria tópico lá. */}
      {community.isMember && !isShow && (
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
    /* Mock branch — comments fixos pra show topics. */
    if (isShowCommunitySlug(slug)) {
      setComments(getShowTopicComments(topicId));
      return;
    }
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
    /* Short-circuit pra show communities — mesmo padrão do
     *  CommunityDetailView. */
    if (isShowCommunitySlug(slug)) {
      setLoading(true);
      const t = getShowCommunityTopic(slug, topicId);
      const c = getShowCommunityDetail(slug);
      setTopic(t);
      setCommunity(c);
      setComments(getShowTopicComments(topicId));
      setLoading(false);
      return;
    }
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
    /* Show communities: append local-only (sem backend). O
     *  comentário some no próximo refresh — é simulação. */
    if (isShowCommunitySlug(slug)) {
      const localId = `local-${topicId}-${comments.length + 1}`;
      const local: ApiCommunityTopicComment = {
        id: localId,
        topicId,
        parentCommentId: replyTarget?.id ?? null,
        body,
        createdAt: new Date().toISOString(),
        deletedAt: null,
        author: {
          id: user?.id ?? null,
          name: user?.name ?? user?.email?.split('@')[0] ?? 'Você',
          avatarUrl: user?.avatarUrl ?? null,
        },
        reactions: { count: 0, mine: false },
        replyCount: 0,
      };
      setComments((prev) => [...prev, local]);
      setDraft('');
      setReplyTarget(null);
      setSubmitting(false);
      return;
    }
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
      /* Show topics: sem backend — o flip optimistic acima já é
       *  o resultado final. */
      if (isShowCommunitySlug(slug)) return;
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

/* `CreateCommunityModal` foi removido — virou subview inline
 * `CommunityCreateView` mais acima neste arquivo, dirigido pelo
 * view-state machine do CommunityPanel. */

/* Wrapper que renderiza os modais via React Portal direto no
 * document.body. Necessário porque o CommunityPanel `.panel`
 * usa `transform` (slide-in animation), o que cria um containing
 * block — qualquer `position: fixed` filho fica relativo ao
 * panel (398px) ao invés da viewport, resultando em modais
 * cortados / mal posicionados no desktop. Portal escapa esse
 * contexto e pinta no body, onde `position: fixed` se comporta
 * como esperado. SSR-safe via guard `typeof document`. */
function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
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
    <ModalPortal>
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
    </ModalPortal>
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
    <ModalPortal>
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
    </ModalPortal>
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
    <ModalPortal>
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
                  {m.name ?? 'Fã'}
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
    </ModalPortal>
  );
}
