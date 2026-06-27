'use client';

import FanverseCore from '@/components/animations/FanverseCore';
import styles from './MobileFanverseHeader.module.css';

/** Recorte da Ana (fundo transparente) dentro do box. */
const HEADER_IMAGE = '/img-ana-header.png';

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
 * translúcido + frosted glass, a imagem da Ana (recorte) deslocada à
 * direita do centro, e o orbe no canto inferior-direito. Textos entram
 * nas próximas etapas.
 */
export default function MobileFanverseHeader() {
  return (
    <header className={styles.header} aria-label="Fanverse Ana Castela">
      {/* Imagem da Ana — altura do box, começando 30px à direita do centro. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={HEADER_IMAGE} alt="Ana Castela" className={styles.heroImg} />

      {/* Orbe — lado direito, mais pra baixo. */}
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
