'use client';

import { useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import styles from './MobileRouteHeader.module.css';

/**
 * Mobile-only fixed top bar that decorates every non-home /app
 * route — chat list, comunidades, ranking, perfil, etc.
 *
 * Three jobs:
 *   1. Back arrow → router.push('/app'). Always returns to the
 *      map, regardless of how the user got to this route.
 *   2. Centered title computed from `pathname`. Keeps a consistent
 *      mobile chrome across every panel without each panel having
 *      to render its own (their internal `.header` is hidden via
 *      a `@media (max-width: 768px)` rule co-located with each
 *      panel's CSS — see SuperfansPanel, CommunityPanel, etc.).
 *   3. Drag-down gesture → router.push('/app'). The standard
 *      mobile "pull-down to dismiss the sheet" affordance — feels
 *      identical to swiping a modal away on iOS / Android.
 *
 * Mounted in /app/layout.tsx and hidden in three cases:
 *   - We're on /app itself (home gets the persistent Fanverse
 *     header instead).
 *   - We're on /app/chat WITH a conversation open — the
 *     LiveChatPanel owns the full viewport and already has its
 *     own back arrow.
 *   - We're on desktop — the persistent shell is plenty.
 *
 * Pathnames not in TITLE_MAP fall through to a generic "Voltar"
 * so deep routes never render a blank title bar.
 */

const TITLE_MAP: Record<string, string> = {
  '/app/chat': 'Conversas',
  '/app/comunidades': 'Comunidades',
  '/app/ranking': 'Superfãs',
  '/app/perfil': 'Meu Perfil',
  '/app/superchat': 'Superchat',
};

function titleFor(pathname: string): string {
  if (TITLE_MAP[pathname]) return TITLE_MAP[pathname];
  // Deep routes: /app/u/[id] → "Perfil", /app/comunidades/[slug] → "Comunidade", etc.
  if (pathname.startsWith('/app/u/')) return 'Perfil';
  if (pathname.startsWith('/app/comunidades/')) return 'Comunidade';
  if (pathname.startsWith('/app/chat/')) return 'Conversa';
  return 'Voltar';
}

// Distance (px) the user has to drag downward before we treat it
// as a "dismiss" intent. Below this we just translate the bar a
// little so the gesture feels alive, then snap it back. Above
// it, we route to /app.
const DISMISS_THRESHOLD = 80;

export default function MobileRouteHeader() {
  const pathname = usePathname();
  const router = useRouter();

  // Drag state — translateY applied to the bar while the finger
  // is down. Reset to 0 on release (success → navigate; cancel →
  // CSS transition handles the snap-back).
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  const goHome = () => router.push('/app');

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) {
      // Only react to downward movement — upward swipes shouldn't
      // do anything since there's nothing above to reveal.
      setDragY(0);
      return;
    }
    // Light rubber-band — full follow up to the threshold, then
    // resists so the bar can't be dragged arbitrarily far.
    setDragY(dy < DISMISS_THRESHOLD ? dy : DISMISS_THRESHOLD + (dy - DISMISS_THRESHOLD) * 0.3);
  };
  const onTouchEnd = () => {
    const fired = dragY >= DISMISS_THRESHOLD;
    setDragY(0);
    startY.current = null;
    if (fired) goHome();
  };

  return (
    <header
      className={styles.bar}
      style={{ transform: `translateY(${dragY}px)` }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <button
        type="button"
        className={styles.backBtn}
        onClick={goHome}
        aria-label="Voltar para o mapa"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M15 5l-7 7 7 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <h1 className={styles.title}>{titleFor(pathname)}</h1>

      {/* Spacer mirrors the back-button footprint so the title sits
       *  visually centered without using absolute positioning. */}
      <span className={styles.spacer} aria-hidden="true" />

      {/* Pull-handle hint at the bottom edge — a small grey bar
       *  that tells the user this surface can be dragged away. */}
      <span className={styles.dragHandle} aria-hidden="true" />
    </header>
  );
}
