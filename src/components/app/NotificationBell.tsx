'use client';

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNotificationsLive } from '@/hooks/useNotificationsLive';
import type { ApiNotification } from '@/lib/api/types';
import styles from './NotificationBell.module.css';

const PULSE_MS = 900;

function timeAgo(iso: string): string {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return 'agora';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}min`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  return `${Math.floor(diffSec / 86400)}d`;
}

/** Display label for the source user — name if set, else email local-part. */
function sourceLabel(n: ApiNotification): string {
  if (!n.sourceUser) return 'Alguém';
  if (n.sourceUser.name?.trim()) return n.sourceUser.name.trim();
  // Fall back to the local-part of the email so we don't leak the domain.
  const local = n.sourceUser.email.split('@')[0];
  return local || n.sourceUser.email;
}

/** Display label for the track — "Title — Artist". */
function trackLabel(n: ApiNotification): string | null {
  if (!n.track) return null;
  return `${n.track.title} — ${n.track.artist}`;
}

/**
 * Renders the notification text with the source user and the track shown
 * in bold/white. Returns a JSX fragment so the rich segments stay typed.
 */
function describe(n: ApiNotification): ReactNode {
  const Strong = ({ children }: { children: ReactNode }) => (
    <strong className={styles.itemStrong}>{children}</strong>
  );

  switch (n.kind) {
    case 'same_track': {
      const track = trackLabel(n);
      return (
        <Fragment>
          <Strong>{sourceLabel(n)}</Strong> está ouvindo{' '}
          {track ? <Strong>{track}</Strong> : 'a mesma música'} agora
        </Fragment>
      );
    }
    case 'same_artist': {
      return (
        <Fragment>
          <Strong>{sourceLabel(n)}</Strong> está curtindo{' '}
          {n.artist ? <Strong>{n.artist}</Strong> : 'o mesmo artista'}
        </Fragment>
      );
    }
    case 'same_album': {
      return (
        <Fragment>
          <Strong>{sourceLabel(n)}</Strong> está ouvindo{' '}
          {n.album ? <Strong>{n.album}</Strong> : 'o mesmo álbum'}
        </Fragment>
      );
    }
    case 'message': {
      return (
        <Fragment>
          <Strong>{sourceLabel(n)}</Strong> mandou uma mensagem
        </Fragment>
      );
    }
    case 'mention': {
      return (
        <Fragment>
          <Strong>{sourceLabel(n)}</Strong> mencionou você
        </Fragment>
      );
    }
    case 'group_added': {
      // Group name lives on the notification payload (createGroup +
      // addMember stash it there so the bell doesn't need to join).
      const payload = (n.payload ?? {}) as { groupName?: string };
      const groupName = payload.groupName?.trim() || 'um grupo';
      return (
        <Fragment>
          <Strong>{sourceLabel(n)}</Strong> te adicionou ao grupo{' '}
          <Strong>{groupName}</Strong>
        </Fragment>
      );
    }
    case 'comment_reaction': {
      // Emoji is stashed in payload by toggleCommentReaction.
      const payload = (n.payload ?? {}) as { emoji?: string };
      const emoji = payload.emoji?.trim() || '❤️';
      return (
        <Fragment>
          <Strong>{sourceLabel(n)}</Strong> reagiu com {emoji} ao seu comentário
        </Fragment>
      );
    }
    case 'comment_reply': {
      return (
        <Fragment>
          <Strong>{sourceLabel(n)}</Strong> respondeu ao seu comentário
        </Fragment>
      );
    }
    case 'comment_mention': {
      return (
        <Fragment>
          <Strong>{sourceLabel(n)}</Strong> te mencionou em um comentário
        </Fragment>
      );
    }
    default:
      return 'Notificação';
  }
}

/**
 * Floating bell — top-right badge showing unread count, click toggles a
 * dropdown panel. Marks each notification read on click.
 */
/**
 * Triggerless mode (`hideTrigger`)
 * ─────────────────────────────────
 * Per product feedback, the top-bar bell glyph is gone — the only
 * visible notifications entry point lives in the BottomNav. When
 * `hideTrigger` is true, the bell button + its pulse halo are
 * hidden (display: none on the wrap class), but the component
 * stays mounted to:
 *   1. Subscribe to the 'app:open-notifications' window event
 *      dispatched by the BottomNav.
 *   2. Render the dropdown panel via a top-right fixed anchor
 *      (.panelFixed) when open, mirroring the position the bell
 *      used to occupy.
 */
interface NotificationBellProps {
  hideTrigger?: boolean;
}

export default function NotificationBell({ hideTrigger = false }: NotificationBellProps = {}) {
  const { notifications, unreadCount, markRead, markAllRead } =
    useNotificationsLive();
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const lastUnreadRef = useRef(unreadCount);
  const dropRef = useRef<HTMLDivElement>(null);

  // Pulse when unread count grows
  useEffect(() => {
    if (unreadCount > lastUnreadRef.current) {
      setPulse(true);
      const id = setTimeout(() => setPulse(false), PULSE_MS);
      lastUnreadRef.current = unreadCount;
      return () => clearTimeout(id);
    }
    lastUnreadRef.current = unreadCount;
  }, [unreadCount]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // External-open hook. The BottomNav's right-most slot now is a
  // notifications icon — it fires this CustomEvent so the same
  // panel surfaces from both places without coupling the two
  // components directly. Any other surface that wants to open
  // the panel can dispatch the same event.
  useEffect(() => {
    const onExternalOpen = () => setOpen(true);
    window.addEventListener('app:open-notifications', onExternalOpen);
    return () =>
      window.removeEventListener('app:open-notifications', onExternalOpen);
  }, []);

  return (
    <div
      className={`${styles.wrap} ${hideTrigger ? styles.wrapHidden : ''}`}
      ref={dropRef}
    >
      {!hideTrigger && (
        <button
          className={`${styles.bell} ${pulse ? styles.bellPulse : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-label={`Notificações${unreadCount ? ` (${unreadCount} não lidas)` : ''}`}
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 2a5 5 0 0 0-5 5v3.5L3.5 13h13L15 10.5V7a5 5 0 0 0-5-5z" />
            <path d="M8 16a2 2 0 0 0 4 0" />
          </svg>
          {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </button>
      )}

      {open && (
        <div
          className={`${styles.panel} ${hideTrigger ? styles.panelFixed : ''}`}
          role="dialog"
          aria-label="Notificações"
        >
          <div className={styles.head}>
            <span className={styles.headTitle}>Notificações</span>
            {unreadCount > 0 && (
              <button className={styles.markAll} onClick={markAllRead}>
                Marcar todas
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className={styles.empty}>Sem novidades por enquanto.</div>
          ) : (
            <ul className={styles.list}>
              {notifications.slice(0, 30).map((n) => {
                const avatar =
                  n.sourceUser?.avatarUrl ??
                  (n.sourceUser?.id ? `https://i.pravatar.cc/72?u=${n.sourceUser.id}` : null);
                return (
                  <li
                    key={n.id}
                    className={`${styles.item} ${n.readAt ? styles.itemRead : styles.itemUnread}`}
                    onClick={() => !n.readAt && markRead(n.id)}
                  >
                    {avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatar}
                        alt=""
                        className={styles.itemAvatar}
                      />
                    ) : (
                      <span className={styles.itemAvatarPlaceholder} aria-hidden="true" />
                    )}
                    <div className={styles.itemBody}>
                      <div className={styles.itemText}>{describe(n)}</div>
                      <div className={styles.itemMeta}>{timeAgo(n.createdAt)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
