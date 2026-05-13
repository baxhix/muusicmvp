'use client';

import { useState } from 'react';
import type { ApiConversationSummary } from '@/lib/api/types';
import styles from './LiveChatStack.module.css';

interface Props {
  conversations: ApiConversationSummary[];
  activeId: string | null;
  /**
   * Set of currently-online user ids. Each avatar gets a green/gray
   * status dot + the offline-grayscale treatment based on whether
   * its `otherUser.id` is in this set. Driven by `useLiveUsers`
   * (presence socket events).
   */
  onlineUserIds?: ReadonlySet<string>;
  onOpen: (conversationId: string) => void;
  onAddClick: () => void;
  /**
   * Fired when the user taps the "ver tudo" overflow trigger — opens
   * the ConversationsSidebar which shows ALL conversations (the dock
   * itself only renders the latest few for compactness).
   */
  onShowAll?: () => void;
}

/** Max DM avatars rendered on the dock. The rest are reachable via
 *  the "ver tudo" trigger that pops the full ConversationsSidebar. */
const DOCK_LIMIT = 7;

/**
 * Dock-style horizontal chat list — real conversations from /api/conversations.
 * Sits at the right edge above the now-playing player. Click avatar opens
 * the corresponding LiveChatPanel.
 */
export default function LiveChatStack({
  conversations,
  activeId,
  onlineUserIds,
  onOpen,
  onAddClick,
  onShowAll,
}: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  // Filter to DMs only — the global Superchat is opened via SuperchatTrigger.
  const allDms = conversations.filter((c) => c.type === 'dm' && c.otherUser);
  const dms = allDms.slice(0, DOCK_LIMIT);
  const overflowCount = Math.max(0, allDms.length - DOCK_LIMIT);

  return (
    <div className={styles.dock}>
      <span className={styles.label}>Chat</span>

      <div className={styles.list}>
        {dms.map((c) => {
          const u = c.otherUser!;
          const img = u.avatarUrl ?? `https://i.pravatar.cc/72?u=${u.id}`;
          const isActive = activeId === c.id;
          const preview = c.lastMessage?.body;
          // Presence flag: if the live-users hook hasn't loaded yet
          // (`onlineUserIds` undefined) we default to OFFLINE so the
          // UI never shows a misleading green dot during the brief
          // hydration window.
          const isOnline = onlineUserIds?.has(u.id) ?? false;

          const unread = c.unreadCount;
          const statusLabel = isOnline ? 'online' : 'offline';
          const baseLabel = u.name ?? 'Conversa';
          const ariaLabel = unread > 0
            ? `${baseLabel}, ${statusLabel}, ${unread} ${unread === 1 ? 'mensagem' : 'mensagens'} não lidas`
            : `${baseLabel}, ${statusLabel}`;

          return (
            <button
              key={c.id}
              className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
              onClick={() => onOpen(c.id)}
              onMouseEnter={() => setHovered(c.id)}
              onMouseLeave={() => setHovered(null)}
              aria-label={ariaLabel}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img}
                alt={u.name ?? ''}
                className={`${styles.avatar} ${isOnline ? '' : styles.avatarOffline}`}
              />

              {/* Presence dot — green for online, neutral gray for
                  offline. Lives on the bottom-right corner of the
                  avatar so it reads at a glance without crowding
                  the unread badge (top-right). */}
              <span
                className={`${styles.statusDot} ${isOnline ? styles.statusDotOnline : styles.statusDotOffline}`}
                aria-hidden="true"
              />

              {unread > 0 && (
                <span className={styles.unreadBadge} aria-hidden="true">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}

              {hovered === c.id && (
                <div className={styles.tooltip}>
                  <span className={styles.tooltipName}>{u.name ?? 'Anônimo'}</span>
                  <span
                    className={`${styles.tooltipStatus} ${isOnline ? styles.tooltipStatusOnline : styles.tooltipStatusOffline}`}
                  >
                    <span className={styles.tooltipStatusDash} aria-hidden="true" />
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                  {preview && <span className={styles.tooltipSub}>{preview}</span>}
                </div>
              )}
            </button>
          );
        })}

        <button
          className={styles.addBtn}
          onClick={onAddClick}
          aria-label="Iniciar nova conversa"
          title="Nova conversa"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </button>

        {/* Overflow trigger — only renders when there are more
            conversations than the dock can comfortably show.
            Reads as "see all your conversations". */}
        {onShowAll && allDms.length > 0 && (
          <button
            className={styles.allBtn}
            onClick={onShowAll}
            aria-label={
              overflowCount > 0
                ? `Ver todas as conversas (mais ${overflowCount})`
                : 'Ver todas as conversas'
            }
            title="Ver todas"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="3" cy="4"  r="1" fill="currentColor" />
              <path d="M6.5 4h6.5" />
              <circle cx="3" cy="8"  r="1" fill="currentColor" />
              <path d="M6.5 8h6.5" />
              <circle cx="3" cy="12" r="1" fill="currentColor" />
              <path d="M6.5 12h6.5" />
            </svg>
            {overflowCount > 0 && (
              <span className={styles.allBtnCount} aria-hidden="true">
                +{overflowCount}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
