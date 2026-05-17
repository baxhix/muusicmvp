'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { useAppShell } from '@/lib/app/AppShellContext';
import { globeStore } from '@/lib/globeStore';
import styles from './BottomNav.module.css';

/**
 * Bottom navigation — mounted inside `/app/layout.tsx` so it
 * persists across every sibling route (chat / comunidades /
 * superchat / ranking / perfil / u/[id]).
 *
 * Phase 2 of the route refactor: each primary surface is now a
 * dedicated route. The nav navigates via `router.push` instead
 * of toggling `activeOverlay` on a singleton modal coordinator.
 * Two consequences:
 *
 *   1. Active-state lights up from `pathname` (URL is the truth)
 *      — opening Chat now changes the URL to /app/chat, the
 *      back button works, the route is deep-linkable.
 *
 *   2. Feed is the only nav slot still backed by a non-routed
 *      surface (it's a bottom-sheet over the map). It continues
 *      to fire the `app:toggle-feed` CustomEvent; its active
 *      state is read from `useAppShell().feedOpen` which the
 *      provider mirrors from the panel's own events.
 *
 * Unread DM count comes from the same provider so the red badge
 * stays accurate even when the user is on a non-chat route.
 */
export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { feedOpen, chatUnreadCount, locationSync } = useAppShell();

  const { user } = useAuth();
  const { status, request } = locationSync;
  const hasCoords = user?.lat != null && user?.lng != null;
  const locating = status === 'requesting';

  /**
   * Lightweight prefetch helper — called on pointerenter / focus
   * of each routed slot so the chunk for the target route is
   * already in flight by the time the user clicks. Next.js's
   * `<Link>` does this automatically; we're on `<button>` here,
   * so the hint is manual. No-op when already on that route.
   */
  const prefetch = (path: string) => {
    if (pathname !== path) router.prefetch(path);
  };

  const handleMapClick = () => {
    // If we're not on /app, go there first. Otherwise center the
    // map on the user (or ask for location if we don't have it).
    if (pathname !== '/app') {
      router.push('/app');
      return;
    }
    if (hasCoords && user) {
      globeStore.flyTo([user.lng as number, user.lat as number], 11);
    } else {
      request();
    }
  };

  const mapTooltip = locating
    ? 'Localizando…'
    : pathname !== '/app'
      ? 'Voltar pro mapa'
      : hasCoords
        ? 'Centralizar no meu local'
        : 'Compartilhar localização';

  // Active-state derivation — URL is the source of truth for
  // routed surfaces; the map slot only lights up when we're on
  // `/app` AND no overlay (e.g. Feed) is intercepting it.
  const onMap = pathname === '/app' && !feedOpen;
  const onChat = pathname.startsWith('/app/chat');
  const onCommunity = pathname.startsWith('/app/comunidades');
  const onProfile =
    pathname.startsWith('/app/perfil') || pathname.startsWith('/app/u/');

  return (
    <nav className={styles.nav} aria-label="Navegação principal">
      <div className={styles.inner}>
        {/* Mapa — active when no other surface is taking over. */}
        <button
          type="button"
          className={`${styles.item} ${onMap ? styles.itemActive : ''}`}
          onClick={handleMapClick}
          onPointerEnter={() => prefetch('/app')}
          onFocus={() => prefetch('/app')}
          disabled={locating}
          aria-label={mapTooltip}
          data-tooltip={mapTooltip}
        >
          <svg viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M3 11h16M11 3c-2 2.5-3 5-3 8s1 5.5 3 8M11 3c2 2.5 3 5 3 8s-1 5.5-3 8"
              stroke="currentColor"
              strokeWidth="1.6"
            />
          </svg>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>Mapa</span>
        </button>

        {/* Feed — toggles the bottom-sheet via the `app:toggle-feed`
            CustomEvent the FeedPanel listens to. Feed is a non-modal
            drawer that overlays the map, so it stays an in-page
            surface rather than a route. */}
        <button
          type="button"
          className={`${styles.item} ${feedOpen ? styles.itemActive : ''}`}
          onClick={() => {
            // If we're not on the map, drop back to /app first so
            // the FeedPanel actually exists in the tree to toggle.
            if (pathname !== '/app') {
              router.push('/app');
            }
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('app:toggle-feed'));
            }
          }}
          aria-label={feedOpen ? 'Fechar feed' : 'Abrir feed'}
          data-tooltip={feedOpen ? 'Fechar feed' : 'Feed'}
        >
          <svg viewBox="0 0 22 22" fill="none">
            <rect x="4" y="4" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M7.5 9h7M7.5 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>Feed</span>
        </button>

        {/* Chat — opens ConversationsSidebar route. The unread-count
            badge sits at the top-right of the icon when > 0. */}
        <button
          type="button"
          className={`${styles.item} ${styles.itemCenter} ${onChat ? styles.itemActive : ''}`}
          onClick={() => router.push('/app/chat')}
          onPointerEnter={() => prefetch('/app/chat')}
          onFocus={() => prefetch('/app/chat')}
          aria-label="Abrir conversas"
          data-tooltip="Chat"
        >
          <span className={styles.iconWrap}>
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M21 12a8 8 0 1 1-3.5-6.6L21 4l-1.2 3.5A7.96 7.96 0 0 1 21 12z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {chatUnreadCount > 0 && (
              <span className={styles.unreadBadge}>
                {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
              </span>
            )}
          </span>
          <span className={styles.dot} aria-hidden="true" />
        </button>

        {/* Comunidade — opens CommunityPanel route. */}
        <button
          type="button"
          className={`${styles.item} ${onCommunity ? styles.itemActive : ''}`}
          onClick={() => router.push('/app/comunidades')}
          onPointerEnter={() => prefetch('/app/comunidades')}
          onFocus={() => prefetch('/app/comunidades')}
          aria-label="Abrir comunidades"
          data-tooltip="Comunidade"
        >
          <svg viewBox="0 0 22 22" fill="none">
            <path
              d="M4 7a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H9l-3 2.5V13H6a2 2 0 0 1-2-2z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 14a2 2 0 0 0 2 2h2l2 1.5V16a2 2 0 0 0 2-2v-3"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>Comunidade</span>
        </button>

        {/* Perfil — opens ProfilePanel route (own profile). The
            `/app/u/[id]` variant is reached from globe pin clicks
            and from contact rows inside other panels. */}
        <button
          type="button"
          className={`${styles.item} ${onProfile ? styles.itemActive : ''}`}
          onClick={() => router.push('/app/perfil')}
          onPointerEnter={() => prefetch('/app/perfil')}
          onFocus={() => prefetch('/app/perfil')}
          aria-label="Abrir perfil"
          data-tooltip="Perfil"
        >
          <svg viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M4 19c1.4-3.2 4-5 7-5s5.6 1.8 7 5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>Perfil</span>
        </button>
      </div>
    </nav>
  );
}
