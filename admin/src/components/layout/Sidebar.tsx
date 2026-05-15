'use client';

import { useState } from 'react';
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
  IconMusic,
  IconTrendingUp,
  IconCode,
  IconTicket,
} from '@/components/icons';
import Avatar from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import styles from './Sidebar.module.css';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  badge?: number;
}

const PRIMARY_NAV: NavItem[] = [
  { href: '/dashboard',  label: 'Dashboard',  icon: IconDashboard },
  { href: '/engagement', label: 'Engajamento', icon: IconTrendingUp },
  { href: '/fanverse',   label: 'Fanverse',   icon: IconStar },
  { href: '/feed',       label: 'Feed',       icon: IconFeed },
  { href: '/users',      label: 'Usuários',   icon: IconUsers },
  { href: '/convites',   label: 'Convites',   icon: IconTicket },
  { href: '/tracks',     label: 'Músicas',    icon: IconMusic },
  { href: '/moderation', label: 'Moderação',  icon: IconShield, badge: 12 },
  { href: '/superfans',  label: 'Superfãs',   icon: IconStar },
];

const SECONDARY_NAV: NavItem[] = [
  { href: '/settings',    label: 'Configurações', icon: IconSettings },
  { href: '/desenvolvedor', label: 'Desenvolvedor',  icon: IconCode },
];

export default function Sidebar({ open = false }: { open?: boolean }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      // logout() reloads on success — if it returns here, the reload
      // didn't fire (e.g. mock mode) so flip the button back to idle.
    } finally {
      setSigningOut(false);
    }
  };

  // Profile footer text — fall back to the email prefix when the user
  // hasn't set a display name yet (most magic-link signups don't).
  const displayName = user.name?.trim() || user.email.split('@')[0];
  const displayRole = user.role === 'admin' ? 'Admin · muusic' : 'Conta';

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
        <div className={styles.profile}>
          <Avatar name={displayName} src={user.avatarUrl ?? undefined} size="sm" />
          <div className={styles.profileBody}>
            <div className={styles.profileName} title={user.email}>
              {displayName}
            </div>
            <div className={styles.profileRole}>{displayRole}</div>
          </div>
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={handleLogout}
            disabled={signingOut}
            aria-label="Sair"
            title="Sair"
          >
            <IconLogout size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
