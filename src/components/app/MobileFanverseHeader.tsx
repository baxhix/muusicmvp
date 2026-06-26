'use client';

import styles from './MobileFanverseHeader.module.css';

/** Arte completa do header (composição pronta — fundo + Ana + gradiente). */
const HEADER_IMAGE = '/header.webp';

/**
 * Header mobile — VARIAÇÃO 2 (A/B).
 *
 * Agora é APENAS a arte (header.webp) como background full-bleed, sem
 * nenhum conteúdo sobreposto — texto (Fanverse/Ana Castela/Fanpoints) e
 * orbe foram removidos per feedback "passa a ser apenas a imagem como
 * background". Overlay fixo no topo (não empurra o globo da home).
 */
export default function MobileFanverseHeader() {
  return (
    <header className={styles.header}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={HEADER_IMAGE} alt="Ana Castela" className={styles.heroImg} />
    </header>
  );
}
