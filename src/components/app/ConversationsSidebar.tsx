'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { ApiConversationSummary } from '@/lib/api/types';
import { stripReplyPrefix } from './MessageBody';
import VerifiedBadge from './VerifiedBadge';
import { showAppToast } from './AppToast';
import { confirmDialog } from './ConfirmDialog';
import UserPicker from './UserPicker';
import styles from './ConversationsSidebar.module.css';

interface Props {
  open: boolean;
  conversations: ApiConversationSummary[];
  activeId: string | null;
  /** Set of online user ids — drives the green/gray status dash per row. */
  onlineUserIds?: ReadonlySet<string>;
  onClose: () => void;
  onOpenConversation: (conversationId: string) => void;
  /** Callback de "iniciar DM com este usuário" — agora disparado
   *  pelo `UserPicker` inline hospedado dentro do próprio sidebar
   *  (antes era um modal overlay no parent). */
  onPickUser: (userId: string) => void;
  /** Callback de "criar grupo" — também disparado pelo UserPicker
   *  inline em modo group. */
  onCreateGroup: (args: { name: string; memberIds: string[] }) => void;
  /** Disparado depois que o user escolheu "Apagar conversa" no
   *  kebab e o backend confirmou o hide. Parent deve refresh da
   *  lista pra remover a row sumida. */
  onConversationHidden?: (conversationId: string) => void;
}

/**
 * Full-list conversations drawer. Slides in from the right edge,
 * similar to the chat detail panel but wider, with:
 *
 *   - Header (title + close + "+" trigger for a new conversation)
 *   - Search field filtering by user name (case-insensitive)
 *   - Scrollable list of ALL DMs with avatar, name, last message,
 *     unread badge, and online/offline indicator
 *
 * The home/map dock continues to show only the last 7 conversations
 * for compactness — this sidebar is the "ver tudo" affordance for
 * anything beyond that.
 */
export default function ConversationsSidebar({
  open,
  conversations,
  activeId,
  onlineUserIds,
  onClose,
  onOpenConversation,
  onPickUser,
  onCreateGroup,
  onConversationHidden,
}: Props) {
  const [query, setQuery] = useState('');
  /* Filtro por tipo de interação. null = mostrar tudo (default);
   * 'dm' = só conversas 1:1; 'group' = só grupos. Per product
   * feedback "dois pequenos botões de Conversas e Grupos, para
   * filtrar esses dois tipos de interação". Clicar o chip ativo
   * de novo desativa (volta pra null). */
  const [typeFilter, setTypeFilter] = useState<'dm' | 'group' | null>(null);
  /* Estado do menu expansível do FAB. Per product feedback "Ao
   * clicar no botão flutuante, abre duas opções logo acima:
   * Nova conversa e Novo grupo". */
  const [fabOpen, setFabOpen] = useState(false);
  /* Subview inline do UserPicker (substitui o modal overlay).
   *   - null      → mostra a lista de conversas (default)
   *   - 'single'  → mostra UserPicker em single mode (Nova conversa)
   *   - 'group'   → mostra UserPicker em group mode (Novo grupo)
   * Per product feedback "O modal de novo grupo, nova conversa...
   * pode ser adaptado para a experiencia ser no box que já está
   * aberto do chat mesmo, digo usar o mesmo espaço, estilo e
   * posição". O picker vira subview do painel hospedeiro em vez
   * de um overlay sobre tudo. */
  const [createView, setCreateView] = useState<'single' | 'group' | null>(null);
  /* Kebab por linha. Guardamos o id da conversa cujo menu está
   * aberto — null significa "todos fechados". Click outside fecha
   * via listener global; click em outra linha troca pra ela. */
  const [kebabOpenId, setKebabOpenId] = useState<string | null>(null);
  const [hidingId, setHidingId] = useState<string | null>(null);
  const kebabMenuRef = useRef<HTMLDivElement>(null);

  // Click fora do menu fecha-o. Listener global registrado só
  // quando há menu aberto pra não dar overhead constante.
  useEffect(() => {
    if (!kebabOpenId) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (kebabMenuRef.current && !kebabMenuRef.current.contains(target)) {
        // Click em outro kebab trigger é detectado por outro
        // handler na própria row — aqui só fechamos quando o
        // click foi em algo COMPLETAMENTE fora.
        setKebabOpenId(null);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [kebabOpenId]);

  const handleHideConversation = async (id: string) => {
    if (hidingId) return;
    setKebabOpenId(null);
    const ok = await confirmDialog({
      title: 'Apagar essa conversa?',
      body: 'Ela some apenas pra você; a outra parte continua vendo tudo.',
      confirmLabel: 'Apagar',
      tone: 'danger',
    });
    if (!ok) return;
    setHidingId(id);
    setKebabOpenId(null);
    try {
      const res = await fetch(`/api/conversations/${id}/hide`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        showAppToast({
          message: 'Não foi possível apagar a conversa. Tente de novo.',
          tone: 'error',
        });
        return;
      }
      showAppToast({
        message: 'Conversa apagada.',
        tone: 'success',
      });
      onConversationHidden?.(id);
    } catch (err) {
      console.error('hide conversation failed:', err);
      showAppToast({
        message: 'Falha de conexão. Tente de novo.',
        tone: 'error',
      });
    } finally {
      setHidingId(null);
    }
  };

  // Reset the search field + type filter whenever the sidebar opens —
  // stale filter state from a previous session would confuse the user.
  useEffect(() => {
    if (open) {
      setQuery('');
      setTypeFilter(null);
    }
  }, [open]);

  // Quando o sidebar fecha, o menu do FAB também fecha — evita ele
  // ficar aberto invisível e ressurgir na próxima abertura. Mesmo
  // raciocínio pro inline UserPicker: se o painel sumiu, a subview
  // de criação não deve ressurgir no próximo open.
  useEffect(() => {
    if (!open) {
      setFabOpen(false);
      setCreateView(null);
    }
  }, [open]);

  // Escape closes the drawer — standard floating UI behavior, matches
  // the chat panel + kebab menu in LiveChatPanel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // DMs + grupos com nome. Filtra o "Superchat" (com ícone do
  // chapéu) per product feedback "Remova o item ou grupo
  // Superchat, que tem o chapeu como icone, marcado como tendo
  // 28 membros". Detecção por nome (mesma do LiveChatStack)
  // porque a API não expõe slug de conversa.
  const dms = useMemo(
    () =>
      conversations.filter((c) => {
        if (c.type === 'dm') return !!c.otherUser;
        if (c.type !== 'group' || !c.name) return false;
        if (c.name === 'Superchat') return false;
        return true;
      }),
    [conversations],
  );

  const filtered = useMemo(() => {
    /* Aplica o filtro de tipo primeiro (Conversas vs Grupos) — fica
     * mais barato derivar a base reduzida antes da text search. */
    const base = typeFilter
      ? dms.filter((c) =>
          typeFilter === 'group' ? c.type === 'group' : c.type === 'dm',
        )
      : dms;
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((c) => {
      const name = (
        c.type === 'group' ? c.name ?? '' : c.otherUser?.name ?? ''
      ).toLowerCase();
      return name.includes(q);
    });
  }, [dms, query, typeFilter]);

  /* Subview inline do UserPicker. Quando `createView` está setado,
   * o painel hospeda o picker no lugar da lista de conversas —
   * o picker traz seu próprio header (com back button), input de
   * nome (group mode), search e footer/CTA. O outer `<aside>`
   * permanece o mesmo pra preservar a animação de slide-in. */
  if (open && createView !== null) {
    const close = () => setCreateView(null);
    return (
      <aside
        className={`${styles.panel} ${styles.panelOpen}`}
        role="dialog"
        aria-label={createView === 'group' ? 'Novo grupo' : 'Iniciar conversa'}
      >
        {createView === 'group' ? (
          <UserPicker
            inline
            open
            mode="group"
            onClose={close}
            recentConversations={conversations}
            onCreateGroup={(args) => {
              onCreateGroup(args);
              setCreateView(null);
            }}
          />
        ) : (
          <UserPicker
            inline
            open
            onClose={close}
            onPick={(uid) => {
              onPickUser(uid);
              setCreateView(null);
            }}
          />
        )}
      </aside>
    );
  }

  return (
    <aside
      className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
      role="dialog"
      aria-label="Todas as conversas"
      aria-hidden={!open}
    >
      <header className={styles.header}>
        <h2 className={styles.title}>Chat</h2>
        {/* Os botões "Nova conversa" / "Novo grupo" SAÍRAM do
         *  header per product feedback. Agora vivem dentro de um
         *  menu expansível ancorado ao FAB lilás no canto
         *  inferior direito do painel (ver `.fab` + `.fabMenu`
         *  abaixo). Mesmo padrão do CommunityPanel. */}
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Fechar conversas"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className={styles.searchWrap}>
        <svg className={styles.searchIcon} viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="7" cy="7" r="5" />
          <path d="M14 14l-3-3" />
        </svg>
        <input
          className={styles.searchInput}
          type="search"
          autoComplete="off"
          placeholder="Buscar conversa…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Filtros por tipo — chips com motion Tab select. Pill roxo
       *  (layoutId="chatFilterPill") desliza entre Conversas/Grupos
       *  quando o user troca; se ambos forem desativados (null), o
       *  pill desmonta com fade automático via AnimatePresence
       *  implícito do layoutId. */}
      <div className={styles.filterRow} role="group" aria-label="Filtrar por tipo">
        <button
          type="button"
          className={styles.filterChip}
          onClick={() => setTypeFilter((cur) => (cur === 'dm' ? null : 'dm'))}
          aria-pressed={typeFilter === 'dm'}
        >
          {typeFilter === 'dm' && (
            <motion.span
              layoutId="chatFilterPill"
              className={styles.filterChipPill}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            />
          )}
          <span className={styles.filterChipLabel}>Conversas</span>
        </button>
        <button
          type="button"
          className={styles.filterChip}
          onClick={() => setTypeFilter((cur) => (cur === 'group' ? null : 'group'))}
          aria-pressed={typeFilter === 'group'}
        >
          {typeFilter === 'group' && (
            <motion.span
              layoutId="chatFilterPill"
              className={styles.filterChipPill}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            />
          )}
          <span className={styles.filterChipLabel}>Grupos</span>
        </button>
      </div>

      <div className={styles.list}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            {query
              ? `Nenhuma conversa para "${query}".`
              : typeFilter === 'group'
                ? 'Você ainda não está em nenhum grupo.'
                : typeFilter === 'dm'
                  ? 'Você ainda não tem conversas individuais.'
                  : 'Você ainda não tem conversas. Toque em + para começar.'}
          </div>
        ) : (
          filtered.map((c) => {
            const isGroup = c.type === 'group';
            const u = c.otherUser;
            const seedId = isGroup ? c.id : (u?.id ?? c.id);
            const displayName = isGroup
              ? (c.name ?? 'Grupo')
              : (u?.name ?? 'Anônimo');
            // The global Superchat group surfaces in this list as
            // a regular `type: 'group'` row. Per product feedback
            // its avatar should be the Ana Castela cowboy-hat
            // icon (icon-chapeu-ac.svg). Real DMs / groups
            // without an uploaded image fall back to the generic
            // silhouette (`/avatar-placeholder.svg`) per product
            // feedback "fez login e foi utilizado uma foto padrão
            // no sistema e não foi utilizado o avatar genérico" —
            // previous round used a deterministic pravatar.cc
            // photo which painted a random stranger's face on
            // every row whose user/group hadn't uploaded media.
            const isSuperchat = isGroup && c.name === 'Superchat';
            const img = isSuperchat
              ? '/icon-chapeu-ac.svg'
              : isGroup
                ? (c.imageUrl ?? '/avatar-placeholder.svg')
                : (u?.avatarUrl ?? '/avatar-placeholder.svg');
            // Groups have no presence concept — always rendered as
            // "active" so they don't get the offline grayscale.
            const isOnline = isGroup
              ? true
              : (onlineUserIds?.has(u?.id ?? '') ?? false);
            const isVerified = !isGroup && !!u?.verified;
            const isActive = activeId === c.id;
            const previewRaw = c.lastMessage?.body ?? '';
            // Strip any reply-prefix so the preview shows the
            // user's actual last sentence, not the quoted block.
            const preview = previewRaw ? stripReplyPrefix(previewRaw) : '';

            const isKebabOpen = kebabOpenId === c.id;
            return (
              /* Row é div (não button) pra que o kebab interno
               * seja um sibling button — evita nested buttons
               * (inválido HTML). Acessibilidade via role/tabIndex
               * + keyboard handler em Enter/Space. */
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                className={`${styles.row} ${isActive ? styles.rowActive : ''}`}
                onClick={() => {
                  // Pick the conversation — DO NOT also fire onClose
                  // here. `onClose` is wired by the parent to
                  // `router.push('/app')` (close the whole chat
                  // surface), which routed the user back to the
                  // map between selecting a thread and the
                  // LiveChatPanel sliding in. The result was a
                  // disorienting "list → home flash → detail"
                  // sequence the user reported as an anomaly.
                  //
                  // The detail panel's own back arrow (mobile) and
                  // × button (desktop) handle dismissal; the
                  // sidebar's onClose is now reserved strictly for
                  // the explicit close button at the top.
                  onOpenConversation(c.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenConversation(c.id);
                  }
                }}
              >
                <span className={styles.avatarWrap}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img}
                    alt=""
                    className={`${styles.avatar} ${isOnline ? styles.avatarOnline : styles.avatarOffline} ${isGroup ? styles.avatarGroup : ''}`}
                    onError={(e) => {
                      // Skip the silhouette fallback for the
                      // Superchat row — we want the hat icon to
                      // stay even if the SVG had a transient
                      // load hiccup (or if a future deploy moves
                      // the asset path).
                      if (isSuperchat) return;
                      const img = e.currentTarget;
                      const fb = '/avatar-placeholder.svg';
                      if (img.src.endsWith(fb)) return;
                      img.src = fb;
                    }}
                  />
                  {/* Status dash only for DMs — groups don't have a
                      single "online" state. */}
                  {!isGroup && (
                    <span
                      className={`${styles.statusDash} ${isOnline ? styles.statusDashOnline : styles.statusDashOffline}`}
                      aria-hidden="true"
                    />
                  )}
                  {isVerified && (
                    <span className={styles.verifiedBadge}>
                      <VerifiedBadge size={14} />
                    </span>
                  )}
                </span>

                <span className={styles.rowInfo}>
                  <span className={styles.rowName}>
                    {displayName}
                    {isVerified && (
                      <VerifiedBadge size={13} className={styles.inlineVerified} />
                    )}
                  </span>
                  {preview && (
                    <span className={styles.rowPreview}>{preview}</span>
                  )}
                </span>

                {c.unreadCount > 0 && (
                  <span className={styles.unreadBadge} aria-hidden="true">
                    {c.unreadCount > 9 ? '9+' : c.unreadCount}
                  </span>
                )}

                {/* Kebab: 3 dots verticais. stopPropagation pra que
                 * o click NÃO abra a conversa. */}
                <button
                  type="button"
                  className={styles.kebabBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    setKebabOpenId((cur) => (cur === c.id ? null : c.id));
                  }}
                  aria-label="Mais opções da conversa"
                  aria-haspopup="menu"
                  aria-expanded={isKebabOpen}
                  disabled={hidingId === c.id}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <circle cx="7" cy="3" r="1.3" fill="currentColor" />
                    <circle cx="7" cy="7" r="1.3" fill="currentColor" />
                    <circle cx="7" cy="11" r="1.3" fill="currentColor" />
                  </svg>
                </button>

                {isKebabOpen && (
                  <div
                    ref={kebabMenuRef}
                    className={styles.kebabMenu}
                    role="menu"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className={`${styles.kebabItem} ${styles.kebabItemDanger}`}
                      role="menuitem"
                      onClick={() => handleHideConversation(c.id)}
                      disabled={hidingId === c.id}
                    >
                      Apagar conversa
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* FAB flutuante no canto inferior direito do panel — mesmo
       *  visual do "+" do CommunityPanel (lilás, 52×52, glow). Ao
       *  clicar, abre menu com duas opções "Nova conversa" e
       *  "Novo grupo" logo acima. O backdrop transparente em
       *  toda a viewport captura outside-clicks pra fechar. */}
      {fabOpen && (
        <div
          className={styles.fabBackdrop}
          onClick={() => setFabOpen(false)}
          aria-hidden="true"
        />
      )}
      {fabOpen && (
        <div className={styles.fabMenu} role="menu">
          <button
            type="button"
            role="menuitem"
            className={styles.fabMenuItem}
            onClick={() => {
              setFabOpen(false);
              setCreateView('single');
            }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M8 3v10M3 8h10" />
            </svg>
            Nova conversa
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.fabMenuItem}
            onClick={() => {
              setFabOpen(false);
              setCreateView('group');
            }}
          >
            <svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="6.5" cy="6.5" r="2.5" />
              <path d="M2 15c0-2.2 2-4 4.5-4S11 12.8 11 15" />
              <circle cx="13" cy="5.5" r="2" />
              <path d="M12 14c0-1.7 1.6-3 3.5-3s.5 0 .5 0" />
            </svg>
            Novo grupo
          </button>
        </div>
      )}
      <button
        type="button"
        className={`${styles.fab} ${fabOpen ? styles.fabActive : ''}`}
        onClick={() => setFabOpen((v) => !v)}
        aria-label={fabOpen ? 'Fechar menu' : 'Nova conversa ou grupo'}
        aria-expanded={fabOpen}
        aria-haspopup="menu"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </aside>
  );
}
