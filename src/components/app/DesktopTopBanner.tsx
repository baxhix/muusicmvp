'use client';

import { useIsMobile } from '@/hooks/useIsMobile';
import styles from './DesktopTopBanner.module.css';

/* ============================================================
 * DESKTOP TOP BANNER — Ana Castela / Fire Arena
 *
 * Banner promocional fixo no topo da viewport desktop, 640px
 * de largura com altura proporcional. Sombra dark dá volume.
 *
 * Imagem: `/public/banner-anacastela.png` (proporção ~6.69:1,
 * fundo escuro com elementos rosa neon). Salvar a arte nessa
 * pasta com esse nome substitui o conteúdo sem mexer no code.
 *
 * Hidden no mobile via `useIsMobile()` — o phone viewport já
 * tem o `MobileHomeChrome` ocupando o topo e não comporta o
 * banner sem competir por atenção.
 * ============================================================ */

export default function DesktopTopBanner() {
  const isMobile = useIsMobile();
  if (isMobile) return null;
  return (
    <div className={styles.banner} role="img" aria-label="Ana Castela — Fire Arena">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/banner-anacastela.png"
        alt="Ana Castela — Fire Arena"
        className={styles.image}
        loading="eager"
      />
    </div>
  );
}
