'use client';

import { IconBell } from '@/components/icons';
import SearchInput from '@/components/ui/SearchInput';
import ThemeToggle from './ThemeToggle';
import styles from './TopBar.module.css';

/**
 * Admin shell top bar.
 *
 * The breadcrumb trail that used to live on the left (Dashboard /
 * Feed / Algoritmo / …) was removed per product feedback — the
 * sidebar's active state is enough to communicate where you are,
 * and each page already renders its own PageHeader with title +
 * description. Removing the duplicate cleans the visual budget
 * at the top and gives the search input more breathing room.
 *
 * The empty `.left` div is preserved on purpose: the layout uses
 * `flex + justify-content: space-between`, so the right-side
 * cluster (search, theme toggle, notifications) stays anchored to
 * the right edge.
 */
export default function TopBar() {
  return (
    <header className={styles.topbar}>
      <div className={styles.left} aria-hidden="true" />

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
