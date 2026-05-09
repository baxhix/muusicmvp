'use client';

import { useState } from 'react';
import type { ApiConversationSummary } from '@/lib/api/types';
import styles from './LiveChatStack.module.css';

interface Props {
  conversations: ApiConversationSummary[];
  activeId: string | null;
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

          return (
            <button
              key={c.id}
              className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
              onClick={() => onOpen(c.id)}
              onMouseEnter={() => setHovered(c.id)}
              onMouseLeave={() => setHovered(null)}
              aria-label={u.name ?? 'Conversa'}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt={u.name ?? ''} className={styles.avatar} />

              {hovered === c.id && (
                <div className={styles.tooltip}>
                  <span className={styles.tooltipName}>{u.name ?? 'Anônimo'}</span>
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
