'use client';

import { useEffect, useState } from 'react';

/**
 * Reactive viewport check — `true` quando o viewport está no
 * range "small desktop" (laptops/monitores secundários entre
 * 769px e 1440px). É exclusivo com `useIsMobile` (≤768px).
 *
 * Usado pra trocar o ArtistBox flutuante (320px) por uma rail
 * vertical compacta de ~52px nessas resoluções, liberando
 * ~250px do canto superior esquerdo do shell pro mapa.
 *
 * SSR-safe: o primeiro render reporta `false` (assume desktop
 * largo); o effect snapa pro valor real após hidratação.
 */
const QUERY = '(min-width: 769px) and (max-width: 1490px)';

export function useIsSmallDesktop(): boolean {
  const [isSmallDesktop, setIsSmallDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(QUERY);
    setIsSmallDesktop(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsSmallDesktop(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isSmallDesktop;
}
