'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthContext';
import styles from './TopBar.module.css';

// Official store URL — same one previously hosted in SideBar's
// midStack icon. Kept as a module-level constant so the drawer
// item below stays a one-liner.
const STORE_URL =
  'https://lojaanacastela.com.br/?srsltid=AfmBOoqO3lURzf9V03K4wnnoPrXa2sFOUu2r7DE9TJguEVZbdzGrWpka';

/** Display name fallback chain: name → email local part → 'Usuário'. */
function displayName(user: { name: string | null; email: string } | null): string {
  if (!user) return 'Usuário';
  if (user.name && user.name.trim()) return user.name;
  return user.email.split('@')[0];
}

/* ── Helpers / shared subcomponents ─────────────────────────────────────── */

function DrawerChevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={styles.drawerChevron}>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BackArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Ícones lineares discretos para os itens do drawer */
function DrawerItemIcon({ name }: { name: 'edit' | 'activity' | 'messages' | 'map' | 'lock' | 'file' | 'shield' | 'trash' | 'logout' | 'grid' | 'bag' }) {
  const props = {
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
    className: styles.drawerItemIcon,
  };

  switch (name) {
    case 'edit':
      return (
        <svg {...props}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      );
    case 'activity':
      return (
        <svg {...props}>
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      );
    case 'messages':
      return (
        <svg {...props}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'map':
      return (
        <svg {...props}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case 'lock':
      return (
        <svg {...props}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case 'file':
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="13" x2="15" y2="13" />
          <line x1="9" y1="17" x2="15" y2="17" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...props}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...props}>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...props}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );
    case 'grid':
      // 2×2 squares — same glyph that used to live in the SideBar
      // for "Trocar universo".
      return (
        <svg {...props}>
          <rect x="3"  y="3"  width="7" height="7" rx="1.5" />
          <rect x="14" y="3"  width="7" height="7" rx="1.5" />
          <rect x="3"  y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'bag':
      // Shopping bag — same glyph that used to live in the SideBar
      // for "Loja oficial".
      return (
        <svg {...props}>
          <path d="M5 8h14l-1 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 8z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </svg>
      );
  }
}

function Toggle({
  checked,
  onChange,
  ariaLabel,
}: { checked: boolean; onChange: (v: boolean) => void; ariaLabel?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.toggleKnob} />
    </button>
  );
}

type SubScreen =
  | 'activity'
  | 'messages'
  | 'map'
  | 'terms'
  | 'privacy'
  | 'password'
  | null;

/** Mock de atividades do usuário com Fanpoints registrados */
type Activity = {
  id: string;
  icon: string;
  label: string;
  points: number;
  time: string;
  group: 'today' | 'yesterday' | 'previous';
};

const ACTIVITIES: Activity[] = [
  { id: 'a1',  icon: '🎵', label: 'Ouviu "Boiadeira" — Ana Castela',     points: 30,  time: 'há 12 min', group: 'today' },
  { id: 'a2',  icon: '💬', label: 'Iniciou conversa com Mariana L.',     points: 40,  time: 'há 1 h',    group: 'today' },
  { id: 'a3',  icon: '❤️', label: 'Reagiu a um post da comunidade',      points: 30,  time: 'há 2 h',    group: 'today' },
  { id: 'a4',  icon: '🔥', label: 'Sequência de 3 dias completa',         points: 120, time: 'há 4 h',    group: 'today' },
  { id: 'a5',  icon: '🎯', label: 'Descobriu Luan Pereira',                points: 55,  time: '14:32',     group: 'yesterday' },
  { id: 'a6',  icon: '🎪', label: 'Entrou no Fanverse de Ana Castela',    points: 70,  time: '11:08',     group: 'yesterday' },
  { id: 'a7',  icon: '🌍', label: 'Explorou 3 cidades no mapa',           points: 60,  time: '09:21',     group: 'yesterday' },
  { id: 'a8',  icon: '🎵', label: 'Ouviu 5 músicas seguidas',             points: 50,  time: 'há 2 dias', group: 'previous' },
  { id: 'a9',  icon: '👥', label: 'Conectou-se com João Pedro',           points: 80,  time: 'há 3 dias', group: 'previous' },
  { id: 'a10', icon: '⭐', label: 'Subiu para o Nível 7',                  points: 200, time: 'há 4 dias', group: 'previous' },
  { id: 'a11', icon: '🎤', label: 'Assistiu live da Ana Castela',         points: 100, time: 'há 5 dias', group: 'previous' },
  { id: 'a12', icon: '🏆', label: 'Completou perfil (foto + cidade)',     points: 100, time: 'há 1 sem.', group: 'previous' },
];

const GROUP_LABEL: Record<Activity['group'], string> = {
  today:     'Hoje',
  yesterday: 'Ontem',
  previous:  'Anteriormente',
};

/* ── Main TopBar ────────────────────────────────────────────────────────── */

interface TopBarProps {
  onProfileOpen?: () => void;
  onEditProfileOpen?: () => void;
  onDeleteAccountOpen?: () => void;
}

export default function TopBar({ onProfileOpen, onEditProfileOpen, onDeleteAccountOpen }: TopBarProps) {
  const { user, logout } = useAuth();
  const userLabel = displayName(user);
  const userEmail = user?.email ?? '';
  const userAvatar = user?.avatarUrl ?? '/ana-beatriz-avatar.png';

  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<SubScreen>(null);
  // Gate for the portal below. We can't render createPortal during
  // SSR (no document) but `typeof window !== 'undefined'` evaluates
  // DIFFERENTLY on server (false) vs client first render (true) —
  // that mismatch crashes React with hydration error #418 the moment
  // the route renders dynamically. Mount flag matches on both sides
  // because useState's initial value is identical, and only flips
  // after the first effect runs (always client-side).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const drawerRef = useRef<HTMLElement>(null);

  // Estado dos toggles persistido em localStorage
  const [allowMessages, setAllowMessages] = useState(true);
  const [showInMap, setShowInMap] = useState(false);
  const [showCity, setShowCity] = useState(true);

  // Senha (sem submissão real — é um placeholder UI)
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');

  // Reseta sub-page sempre que fechar o drawer
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => setSection(null), 320);
      return () => clearTimeout(t);
    }
  }, [open]);


  // Outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (section) setSection(null);
        else setOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, section]);

  const goBack = () => setSection(null);
  const closeAll = () => { setSection(null); setOpen(false); };

  // ── Senha — validações simples (regras do screenshot mobile) ────────────
  const pwdRules = {
    minLength: pwdNew.length >= 6,
    upper:     /[A-Z]/.test(pwdNew),
    special:   /[^A-Za-z0-9]/.test(pwdNew),
  };

  // ── Status online ────────────────────────────────────────────────────────
  const [online, setOnline] = useState(true);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  // Fecha o popover de status ao clicar fora
  useEffect(() => {
    if (!statusMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`.${styles.statusMenu}`) && !target.closest(`.${styles.drawerIdentityDot}`)) {
        setStatusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [statusMenuOpen]);

  return (
    <>
      {/* Avatar trigger — always visible */}
      <div
        className={styles.userMenu}
        onClick={() => setOpen((o) => !o)}
        role="button"
        aria-expanded={open}
        aria-label="Menu do usuário"
      >
        <div className={styles.userInfo}>
          <span className={styles.userName}>{userLabel}</span>
        </div>
        <div className={`${styles.avatar} ${online ? styles.avatarOnline : ''}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={userAvatar}
            src={userAvatar}
            alt="Meu perfil"
            className={styles.avatarImg}
          />
          {online && <span className={styles.onlineDot} />}
        </div>
      </div>

      {mounted && createPortal(
        <>
          {open && (
            <div
              className={styles.backdrop}
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
          )}

          <aside
            ref={drawerRef}
            className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`}
            aria-label="Menu do usuário"
          >
            {/* ── Container que faz slide entre menu e sub-page ── */}
            <div className={`${styles.drawerSlide} ${section ? styles.drawerSlideShifted : ''}`}>
              {/* ─────── Página 1: Menu principal ─────── */}
              <div className={styles.drawerPane}>
                <div className={styles.drawerHeader}>
                  <button
                    className={styles.closeBtn}
                    onClick={() => setOpen(false)}
                    aria-label="Fechar menu"
                  >
                    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M4 4l10 10M14 4L4 14"/>
                    </svg>
                  </button>
                </div>

                <div className={styles.drawerIdentity}>
                  <div className={styles.drawerIdentityAvatarWrap}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      key={userAvatar}
                      src={userAvatar}
                      alt="Foto de perfil"
                      className={`${styles.drawerIdentityAvatar} ${online ? styles.drawerIdentityAvatarOnline : ''}`}
                    />
                    <button
                      type="button"
                      className={`${styles.drawerIdentityDot} ${online ? styles.drawerIdentityDotOnline : ''}`}
                      onClick={() => setStatusMenuOpen(v => !v)}
                      aria-label={online ? 'Trocar status — você está online' : 'Trocar status — você está offline'}
                      aria-expanded={statusMenuOpen}
                    />
                    {statusMenuOpen && (
                      <div className={styles.statusMenu} role="menu">
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={online}
                          className={`${styles.statusOption} ${online ? styles.statusOptionActive : ''}`}
                          onClick={() => { setOnline(true); setStatusMenuOpen(false); }}
                        >
                          <span className={`${styles.statusBullet} ${styles.statusBulletOn}`} />
                          Online
                        </button>
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={!online}
                          className={`${styles.statusOption} ${!online ? styles.statusOptionActive : ''}`}
                          onClick={() => { setOnline(false); setStatusMenuOpen(false); }}
                        >
                          <span className={`${styles.statusBullet} ${styles.statusBulletOff}`} />
                          Offline
                        </button>
                      </div>
                    )}
                  </div>
                  <h2 className={styles.drawerIdentityName}>{userLabel}</h2>
                  {userEmail && (
                    <span className={styles.drawerIdentityEmail}>{userEmail}</span>
                  )}
                  <div className={styles.drawerIdentityStatusRow}>
                    <span className={`${styles.drawerStatusDot} ${online ? styles.drawerStatusDotOn : styles.drawerStatusDotOff}`} />
                    <span className={styles.drawerIdentityStatusLabel}>
                      {online ? 'Online' : 'Offline'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={online}
                      aria-label={online ? 'Ficar offline' : 'Ficar online'}
                      className={`${styles.drawerStatusToggle} ${online ? styles.drawerStatusToggleOn : ''}`}
                      onClick={() => setOnline(v => !v)}
                    >
                      <span className={styles.drawerStatusKnob} />
                    </button>
                  </div>
                </div>

                <nav className={styles.drawerNav}>
                  {/* Fanverse section — switch universe + official
                      store. Both items used to live in the SideBar's
                      vertical midStack; moved here so the left-edge
                      bar can stay focused on the logo + the dock. */}
                  <div className={styles.drawerSection}>
                    <span className={styles.drawerEyebrow}>Fanverse</span>
                    <Link
                      href="/app/select"
                      className={styles.drawerItem}
                      onClick={() => setOpen(false)}
                    >
                      <DrawerItemIcon name="grid" />
                      <span>Trocar Fanverse</span>
                      <DrawerChevron />
                    </Link>
                    <a
                      href={STORE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.drawerItem}
                      onClick={() => setOpen(false)}
                    >
                      <DrawerItemIcon name="bag" />
                      <span>Loja oficial</span>
                      <DrawerChevron />
                    </a>
                  </div>

                  <div className={styles.drawerSection}>
                    <span className={styles.drawerEyebrow}>Conta</span>
                    <button
                      className={styles.drawerItem}
                      onClick={() => { setOpen(false); onEditProfileOpen?.(); }}
                    >
                      <DrawerItemIcon name="edit" />
                      <span>Editar perfil</span>
                      <DrawerChevron />
                    </button>
                    <button
                      className={`${styles.drawerItem} ${styles.drawerItemDisabled}`}
                      disabled
                      aria-disabled="true"
                      title="Em breve"
                    >
                      <DrawerItemIcon name="activity" />
                      <span>Minha atividade</span>
                      <DrawerChevron />
                    </button>
                  </div>

                  <div className={styles.drawerSection}>
                    <span className={styles.drawerEyebrow}>Privacidade</span>
                    <button
                      className={`${styles.drawerItem} ${styles.drawerItemDisabled}`}
                      disabled
                      aria-disabled="true"
                      title="Em breve"
                    >
                      <DrawerItemIcon name="messages" />
                      <span>Mensagens</span>
                      <DrawerChevron />
                    </button>
                    <button
                      className={`${styles.drawerItem} ${styles.drawerItemDisabled}`}
                      disabled
                      aria-disabled="true"
                      title="Em breve"
                    >
                      <DrawerItemIcon name="map" />
                      <span>Mapa</span>
                      <DrawerChevron />
                    </button>
                  </div>

                  <div className={styles.drawerSection}>
                    <span className={styles.drawerEyebrow}>Segurança</span>
                    <button
                      className={`${styles.drawerItem} ${styles.drawerItemDisabled}`}
                      disabled
                      aria-disabled="true"
                      title="Em breve"
                    >
                      <DrawerItemIcon name="lock" />
                      <span>Alterar senha</span>
                      <DrawerChevron />
                    </button>
                  </div>

                  <div className={styles.drawerSection}>
                    <span className={styles.drawerEyebrow}>Legal</span>
                    <button
                      className={`${styles.drawerItem} ${styles.drawerItemDisabled}`}
                      disabled
                      aria-disabled="true"
                      title="Em breve"
                    >
                      <DrawerItemIcon name="file" />
                      <span>Termos de Uso</span>
                      <DrawerChevron />
                    </button>
                    <button
                      className={`${styles.drawerItem} ${styles.drawerItemDisabled}`}
                      disabled
                      aria-disabled="true"
                      title="Em breve"
                    >
                      <DrawerItemIcon name="shield" />
                      <span>Política de Privacidade</span>
                      <DrawerChevron />
                    </button>
                    <button
                      className={`${styles.drawerItem} ${styles.drawerItemDelete} ${styles.drawerItemDisabled}`}
                      disabled
                      aria-disabled="true"
                      title="Em breve"
                    >
                      <DrawerItemIcon name="trash" />
                      <span>Excluir conta</span>
                    </button>
                  </div>
                </nav>

                <div className={styles.drawerFooter}>
                  <div className={styles.drawerDivider} />
                  <button
                    className={`${styles.drawerItem} ${styles.drawerItemLogout}`}
                    onClick={() => {
                      closeAll();
                      logout();
                    }}
                  >
                    <DrawerItemIcon name="logout" />
                    <span>Sair</span>
                  </button>
                </div>
              </div>

              {/* ─────── Página 2: Sub-screen ─────── */}
              <div className={styles.drawerPane}>
                {section === 'activity' && (() => {
                  const groups: Activity['group'][] = ['today', 'yesterday', 'previous'];
                  const totalFP = 3480;
                  return (
                    <SubScreenWrap title="Minha atividade" onBack={goBack}>
                      <div className={styles.activitySummary}>
                        <span className={styles.activitySummaryNum}>
                          {totalFP.toLocaleString('pt-BR')}
                        </span>
                        <span className={styles.activitySummaryLabel}>Fanpoints acumulados</span>
                        <span className={styles.activitySummaryLevel}>Nível 7</span>
                      </div>

                      {groups.map((g) => {
                        const items = ACTIVITIES.filter((a) => a.group === g);
                        if (items.length === 0) return null;
                        return (
                          <div key={g} className={styles.activityGroup}>
                            <span className={styles.activityGroupLabel}>{GROUP_LABEL[g]}</span>
                            <div className={styles.activityList}>
                              {items.map((a) => (
                                <div key={a.id} className={styles.activityItem}>
                                  <div className={styles.activityInfo}>
                                    <span className={styles.activityLabel}>{a.label}</span>
                                    <span className={styles.activityTime}>{a.time}</span>
                                  </div>
                                  <span className={styles.activityPoints}>+{a.points}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </SubScreenWrap>
                  );
                })()}

                {section === 'messages' && (
                  <SubScreenWrap title="Mensagens" onBack={goBack}>
                    <SettingRow
                      title="Permitir envio de mensagens"
                      description="Isso deixa o botão ativo para o usuário enviar uma mensagem para você."
                    >
                      <Toggle
                        checked={allowMessages}
                        onChange={setAllowMessages}
                        ariaLabel="Permitir envio de mensagens"
                      />
                    </SettingRow>
                  </SubScreenWrap>
                )}

                {section === 'map' && (
                  <SubScreenWrap title="Mapa" onBack={goBack}>
                    <SettingRow
                      title="Aparecer no Mapa"
                      description="Mostra seu perfil no mapa para outros usuários quando a localização está ativa."
                    >
                      <Toggle
                        checked={showInMap}
                        onChange={setShowInMap}
                        ariaLabel="Aparecer no Mapa"
                      />
                    </SettingRow>
                    <SettingRow
                      title="Mostrar Cidade"
                      description="Mostra a cidade que você está ao permitir a localização."
                    >
                      <Toggle
                        checked={showCity}
                        onChange={setShowCity}
                        ariaLabel="Mostrar Cidade"
                      />
                    </SettingRow>

                    <h4 className={styles.subSectionTitle}>Importante</h4>
                    <p className={styles.subBody}>
                      Para proteger você, sua localização dentro do app nunca será exibida de forma exata.
                    </p>
                    <p className={styles.subBody}>
                      Em vez disso, ela aparece de forma aproximada, alternando entre diferentes pontos
                      dentro da cidade que você está (ou que você escolher).
                    </p>
                    <p className={styles.subBody}>
                      Além disso, o app não armazena sua localização atual. Tudo é tratado de forma temporária,
                      apenas para viabilizar a experiência, sem histórico ou rastreamento. Isso significa que
                      ninguém consegue identificar onde você realmente está, apenas a região geral. Você continua
                      aproveitando toda a experiência da plataforma com mais segurança e tranquilidade.
                    </p>
                  </SubScreenWrap>
                )}

                {section === 'terms' && (
                  <SubScreenWrap title="Termos de Uso" onBack={goBack}>
                    <p className={styles.subBody}>
                      Última atualização: maio de 2026.
                    </p>
                    <p className={styles.subBody}>
                      Bem-vindo ao Fanverse. Ao criar uma conta e usar nossos serviços, você concorda com
                      os termos descritos abaixo. Leia com atenção — esses termos definem como você pode
                      usar a plataforma, seus direitos como usuário e as regras de convivência da comunidade.
                    </p>
                    <h4 className={styles.subSectionTitle}>1. Aceitação dos termos</h4>
                    <p className={styles.subBody}>
                      Ao acessar e utilizar o Fanverse, você concorda em cumprir estes termos. Se não
                      concordar com qualquer parte, por favor não utilize o serviço.
                    </p>
                    <h4 className={styles.subSectionTitle}>2. Uso responsável</h4>
                    <p className={styles.subBody}>
                      Você se compromete a usar o Fanverse de forma respeitosa, sem postar conteúdo
                      ilegal, ofensivo ou que viole direitos de terceiros. Comportamentos abusivos podem
                      levar à suspensão ou exclusão da conta.
                    </p>
                    <h4 className={styles.subSectionTitle}>3. Conteúdo do usuário</h4>
                    <p className={styles.subBody}>
                      Você mantém os direitos sobre o conteúdo que publica, mas concede ao Fanverse uma
                      licença para exibir esse conteúdo dentro da plataforma. Conteúdo que viole leis ou
                      direitos autorais será removido.
                    </p>
                    <h4 className={styles.subSectionTitle}>4. Modificações</h4>
                    <p className={styles.subBody}>
                      Estes termos podem ser atualizados periodicamente. Mudanças relevantes serão
                      notificadas dentro do app.
                    </p>
                  </SubScreenWrap>
                )}

                {section === 'privacy' && (
                  <SubScreenWrap title="Política de Privacidade" onBack={goBack}>
                    <p className={styles.subBody}>
                      Última atualização: maio de 2026.
                    </p>
                    <p className={styles.subBody}>
                      A privacidade dos nossos usuários é prioridade absoluta. Esta política descreve quais
                      dados coletamos, como tratamos essas informações, e quais são seus direitos.
                    </p>
                    <h4 className={styles.subSectionTitle}>1. Dados que coletamos</h4>
                    <p className={styles.subBody}>
                      Coletamos informações de cadastro (nome, e-mail, data de nascimento), dados de uso
                      do app, e — quando você autoriza — sua localização aproximada. Sua localização exata
                      nunca é armazenada.
                    </p>
                    <h4 className={styles.subSectionTitle}>2. Como usamos</h4>
                    <p className={styles.subBody}>
                      Usamos seus dados para personalizar sua experiência (descobrir fãs próximos, mostrar
                      atividade na sua região), garantir segurança da plataforma, e melhorar nossos serviços.
                    </p>
                    <h4 className={styles.subSectionTitle}>3. Compartilhamento</h4>
                    <p className={styles.subBody}>
                      Não vendemos seus dados. Compartilhamos apenas o estritamente necessário com
                      provedores de infraestrutura (hosting, análise) sob acordos de confidencialidade.
                    </p>
                    <h4 className={styles.subSectionTitle}>4. Seus direitos</h4>
                    <p className={styles.subBody}>
                      Você pode acessar, corrigir, exportar ou excluir seus dados a qualquer momento. Em
                      caso de dúvida ou solicitação, entre em contato pelo nosso canal de suporte.
                    </p>
                  </SubScreenWrap>
                )}

                {section === 'password' && (
                  <SubScreenWrap title="Alterar senha" onBack={goBack}>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Senha:</label>
                      <input
                        type="password"
                        className={styles.fieldInput}
                        placeholder="Digite a sua senha atual"
                        value={pwdCurrent}
                        onChange={(e) => setPwdCurrent(e.target.value)}
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Nova senha:</label>
                      <input
                        type="password"
                        className={styles.fieldInput}
                        placeholder="Digite a nova senha"
                        value={pwdNew}
                        onChange={(e) => setPwdNew(e.target.value)}
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Confirme sua nova senha:</label>
                      <input
                        type="password"
                        className={styles.fieldInput}
                        placeholder="Confirme a sua nova senha"
                        value={pwdConfirm}
                        onChange={(e) => setPwdConfirm(e.target.value)}
                      />
                    </div>
                    <h4 className={styles.subSectionTitle}>Sua senha precisa ter:</h4>
                    <ul className={styles.rulesList}>
                      <li className={pwdRules.minLength ? styles.ruleOk : styles.ruleFail}>
                        • No mínimo 6 caracteres;
                      </li>
                      <li className={pwdRules.upper ? styles.ruleOk : styles.ruleFail}>
                        • Pelo menos 1 letra maiúscula;
                      </li>
                      <li className={pwdRules.special ? styles.ruleOk : styles.ruleFail}>
                        • Pelo menos 1 caractere especial (ex: @ # $ %)
                      </li>
                    </ul>
                  </SubScreenWrap>
                )}

              </div>
            </div>
          </aside>
        </>,
        document.body
      )}
    </>
  );
}

/* ── Sub-screen helpers ─────────────────────────────────────────────────── */

function SubScreenWrap({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className={styles.subHeader}>
        <button className={styles.subBackBtn} onClick={onBack} aria-label="Voltar">
          <BackArrow />
        </button>
        <h3 className={styles.subTitle}>{title}</h3>
        <span className={styles.subHeaderSpacer} aria-hidden="true" />
      </div>
      <div className={styles.subBodyWrap}>{children}</div>
    </>
  );
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.settingRow}>
      <div className={styles.settingRowTop}>
        <span className={styles.settingTitle}>{title}</span>
        {children}
      </div>
      <p className={styles.settingDesc}>{description}</p>
    </div>
  );
}
