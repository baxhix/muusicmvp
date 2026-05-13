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
}

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
}: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  // Filter to DMs only — the global Superchat is opened via SuperchatTrigger.
  const dms = conversations.filter((c) => c.type === 'dm' && c.otherUser);

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
      </div>
    </div>
  );
}
