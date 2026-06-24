'use client';

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useNotificationsLive } from '@/hooks/useNotificationsLive';
import type { ApiNotification } from '@/lib/api/types';
import styles from './NotificationBell.module.css';

const PULSE_MS = 900;
/** How many notifications fit inside the panel's resting footprint
 *  before the "Ver mais" CTA kicks in. Mirrors the PREVIEW_COUNT
 *  pattern in PlaylistModal so both panels truncate the same way:
 *  show the first N, hide the rest under a single Ver mais click. */
const PREVIEW_COUNT = 7;

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
    case 'waved': {
      // Heart wave received from another user's map marker.
      // Pairs with the global `app:hearts-cascade` overlay
      // that fires when this notification arrives via socket
      // (see useNotificationsLive) — the bell entry is the
      // persistent record alongside the transient celebration.
      return (
        <Fragment>
          <Strong>{sourceLabel(n)}</Strong> acenou com um coração para você
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
  /** When set, the parent owns the open state — the panel only
   *  reads from this prop and reports changes via onOpenChange.
   *  Used by /app's overlay coordinator so opening another modal
   *  can force-close this one (and vice-versa). */
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
}

export default function NotificationBell({
  hideTrigger = false,
  open: openProp,
  onOpenChange,
}: NotificationBellProps = {}) {
  const { notifications, unreadCount, markRead, clearAll } =
    useNotificationsLive();
  // Uncontrolled fallback — used when the parent doesn't pass an
  // explicit open prop. In /app we go full-controlled.
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  // setOpen is memoized so the useEffect listeners below don't churn
  // their bound handlers on every render. The latest `open` value is
  // read off a ref so the function identity stays stable across
  // toggles (otherwise the outside-click effect would re-subscribe
  // every time the panel opens or closes).
  const openRef = useRef(open);
  openRef.current = open;
  const setOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const resolved =
        typeof next === 'function' ? next(openRef.current) : next;
      if (isControlled) {
        onOpenChange?.(resolved);
      } else {
        setInternalOpen(resolved);
      }
    },
    [isControlled, onOpenChange],
  );
  const [pulse, setPulse] = useState(false);
  const lastUnreadRef = useRef(unreadCount);
  const dropRef = useRef<HTMLDivElement>(null);
  // Toggle for the "Ver mais" reveal. Default false so each time
  // the panel opens it starts collapsed; the close-reset effect
  // below flips it back ~360ms after `open` becomes false (the
  // ~exit-animation window).
  const [showAllNotifs, setShowAllNotifs] = useState(false);
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => setShowAllNotifs(false), 360);
      return () => clearTimeout(t);
    }
  }, [open]);

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
        // Skip the close when the user is clicking the BottomNav's
        // own notifications toggle (or any other surface marked as
        // an overlay toggle for this panel). Without this guard, the
        // `mousedown` here fires BEFORE the BottomNav's `click`,
        // closing the panel via parent state → the click then reads
        // `activeOverlay='notifications'` from stale state and
        // toggles it back to 'notifications', re-opening the panel.
        // Net effect: clicking the navbar item twice produces the
        // "desce e sobe novamente, num looping eterno" symptom. The
        // toggle button itself manages its own state — we just need
        // to stay out of the way.
        const target = e.target as Element | null;
        if (target?.closest('[data-overlay-toggle="notifications"]')) {
          return;
        }
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, setOpen]);

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
  }, [setOpen]);

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
          {/* Badge anima scale 0→1 spring quando aparece (nova
           *  notificação). AnimatePresence handle unmount fade. */}
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                key="badge"
                className={styles.badge}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 24 }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      )}

      {/* Scrim — only rendered in `hideTrigger` mode (i.e. the
       *  mobile / right-rail entry point). Darkens the rest of
       *  the surface so the notifications list reads against a
       *  clean backdrop instead of the busy basemap. Tapping
       *  the scrim closes the panel — same gesture every other
       *  modal in /app uses. */}
      {open && hideTrigger && (
        <div
          className={styles.scrim}
          onClick={() => setOpen(false)}
          role="presentation"
          aria-hidden="true"
        />
      )}
      {open && (
        <div
          className={`${styles.panel} ${hideTrigger ? styles.panelFixed : ''}`}
          role="dialog"
          aria-label="Notificações"
        >
          <div className={styles.head}>
            {/* Fechar (X) à esquerda — affordance explícita de fechar o
             *  painel além do tap no scrim. */}
            <button
              type="button"
              className={styles.headClose}
              onClick={() => setOpen(false)}
              aria-label="Fechar notificações"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <span className={styles.headTitle}>Notificações</span>
            {/* Limpar à direita — marca tudo como lido e esvazia a lista. */}
            {notifications.length > 0 && (
              <button className={styles.clearAll} onClick={clearAll}>
                Limpar
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className={styles.empty}>Sem novidades por enquanto.</div>
          ) : (
            (() => {
              // Visible slice — capped at PREVIEW_COUNT until the
              // user clicks "Ver mais" (same pattern as the
              // PlaylistModal). Anything past the cap is hidden by
              // truncating the array rather than relying on the
              // panel's overflow, so the modal footprint stays
              // visually predictable.
              const visible = showAllNotifs
                ? notifications
                : notifications.slice(0, PREVIEW_COUNT);
              const hiddenCount = notifications.length - visible.length;
              return (
                <>
                  <ul className={styles.list}>
                    {visible.map((n) => {
                      const avatar =
                        n.sourceUser?.avatarUrl ??
                        (n.sourceUser ? '/avatar-placeholder.svg' : null);
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
                            <span
                              className={styles.itemAvatarPlaceholder}
                              aria-hidden="true"
                            />
                          )}
                          <div className={styles.itemBody}>
                            <div className={styles.itemText}>{describe(n)}</div>
                            <div className={styles.itemMeta}>{timeAgo(n.createdAt)}</div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      className={styles.viewMoreBtn}
                      onClick={() => setShowAllNotifs(true)}
                    >
                      Ver mais ({hiddenCount})
                    </button>
                  )}
                </>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}
