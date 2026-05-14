'use client';

import styles from './SuperchatTrigger.module.css';

interface Props {
  onClick: () => void;
  /** Number of unread messages in the Superchat room. 0 hides the badge. */
  unreadCount?: number;
}

/**
 * Inline pill (next to FilterTabs / Ranking / NotificationBell) that
 * opens the global Superchat panel. Same visual treatment as the
 * "Entre no Superchat!" CTA that used to live in the (now-removed)
 * SingleBanner: white pill with a play glyph + bold dark label and
 * a soft idle pulse so the eye gets drawn to the entry point.
 */
export default function SuperchatTrigger({ onClick, unreadCount = 0 }: Props) {
  return (
    <button
      type="button"
      className={styles.btn}
      onClick={onClick}
      aria-label={
        unreadCount > 0
          ? `Entre no Superchat (${unreadCount} mensagens não lidas)`
          : 'Entre no Superchat'
      }
      title="Entre no Superchat"
    >
      <svg
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="currentColor"
        aria-hidden="true"
        className={styles.icon}
      >
        <path d="M4 2.5v11l9-5.5z" />
      </svg>
      <span className={styles.label}>Entre no Superchat!</span>
      {unreadCount > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
