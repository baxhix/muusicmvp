'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useIsMobile } from '@/hooks/useIsMobile';
import styles from './MobileHomeChrome.module.css';

/**
 * Mobile-only solid background + secondary info bar for the
 * /app home view.
 *
 * Renders three stacked horizontal strips at the very top of
 * the viewport:
 *
 *   - Header background (y:0 → 68): solid black band that
 *     sits behind the right-rail Notif/Send cluster, so the
 *     two icons share a continuous surface instead of looking
 *     like loose floating chrome. ArtistBox is hidden on
 *     mobile (see ArtistBox.module.css) — its Fanpoints chip
 *     moved into the info bar below.
 *   - Gray divider (1px) at y:68.
 *   - Info bar (y:69 → 105): the user's Fanpoints with the
 *     amber crown icon on the left, secondary live state
 *     (online-fan count) on the right.
 *
 * Unmounts on desktop and on every non-home route.
 */
export default function MobileHomeChrome() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.id ?? null);
  const fanpoints = profile?.fanpoints ?? 0;
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? 'fã';
  // Avatar source — uses the auth user's uploaded avatar if any,
  // otherwise falls back to the generic placeholder we ship at
  // /public/avatar-placeholder.svg. Same fallback the rest of
  // the app uses for new accounts.
  const avatarSrc = user?.avatarUrl ?? '/avatar-placeholder.svg';

  if (!isMobile) return null;

  return (
    <div className={styles.chrome} aria-hidden="false">
      <div className={styles.headerBg} aria-hidden="true" />
      <div className={styles.brand} aria-hidden="false">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-ana.png"
          alt="Ana Castela"
          className={styles.logo}
        />
        {/* Fanverse SVG brand mark — upgraded from the previous
            small "FANVERSE" text wordmark per product feedback
            ("Insira o logotipo Fanverse, que tem quando o usuário
            insere o email, na home"). Same asset that the auth
            email-entry surface uses, sized down here so it stays
            secondary to the Ana Castela logo above. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fanverse-logo.svg"
          alt="Fanverse"
          className={styles.brandLogo}
        />
      </div>
      <div
        className={styles.infoBar}
        role="status"
        aria-label={`Olá, ${firstName}. Você tem ${fanpoints.toLocaleString('pt-BR')} Fanpoints`}
      >
        {/* Greeting row on the LEFT — now a clickable button that
          * routes to the settings / profile surface. Carries a
          * profile-photo miniature (24×24, same size as the
          * listening_together stack avatars) + the "Olá, X!"
          * greeting. The dedicated /app/configuracoes route
          * doesn't exist yet so the click goes to /app/perfil,
          * matching the BottomNav hamburger's "Configurações"
          * entry. */}
        <button
          type="button"
          className={styles.greetingBtn}
          onClick={() => router.push('/app/perfil')}
          aria-label={`Olá, ${firstName} — abrir configurações`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarSrc}
            alt=""
            className={styles.greetingAvatar}
          />
          {/* "Olá, X" wrapped in a single inline-flow span — the
            * `.greetingBtn` flex gap only separates the AVATAR
            * from the text now, not "Olá," from the name. Inside
            * the wrapper a literal space character produces the
            * natural word-space between label and name. */}
          <span className={styles.greetingText}>
            <span className={styles.greetingLabel}>Olá,</span>{' '}
            <span className={styles.greetingName}>{firstName}!</span>
          </span>
        </button>
        {/* Fanpoints chip on the RIGHT — now a clickable button
          * that routes to the Superfãs / Ranking surface. */}
        <button
          type="button"
          className={styles.fanpointsChip}
          onClick={() => router.push('/app/ranking')}
          aria-label={`Você tem ${fanpoints.toLocaleString('pt-BR')} Fanpoints — abrir Superfãs`}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2.5 19h19l-1.5-9-5 3.5L12 6l-3 7.5L4 10l-1.5 9z" />
          </svg>
          <span className={styles.fanpointsValue}>
            {fanpoints.toLocaleString('pt-BR')}
          </span>
          <span className={styles.fanpointsLabel}>Fanpoints</span>
        </button>
      </div>
    </div>
  );
}
