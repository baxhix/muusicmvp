'use client';

import styles from './SuperchatTrigger.module.css';

interface Props {
  onClick: () => void;
}

/**
 * Small floating button that opens the Superchat. Positioned next to the
 * NotificationBell at the top-right of the screen.
 */
export default function SuperchatTrigger({ onClick }: Props) {
  return (
    <button
      className={styles.btn}
      onClick={onClick}
      aria-label="Abrir Superchat"
      title="Superchat — sala global"
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-4 3v-3H5a2 2 0 0 1-2-2V5z" />
      </svg>
    </button>
  );
}
