'use client';

import styles from './RankingButton.module.css';

interface Props {
  onClick: () => void;
}

/**
 * Floating top-bar trigger that opens the global RankingModal. Sits next
 * to the SuperchatTrigger and NotificationBell so the whole "social"
 * row lives together visually.
 */
export default function RankingButton({ onClick }: Props) {
  return (
    <button
      type="button"
      className={styles.btn}
      onClick={onClick}
      aria-label="Abrir ranking"
      title="Ranking — quem mais ouve música"
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 4h10v3a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V4z" />
        <path d="M5 4H3v1a2 2 0 0 0 2 2M15 4h2v1a2 2 0 0 1-2 2" />
        <path d="M10 10v3" />
        <path d="M6 17h8M7 17v-1a3 3 0 0 1 3-3M13 17v-1a3 3 0 0 0-3-3" />
      </svg>
      <span className={styles.label}>Ranking</span>
    </button>
  );
}
