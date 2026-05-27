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

  // Reset the search field whenever the sidebar opens — stale filter
  // text from a previous session would confuse the user.
  useEffect(() => {
    if (open) setQuery('');
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

  // DMs only — the global Superchat lives at the bottom of the
  // screen via SuperchatTrigger, doesn't belong in this list.
  const dms = useMemo(
    () =>
      conversations.filter((c) =>
        c.type === 'dm'
          ? !!c.otherUser
          : c.type === 'group' && !!c.name,
      ),
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
        {/* Era um ícone "two heads" (criar grupo) ao lado do título.
         *  Per product feedback "substitua o ícone de Criar grupo
         *  por um botão Novo grupo", virou um pill texto. Usa o
         *  estilo dedicado .newGroupBtn (pill mais largo que o
         *  .newBtn quadrado do "+", ver ConversationsSidebar.module.css). */}
        <button
          type="button"
          className={styles.newGroupBtn}
          onClick={onNewGroup}
          aria-label="Novo grupo"
          title="Novo grupo"
        >
          Novo grupo
        </button>
        <button
          type="button"
          className={styles.newBtn}
          onClick={onNewConversation}
          aria-label="Nova conversa"
          title="Nova conversa"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </button>
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
    </aside>
  );
}
