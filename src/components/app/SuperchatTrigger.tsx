'use client';

import styles from './SuperchatTrigger.module.css';

interface Props {
  onClick: () => void;
  /** Number of unread messages in the Superchat room. 0 hides the badge. */
  unreadCount?: number;
}

/**
 * Inline pill (next to FilterTabs / Ranking / NotificationBell) that
 * opens the global Superchat panel. Shows a red unread-count badge when
 * there are messages the current user hasn't seen yet.
 */
export default function SuperchatTrigger({ onClick, unreadCount = 0 }: Props) {
  return (
    <button
      type="button"
      className={styles.btn}
      onClick={onClick}
      aria-label={
        unreadCount > 0
          ? `Superchat (${unreadCount} mensagens não lidas)`
          : 'Abrir Superchat'
      }
      title="Superchat — sala global"
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-4 3v-3H5a2 2 0 0 1-2-2V5z" />
      </svg>
      <span className={styles.label}>Superchat</span>
      {unreadCount > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
