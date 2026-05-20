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
  const {
    feedOpen,
    setFeedOpen,
    locationSync,
    activeOverlay,
    setActiveOverlay,
    setShowPlaylist,
    setShowEditProfile,
  } = useAppShell();
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

  /**
   * Fecha qualquer overlay aberto pelos itens do hamburger ou do
   * drawer da TopBar — Playlist, Superfãs/Notificações (via
   * activeOverlay), EditProfile e Feed bottom-sheet. Cada slot da
   * navbar chama isso ANTES de executar sua própria ação, então a
   * superfície anterior some no mesmo gesto em que a nova entra,
   * per product feedback "no mobile, quando algum item que abre a
   * partir do icone hamburger estiver aberto e clicar em outro
   * item da navbar, o que estiver aberto deve ser fechado e
   * aberto o que foi clicado". O slot Feed re-abre o feedOpen
   * logo depois desse reset; os demais slots não tocam mais nele.
   */
  const dismissShellOverlays = () => {
    setActiveOverlay(null);
    setShowEditProfile(false);
    setFeedOpen(false);
    setMoreOpen(false);
  };

  const handleMapClick = () => {
    // Feed is a bottom-sheet overlay over /app. If it's open, the
    // user is technically already on /app but the map is hidden
    // by the sheet — tapping the Map slot should mean "give me
    // the map back", which requires closing the Feed first.
    const wasFeedOpen = feedOpen;
    dismissShellOverlays();
    if (wasFeedOpen) {
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

        {/* Feed — toggles the bottom-sheet directly via the shell's
            `feedOpen` state. The state survives the navigation gap
            so opening Feed from a non-/app route lands the user on
            /app WITH the panel expanded; previously we dispatched
            an `app:toggle-feed` CustomEvent that FeedPanel had to
            already be mounted to receive, which silently dropped
            the intent when crossing a route boundary. */}
        <button
          type="button"
          className={`${styles.item} ${feedOpen ? styles.itemActive : ''}`}
          onClick={() => {
            // Open the feed unconditionally — the navbar Feed slot
            // is "show me the feed", not "toggle". Closing happens
            // via the panel header's tap-to-minimize.
            // dismissShellOverlays primeiro pra qualquer Playlist/
            // EditProfile/hamburger aberto sumir, e só depois
            // setFeedOpen(true) — o reset de `feedOpen` que o
            // helper faz é batched com a abertura, então o net
            // state é feed aberto, demais fechados.
            dismissShellOverlays();
            setFeedOpen(true);
            // If we're not on /app, route there so FeedPanel actually
            // mounts and reads the now-true `feedOpen` flag.
            if (pathname !== '/app') {
              router.push('/app');
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

        {/* Center slot — Superfã crown on BOTH viewports.
         *
         * Mobile: routes to /app/ranking (toggleNav back to /app
         *   on re-tap).
         * Desktop: toggles the layered `superfans` overlay so the
         *   Feed (and anything else mounted on /app/page.tsx)
         *   stays visible behind the leaderboard — same shape as
         *   Notificações + Playlist.
         *
         * Chat displaced from this slot is reachable via the dock
         * (3 latest on the right rail) and the new chat button in
         * the right-rail cluster (desktop) / hamburger menu
         * (mobile). The `itemActive` source is derived per-mode:
         * pathname on mobile, the overlay flag on desktop. */}
        {(() => {
          const superfansActive = isMobile
            ? pathname.startsWith('/app/ranking')
            : activeOverlay === 'superfans';
          return (
            <button
              type="button"
              className={`${styles.item} ${styles.itemCenter} ${superfansActive ? styles.itemActive : ''}`}
              onClick={() => {
                if (isMobile) {
                  dismissShellOverlays();
                  toggleNav('/app/ranking');
                } else {
                  setActiveOverlay((curr) =>
                    curr === 'superfans' ? null : 'superfans',
                  );
                }
              }}
              onPointerEnter={() => isMobile && prefetch('/app/ranking')}
              onFocus={() => isMobile && prefetch('/app/ranking')}
              aria-label={superfansActive ? 'Fechar Superfãs' : 'Superfãs'}
              aria-pressed={!isMobile ? superfansActive : undefined}
              data-tooltip={superfansActive ? 'Fechar' : 'Superfãs'}
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
          );
        })()}

        {/* 4th slot — Comunidade across BOTH viewports.
         *
         * Per product feedback, Chat is no longer in the mobile
         * navbar — Comunidade takes the slot on phones too. Chat
         * stays reachable on mobile via the floating right-rail
         * Send icon (in app/app/layout.tsx, aligned with the
         * Fanpoints chip in the home header). The hamburger menu
         * also still surfaces it.
         *
         * Desktop label is shown via `.label`; mobile hides
         * `.label` globally so only the icon renders there. */}
        <button
          type="button"
          className={`${styles.item} ${onCommunity ? styles.itemActive : ''}`}
          onClick={() => { dismissShellOverlays(); toggleNav('/app/comunidades'); }}
          onPointerEnter={() => prefetch('/app/comunidades')}
          onFocus={() => prefetch('/app/comunidades')}
          aria-label={onCommunity ? 'Fechar comunidades' : 'Abrir comunidades'}
          aria-pressed={!isMobile ? onCommunity : undefined}
          data-tooltip={onCommunity ? 'Fechar' : 'Comunidade'}
        >
          <span className={styles.iconWrap}>
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
          </span>
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
              onClick={() => {
                // Fecha overlays alheios (Playlist, EditProfile,
                // Feed) antes de toggleeear o próprio menu — não
                // chamamos dismissShellOverlays porque esse
                // helper também zera moreOpen, o que conflitaria
                // com o toggle aqui (se moreOpen=true, queremos
                // que o tap feche; se false, queremos abrir).
                setActiveOverlay(null);
                setShowEditProfile(false);
                setFeedOpen(false);
                setMoreOpen((v) => !v);
              }}
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
              <>
                {/* Full-screen blurred backdrop behind the menu
                 *  per product feedback "No mobile, aplique o
                 *  efeito de blur no background no box que abre
                 *  após clicar no menu hamburguer". Sits below
                 *  the menu (z:79 vs menu z:80) but above the
                 *  rest of the app chrome so everything visible
                 *  while the menu is open softens out. Click
                 *  anywhere on the backdrop closes the menu —
                 *  same affordance the existing outside-click
                 *  listener already provides, just made tappable
                 *  edge-to-edge. */}
                <div
                  className={styles.moreBackdrop}
                  aria-hidden="true"
                  onClick={() => setMoreOpen(false)}
                />
              <div className={styles.moreMenu} role="menu">
                {/* Comunidades — demoted from the navbar's 4th slot
                 *  on mobile (Chat takes that slot now). Communities
                 *  is more of a destination users head to on purpose,
                 *  so it lives one tap deeper than the inbox-style
                 *  Chat. The standard users glyph mirrors the icon
                 *  that used to sit on the navbar. */}
                <button
                  type="button"
                  role="menuitem"
                  className={styles.moreItem}
                  onClick={() => {
                    setMoreOpen(false);
                    router.push('/app/comunidades');
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
                    <path
                      d="M2 20c1-3.5 3.6-5.5 7-5.5s6 2 7 5.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <circle cx="17" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1.6" />
                    <path
                      d="M16 14.4c1.2 0 2.3.2 3.2.7 1.5.8 2.5 2.2 2.9 4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                  Comunidades
                </button>
                {/* Playlist — opens the PlaylistModal (videos /
                  * tracks the user can scrub through). The
                  * shortcut already exists on the desktop
                  * right-rail; per product feedback the mobile
                  * hamburger now surfaces it too so users on
                  * phones don't have to round-trip through the
                  * NowPlaying mini-bar to reach the queue. */}
                <button
                  type="button"
                  role="menuitem"
                  className={styles.moreItem}
                  onClick={() => {
                    setMoreOpen(false);
                    setShowPlaylist(true);
                  }}
                >
                  {/* Music-note + bullet-list combo signals
                    * "playlist of media". Two notes on the left
                    * with a small queue indicator on the right. */}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 5h11M3 10h11M3 15h7" />
                    <path d="M17 6v9" />
                    <circle cx="15.5" cy="16.5" r="1.6" fill="currentColor" stroke="none" />
                    <circle cx="20.5" cy="14.5" r="1.6" fill="currentColor" stroke="none" />
                    <path d="M17 6l4-1" />
                  </svg>
                  Playlist
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
                  {/* Sliders icon — three horizontal tracks each
                    * carrying a filled knob at a different x
                    * position. Replaces the 8-prong gear per
                    * product feedback "mude o ícone de
                    * configurações". The sliders glyph reads
                    * as "preferences / tune" which fits the
                    * Configurações destination better than the
                    * traditional cog, AND it's a tiny path set
                    * (3 lines + 3 circles) so iOS Safari has
                    * nothing complex to rasterize. */}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="4" y1="7" x2="20" y2="7" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="17" x2="20" y2="17" />
                    <circle cx="9" cy="7" r="2.2" fill="currentColor" stroke="none" />
                    <circle cx="15" cy="12" r="2.2" fill="currentColor" stroke="none" />
                    <circle cx="11" cy="17" r="2.2" fill="currentColor" stroke="none" />
                  </svg>
                  Configurações
                </button>
              </div>
              </>
            )}
          </div>
        ) : (
          /* Desktop 5th slot = Notificações. The Perfil slot was
           * promoted out of the navbar per product feedback —
           * profile access is still one click away via the TopBar
           * avatar menu (which calls `onProfileOpen` to route to
           * /app/perfil). The Notificações button toggles the
           * `notifications` overlay just like the right-rail entry
           * used to; the NotificationBell component listens to
           * `activeOverlay` from AppShellContext, so toggling here
           * lights up the same dropdown. */
          <button
            type="button"
            className={`${styles.item} ${activeOverlay === 'notifications' ? styles.itemActive : ''}`}
            onClick={() => {
              setActiveOverlay((curr) =>
                curr === 'notifications' ? null : 'notifications',
              );
            }}
            aria-label={
              activeOverlay === 'notifications'
                ? 'Fechar notificações'
                : 'Abrir notificações'
            }
            aria-pressed={activeOverlay === 'notifications'}
            data-tooltip={
              activeOverlay === 'notifications' ? 'Fechar' : 'Notificações'
            }
          >
            <svg viewBox="0 0 22 22" fill="none">
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
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.label}>Notificações</span>
          </button>
        )}
      </div>
    </nav>
  );
}
