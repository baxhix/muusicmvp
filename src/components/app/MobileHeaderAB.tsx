'use client';

import { useIsMobile } from '@/hooks/useIsMobile';
import MobileFanverseHeader from './MobileFanverseHeader';

/**
 * Header MOBILE da home (/app).
 *
 * O A/B com a Opção 1 (MobileHomeChrome) foi encerrado: a Opção 2
 * (MobileFanverseHeader) é o header definitivo. O seletor "Opção 1 /
 * Opção 2" foi removido.
 *
 * Só mobile — no desktop o filho já retornaria null, mas saímos cedo.
 */
export default function MobileHeaderAB() {
  const isMobile = useIsMobile();
  if (!isMobile) return null;
  return <MobileFanverseHeader />;
}
