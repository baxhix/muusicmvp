'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { useAppShell } from '@/lib/app/AppShellContext';
import { useIsMobile } from '@/hooks/useIsMobile';
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
  const isMobile = useIsMobile();

  const { user } = useAuth();
  const { status, request } = locationSync;
  const hasCoords = user?.lat != null && user?.lng != null;
  const locating = status === 'requesting';

  // Mobile-only "more" popover — replaces the Perfil slot on phones
  // with a hamburger that surfaces Superfã / Minha Conta /
  // Configurações in a small floating sheet anchored above the
  // nav. Click-outside + Escape close it. Desktop keeps the
  // direct Perfil link since the right-rail already exposes
  // Superfãs and the cluster has room for a single-purpose slot.
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!moreOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (moreRef.current?.contains(e.target as Node)) return;
      setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);
  // Close the popover whenever the route changes (e.g. user picks
  // an item) — otherwise a stale sheet would linger over the next
  // surface until they tap outside.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

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

  /**
   * Toggle-style navigation — tapping a slot while already on its
   * target route routes back to `/app` (closing the surface).
   * `prefix` is checked with `startsWith` so `/app/u/[id]` still
   * resolves the Perfil slot back to /app on a second tap.
   */
  const toggleNav = (path: string, prefix = path) => {
    if (pathname === path || pathname.startsWith(prefix + '/')) {
      router.push('/app');
    } else {
      router.push(path);
    }
  };

  const handleMapClick = () => {
    // Feed is a bottom-sheet overlay over /app. If it's open, the
    // user is technically already on /app but the map is hidden
    // by the sheet — tapping the Map slot should mean "give me
    // the map back", which requires closing the Feed first.
    // Previously this branch did nothing in that state because
    // pathname === '/app' AND hasCoords passed, so we just flew
    // the camera under an invisible map.
    if (feedOpen) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app:toggle-feed'));
      }
      // Don't fall through to flyTo / route push — the user's
      // intent was "show the map", not also re-center. The next
      // tap on Map (when feed is already closed) handles centering.
      return;
    }
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

        {/* Center slot — diverges by viewport.
         *
         * Desktop: Chat (opens ConversationsSidebar route). The
         *   dock + right-rail expose Superfã in the cluster, so
         *   the center stays the most-used conversation surface.
         *
         * Mobile: Superfã (crown) — routes to /app/ranking. The
         *   dock on the right and the hamburger's "Conversas"
         *   item already cover the chat list, and product feedback
         *   wanted the crown to be the visual focal point of the
         *   navbar. */}
        {isMobile ? (
          <button
            type="button"
            className={`${styles.item} ${styles.itemCenter} ${pathname.startsWith('/app/ranking') ? styles.itemActive : ''}`}
            onClick={() => toggleNav('/app/ranking')}
            onPointerEnter={() => prefetch('/app/ranking')}
            onFocus={() => prefetch('/app/ranking')}
            aria-label={pathname.startsWith('/app/ranking') ? 'Fechar Superfãs' : 'Superfãs'}
            data-tooltip={pathname.startsWith('/app/ranking') ? 'Fechar' : 'Superfãs'}
          >
            <span className={styles.iconWrap}>
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M3.5 8.5l2 9.5h13l2-9.5-5 3.5-3.5-7-3.5 7-5-3.5z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path d="M6.5 21h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
            <span className={styles.dot} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className={`${styles.item} ${styles.itemCenter} ${onChat ? styles.itemActive : ''}`}
            onClick={() => toggleNav('/app/chat')}
            onPointerEnter={() => prefetch('/app/chat')}
            onFocus={() => prefetch('/app/chat')}
            aria-label={onChat ? 'Fechar conversas' : 'Abrir conversas'}
            data-tooltip={onChat ? 'Fechar' : 'Chat'}
          >
            <span className={styles.iconWrap}>
              {/* Speech-bubble icon — rounded rectangle with the tail
               *  pointing down-left (the standard chat affordance). The
               *  previous message-circle SVG had its winding direction
               *  flipped, which made the tail point up. */}
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6l-4 3v-3H6a2 2 0 0 1-2-2V5z"
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
        )}

        {/* Comunidade — opens CommunityPanel route. Standard users
            icon (group of three silhouettes) — the previous two-
            speech-bubble glyph was getting clipped at the bottom-
            right edge of its 22x22 viewBox. */}
        <button
          type="button"
          className={`${styles.item} ${onCommunity ? styles.itemActive : ''}`}
          onClick={() => toggleNav('/app/comunidades')}
          onPointerEnter={() => prefetch('/app/comunidades')}
          onFocus={() => prefetch('/app/comunidades')}
          aria-label={onCommunity ? 'Fechar comunidades' : 'Abrir comunidades'}
          data-tooltip={onCommunity ? 'Fechar' : 'Comunidade'}
        >
          <svg viewBox="0 0 24 24" fill="none">
            <circle
              cx="9"
              cy="8"
              r="3.5"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M2 20c1-3.5 3.6-5.5 7-5.5s6 2 7 5.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <circle
              cx="17"
              cy="9.5"
              r="2.5"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M16 14.4c1.2 0 2.3.2 3.2.7 1.5.8 2.5 2.2 2.9 4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>Comunidade</span>
        </button>

        {/* Profile slot — diverges by viewport.
         *
         * Desktop: direct Perfil link. The `/app/u/[id]` variant
         *   (other-user profile reached from globe pins / contact
         *   rows) also resolves to this slot via `onProfile`.
         *
         * Mobile: hamburger toggling a popover with Superfã /
         *   Minha Conta / Configurações. The popover anchors above
         *   the nav and dismisses on outside-click, Escape, or
         *   route change. */}
        {isMobile ? (
          <div className={styles.moreWrap} ref={moreRef}>
            <button
              type="button"
              className={`${styles.item} ${moreOpen ? styles.itemActive : ''}`}
              onClick={() => setMoreOpen((v) => !v)}
              aria-label={moreOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              data-tooltip={moreOpen ? 'Fechar' : 'Menu'}
            >
              <svg viewBox="0 0 22 22" fill="none" aria-hidden="true">
                <path
                  d="M4 6.5h14M4 11h14M4 15.5h14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <span className={styles.dot} aria-hidden="true" />
            </button>

            {moreOpen && (
              <div className={styles.moreMenu} role="menu">
                {/* Conversas — Chat moved off the navbar center on
                 *  mobile (the crown takes that slot), so this is
                 *  now the canonical entry to the full conversation
                 *  list from the bottom rail. The dock avatars on
                 *  the right still cover the 3 most recent threads. */}
                <button
                  type="button"
                  role="menuitem"
                  className={styles.moreItem}
                  onClick={() => {
                    setMoreOpen(false);
                    router.push('/app/chat');
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6l-4 3v-3H6a2 2 0 0 1-2-2V5z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Conversas
                  {chatUnreadCount > 0 && (
                    <span className={styles.moreItemBadge} aria-hidden="true">
                      {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.moreItem}
                  onClick={() => {
                    setMoreOpen(false);
                    router.push('/app/perfil');
                  }}
                >
                  <svg viewBox="0 0 22 22" fill="none" aria-hidden="true">
                    <circle cx="11" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
                    <path
                      d="M4 19c1.4-3.2 4-5 7-5s5.6 1.8 7 5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                  Minha Conta
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.moreItem}
                  onClick={() => {
                    setMoreOpen(false);
                    // No dedicated /app/configuracoes route yet —
                    // ProfilePanel hosts the editable account + the
                    // destructive actions today. Re-aim here when
                    // the settings route lands.
                    router.push('/app/perfil');
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                    <path
                      d="M19.4 13.5a1.7 1.7 0 0 1 .3 1.8l-.4 1a1.7 1.7 0 0 1-2.2.9l-.7-.3a1.7 1.7 0 0 0-1.9.4l-.4.4a1.7 1.7 0 0 0-.4 1.9l.3.7a1.7 1.7 0 0 1-.9 2.2l-1 .4a1.7 1.7 0 0 1-1.8-.3l-.6-.5a1.7 1.7 0 0 0-2 0l-.6.5a1.7 1.7 0 0 1-1.8.3l-1-.4a1.7 1.7 0 0 1-.9-2.2l.3-.7a1.7 1.7 0 0 0-.4-1.9l-.4-.4a1.7 1.7 0 0 0-1.9-.4l-.7.3a1.7 1.7 0 0 1-2.2-.9l-.4-1a1.7 1.7 0 0 1 .3-1.8l.5-.6a1.7 1.7 0 0 0 0-2l-.5-.6A1.7 1.7 0 0 1 2.4 8.7l.4-1a1.7 1.7 0 0 1 2.2-.9l.7.3a1.7 1.7 0 0 0 1.9-.4l.4-.4a1.7 1.7 0 0 0 .4-1.9l-.3-.7a1.7 1.7 0 0 1 .9-2.2l1-.4a1.7 1.7 0 0 1 1.8.3l.6.5a1.7 1.7 0 0 0 2 0l.6-.5a1.7 1.7 0 0 1 1.8-.3l1 .4a1.7 1.7 0 0 1 .9 2.2l-.3.7a1.7 1.7 0 0 0 .4 1.9l.4.4a1.7 1.7 0 0 0 1.9.4l.7-.3a1.7 1.7 0 0 1 2.2.9l.4 1a1.7 1.7 0 0 1-.3 1.8l-.5.6a1.7 1.7 0 0 0 0 2l.5.6z"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Configurações
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            className={`${styles.item} ${onProfile ? styles.itemActive : ''}`}
            onClick={() => {
              // Profile slot covers both /app/perfil (own) and
              // /app/u/[id] (other user). Either active → close
              // back to /app on tap; otherwise open own profile.
              if (onProfile) router.push('/app');
              else router.push('/app/perfil');
            }}
            onPointerEnter={() => prefetch('/app/perfil')}
            onFocus={() => prefetch('/app/perfil')}
            aria-label={onProfile ? 'Fechar perfil' : 'Abrir perfil'}
            data-tooltip={onProfile ? 'Fechar' : 'Perfil'}
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
        )}
      </div>
    </nav>
  );
}
