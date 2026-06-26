'use client';

import { useAuth } from '@/lib/auth/AuthContext';
import { useAppShell } from '@/lib/app/AppShellContext';
import styles from './DesktopTopBar.module.css';

/**
 * Barra superior fixa do DESKTOP (oculta no mobile via CSS).
 *
 * Full-width, colada no topo, 46px, preta com 75% de transparência —
 * deixa o fundo aparecer ao rolar. Na extremidade direita: avatar do
 * usuário logado (36×36) + sino de notificações (movido do TopBar
 * flutuante, que agora fica oculto no desktop). À esquerda do
 * avatar/sino, da direita p/ a esquerda: Ajuda (inativo), Minha conta
 * (abre o drawer), Ranking (abre o modal Ranking Fanverse).
 *
 * Reaproveita os gatilhos existentes:
 *   - `app:open-account-drawer` → TopBar abre o drawer "Minha conta".
 *   - `app:open-ranking-store` (screen 'ranking') → RankingStoreModal.
 *   - `activeOverlay='notifications'` (AppShell) → NotificationBell.
 */
export default function DesktopTopBar() {
  const { user } = useAuth();
  const { activeOverlay, setActiveOverlay } = useAppShell();
  const avatar = user?.avatarUrl ?? '/avatar-placeholder.svg';
  const notifOpen = activeOverlay === 'notifications';
  // Visível no mapa (location_consent) → bolinha verde; senão cinza.
  const online = Boolean(user?.locationConsent);

  const openDrawer = () =>
    window.dispatchEvent(new CustomEvent('app:open-account-drawer'));
  const openRanking = () =>
    window.dispatchEvent(
      new CustomEvent('app:open-ranking-store', { detail: { screen: 'ranking' } }),
    );

  return (
    <header className={styles.bar} role="banner">
      <nav className={styles.cluster} aria-label="Menu do topo">
        {/* Itens — DOM esq→dir: Ranking, Minha conta, Ajuda.
            Visual (dir→esq a partir do avatar): Ajuda, Minha conta, Ranking. */}
        <button type="button" className={styles.link} onClick={openRanking}>
          Ranking
        </button>
        <button type="button" className={styles.link} onClick={openDrawer}>
          Minha conta
        </button>
        <button
          type="button"
          className={`${styles.link} ${styles.linkDisabled}`}
          disabled
          aria-disabled="true"
          title="Em breve"
        >
          Ajuda
        </button>

        {/* Sino de notificações (movido do TopBar). O marker
            data-overlay-toggle é lido pelo NotificationBell pra ignorar
            outside-click neste trigger. */}
        <button
          type="button"
          className={`${styles.notifBtn} ${notifOpen ? styles.notifBtnActive : ''}`}
          data-overlay-toggle="notifications"
          onClick={() =>
            setActiveOverlay((curr) =>
              curr === 'notifications' ? null : 'notifications',
            )
          }
          aria-label={notifOpen ? 'Fechar notificações' : 'Abrir notificações'}
          aria-pressed={notifOpen}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Avatar do usuário logado — borda + bolinha on/offline +
            seta pra baixo (affordance de clicável). Abre o drawer. */}
        <button
          type="button"
          className={styles.avatarBtn}
          onClick={openDrawer}
          aria-label="Minha conta"
        >
          <span className={styles.avatarWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatar} alt="" className={styles.avatarImg} />
            <span
              className={`${styles.onlineDot} ${online ? '' : styles.onlineDotOff}`}
              aria-hidden="true"
            />
          </span>
          <svg
            className={styles.chevron}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
      </nav>
    </header>
  );
}
