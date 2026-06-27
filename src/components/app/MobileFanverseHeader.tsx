'use client';

import FanverseCore from '@/components/animations/FanverseCore';
import styles from './MobileFanverseHeader.module.css';

/** Abre o Fanverse Search (mesmo gatilho do orbe nas outras surfaces). */
function openSearch() {
  try {
    window.dispatchEvent(new CustomEvent('app:open-fanverse-search'));
  } catch {
    /* SSR */
  }
}

/**
 * Header mobile — VARIAÇÃO 2 (A/B). Recriação do zero.
 *
 * Box dark flutuante (overlay fixo) com preenchimento em gradiente
 * translúcido + frosted glass, e o orbe no lado direito. Textos entram
 * nas próximas etapas.
 */
export default function MobileFanverseHeader() {
  return (
    <header className={styles.header} aria-label="Fanverse Ana Castela">
      {/* Orbe — lado direito, centralizado verticalmente. */}
      <button
        type="button"
        className={styles.orb}
        onClick={openSearch}
        aria-label="Abrir Fanverse Search"
      >
        <FanverseCore />
      </button>
    </header>
  );
}
