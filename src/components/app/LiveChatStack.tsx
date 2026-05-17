'use client';

import { useState } from 'react';
import type { ApiConversationSummary } from '@/lib/api/types';
import VerifiedBadge from './VerifiedBadge';
import styles from './LiveChatStack.module.css';

interface Props {
  conversations: ApiConversationSummary[];
  activeId: string | null;
  /**
   * Set of currently-online user ids. Drives the green/gray ring +
   * status dot per avatar (via `useLiveUsers`'s presence stream).
   */
  onlineUserIds?: ReadonlySet<string>;
  onOpen: (conversationId: string) => void;
}

/** The dock now renders ONLY the 3 most recent conversations per
 *  product feedback. The chat / feed / comunidade action shortcuts
 *  that used to live at the bottom of this column (and the
 *  hover-reveal of the next 4 conversations) were retired together
 *  — the shortcuts moved to a horizontal row in the page's topBar,
 *  and the full conversations list is reachable from the chat
 *  panel that the topBar shortcut opens. */
const DOCK_LIMIT = 3;

/**
 * Right-edge stack of the 3 latest conversation avatars. Click an
 * avatar to open the corresponding LiveChatPanel. The hamburger
 * trigger + Feed + Comunidade shortcuts used to share this column
 * but have moved up to the page's centered topBar.
 */
export default function LiveChatStack({
  conversations,
  activeId,
  onlineUserIds,
  onOpen,
}: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  // Include both DMs (with a resolvable other user) AND user-created
  // groups. The global Superchat (named room, accessed via
  // SuperchatTrigger) is excluded — it has no slug check available
  // here, but in practice it's the only group without `name` set by
  // the createGroup flow, and we skip rendering it explicitly below.
  const dockable = conversations.filter((c) => {
    if (c.type === 'dm') return !!c.otherUser;
    // Groups must have a name (user-created); the unnamed Superchat
    // shouldn't appear in the dock since it has its own trigger.
    return c.type === 'group' && !!c.name;
  });
  const items = dockable.slice(0, DOCK_LIMIT);

  return (
    <div className={styles.dock}>
      <span className={styles.label}>Chat</span>

      <div className={styles.list}>
        {items.map((c) => {
          const isGroup = c.type === 'group';
          // Normalize fields so the rest of the render is shape-agnostic.
          const u = c.otherUser;
          const displayName = isGroup
            ? (c.name ?? 'Grupo')
            : (u?.name ?? 'Conversa');
          const seedId = isGroup ? c.id : (u?.id ?? c.id);
          const img = isGroup
            ? (c.imageUrl ?? `https://i.pravatar.cc/72?u=${seedId}`)
            : (u?.avatarUrl ?? `https://i.pravatar.cc/72?u=${seedId}`);
          const isActive = activeId === c.id;
          const preview = c.lastMessage?.body;
          // Groups have no presence concept — always "active" visually
          // (no grayscale, no ring). DMs use the live presence set.
          const isOnline = isGroup
            ? true
            : (onlineUserIds?.has(u?.id ?? '') ?? false);
          const isVerified = !isGroup && !!u?.verified;

          const unread = c.unreadCount;
          const statusLabel = isGroup
            ? `${c.memberCount ?? 0} membros`
            : isOnline ? 'online' : 'offline';
          const ariaLabel = unread > 0
            ? `${displayName}, ${statusLabel}, ${unread} ${unread === 1 ? 'mensagem' : 'mensagens'} não lidas`
            : `${displayName}, ${statusLabel}`;

          return (
            <button
              key={c.id}
              className={`${styles.item} ${isActive ? styles.itemActive : ''} ${isOnline ? '' : styles.itemOffline}`}
              onClick={() => onOpen(c.id)}
              onMouseEnter={() => setHovered(c.id)}
              onMouseLeave={() => setHovered(null)}
              aria-label={ariaLabel}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img}
                alt={displayName}
                className={`${styles.avatar} ${isOnline ? '' : styles.avatarOffline} ${isGroup ? styles.avatarGroup : ''}`}
                onError={(e) => {
                  // Avatar 404? Fall back to a deterministic pravatar so
                  // the dock never shows a broken-image icon.
                  const img = e.currentTarget;
                  const fb = `https://i.pravatar.cc/72?u=${seedId}`;
                  if (img.src !== fb) img.src = fb;
                }}
              />

              {/* Presence dot — DMs only. Groups don't have a
                  single "online" state, so skip the indicator
                  entirely instead of showing a misleading dot. */}
              {!isGroup && (
                <span
                  className={`${styles.statusDot} ${isOnline ? styles.statusDotOnline : styles.statusDotOffline}`}
                  aria-hidden="true"
                />
              )}

              {/* Verified check — DM-only (group avatars don't
                  carry a verified flag). */}
              {isVerified && (
                <span className={styles.verifiedBadge}>
                  <VerifiedBadge size={16} />
                </span>
              )}

              {unread > 0 && (
                <span className={styles.unreadBadge} aria-hidden="true">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}

              {hovered === c.id && (
                <div className={styles.tooltip}>
                  <span className={styles.tooltipName}>{displayName}</span>
                  {preview && <span className={styles.tooltipSub}>{preview}</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
