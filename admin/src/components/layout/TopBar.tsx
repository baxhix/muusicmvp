'use client';

import { usePathname } from 'next/navigation';
import { IconBell, IconChevronRight } from '@/components/icons';
import SearchInput from '@/components/ui/SearchInput';
import ThemeToggle from './ThemeToggle';
import styles from './TopBar.module.css';

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard':  'Dashboard',
  '/engagement': 'Engajamento',
  '/feed':       'Feed',
  '/users':      'Usuários',
  '/tracks':     'Músicas',
  '/moderation': 'Moderação',
  '/superfans':  'Superfãs',
  '/settings':   'Configurações',
};

function getCrumbs(pathname: string): { label: string; href: string }[] {
  const exact = ROUTE_LABELS[pathname];
  if (exact) return [{ label: exact, href: pathname }];

  const segs = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];
  let acc = '';
  for (const s of segs) {
    acc += `/${s}`;
    crumbs.push({
      label: ROUTE_LABELS[acc] ?? decodeURIComponent(s).replace(/-/g, ' '),
      href: acc,
    });
  }
  return crumbs.length > 0 ? crumbs : [{ label: 'Admin', href: '/' }];
}

export default function TopBar() {
  const pathname = usePathname();
  const crumbs = getCrumbs(pathname);

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <nav className={styles.crumbs} aria-label="breadcrumb">
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={c.href} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && (
                  <span className={styles.crumbSep} aria-hidden="true">
                    <IconChevronRight size={12} />
                  </span>
                )}
                <span className={isLast ? styles.crumbCurrent : undefined}>{c.label}</span>
              </span>
            );
          })}
        </nav>
      </div>

      <div className={styles.right}>
        <div className={styles.searchWrap}>
          <SearchInput pill placeholder="Buscar usuários, posts, denúncias..." />
        </div>
        <ThemeToggle />
        <button className={styles.iconBtn} aria-label="Notificações" type="button">
          <IconBell size={16} />
          <span className={styles.notificationDot} />
        </button>
      </div>
    </header>
  );
}
