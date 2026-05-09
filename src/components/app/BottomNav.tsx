'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './BottomNav.module.css';

interface BottomNavProps {
  onSuperfansOpen?: () => void;
  onProfileOpen?: () => void;
}

const NAV_ITEMS = [
  {
    id: 'map',
    label: 'Mapa',
    href: '/app',
    icon: (
      <svg viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M3 11h16M11 3c-2 2.5-3 5-3 8s1 5.5 3 8M11 3c2 2.5 3 5 3 8s-1 5.5-3 8" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    ),
  },
  {
    id: 'explore',
    label: 'Explorar',
    href: '',
    icon: (
      <svg viewBox="0 0 22 22" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M15.5 15.5L19 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function BottomNav({ onSuperfansOpen, onProfileOpen }: BottomNavProps = {}) {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Navegação principal">
      <div className={styles.inner}>
        {NAV_ITEMS.slice(0, 2).map((item) => {
          const isActive = pathname === item.href;
          const cls = `${styles.item} ${isActive ? styles.itemActive : ''}`;
          const children = (
            <>
              {item.icon}
              <div className={styles.dot} aria-hidden="true" />
              <span className={styles.label}>{item.label}</span>
            </>
          );
          return item.href ? (
            <Link
              key={item.id}
              href={item.href}
              className={cls}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {children}
            </Link>
          ) : (
            <button key={item.id} className={cls} aria-label={item.label}>
              {children}
            </button>
          );
        })}

        {/* Center crown button — Superfãs */}
        <button
          className={`${styles.item} ${styles.itemCenter}`}
          onClick={onSuperfansOpen}
          aria-label="Superfãs"
        >
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M3.5 8.5l2 9.5h13l2-9.5-5 3.5-3.5-7-3.5 7-5-3.5z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6.5 21h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Chat */}
        <button
          className={`${styles.item} ${pathname === '/app/chat' ? styles.itemActive : ''}`}
          aria-label="Chat"
        >
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
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
            <circle cx="11" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M4 19c0-3.5 3-6 7-6s7 2.5 7 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <div className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>Perfil</span>
        </button>
      </div>
    </nav>
  );
}
