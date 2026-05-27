'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ApiConversationSummary } from '@/lib/api/types';
import { stripReplyPrefix } from './MessageBody';
import VerifiedBadge from './VerifiedBadge';
import styles from './ConversationsSidebar.module.css';

interface Props {
  open: boolean;
  conversations: ApiConversationSummary[];
  activeId: string | null;
  /** Set of online user ids — drives the green/gray status dash per row. */
  onlineUserIds?: ReadonlySet<string>;
  onClose: () => void;
  onOpenConversation: (conversationId: string) => void;
  /** Fired when the user clicks "+ Nova conversa" — typically opens UserPicker. */
  onNewConversation: () => void;
  /** Fired when the user clicks "Novo grupo" — opens UserPicker in group mode. */
  onNewGroup: () => void;
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
  onNewConversation,
  onNewGroup,
}: Props) {
  const [query, setQuery] = useState('');
  /* Estado do menu expansível do FAB. Per product feedback "Ao
   * clicar no botão flutuante, abre duas opções logo acima:
   * Nova conversa e Novo grupo". */
  const [fabOpen, setFabOpen] = useState(false);

  // Reset the search field whenever the sidebar opens — stale filter
  // text from a previous session would confuse the user.
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  // Quando o sidebar fecha, o menu do FAB também fecha — evita ele
  // ficar aberto invisível e ressurgir na próxima abertura.
  useEffect(() => {
    if (!open) setFabOpen(false);
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
    const q = query.trim().toLowerCase();
    if (!q) return dms;
    return dms.filter((c) => {
      const name = (
        c.type === 'group' ? c.name ?? '' : c.otherUser?.name ?? ''
      ).toLowerCase();
      return name.includes(q);
    });
  }, [dms, query]);

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

      <div className={styles.list}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            {query
              ? `Nenhuma conversa para "${query}".`
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

            return (
              <button
                key={c.id}
                type="button"
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
              </button>
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
              onNewConversation();
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
              onNewGroup();
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
