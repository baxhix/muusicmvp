'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconDashboard,
  IconFeed,
  IconUsers,
  IconShield,
  IconStar,
  IconSettings,
  IconLogout,
} from '@/components/icons';
import Avatar from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import styles from './Sidebar.module.css';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  badge?: number;
}

const PRIMARY_NAV: NavItem[] = [
  { href: '/dashboard',  label: 'Dashboard',  icon: IconDashboard },
  { href: '/feed',       label: 'Feed',       icon: IconFeed },
  { href: '/users',      label: 'Usuários',   icon: IconUsers },
  { href: '/moderation', label: 'Moderação',  icon: IconShield, badge: 12 },
  { href: '/superfans',  label: 'Superfãs',   icon: IconStar },
];

const SECONDARY_NAV: NavItem[] = [
  { href: '/settings', label: 'Configurações', icon: IconSettings },
];

export default function Sidebar({ open = false }: { open?: boolean }) {
  const pathname = usePathname();

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(styles.item, active && styles.itemActive)}
        aria-current={active ? 'page' : undefined}
      >
        <span className={styles.itemIcon}>
          <Icon size={16} />
        </span>
        <span className={styles.itemLabel}>{item.label}</span>
        {typeof item.badge === 'number' && item.badge > 0 && (
          <span className={cn(styles.itemBadge, !active && styles.itemBadgeMute)}>
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className={cn(styles.sidebar, open && styles.sidebarOpen)}>
      <Link href="/dashboard" className={styles.brand}>
        <span className={styles.brandLogo}>F</span>
        <span className={styles.brandName}>
          Fanverse
          <span className={styles.brandTag}>Admin</span>
        </span>
      </Link>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Plataforma</span>
        {PRIMARY_NAV.map(renderItem)}
      </div>

      <div className={styles.spacer} />

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Sistema</span>
        {SECONDARY_NAV.map(renderItem)}
      </div>

      <div className={styles.footer}>
        <div className={styles.profile} role="button" tabIndex={0}>
          <Avatar name="Marcelo Admin" size="sm" />
          <div className={styles.profileBody}>
            <div className={styles.profileName}>Marcelo Baxhix</div>
            <div className={styles.profileRole}>Owner · Fanverse</div>
          </div>
          <span className={styles.itemIcon} title="Sair">
            <IconLogout size={14} />
          </span>
        </div>
      </div>
    </aside>
  );
}
