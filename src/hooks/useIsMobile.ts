'use client';

import { useEffect, useState } from 'react';

/**
 * Reactive viewport check — `true` whenever the viewport matches
 * the muusic "mobile" breakpoint (768px or narrower). Updates
 * live when the user resizes the window or rotates the device.
 *
 * SSR-safe: the first render always reports `false` so the SSR
 * HTML matches "desktop" mode (which is the safer default — we'd
 * rather mount one extra component than miss one). The effect
 * snaps to the real value after hydration.
 */
const QUERY = '(max-width: 768px)';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(QUERY);
    setIsMobile(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    // Modern browsers + iOS Safari 14+ — addEventListener is fine.
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
