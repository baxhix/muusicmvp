'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconDashboard,
  IconUsers,
  IconStar,
  IconTrendingUp,
  IconGrid,
  IconHome,
  IconSettings,
  IconLogo,
  IconLogout,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
} from '@/components/icons';
import Avatar from '@/components/ui/Avatar';
import Tooltip from '@/components/ui/Tooltip';
import FanverseCore from '@/components/animations/FanverseCore';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import styles from './Sidebar.module.css';

/* ──────────────────────────────────────────────────────────────
 * Modelo de navegação — tree de 2 níveis:
 *
 *   - Top-level leaf:   item com rota, sem filhos. Ícone.
 *   - Group:            container de leaves. Ícone. Click toggla
 *                       expand/collapse; não navega.
 *   - Group leaf:       item com rota, sem ícone, indentado.
 *
 * Itens filhos NÃO têm ícone (per IA definida pelo produto:
 * "Itens de categoria filho, não precisam de ícones, apenas o pai").
 * ────────────────────────────────────────────────────────────── */

interface NavLeaf {
  kind: 'leaf';
  href: string;
  label: string;
  /** Só itens top-level recebem ícone. */
  icon?: React.ComponentType<{ size?: number }>;
  badge?: number;
  /** Visual esmaecido + sem navegação. Usado por Fanverse (rota
   *  ainda existe, mas não é foco do produto agora). */
  disabled?: boolean;
}

interface NavGroup {
  kind: 'group';
  /** Slug usado em localStorage pra persistir aberto/fechado. */
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  children: NavLeaf[];
}

type NavEntry = NavLeaf | NavGroup;

/* ──────────────────────────────────────────────────────────────
 * IA atual:
 *
 *   Dashboard
 *   Usuários
 *
 *   Plataforma  (group)
 *     Feed
 *     Comunidades
 *     Moderação
 *     Notificações
 *     E-mails
 *     Músicas
 *     Lives          (disabled — backlog)
 *     Presave        (disabled — backlog)
 *
 *   Superfãs    (group)
 *     Materiais
 *     Fanpoints
 *     Superchat
 *     Níveis
 *
 *   Growth      (group)
 *     Convites
 *     Aquisição
 *     Engajamento    (disabled — backlog)
 *
 *   Site        (group)
 *     Blog
 *     FAQ
 *     LGPD
 *     Footer
 *
 *   Sistema     (group)
 *     Configurações
 *     Desenvolvedor
 *
 *   Fanverse    (disabled, no rodapé)
 * ────────────────────────────────────────────────────────────── */

const NAV: NavEntry[] = [
  { kind: 'leaf', href: '/dashboard', label: 'Dashboard', icon: IconDashboard },
  { kind: 'leaf', href: '/users',     label: 'Usuários',  icon: IconUsers },

  {
    kind: 'group',
    id: 'plataforma',
    label: 'Plataforma',
    icon: IconGrid,
    children: [
      /* Feed e Comunidades movidos de Superfãs pra cá conforme
       * reorg do produto — são features da plataforma como um
       * todo, não exclusivas do tier de superfãs. Ficam no topo
       * por serem o conteúdo mais consultado.
       *
       * "Músicas" desceu pra logo abaixo de "E-mails" per product
       * feedback. "Lives" e "Presave" ficaram disabled — features
       * ainda em backlog, sem operação ativa. */
      { kind: 'leaf', href: '/feed',          label: 'Feed' },
      { kind: 'leaf', href: '/comunidades',   label: 'Comunidades' },
      { kind: 'leaf', href: '/moderation',    label: 'Moderação', badge: 12 },
      { kind: 'leaf', href: '/notificacoes',  label: 'Notificações' },
      { kind: 'leaf', href: '/emails',        label: 'E-mails' },
      { kind: 'leaf', href: '/tracks',        label: 'Músicas' },
      { kind: 'leaf', href: '/live',          label: 'Lives',   disabled: true },
      { kind: 'leaf', href: '/pre-save',      label: 'Presave', disabled: true },
    ],
  },

  {
    kind: 'group',
    id: 'superfans',
    label: 'Superfãs',
    icon: IconStar,
    /* Reordenado per product feedback "Materiais primeiro,
     * Fanpoints segundo, Superchat e Níveis depois". */
    children: [
      { kind: 'leaf', href: '/materiais',     label: 'Materiais' },
      { kind: 'leaf', href: '/fanpoints',     label: 'Fanpoints' },
      { kind: 'leaf', href: '/superchat',     label: 'Superchat' },
      { kind: 'leaf', href: '/niveis',        label: 'Níveis' },
    ],
  },

  {
    kind: 'group',
    id: 'growth',
    label: 'Growth',
    icon: IconTrendingUp,
    /* "Engajamento" agora vem DEPOIS de "Aquisição" e fica
     * disabled per product feedback — feature ainda no roadmap. */
    children: [
      { kind: 'leaf', href: '/convites',   label: 'Convites' },
      { kind: 'leaf', href: '/aquisicao',  label: 'Aquisição' },
      { kind: 'leaf', href: '/engagement', label: 'Engajamento', disabled: true },
    ],
  },

  {
    kind: 'group',
    id: 'site',
    label: 'Site',
    icon: IconHome,
    /* FAQ, LGPD e Footer adicionados como placeholders — cada um
     * vira CRUD próprio numa fase seguinte (precisam de schema
     * dedicado + endpoints + UI). Por enquanto os links vão pra
     * stubs em admin/(shell)/site/. */
    children: [
      { kind: 'leaf', href: '/blog',           label: 'Blog' },
      { kind: 'leaf', href: '/site/faq',       label: 'FAQ' },
      { kind: 'leaf', href: '/site/lgpd',      label: 'LGPD' },
      { kind: 'leaf', href: '/site/footer',    label: 'Footer' },
    ],
  },

  {
    kind: 'group',
    id: 'sistema',
    label: 'Sistema',
    icon: IconSettings,
    children: [
      { kind: 'leaf', href: '/settings',      label: 'Configurações' },
      { kind: 'leaf', href: '/desenvolvedor', label: 'Desenvolvedor' },
    ],
  },
];

/** Mantido fora da NAV principal — visual esmaecido + sem grupo,
 *  pinned no final da sidebar pra indicar feature em pausa. */
const FANVERSE_DISABLED: NavLeaf = {
  kind: 'leaf',
  href: '/fanverse',
  label: 'Fanverse',
  icon: IconLogo,
  disabled: true,
};

const COLLAPSED_KEY = 'admin:sidebar-collapsed';
const GROUP_STATE_KEY = 'admin:sidebar-groups';

/** Encontra qual group contém uma rota — usado pra auto-expandir
 *  o grupo quando o usuário navega pra um filho dele. */
function findOwnerGroup(pathname: string): string | null {
  for (const entry of NAV) {
    if (entry.kind !== 'group') continue;
    for (const child of entry.children) {
      if (pathname === child.href || pathname.startsWith(`${child.href}/`)) {
        return entry.id;
      }
    }
  }
  return null;
}

export default function Sidebar({ open = false }: { open?: boolean }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  /* Restaura collapsed + estado dos grupos do localStorage no mount.
   * Estado dos grupos: persistido por id pra cada admin escolher
   * quais grupos quer ver expandidos. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedCollapsed = window.localStorage.getItem(COLLAPSED_KEY);
    const nextCollapsed = storedCollapsed === '1';
    setCollapsed(nextCollapsed);
    document.documentElement.style.setProperty(
      '--sidebar-w',
      nextCollapsed ? 'var(--sidebar-w-collapsed)' : '248px',
    );

    /* Inicializa grupos: tenta localStorage; se não houver,
     * abre o grupo da rota atual + Superfãs (mais usado). */
    let initialGroups: Record<string, boolean> = {};
    const storedGroups = window.localStorage.getItem(GROUP_STATE_KEY);
    if (storedGroups) {
      try {
        initialGroups = JSON.parse(storedGroups) as Record<string, boolean>;
      } catch {
        // ignore parse errors — usa default
      }
    } else {
      initialGroups = { superfans: true };
    }
    const owner = findOwnerGroup(pathname);
    if (owner && !initialGroups[owner]) {
      initialGroups[owner] = true;
    }
    setOpenGroups(initialGroups);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Quando a rota muda (navegação interna), garante que o grupo
   * que contém ela esteja aberto. */
  useEffect(() => {
    const owner = findOwnerGroup(pathname);
    if (!owner) return;
    setOpenGroups((prev) => (prev[owner] ? prev : { ...prev, [owner]: true }));
  }, [pathname]);

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

  const toggleGroup = useCallback((id: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(GROUP_STATE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  };

  const displayName = user.name?.trim() || user.email.split('@')[0];
  const displayRole = user.role === 'admin' ? 'Admin · muusic' : 'Conta';

  /* ── Renderers ─────────────────────────────────────────────── */

  /** Item top-level COM ícone (Dashboard, Usuários, Fanverse). */
  function renderTopLeaf(item: NavLeaf) {
    const Icon = item.icon;
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const interactive = !item.disabled;
    const Wrapper: React.ElementType = interactive ? Link : 'div';
    const wrapperProps = interactive ? { href: item.href } : { 'aria-disabled': true };
    return (
      <Tooltip key={item.href} label={item.label} side="right" disabled={!collapsed}>
        <Wrapper
          {...wrapperProps}
          className={cn(
            styles.item,
            active && interactive && styles.itemActive,
            item.disabled && styles.itemDisabled,
          )}
          aria-current={active && interactive ? 'page' : undefined}
        >
          <span className={styles.itemIcon}>
            {Icon ? <Icon size={16} /> : null}
          </span>
          <span className={styles.itemLabel}>{item.label}</span>
          {typeof item.badge === 'number' && item.badge > 0 && (
            <span className={cn(styles.itemBadge, !active && styles.itemBadgeMute)}>
              {item.badge}
            </span>
          )}
        </Wrapper>
      </Tooltip>
    );
  }

  /** Item filho de um grupo (SEM ícone, indentado). */
  function renderChildLeaf(item: NavLeaf) {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(styles.child, active && styles.childActive)}
        aria-current={active ? 'page' : undefined}
      >
        <span className={styles.childLabel}>{item.label}</span>
        {typeof item.badge === 'number' && item.badge > 0 && (
          <span className={cn(styles.itemBadge, !active && styles.itemBadgeMute)}>
            {item.badge}
          </span>
        )}
      </Link>
    );
  }

  /** Group header — toggla aberto/fechado. Mostra caret. */
  function renderGroup(group: NavGroup) {
    const Icon = group.icon;
    const isOpen = openGroups[group.id] ?? false;
    /* Grupo recebe destaque visual quando alguma rota interna
     * está ativa (mesmo se collapsed) — pista de "você está aqui". */
    const owner = findOwnerGroup(pathname);
    const hasActiveChild = owner === group.id;

    /* No modo collapsed (sidebar de ícones), o "toggle" não faz
     * sentido — mostramos só o ícone do grupo num tooltip que
     * lista os filhos no hover. Por ora, simplificamos: o
     * próprio ícone clica e abre o sidebar inteiro. */
    return (
      <div key={group.id} className={styles.group}>
        <Tooltip
          label={group.label}
          side="right"
          disabled={!collapsed}
        >
          <button
            type="button"
            className={cn(
              styles.groupHeader,
              hasActiveChild && styles.groupHeaderActive,
            )}
            onClick={() => toggleGroup(group.id)}
            aria-expanded={isOpen}
            aria-controls={`sidebar-group-${group.id}`}
          >
            <span className={styles.itemIcon}>
              <Icon size={16} />
            </span>
            <span className={styles.itemLabel}>{group.label}</span>
            <span
              className={cn(
                styles.groupCaret,
                isOpen && styles.groupCaretOpen,
              )}
              aria-hidden="true"
            >
              <IconChevronDown size={12} />
            </span>
          </button>
        </Tooltip>
        {isOpen && !collapsed && (
          <div
            id={`sidebar-group-${group.id}`}
            className={styles.groupChildren}
            role="group"
            aria-label={group.label}
          >
            {group.children.map(renderChildLeaf)}
          </div>
        )}
      </div>
    );
  }

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
          {/* Orb decorativo à esquerda do wordmark — mesmo
           *  shader WebGL2 que aplicamos no /teste, na landing e
           *  no /app. aria-hidden porque é decorativo, o
           *  title="Fanverse Admin" do Link já comunica a marca. */}
          <span className={styles.brandOrb} aria-hidden="true">
            <FanverseCore />
          </span>
          {/* Wordmark "FANVERSE" SÓ no modo expandido. Quando o
           *  sidebar está collapsed (64px), o orb à esquerda já
           *  serve como marca completa — o F mini-ícone antigo
           *  virava ruído ao lado do orb. */}
          {!collapsed && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/teste-fanverse-logo.svg"
              alt="Fanverse"
              className={cn(styles.brandLogo, styles.brandLogoWordmark)}
            />
          )}
        </Link>
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

      <nav className={styles.nav} aria-label="Navegação principal">
        {NAV.map((entry) =>
          entry.kind === 'leaf' ? renderTopLeaf(entry) : renderGroup(entry),
        )}
      </nav>

      {/* Fanverse pinned no rodapé, desabilitado. `.nav` tem
       *  flex:1 e empurra naturalmente o disabled + footer pra
       *  base — sem .spacer pra não competir por espaço. */}
      <div className={styles.disabledRow}>{renderTopLeaf(FANVERSE_DISABLED)}</div>

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
