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
  /**
   * Fired when the user taps the hamburger / Chat trigger. Behaves
   * as a TOGGLE — the parent flips its own state so a second click
   * collapses the Chat panel. Pair with `chatOpen` so the dock can
   * paint the active-state.
   */
  onAddClick: () => void;
  /** Drives the active-state outline on the Chat shortcut. */
  chatOpen?: boolean;
  /**
   * Toggle the Comunidade panel. Same contract as `onAddClick` —
   * the parent owns the open/closed state and just flips it here.
   */
  onCommunityToggle?: () => void;
  /** Drives the active-state outline on the Comunidade shortcut. */
  communityOpen?: boolean;
  /**
   * Whether the FeedPanel is currently expanded. The Feed has its
   * own internal `minimized` state but broadcasts the value via
   * `app:feed-state-change` — `/app/page.tsx` mirrors it and passes
   * it here so the Feed shortcut paints the same lilac active
   * outline as Chat / Comunidade.
   */
  feedOpen?: boolean;
}

/** Max DM avatars kept in the dock's render list. The remainder are
 *  reachable via the "+" trigger that opens the full
 *  ConversationsSidebar. */
const DOCK_LIMIT = 7;

/** How many avatars are visible at rest. The rest of the
 *  DOCK_LIMIT slice stays mounted but visually collapsed via
 *  `.itemHidden` (CSS), only sliding into view when the dock is
 *  hovered. Keeps the right-edge column quiet most of the time. */
const VISIBLE_AT_REST = 3;

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
  chatOpen = false,
  onCommunityToggle,
  communityOpen = false,
  feedOpen = false,
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
        {items.map((c, idx) => {
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

          // Items past the resting-visible slice are present in DOM
          // but hidden until the dock is hovered. CSS handles the
          // reveal (max-height + opacity transition) — keeping the
          // markup stable here avoids tearing animations.
          const hiddenAtRest = idx >= VISIBLE_AT_REST;

          return (
            <button
              key={c.id}
              className={`${styles.item} ${isActive ? styles.itemActive : ''} ${isOnline ? '' : styles.itemOffline} ${hiddenAtRest ? styles.itemHidden : ''}`}
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

        <button
          className={`${styles.addBtn} ${chatOpen ? styles.dockShortcutActive : ''}`}
          onClick={onAddClick}
          aria-label={chatOpen ? 'Fechar lista de conversas' : 'Abrir lista de conversas'}
          aria-pressed={chatOpen}
          title={chatOpen ? 'Fechar conversas' : 'Ver todas as conversas'}
        >
          {/* Speech-bubble icon — single rounded bubble with a tail
              at the bottom-left. Distinct from:
                • the Comunidade cluster icon above (multi-bubble),
                • the Superchat single-bubble in BottomNav (tail at
                  bottom-right, larger 24px viewbox).
              Communicates 1:1 / DMs directly, replacing the
              previous hamburger icon which read as "list / menu". */}
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 4h10a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 13 12H7l-3 2.5V12H3a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 3 4z" />
          </svg>
        </button>

        {/* Feed shortcut — dispatches `app:toggle-feed` which the
            FeedPanel listens to. The Feed's open/closed state
            reaches us here via `feedOpen` (page.tsx mirrors the
            FeedPanel's `app:feed-state-change` broadcast), driving
            the lilac active outline so this shortcut behaves
            consistently with the Chat / Comunidade ones. */}
        <button
          className={`${styles.dockShortcut} ${feedOpen ? styles.dockShortcutActive : ''}`}
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('app:toggle-feed'));
            }
          }}
          aria-label={feedOpen ? 'Fechar feed' : 'Abrir feed'}
          aria-pressed={feedOpen}
          title={feedOpen ? 'Fechar feed' : 'Feed'}
        >
          {/* Feed/list icon — three lines of content reading as a
              short post + meta line, distinct from the hamburger. */}
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="10" height="10" rx="2" />
            <path d="M5.5 7h5M5.5 10h3" />
          </svg>
        </button>

        {/* Comunidade / Fórum — opens the CommunityPanel. Toggle
            behavior: clicking the icon while the panel is open
            closes it. Wired via the `onCommunityToggle` prop so
            the parent owns the open/closed state (drives the
            active-state outline below). */}
        <button
          className={`${styles.dockShortcut} ${communityOpen ? styles.dockShortcutActive : ''}`}
          onClick={onCommunityToggle}
          aria-label={communityOpen ? 'Fechar comunidade' : 'Abrir comunidade'}
          aria-pressed={communityOpen}
          title={communityOpen ? 'Fechar comunidade' : 'Comunidade'}
        >
          {/* Chat-bubble cluster icon — reads as multi-thread
              discussion without overlapping the single-bubble
              superchat motif. */}
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H7l-2 2v-2H5a2 2 0 0 1-2-2z" />
            <path d="M9 11a2 2 0 0 0 2 2h1l1 1v-1a2 2 0 0 0 2-2v-2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
