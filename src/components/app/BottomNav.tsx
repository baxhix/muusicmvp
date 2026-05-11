'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './BottomNav.module.css';

interface BottomNavProps {
  onSuperfansOpen?: () => void;
  onProfileOpen?: () => void;
  /** Open the global Superchat panel (wired in page.tsx). */
  onSuperchatOpen?: () => void;
}

export default function BottomNav({
  onSuperfansOpen,
  onProfileOpen,
  onSuperchatOpen,
}: BottomNavProps = {}) {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Navegação principal">
      <div className={styles.inner}>
        {/* Mapa */}
        <Link
          href="/app"
          className={`${styles.item} ${pathname === '/app' ? styles.itemActive : ''}`}
          aria-label="Mapa"
          aria-current={pathname === '/app' ? 'page' : undefined}
        >
          <svg viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M3 11h16M11 3c-2 2.5-3 5-3 8s1 5.5 3 8M11 3c2 2.5 3 5 3 8s-1 5.5-3 8"
              stroke="currentColor"
              strokeWidth="1.3"
            />
          </svg>
          <div className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>Mapa</span>
        </Link>

        {/* Feed — temporarily inactive. The button is `disabled` AND has
            `pointer-events: none` via .itemDisabled so any click is a
            no-op without needing an onClick handler. */}
        <button
          type="button"
          className={`${styles.item} ${styles.itemDisabled}`}
          disabled
          aria-disabled="true"
          title="Feed inativo temporariamente"
          aria-label="Feed (Feed inativo temporariamente)"
        >
          {/* Feed icon — stacked lines like an article list */}
          <svg viewBox="0 0 22 22" fill="none">
            <rect x="3" y="4"  width="16" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="3" y="10" width="16" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="3" y="16" width="16" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <div className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>
            Feed
            <span className={styles.labelHint}> (Feed inativo temporariamente)</span>
          </span>
        </button>

        {/* Center crown button — opens Ranking/Superfans */}
        <button
          className={`${styles.item} ${styles.itemCenter}`}
          onClick={onSuperfansOpen}
          aria-label="Ranking"
        >
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M3.5 8.5l2 9.5h13l2-9.5-5 3.5-3.5-7-3.5 7-5-3.5z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M6.5 21h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>

        {/* Chat → opens the Superchat panel */}
        <button
          type="button"
          className={styles.item}
          onClick={onSuperchatOpen}
          aria-label="Abrir Superchat"
        >
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>Chat</span>
        </button>

        {/* Profile */}
        <button
          className={`${styles.item} ${pathname === '/app/profile' ? styles.itemActive : ''}`}
          onClick={onProfileOpen}
          aria-label="Perfil"
        >
          <svg viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M4 19c0-3.5 3-6 7-6s7 2.5 7 6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <div className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>Perfil</span>
        </button>
      </div>
    </nav>
  );
}
