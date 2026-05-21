'use client';

import { useCallback, useEffect, useState } from 'react';
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
  IconMessage,
  IconMusic,
  IconTrendingUp,
  IconCode,
  IconTicket,
  IconCalendar,
  IconEdit,
  IconChevronLeft,
  IconChevronRight,
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

/* Order locked by product feedback:
 *   Dashboard → Engajamento → Moderação → Superfãs → Usuários
 *   → Feed → Comunidade → Músicas → Pre Save → Convites → Fanverse
 *
 * Pre Save fica adjacente a Músicas porque é uma feature de
 * release/marketing de faixa — agrupa visualmente com o domínio
 * de música. */
const PRIMARY_NAV: NavItem[] = [
  { href: '/dashboard',   label: 'Dashboard',   icon: IconDashboard },
  { href: '/engagement',  label: 'Engajamento', icon: IconTrendingUp },
  { href: '/moderation',  label: 'Moderação',   icon: IconShield, badge: 12 },
  { href: '/superfans',   label: 'Superfãs',    icon: IconStar },
  { href: '/users',       label: 'Usuários',    icon: IconUsers },
  { href: '/feed',        label: 'Feed',        icon: IconFeed },
  { href: '/comunidades', label: 'Comunidade',  icon: IconMessage },
  { href: '/tracks',      label: 'Músicas',     icon: IconMusic },
  { href: '/pre-save',    label: 'Pre Save',    icon: IconCalendar },
  { href: '/blog',        label: 'Blog',        icon: IconEdit },
  { href: '/convites',    label: 'Convites',    icon: IconTicket },
  { href: '/fanverse',    label: 'Fanverse',    icon: IconStar },
];

const SECONDARY_NAV: NavItem[] = [
  { href: '/settings',    label: 'Configurações', icon: IconSettings },
  { href: '/desenvolvedor', label: 'Desenvolvedor',  icon: IconCode },
];

/** localStorage key for the collapsed-state persistence. Picking a
 *  namespaced key so the admin's flag doesn't collide with anything
 *  the main app stores under `app:*`. */
const COLLAPSED_KEY = 'admin:sidebar-collapsed';

/**
 * Sidebar with a collapse / expand toggle (icon-only mode) per
 * product feedback "refaça a sidebar para que tenha a opção de
 * retrair o menu ficando apenas os ícones visíveis". When
 * collapsed:
 *   - Sidebar width drops from `--sidebar-w` (248px) to
 *     `--sidebar-w-collapsed` (64px).
 *   - Labels, section eyebrows, brand wordmark, and the
 *     profile body collapse to icon-only.
 *   - The `--sidebar-w` CSS custom property is reassigned on
 *     `<html>` so the shell's `.main { margin-left: var(--sidebar-w) }`
 *     follows automatically — no extra plumbing needed in the
 *     shell layout.
 *   - State persists across reloads via localStorage.
 *
 * Native `title` tooltips kick in for each row so a hover reveals
 * the label when collapsed.
 */
export default function Sidebar({ open = false }: { open?: boolean }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Restore the collapsed flag from localStorage on first mount
  // + sync the CSS custom property that drives the shell's
  // margin-left. Render is initially `false` (expanded) to match
  // server-side output, then the effect flips it before the
  // first paint that matters.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(COLLAPSED_KEY);
    const next = stored === '1';
    setCollapsed(next);
    document.documentElement.style.setProperty(
      '--sidebar-w',
      next ? 'var(--sidebar-w-collapsed)' : '248px',
    );
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((curr) => {
      const next = !curr;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
        document.documentElement.style.setProperty(
          '--sidebar-w',
          next ? 'var(--sidebar-w-collapsed)' : '248px',
        );
      }
      return next;
    });
  }, []);

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
        // Native title surfaces the label on hover when collapsed,
        // and provides accessible context the visible label already
        // gave when expanded.
        title={item.label}
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
    <aside
      className={cn(
        styles.sidebar,
        open && styles.sidebarOpen,
        collapsed && styles.sidebarCollapsed,
      )}
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div className={styles.brand}>
        <Link href="/dashboard" className={styles.brandLink} title="Fanverse Admin">
          {/* Actual Fanverse SVG brand mark — same purple→pink
              stripey-F asset the main app + auth surfaces use,
              so the visual identity reads consistently across
              the platform. Per product feedback "inclua o
              logotipo Fanverse no painel admin também". */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/fanverse-logo.svg"
            alt=""
            className={styles.brandLogo}
            aria-hidden="true"
          />
          <span className={styles.brandName}>Fanverse</span>
        </Link>
        {/* Collapse toggle — pinned to the right edge of the
         *  brand row. When the sidebar is expanded the chevron
         *  points LEFT (suggesting "fold inward"); when
         *  collapsed it points RIGHT (suggesting "unfold"). */}
        <button
          type="button"
          className={styles.collapseToggle}
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expandir menu' : 'Retrair menu'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expandir menu' : 'Retrair menu'}
        >
          {collapsed ? <IconChevronRight size={14} /> : <IconChevronLeft size={14} />}
        </button>
      </div>

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
        <div className={styles.profile} title={displayName}>
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
