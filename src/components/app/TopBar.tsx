'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthContext';
import RankMedallion from './RankMedallion';
import { useRankBands } from './RankBandsProvider';
import { useAppShell } from '@/lib/app/AppShellContext';
import { useDisplaySetting, DISPLAY_KEYS } from '@/hooks/useDisplaySetting';
import { resetOnboarding } from '@/lib/onboarding';
import { api } from '@/lib/api/client';
import { track } from '@/lib/analytics';
import LegalDocumentModal, { type LegalKind } from './LegalDocumentModal';
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

function DrawerChevron({ open }: { open?: boolean } = {}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`${styles.drawerChevron}${open ? ` ${styles.drawerChevronOpen}` : ''}`}
    >
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
function DrawerItemIcon({ name }: { name: 'edit' | 'activity' | 'messages' | 'map' | 'lock' | 'file' | 'shield' | 'trash' | 'logout' | 'grid' | 'bag' | 'superchat' | 'info' | 'star' | 'invite' | 'settings' }) {
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
    case 'info':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
    case 'settings':
      // Engrenagem (Feather "settings") — agrupador Configurações.
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case 'star':
      // Estrela 5 pontas — usada no item Fanpoints. Mesmo glyph
      // do item Fanpoints no hamburger menu (BottomNav) pra
      // consistência visual entre as duas entradas.
      return (
        <svg {...props}>
          <path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.9 6.7 19.6l1.1-6L3.4 9.4l6-.8L12 3z" />
        </svg>
      );
    case 'invite':
      // Pessoa + "+" — convidar amigos (loop viral).
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="22" y1="11" x2="16" y2="11" />
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
    case 'superchat':
      // Play-triangle glyph — same shape used in the removed
      // top-right SuperchatTrigger pill, so the Superchat
      // identity reads consistently wherever the link surfaces.
      // Filled to differentiate from the outline-style chat
      // bubble used for the disabled "Mensagens" item below.
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className={styles.drawerItemIcon}
        >
          <path d="M7 4.5v15l12-7.5z" />
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
  disabled,
}: { checked: boolean; onChange: (v: boolean) => void; ariaLabel?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`${styles.toggle} ${checked ? styles.toggleOn : ''} ${disabled ? styles.toggleDisabled : ''}`}
      onClick={() => { if (!disabled) onChange(!checked); }}
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
  | 'settings'
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
  const { user, logout, refresh } = useAuth();
  const { rankOf } = useRankBands();
  /* Per product feedback "as notificações vão para cima, ao lado
   * esquerdo da imagem do usuário no topo superior direito" —
   * trazemos o bell pro topo. Toggle do mesmo flag
   * `activeOverlay === 'notifications'` que o BottomNav usava antes;
   * o NotificationBell component continua escutando esse flag
   * pra abrir/fechar o painel correspondente. */
  const { activeOverlay, setActiveOverlay } = useAppShell();
  const notifOpen = activeOverlay === 'notifications';

  /* Toggles de exibição (persistidos via useDisplaySetting →
   * localStorage + CustomEvent). Per product feedback "controle
   * de exibição do card de nível de zoom + itens de brainstorm
   * dentro de Configurações". Defaults: zoom indicator visível,
   * brainstorm triggers visíveis. */
  const [showZoomIndicator, setShowZoomIndicator] = useDisplaySetting(
    DISPLAY_KEYS.zoomIndicator,
    true,
  );
  const [showBrainstormTriggers, setShowBrainstormTriggers] = useDisplaySetting(
    DISPLAY_KEYS.brainstormTriggers,
    true,
  );
  const userLabel = displayName(user);
  // Generic placeholder silhouette for brand-new users who
  // haven't uploaded a profile photo yet. The previous fallback
  // was an actual person's photo (/ana-beatriz-avatar.png),
  // which made new accounts look like they belonged to someone
  // else; the placeholder is a neutral SVG silhouette in /public.
  const userAvatar = user?.avatarUrl ?? '/avatar-placeholder.svg';

  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<SubScreen>(null);
  /* Modal in-app pra Termos / Privacidade. Aberto via item do
   * drawer (seção Legal). null = fechado. Mantido fora do drawer
   * pra que fechar o drawer não desmonte o modal involuntariamente. */
  const [legalModalKind, setLegalModalKind] = useState<LegalKind | null>(null);
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

  /* Consentimento de localização (LGPD) — real, persistido em
   * users.location_consent. Espelha user.locationConsent com update
   * otimista; o toggle fica desabilitado pra menores (que nunca
   * compartilham localização). Revogar só desliga o flag (as coords
   * ficam guardadas, escondidas) e tira o usuário do mapa na hora;
   * religar mostra de novo. A captura inicial das coords é feita pelo
   * LocationSync headless no /app. */
  const isMinor = Boolean(user?.isMinor);
  const [locationConsent, setLocationConsent] = useState(
    Boolean(user?.locationConsent),
  );
  const [consentBusy, setConsentBusy] = useState(false);
  useEffect(() => {
    setLocationConsent(Boolean(user?.locationConsent));
  }, [user?.locationConsent]);

  async function handleLocationConsentToggle(next: boolean) {
    if (consentBusy || isMinor) return;
    setLocationConsent(next); // otimista
    setConsentBusy(true);
    try {
      await api.patch('/api/me/location-consent', { consent: next });
      if (next) {
        track('location_consent_granted', { surface: 'settings' });
      } else {
        track('location_consent_revoked', {});
      }
      await refresh();
    } catch {
      setLocationConsent(!next); // rollback
    } finally {
      setConsentBusy(false);
    }
  }

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

  /* Listener pro CustomEvent disparado pelo hamburger menu do
   * BottomNav (mobile) — item "Configurações" abre o mesmo drawer
   * que o avatar abre no desktop. Per product feedback "no mobile
   * o item Configurações deve ir para a tela que na versão desktop
   * abre detalhes da Conta, Privacidade, Segurança, Legal e Sair". */
  useEffect(() => {
    const onOpenDrawer = () => setOpen(true);
    window.addEventListener('app:open-account-drawer', onOpenDrawer);
    return () => window.removeEventListener('app:open-account-drawer', onOpenDrawer);
  }, []);

  const goBack = () => setSection(null);
  const closeAll = () => { setSection(null); setOpen(false); };

  // ── Senha — validações simples (regras do screenshot mobile) ────────────
  const pwdRules = {
    minLength: pwdNew.length >= 6,
    upper:     /[A-Z]/.test(pwdNew),
    special:   /[^A-Za-z0-9]/.test(pwdNew),
  };

  // Status "Online" removido per product feedback (era mocado — só
  // estado local sem efeito real). No lugar, a identidade do drawer
  // expõe o toggle real de visibilidade no mapa (location_consent).

  return (
    <>
      {/* Avatar trigger — always visible.
          The "Olá, <name>!" label that used to sit next to the
          avatar was removed per product feedback — the drawer
          opened by clicking still shows the full display name +
          email, so identity stays one tap away. */}
      <div
        className={styles.userMenu}
        onClick={() => setOpen((o) => !o)}
        role="button"
        aria-expanded={open}
        aria-label="Menu do usuário"
      >
        {/* Bell de notificações — à esquerda do avatar per product
         * feedback. stopPropagation no click impede que o handler
         * do userMenu wrapper (abrir drawer) dispare junto.
         * `data-overlay-toggle="notifications"` é o marker que o
         * NotificationBell escuta pra ignorar outside-click neste
         * trigger (evita flap aberto/fechado). */}
        <button
          type="button"
          className={`${styles.notifBtn} ${notifOpen ? styles.notifBtnActive : ''}`}
          data-overlay-toggle="notifications"
          onClick={(e) => {
            e.stopPropagation();
            setActiveOverlay((curr) =>
              curr === 'notifications' ? null : 'notifications',
            );
          }}
          aria-label={notifOpen ? 'Fechar notificações' : 'Abrir notificações'}
          aria-pressed={notifOpen}
        >
          <svg viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path
              d="M5 9a6 6 0 0 1 12 0v3.4l1.4 2.6H3.6L5 12.4Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M9 18a2 2 0 0 0 4 0"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <div className={styles.avatar}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={userAvatar}
            src={userAvatar}
            alt="Meu perfil"
            className={styles.avatarImg}
          />
          {/* Medalhão de rank — meu próprio status, se Top 10. */}
          <RankMedallion position={rankOf(user?.id)} size="sm" />
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
                      className={styles.drawerIdentityAvatar}
                    />
                  </div>
                  <h2 className={styles.drawerIdentityName}>{userLabel}</h2>

                  {/* Fanpoints + posição no ranking — logo abaixo do nome,
                   *  linkando pro ranking (/app/ranking). */}
                  <Link
                    href="/app/ranking"
                    className={styles.drawerFanpoints}
                    onClick={closeAll}
                  >
                    <strong>236.354</strong> Fanpoints
                    <span className={styles.drawerFanpointsRank}>(Top 1!)</span>
                  </Link>

                  {/* Aparecer no mapa — visibilidade REAL no mapa
                   *  (consentimento LGPD, location_consent). Substituiu o
                   *  antigo toggle "Online" (que era só estado local
                   *  mocado, sem efeito). Mesmo flag do "Aparecer no mapa"
                   *  do Meu Perfil; update otimista + PATCH
                   *  /api/me/location-consent. Aqui vem com mais contexto
                   *  pro usuário entender o que liga/desliga. */}
                  <div className={styles.drawerMapRow}>
                    <div className={styles.drawerMapText}>
                      <span className={styles.drawerMapTitle}>Aparecer no mapa</span>
                      <span className={styles.drawerMapDesc}>
                        {isMinor ? (
                          'Indisponível para menores de 18 anos.'
                        ) : (
                          <>
                            Mostra você no mapa para outros fãs com{' '}
                            <strong className={styles.bold}>
                              localização aleatória em raio de 25 Km
                            </strong>{' '}
                            ao redor da cidade que você selecionou.{' '}
                            <strong className={styles.bold}>Nunca a exata</strong>.
                          </>
                        )}
                      </span>
                    </div>
                    <Toggle
                      checked={locationConsent}
                      onChange={handleLocationConsentToggle}
                      disabled={isMinor || consentBusy}
                      ariaLabel="Aparecer no mapa"
                    />
                  </div>
                  {!isMinor && (
                    <p className={styles.drawerMapNote}>
                      <strong className={styles.bold}>
                        Sua localização nunca é exibida de forma exata
                      </strong>{' '}
                      e não fica armazenada em nosso banco de dados — aparece
                      somente em uma região randômica, alternando entre pontos
                      dentro da cidade de sua escolha. Sua segurança em primeiro
                      lugar.
                    </p>
                  )}
                </div>

                <nav className={styles.drawerNav}>
                  {/* Fanverse section retired per product feedback —
                      both items ("Trocar Fanverse" + "Loja oficial")
                      were hidden from the drawer. The Loja URL is
                      still surfaced from the ArtistBox discount
                      badge ("15% OFF na Loja da Boiadeira") and the
                      universe switcher (/app/select) is still
                      reachable via direct URL when needed. Keeping
                      the markup commented out here in a single
                      block so wiring it back is a one-liner if the
                      product direction changes.

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
                  */}

                  {/* Superchat link — moved IN here per product
                      feedback ("Remova o botão Entre no Superchat
                      e inclua esse link dentro do menu ao abrir
                      clicando na imagem lateral do usuário"). The
                      separate top-right SuperchatTrigger pill that
                      used to live at .superchatTriggerSlot is gone;
                      this menu entry is the new entry point. The
                      play-triangle icon matches the glyph from the
                      removed pill so the Superchat visual identity
                      stays consistent across the app. */}
                  <div className={styles.drawerSection}>
                    <span className={styles.drawerEyebrow}>Fanverse</span>
                    {/* Fanpoints — abre o FanpointsModal global. Per
                     * spec "inclua o item Fanpoints no menu geral,
                     * que abre ao clicar na imagem do usuário logado
                     * no topo direito". Mesmo evento que o trigger
                     * do .metaPoints do fold e do item Fanpoints
                     * no hamburger menu (BottomNav) — mantém UX
                     * consistente. */}
                    <button
                      type="button"
                      className={styles.drawerItem}
                      onClick={() => {
                        setOpen(false);
                        try {
                          window.dispatchEvent(new CustomEvent('app:open-fanpoints'));
                        } catch { /* SSR — ignore */ }
                      }}
                    >
                      <DrawerItemIcon name="star" />
                      <span>Fanpoints</span>
                      <DrawerChevron />
                    </button>
                    {/* Convidar amigos — loop viral (Item 6). Abre o
                     * InviteFriendsModal (mount global no layout) via
                     * CustomEvent. */}
                    <button
                      type="button"
                      className={styles.drawerItem}
                      onClick={() => {
                        setOpen(false);
                        try {
                          window.dispatchEvent(new CustomEvent('app:open-invite'));
                        } catch { /* SSR — ignore */ }
                      }}
                    >
                      <DrawerItemIcon name="invite" />
                      <span className={styles.drawerItemGrow}>Convidar amigos</span>
                      <span className={styles.drawerItemHint}>ganhe 300 Fanpoints</span>
                      <DrawerChevron />
                    </button>
                    {/* "Entre no Superchat" foi movido pro Brainstorm
                        (trigger no left-rail da home, gated por
                        flags.superchat) per product feedback. */}
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
                    {/* Configurações — abre como sub-tela deslizante
                     *  (section === 'settings', mesmo mecanismo das
                     *  outras sub-screens) com seta de voltar, em vez
                     *  de expandir inline embaixo. */}
                    <button
                      type="button"
                      className={styles.drawerItem}
                      onClick={() => setSection('settings')}
                    >
                      <DrawerItemIcon name="settings" />
                      <span>Configurações</span>
                      <DrawerChevron />
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
                {/* Configurações — sub-tela deslizante (seta de voltar +
                 *  título), reusando o mesmo slide das demais
                 *  sub-screens. Agrupa Atividade, Exibição, Privacidade,
                 *  Segurança e Legal num único nível, em vez de expandir
                 *  inline no menu principal. */}
                {section === 'settings' && (
                  <>
                    <div className={styles.subHeader}>
                      <button className={styles.subBackBtn} onClick={goBack} aria-label="Voltar">
                        <BackArrow />
                      </button>
                      <h3 className={styles.subTitle}>Configurações</h3>
                      <span className={styles.subHeaderSpacer} aria-hidden="true" />
                    </div>
                    <nav className={styles.drawerNav}>
                      <div className={styles.drawerSection}>
                        <span className={styles.drawerEyebrow}>Atividade</span>
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

                      {/* Per product feedback: controle de exibição do card
                       *  de nível de zoom + itens de brainstorm como toggles
                       *  (persistidos em localStorage via useDisplaySetting). */}
                      <div className={styles.drawerSection}>
                        <span className={styles.drawerEyebrow}>Exibição</span>
                        <div className={styles.drawerToggleRow}>
                          <div className={styles.drawerToggleText}>
                            <span className={styles.drawerToggleTitle}>
                              Indicador de zoom
                            </span>
                            <span className={styles.drawerToggleDesc}>
                              Mostra o nível de zoom atual sobre o mapa
                            </span>
                          </div>
                          <Toggle
                            checked={showZoomIndicator}
                            onChange={setShowZoomIndicator}
                            ariaLabel="Exibir indicador de zoom"
                          />
                        </div>
                        <div className={styles.drawerToggleRow}>
                          <div className={styles.drawerToggleText}>
                            <span className={styles.drawerToggleTitle}>
                              Recursos em teste
                            </span>
                            <span className={styles.drawerToggleDesc}>
                              Esconde os botões de brainstorm na tela inicial
                            </span>
                          </div>
                          <Toggle
                            checked={showBrainstormTriggers}
                            onChange={setShowBrainstormTriggers}
                            ariaLabel="Exibir recursos em teste"
                          />
                        </div>
                        {/* Refazer tour de onboarding — apaga o flag
                         *  localStorage e re-dispara os 3 tooltips. */}
                        <button
                          type="button"
                          className={styles.drawerItem}
                          onClick={() => {
                            resetOnboarding();
                            setActiveOverlay(null);
                          }}
                        >
                          <DrawerItemIcon name="info" />
                          <span>Refazer tour de onboarding</span>
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
                        {/* Termos + Privacidade abrem como MODAL dentro do
                         *  app (LegalDocumentModal). Conteúdo via
                         *  GET /api/legal/:kind (publicado em /admin/site/lgpd). */}
                        <button
                          type="button"
                          className={styles.drawerItem}
                          onClick={() => {
                            closeAll();
                            setLegalModalKind('terms_of_use');
                          }}
                        >
                          <DrawerItemIcon name="file" />
                          <span>Termos de Uso</span>
                          <DrawerChevron />
                        </button>
                        <button
                          type="button"
                          className={styles.drawerItem}
                          onClick={() => {
                            closeAll();
                            setLegalModalKind('privacy_policy');
                          }}
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
                  </>
                )}

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
                    {isMinor ? (
                      <p className={styles.subBody}>
                        O compartilhamento de localização não está disponível
                        para menores de 18 anos.
                      </p>
                    ) : (
                      <SettingRow
                        title="Compartilhar localização"
                        description="Mostra seu perfil no mapa para outros fãs (localização aproximada — nunca exata). Desligar esconde você do mapa na hora; religar mostra de novo."
                      >
                        <Toggle
                          checked={locationConsent}
                          onChange={handleLocationConsentToggle}
                          ariaLabel="Compartilhar localização"
                        />
                      </SettingRow>
                    )}

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

      {/* Modal in-app de Termos / Privacidade — fica fora do
       *  createPortal acima pra que fechar o drawer (closeAll) NÃO
       *  desmonte o modal. Disparado por dois items da seção Legal
       *  do drawer. Conteúdo via GET /api/legal/:kind. */}
      <LegalDocumentModal
        open={legalModalKind !== null}
        kind={legalModalKind ?? 'terms_of_use'}
        onClose={() => setLegalModalKind(null)}
      />
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
